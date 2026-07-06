import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import api from "../../api/client";
import RoofMappingStep from "./RoofMappingStep";
import ObstructionMappingStep from "./ObstructionMappingStep";
import Viewer from "./3d/Viewer";
import SVGCanvas from "./SVGCanvas";
import { generateUUID, calculateArea, isPointInPolygon } from "../../utils/design/coords";
import { buildLiveSceneData } from "../../utils/design/sceneDataBuilder";
import type { SceneData, LocalObject } from "../../utils/design/types";

/**
 * Interface representing a custom frontend mapped roof layout structure.
 */
export interface RoofData {
	id: string;
	name: string;
	height: number;
	points: [number, number][]; // in meters [x, y]
	area: number;
	parapetEnabled: boolean;
	parapetHeight: number;
	parapetThickness: number;
	parapetSetback: number;
}

interface UnifiedDesignStepProps {
	sitevisitId: string;
	widthMeters: number;
	heightMeters: number;
	imageUrl: string;
	initialRoofs: RoofData[];
	initialObjects: LocalObject[];
	stage: number;
	onSaveStatusChange?: (saving: boolean) => void;
	sceneData?: SceneData | null;
	onContinue?: () => void;
}

export default function UnifiedDesignStep({
	sitevisitId,
	widthMeters,
	heightMeters,
	imageUrl,
	initialRoofs,
	initialObjects,
	stage,
	onSaveStatusChange,
	sceneData,
	onContinue,
}: UnifiedDesignStepProps) {

	// ────────────────────────────────────────────────────────────────────────
	// SHARED DATA STATES
	// ────────────────────────────────────────────────────────────────────────
	const [roofs, setRoofs] = useState<RoofData[]>(initialRoofs);
	const [objects, setObjects] = useState<LocalObject[]>(initialObjects);

	// Selection & Mode States
	const [selectedRoofId, setSelectedRoofId] = useState<string | null>(null);
	const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

	// Drawing States
	const [isDrawingRoofs, setIsDrawingRoofs] = useState(false);
	const [objectDrawingMode, setObjectDrawingMode] = useState<"none" | "ac_unit" | "mumtee" | "water_tank" | "tree" | "wall" | "polygon">("none");

	const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
	const [mousePosMeters, setMousePosMeters] = useState<[number, number] | null>(null);
	const [wallStartPoint, setWallStartPoint] = useState<[number, number] | null>(null);

	// Dragging states (unified)
	const [activeDrag, setActiveDrag] = useState<{
		type: "roof-vertex" | "object" | "object-vertex";
		targetId: string;
		vertexIndex?: number;
		startMousePos: [number, number];
		originalState: any;
	} | null>(null);

	// Viewport Transform States (Zoom/Pan is preserved across steps!)
	const [scale, setScale] = useState(1);
	const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const panStart = useRef({ x: 0, y: 0 });

	// Saving States
	const [savingRoofs, setSavingRoofs] = useState(false);
	const [savingObjects, setSavingObjects] = useState(false);

	const viewportRef = useRef<HTMLDivElement>(null);
	const innerContainerRef = useRef<HTMLDivElement>(null);

	// Debounce and auto-save state controllers
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestRoofsRef = useRef(roofs);
	const saveObjectsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestObjectsRef = useRef(objects);
	
	useEffect(() => {
		latestRoofsRef.current = roofs;
	}, [roofs]);

	useEffect(() => {
		latestObjectsRef.current = objects;
	}, [objects]);

	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
				saveRoofDesign(latestRoofsRef.current);
			}
			if (saveObjectsTimeoutRef.current) {
				clearTimeout(saveObjectsTimeoutRef.current);
				saveObjectsDesign(latestObjectsRef.current);
			}
		};
	}, []);

	// Coordinate Converters: SVG percentage (0-100) <-> real-world meters
	const pxToMX = (px: number) => (px / 100) * widthMeters;
	const pxToMY = (px: number) => (px / 100) * heightMeters;

	// Keep parent updated with saving state changes
	useEffect(() => {
		onSaveStatusChange?.(savingRoofs || savingObjects);
	}, [savingRoofs, savingObjects, onSaveStatusChange]);

	// Sync initial data from workspace
	useEffect(() => {
		setRoofs(initialRoofs);
	}, [initialRoofs]);

	useEffect(() => {
		setObjects(initialObjects);
	}, [initialObjects]);

	// ────────────────────────────────────────────────────────────────────────
	// SAVE CALLS
	// ────────────────────────────────────────────────────────────────────────
	const saveRoofDesignDebounced = (currentRoofsList = roofs) => {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}
		saveTimeoutRef.current = setTimeout(() => {
			saveRoofDesign(currentRoofsList);
			saveTimeoutRef.current = null;
		}, 2000);
	};

	const saveRoofDesign = async (currentRoofsList = roofs) => {
		if (!sitevisitId) return;
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		setSavingRoofs(true);
		try {
			const payloadRoofs: Record<string, { name: string; height: number; area: number; roof: [number, number][] }> = {};
			const payloadWalls: Record<string, { name: string; z_init: number; z_end: number; roof_id: string; p1: [number, number]; p2: [number, number]; thickness: number; setback: number }> = {};
			
			let wallCounter = 0;

			currentRoofsList.forEach((r) => {
				payloadRoofs[r.id] = {
					name: r.name,
					height: r.height,
					area: r.area,
					roof: r.points,
				};

				if (r.parapetEnabled) {
					for (let i = 0; i < r.points.length; i++) {
						const p1 = r.points[i];
						const p2 = r.points[(i + 1) % r.points.length];
						const wallId = generateUUID();
						wallCounter++;

						payloadWalls[wallId] = {
							name: `Wall ${wallCounter}`,
							z_init: r.height,
							z_end: r.height + r.parapetHeight,
							roof_id: r.id,
							p1,
							p2,
							thickness: r.parapetThickness,
							setback: r.parapetSetback,
						};
					}
				}
			});

			await api.post("/visit/roof/create", {
				sitevisit_id: sitevisitId,
				roofs: payloadRoofs,
				walls: payloadWalls,
			});
		} catch (e) {
			console.error("Failed to save roof design payload", e);
		} finally {
			setSavingRoofs(false);
		}
	};

	const saveObjectsDesignDebounced = (list: LocalObject[]) => {
		if (saveObjectsTimeoutRef.current) {
			clearTimeout(saveObjectsTimeoutRef.current);
		}
		saveObjectsTimeoutRef.current = setTimeout(() => {
			saveObjectsDesign(list);
			saveObjectsTimeoutRef.current = null;
		}, 2000);
	};

	const saveObjectsDesign = async (list: LocalObject[]) => {
		if (saveObjectsTimeoutRef.current) {
			clearTimeout(saveObjectsTimeoutRef.current);
			saveObjectsTimeoutRef.current = null;
		}
		try {
			setSavingObjects(true);
			const objectsDict: Record<string, any> = {};

			list.forEach((obj) => {
				const item: any = {
					name: obj.name,
					type: obj.type,
					tag: obj.tag || undefined,
					roof_id: obj.roof_id || undefined,
					on_roof: obj.on_roof,
					cast_shadow: obj.cast_shadow,
					center_x: obj.center_x,
					center_y: obj.center_y,
					z_init: obj.z_init,
					z_end: obj.z_end,
					length: obj.type === "cuboid" ? obj.length : undefined,
					width: obj.type === "cuboid" ? obj.width : undefined,
					angle: obj.type === "cuboid" ? obj.angle : undefined,
					radius: (obj.type === "cylinder" || obj.type === "tree") ? obj.radius : undefined,
					p1: obj.type === "wall" ? obj.p1 || undefined : undefined,
					p2: obj.type === "wall" ? obj.p2 || undefined : undefined,
					thickness: obj.type === "wall" ? obj.thickness : undefined,
					polygon: obj.type === "polygon" ? obj.polygon || undefined : undefined,
				};
				objectsDict[obj.id] = item;
			});

			await api.post("/visit/objects/create", {
				sitevisit_id: sitevisitId,
				objects: objectsDict,
			});
		} catch (error) {
			console.error("Failed to save objects design:", error);
		} finally {
			setSavingObjects(false);
		}
	};

	// Compile active state lists (roofs, objects) into the structured payload expected by the 3D Viewer
	const liveSceneData = useMemo(() => {
		return buildLiveSceneData(sceneData, roofs, objects, stage);
	}, [sceneData, roofs, objects, stage]);

	// ────────────────────────────────────────────────────────────────────────
	// VIEWPORT ZOOM & PAN
	// ────────────────────────────────────────────────────────────────────────
	const handleWheel = (e: React.WheelEvent) => {
		const zoomIntensity = 0.08;
		e.preventDefault();
		const zoomFactor = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
		setScale((prev) => Math.max(0.4, Math.min(prev * zoomFactor, 6)));
	};

	const zoomIn2D = () => {
		setScale((prev) => Math.min(prev + 0.15, 6));
	};

	const zoomOut2D = () => {
		setScale((prev) => Math.max(prev - 0.15, 0.4));
	};

	const getMouseMeters = (e: React.MouseEvent): [number, number] => {
		if (!innerContainerRef.current) return [0, 0];
		const rect = innerContainerRef.current.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * 100;
		const py = ((e.clientY - rect.top) / rect.height) * 100;
		return [pxToMX(px), pxToMY(py)];
	};

	// ────────────────────────────────────────────────────────────────────────
	// MOUSE EVENT LIFECYCLE
	// ────────────────────────────────────────────────────────────────────────
	const handleMouseDown = (e: React.MouseEvent) => {
		if (e.button === 2) return; // Right click

		const target = e.target as SVGElement;
		const isVertex = target.classList.contains("vertex-handle");
		const isObject = target.classList.contains("object-handle");

		if (!isVertex && !isObject) {
			setIsPanning(true);
			panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
		}
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		const [mx, my] = getMouseMeters(e);
		setMousePosMeters([mx, my]);

		if (isPanning) {
			setPanOffset({
				x: e.clientX - panStart.current.x,
				y: e.clientY - panStart.current.y,
			});
			return;
		}

		if (activeDrag) {
			const dx = mx - activeDrag.startMousePos[0];
			const dy = my - activeDrag.startMousePos[1];
			const orig = activeDrag.originalState;

			if (activeDrag.type === "roof-vertex" && activeDrag.vertexIndex !== undefined) {
				const updatedRoofs = roofs.map((r) => {
					if (r.id !== activeDrag.targetId) return r;
					const nextPoints = [...r.points];
					nextPoints[activeDrag.vertexIndex!] = [
						orig.points[activeDrag.vertexIndex!][0] + dx,
						orig.points[activeDrag.vertexIndex!][1] + dy,
					];
					return {
						...r,
						points: nextPoints,
						area: calculateArea(nextPoints),
					};
				});
				setRoofs(updatedRoofs);
						} else if (activeDrag.type === "object") {
				const updatedObjs = objects.map((obj) => {
					if (obj.id !== activeDrag.targetId) return obj;

					if (obj.type === "cuboid" || obj.type === "cylinder" || obj.type === "tree") {
						const nextX = orig.center_x + dx;
						const nextY = orig.center_y + dy;
						
						const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
						const onRoof = !!snapRoof;
						const roofId = snapRoof ? snapRoof.id : undefined;
						const zInit = snapRoof ? snapRoof.height : 0;
						const objHeight = orig.z_end - orig.z_init;

						return {
							...obj,
							center_x: nextX,
							center_y: nextY,
							on_roof: onRoof,
							roof_id: roofId,
							z_init: zInit,
							z_end: zInit + objHeight,
						};
					} else if (obj.type === "wall" && orig.p1 && orig.p2) {
						const nextP1: [number, number] = [orig.p1[0] + dx, orig.p1[1] + dy];
						const nextP2: [number, number] = [orig.p2[0] + dx, orig.p2[1] + dy];
						const nextX = (nextP1[0] + nextP2[0]) / 2;
						const nextY = (nextP1[1] + nextP2[1]) / 2;

						const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
						const onRoof = !!snapRoof;
						const roofId = snapRoof ? snapRoof.id : undefined;
						const zInit = snapRoof ? snapRoof.height : 0;
						const objHeight = orig.z_end - orig.z_init;

						return {
							...obj,
							p1: nextP1,
							p2: nextP2,
							center_x: nextX,
							center_y: nextY,
							on_roof: onRoof,
							roof_id: roofId,
							z_init: zInit,
							z_end: zInit + objHeight,
						};
					} else if (obj.type === "polygon" && orig.polygon) {
						const translatedPoly = orig.polygon.map((p: [number, number]) => [p[0] + dx, p[1] + dy] as [number, number]);
						const nextX = translatedPoly.reduce((acc: number, p: [number, number]) => acc + p[0], 0) / translatedPoly.length;
						const nextY = translatedPoly.reduce((acc: number, p: [number, number]) => acc + p[1], 0) / translatedPoly.length;

						const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
						const onRoof = !!snapRoof;
						const roofId = snapRoof ? snapRoof.id : undefined;
						const zInit = snapRoof ? snapRoof.height : 0;
						const objHeight = orig.z_end - orig.z_init;

						return {
							...obj,
							polygon: translatedPoly,
							center_x: nextX,
							center_y: nextY,
							on_roof: onRoof,
							roof_id: roofId,
							z_init: zInit,
							z_end: zInit + objHeight,
						};
					}
					return obj;
				});
				setObjects(updatedObjs);
			} else if (activeDrag.type === "object-vertex" && activeDrag.vertexIndex !== undefined) {
				const updatedObjs = objects.map((obj) => {
					if (obj.id !== activeDrag.targetId) return obj;

					if (obj.type === "wall" && orig.p1 && orig.p2) {
						const p1 = activeDrag.vertexIndex === 0 ? [mx, my] as [number, number] : orig.p1;
						const p2 = activeDrag.vertexIndex === 1 ? [mx, my] as [number, number] : orig.p2;
						const nextX = (p1[0] + p2[0]) / 2;
						const nextY = (p1[1] + p2[1]) / 2;

						const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
						const onRoof = !!snapRoof;
						const roofId = snapRoof ? snapRoof.id : undefined;
						const zInit = snapRoof ? snapRoof.height : 0;
						const objHeight = orig.z_end - orig.z_init;

						return {
							...obj,
							p1,
							p2,
							center_x: nextX,
							center_y: nextY,
							on_roof: onRoof,
							roof_id: roofId,
							z_init: zInit,
							z_end: zInit + objHeight,
						};
					} else if (obj.type === "polygon" && orig.polygon) {
						const nextPoly = [...orig.polygon];
						nextPoly[activeDrag.vertexIndex!] = [mx, my];
						const nextX = nextPoly.reduce((acc: number, p: [number, number]) => acc + p[0], 0) / nextPoly.length;
						const nextY = nextPoly.reduce((acc: number, p: [number, number]) => acc + p[1], 0) / nextPoly.length;

						const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
						const onRoof = !!snapRoof;
						const roofId = snapRoof ? snapRoof.id : undefined;
						const zInit = snapRoof ? snapRoof.height : 0;
						const objHeight = orig.z_end - orig.z_init;

						return {
							...obj,
							polygon: nextPoly,
							center_x: nextX,
							center_y: nextY,
							on_roof: onRoof,
							roof_id: roofId,
							z_init: zInit,
							z_end: zInit + objHeight,
						};
					}
					return obj;
				});
				setObjects(updatedObjs);
			}
		}
	};

	const handleMouseUp = () => {
		setIsPanning(false);
		if (activeDrag) {
			if (activeDrag.type === "roof-vertex") {
				saveRoofDesign(roofs);
			} else if (activeDrag.type === "object") {
				const obj = objects.find((o) => o.id === activeDrag.targetId);
				const isStrictlyOnRoof = obj && ["ac_unit", "mumtee", "water_tank"].includes(obj.tag || obj.type);
				if (obj && isStrictlyOnRoof && !obj.on_roof) {
					const restored = objects.map((o) => {
						if (o.id === obj.id) {
							return {
								...o,
								center_x: activeDrag.originalState.center_x,
								center_y: activeDrag.originalState.center_y,
								on_roof: activeDrag.originalState.on_roof,
								roof_id: activeDrag.originalState.roof_id,
								z_init: activeDrag.originalState.z_init,
								z_end: activeDrag.originalState.z_end,
							};
						}
						return o;
					});
					setObjects(restored);
					saveObjectsDesign(restored);
					setActiveDrag(null);
					alert("This object (AC unit, tank, or stair cabin) must remain inside a mapped roof boundary.");
					return;
				}
				saveObjectsDesign(objects);
			} else {
				saveObjectsDesign(objects);
			}
			setActiveDrag(null);
		}
	};

	const handleMouseLeave = () => {
		setIsPanning(false);
		setActiveDrag(null);
	};

	// ────────────────────────────────────────────────────────────────────────
	// DRAG TRIGGERS
	// ────────────────────────────────────────────────────────────────────────
	const startDraggingRoofVertex = (e: React.MouseEvent, roofId: string, ptIdx: number) => {
		e.stopPropagation();
		if (isDrawingRoofs || stage !== 2) return;

		setSelectedRoofId(roofId);
		const roof = roofs.find((r) => r.id === roofId);
		if (!roof) return;

		const mousePos = getMouseMeters(e);
		setActiveDrag({
			type: "roof-vertex",
			targetId: roofId,
			vertexIndex: ptIdx,
			startMousePos: mousePos,
			originalState: JSON.parse(JSON.stringify(roof)),
		});
	};

	const startDraggingObject = (e: React.MouseEvent, objId: string) => {
		e.stopPropagation();
		if (objectDrawingMode !== "none" || stage !== 3) return;

		setSelectedObjectId(objId);
		const obj = objects.find((o) => o.id === objId);
		if (!obj) return;

		const mousePos = getMouseMeters(e);
		setActiveDrag({
			type: "object",
			targetId: objId,
			startMousePos: mousePos,
			originalState: JSON.parse(JSON.stringify(obj)),
		});
	};

	const startDraggingObjectVertex = (e: React.MouseEvent, objId: string, vIdx: number) => {
		e.stopPropagation();
		if (objectDrawingMode !== "none" || stage !== 3) return;

		const obj = objects.find((o) => o.id === objId);
		if (!obj) return;

		const mousePos = getMouseMeters(e);
		setActiveDrag({
			type: "object-vertex",
			targetId: objId,
			vertexIndex: vIdx,
			startMousePos: mousePos,
			originalState: JSON.parse(JSON.stringify(obj)),
		});
	};

	// ────────────────────────────────────────────────────────────────────────
	// CANVAS CLICKS (DRAWING CREATIONS)
	// ────────────────────────────────────────────────────────────────────────
	const handleCanvasClick = (e: React.MouseEvent) => {
		const [mx, my] = getMouseMeters(e);

		// ── STAGE 2: ROOF BOUNDARY DRAWING ──
		if (stage === 2 && isDrawingRoofs) {
			const isFirstPointClose = currentPoints.length > 0 &&
				Math.hypot(mx - currentPoints[0][0], my - currentPoints[0][1]) < 0.8;

			if (isFirstPointClose && currentPoints.length >= 3) {
				// Close roof outline
				const newRoof: RoofData = {
					id: generateUUID("roof"),
					name: `Roof Boundary ${roofs.length + 1}`,
					height: 3.5,
					points: currentPoints,
					area: calculateArea(currentPoints),
					parapetEnabled: false,
					parapetHeight: 1.0,
					parapetThickness: 0.23,
					parapetSetback: 0.0,
				};
				const updated = [...roofs, newRoof];
				setRoofs(updated);
				setSelectedRoofId(newRoof.id);
				setCurrentPoints([]);
				setIsDrawingRoofs(false);
				saveRoofDesign(updated);
			} else {
				setCurrentPoints([...currentPoints, [mx, my]]);
			}
			return;
		}

		// ── STAGE 3: OBSTRUCTION PLACEMENT ──
		if (stage === 3 && objectDrawingMode !== "none") {
			// VALIDATION RULE: Don't let objects be placed unless there is a roof planned
			if (roofs.length === 0) {
				setObjectDrawingMode("none");
				setCurrentPoints([]);
				setWallStartPoint(null);
				return;
			}

			if (objectDrawingMode === "ac_unit" || objectDrawingMode === "mumtee" || objectDrawingMode === "water_tank" || objectDrawingMode === "tree") {
				let type: "cuboid" | "cylinder" | "tree" = "cuboid";
				let tag: string | undefined = undefined;
				let name = "";
				let length = 2, width = 2, radius = 1;

				if (objectDrawingMode === "ac_unit") {
					type = "cuboid";
					tag = undefined;
					const count = objects.filter((o) => o.type === "cuboid" && o.tag !== "mumtee").length + 1;
					name = `AC Unit ${count}`;
					length = 1.2;
					width = 0.8;
				} else if (objectDrawingMode === "mumtee") {
					type = "cuboid";
					tag = "mumtee";
					const count = objects.filter((o) => o.tag === "mumtee").length + 1;
					name = `Mumtee ${count}`;
					length = 4;
					width = 3.5;
				} else if (objectDrawingMode === "water_tank") {
					type = "cylinder";
					tag = "cylinder_tank";
					const count = objects.filter((o) => o.tag === "cylinder_tank").length + 1;
					name = `Cylinder Tank ${count}`;
					radius = 0.8;
				} else if (objectDrawingMode === "tree") {
					type = "tree";
					tag = "mango";
					const count = objects.filter((o) => o.type === "tree").length + 1;
					name = `Generic Tree ${count}`;
					radius = 2.5;
				}

				const snapRoof = roofs.find((r) => isPointInPolygon([mx, my], r.points));
				const isStrictlyOnRoof = ["ac_unit", "mumtee", "water_tank"].includes(objectDrawingMode);
				if (isStrictlyOnRoof && !snapRoof) {
					alert("This object (AC unit, tank, or stair cabin) must be placed inside a mapped roof boundary.");
					return;
				}

				const isStrictlyOffRoof = objectDrawingMode === "tree";
				const onRoof = isStrictlyOffRoof ? false : !!snapRoof;
				const roofId = onRoof ? snapRoof?.id : undefined;
				const zInit = onRoof ? (snapRoof?.height || 0) : 0;
				const defaultHeight = type === "tree" ? 5 : 2.5;

				const newObj: LocalObject = {
					id: generateUUID("obj"),
					name,
					type,
					tag,
					roof_id: roofId,
					on_roof: onRoof,
					cast_shadow: true,
					center_x: mx,
					center_y: my,
					z_init: zInit,
					z_end: zInit + defaultHeight,
					length,
					width,
					angle: 0,
					radius,
					p1: undefined,
					p2: undefined,
					thickness: 0.23,
					polygon: undefined,
				};
				const updated = [...objects, newObj];
				setObjects(updated);
				setSelectedObjectId(newObj.id);
				setObjectDrawingMode("none");
				saveObjectsDesign(updated);
			} else if (objectDrawingMode === "wall") {
				if (!wallStartPoint) {
					setWallStartPoint([mx, my]);
				} else {
					const count = objects.filter((o) => o.type === "wall").length + 1;
					const nextX = (wallStartPoint[0] + mx) / 2;
					const nextY = (wallStartPoint[1] + my) / 2;
					
					const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
					const onRoof = !!snapRoof;
					const roofId = snapRoof ? snapRoof.id : undefined;
					const zInit = snapRoof ? snapRoof.height : 0;
					const defaultHeight = 1.5;

					const newWall: LocalObject = {
						id: generateUUID("obj"),
						name: `Wall ${count}`,
						type: "wall",
						tag: undefined,
						roof_id: roofId,
						on_roof: onRoof,
						cast_shadow: true,
						center_x: nextX,
						center_y: nextY,
						z_init: zInit,
						z_end: zInit + defaultHeight,
						length: 0,
						width: 0,
						angle: 0,
						radius: 0,
						p1: wallStartPoint,
						p2: [mx, my],
						thickness: 0.23,
						polygon: undefined,
					};
					const updated = [...objects, newWall];
					setObjects(updated);
					setSelectedObjectId(newWall.id);
					setWallStartPoint(null);
					setObjectDrawingMode("none");
					saveObjectsDesign(updated);
				}
			} else if (objectDrawingMode === "polygon") {
				const isFirstPoint = currentPoints.length > 0 &&
					Math.hypot(mx - currentPoints[0][0], my - currentPoints[0][1]) < 0.8;

				if (isFirstPoint && currentPoints.length >= 3) {
					const polyCenter: [number, number] = [
						currentPoints.reduce((acc, p) => acc + p[0], 0) / currentPoints.length,
						currentPoints.reduce((acc, p) => acc + p[1], 0) / currentPoints.length,
					];
					const count = objects.filter((o) => o.type === "polygon").length + 1;
					
					const snapRoof = roofs.find((r) => isPointInPolygon(polyCenter, r.points));
					const onRoof = !!snapRoof;
					const roofId = snapRoof ? snapRoof.id : undefined;
					const zInit = snapRoof ? snapRoof.height : 0;
					const defaultHeight = 2.5;

					const newPoly: LocalObject = {
						id: generateUUID("obj"),
						name: `Polygon ${count}`,
						type: "polygon",
						tag: undefined,
						roof_id: roofId,
						on_roof: onRoof,
						cast_shadow: true,
						center_x: polyCenter[0],
						center_y: polyCenter[1],
						z_init: zInit,
						z_end: zInit + defaultHeight,
						length: 0,
						width: 0,
						angle: 0,
						radius: 0,
						p1: undefined,
						p2: undefined,
						thickness: 0,
						polygon: currentPoints,
					};
					const updated = [...objects, newPoly];
					setObjects(updated);
					setSelectedObjectId(newPoly.id);
					setCurrentPoints([]);
					setObjectDrawingMode("none");
					saveObjectsDesign(updated);
				} else {
					setCurrentPoints([...currentPoints, [mx, my]]);
				}
			}
		}
	};

	// ESC Key listener
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setIsDrawingRoofs(false);
				setObjectDrawingMode("none");
				setCurrentPoints([]);
				setWallStartPoint(null);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// ────────────────────────────────────────────────────────────────────────
	// ROOF PROP SIDEBAR EDITORS
	// ────────────────────────────────────────────────────────────────────────
	const deleteSelectedRoof = () => {
		if (!selectedRoofId) return;
		const updated = roofs.filter((r) => r.id !== selectedRoofId);
		setRoofs(updated);
		setSelectedRoofId(null);
		saveRoofDesign(updated);
	};

	const updateSelectedRoof = (updates: Partial<RoofData>) => {
		if (!selectedRoofId) return;
		const updated = roofs.map((r) => {
			if (r.id !== selectedRoofId) return r;
			return { ...r, ...updates };
		});
		setRoofs(updated);
		saveRoofDesignDebounced(updated);
	};

	const undoLastRoofPoint = () => {
		if (currentPoints.length > 0) {
			setCurrentPoints(currentPoints.slice(0, -1));
		}
	};

	const cancelRoofDrawing = () => {
		setIsDrawingRoofs(false);
		setCurrentPoints([]);
	};

	// ────────────────────────────────────────────────────────────────────────
	// OBJECT PROP SIDEBAR EDITORS
	// ────────────────────────────────────────────────────────────────────────
	const deleteSelectedObject = () => {
		if (!selectedObjectId) return;
		const updated = objects.filter((o) => o.id !== selectedObjectId);
		setObjects(updated);
		setSelectedObjectId(null);
		saveObjectsDesign(updated);
	};

	const updateSelectedObject = (fields: Partial<LocalObject>) => {
		if (!selectedObjectId) return;
		const updated = objects.map((obj) => {
			if (obj.id !== selectedObjectId) return obj;
			return { ...obj, ...fields };
		});
		setObjects(updated);
		saveObjectsDesignDebounced(updated);
	};

	return (
		<div className="flex-grow w-full flex flex-col md:flex-row overflow-hidden relative">

			{/* Column 1: 2D drawing canvas */}
			<div
				ref={viewportRef}
				onWheel={handleWheel}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseLeave}
				onClick={handleCanvasClick}
				className={`flex-grow flex-1 h-full bg-neutral-950 flex items-center justify-center relative overflow-hidden p-6 border-r border-white/10 ${
					(isDrawingRoofs || objectDrawingMode !== "none") ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab"
				}`}
			>
				{/* Canvas bounding frame */}
				<div
					ref={innerContainerRef}
					style={{
						transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
						transformOrigin: "center",
					}}
					className="relative w-full max-w-[70vh] aspect-square border border-white/10 rounded-3xl overflow-hidden shadow-2xl bg-neutral-900 select-none flex items-center justify-center transition-transform duration-75 ease-out"
				>
					{/* Background Satellite snapshot */}
					{imageUrl && (
						<img
							src={imageUrl}
							alt="Captured Map"
							className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
							draggable={false}
						/>
					)}

					{/* SVG vector drawings */}
										{/* Interactive SVG Overlays Canvas */}
					<SVGCanvas
						widthMeters={widthMeters}
						heightMeters={heightMeters}
						stage={stage}
						roofs={roofs}
						selectedRoofId={selectedRoofId}
						setSelectedRoofId={setSelectedRoofId}
						isDrawingRoofs={isDrawingRoofs}
						currentPoints={currentPoints}
						mousePosMeters={mousePosMeters}
						wallStartPoint={wallStartPoint}
						objectDrawingMode={objectDrawingMode}
						objects={objects}
						selectedObjectId={selectedObjectId}
						setSelectedObjectId={setSelectedObjectId}
						startDraggingRoofVertex={startDraggingRoofVertex}
						startDraggingObject={startDraggingObject}
						startDraggingObjectVertex={startDraggingObjectVertex}
					/>
				</div>

				{/* 2D Zoom Control buttons overlay */}
				<div className="absolute bottom-6 right-6 flex flex-col gap-1.5 z-25">
					<button
						onClick={zoomIn2D}
						className="w-10 h-10 bg-black/75 hover:bg-neutral-800 text-white rounded-xl border border-white/10 flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
						title="Zoom In"
					>
						<Plus className="w-4.5 h-4.5" />
					</button>
					<button
						onClick={zoomOut2D}
						className="w-10 h-10 bg-black/75 hover:bg-neutral-800 text-white rounded-xl border border-white/10 flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
						title="Zoom Out"
					>
						<Minus className="w-4.5 h-4.5" />
					</button>
				</div>
			</div>

			{/* Column 2: 3D live preview container */}
			<div className="flex-grow flex-1 h-full relative overflow-hidden bg-neutral-950 border-r border-white/10">
				{liveSceneData ? (
					<Viewer data={liveSceneData} />
				) : (
					<div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-500 bg-neutral-950">
						<span className="text-xs font-semibold animate-pulse">Initializing 3D viewport...</span>
					</div>
				)}
			</div>

			{/* Column 3: Design Sidebar step component */}
			<div className="w-full md:w-[380px] bg-neutral-900/60 p-6 flex flex-col justify-between flex-shrink-0 border-l border-white/10 gap-6 overflow-y-auto z-20 font-sans text-neutral-200">
				{stage === 2 ? (
					<RoofMappingStep
						roofs={roofs}
						selectedRoofId={selectedRoofId}
						setSelectedRoofId={setSelectedRoofId}
						isDrawing={isDrawingRoofs}
						setIsDrawing={setIsDrawingRoofs}
						currentPoints={currentPoints}
						undoLastPoint={undoLastRoofPoint}
						cancelDrawing={cancelRoofDrawing}
						deleteSelectedRoof={deleteSelectedRoof}
						updateSelectedRoof={updateSelectedRoof}
						onContinue={onContinue || (() => {})}
					/>
				) : (
					<ObstructionMappingStep
						roofs={roofs}
						objects={objects}
						selectedObjectId={selectedObjectId}
						setSelectedObjectId={setSelectedObjectId}
						objectDrawingMode={objectDrawingMode}
						setObjectDrawingMode={setObjectDrawingMode}
						deleteSelectedObject={deleteSelectedObject}
						updateSelectedObject={updateSelectedObject}
						onContinue={onContinue || (() => {})}
					/>
				)}
			</div>

		</div>
	);
}
