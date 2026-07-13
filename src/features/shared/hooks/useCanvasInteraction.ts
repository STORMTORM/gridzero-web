import { useCallback } from "react";
import type { RoofData, PlacedPanelGroup, DragState } from "../types";
import type { LocalObject } from "../../../utils/design/types";
import { dragService } from "../services/dragService";
import { panelService } from "../services/panelService";
import { CATEGORY_DEFAULTS, DEFAULT_PREFERENCES } from "../constants";
import { generateUUID, isPointInPolygon, calculateArea } from "../../../utils/design/coords";

interface CanvasInteractionParams {
	sitevisitId: string;
	stage: string;
	roofs: RoofData[];
	setRoofs: React.Dispatch<React.SetStateAction<RoofData[]>>;
	objects: LocalObject[];
	setObjects: React.Dispatch<React.SetStateAction<LocalObject[]>>;
	panelGroups: PlacedPanelGroup[];
	setPanelGroups: React.Dispatch<React.SetStateAction<PlacedPanelGroup[]>>;
	activeDrag: DragState | null;
	setActiveDrag: React.Dispatch<React.SetStateAction<DragState | null>>;
	setToastMessage: (msg: string | null) => void;
	
	// Hook interfaces
	viewport: any;
	selection: any;
	roofEditor: any;
	objectEditor: any;
	panelPlacement: any;
	autoSave: any;
}

export function useCanvasInteraction({
	stage,
	roofs,
	setRoofs,
	objects,
	setObjects,
	panelGroups,
	setPanelGroups,
	activeDrag,
	setActiveDrag,
	setToastMessage,
	viewport,
	selection,
	roofEditor,
	objectEditor,
	panelPlacement,
	autoSave,
}: CanvasInteractionParams) {
	
	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		viewport.handleMouseDown(e);
	}, [viewport]);

	const handleMouseMove = useCallback((e: React.MouseEvent) => {
		const [mx, my] = viewport.getMouseMeters(e);
		viewport.setMousePosMeters([mx, my]);

		if (viewport.isPanning) {
			viewport.setPanOffset({
				x: e.clientX - viewport.panStart.current.x,
				y: e.clientY - viewport.panStart.current.y,
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
					return dragService.handleRoofVertexDrag(orig, dx, dy, activeDrag.vertexIndex!);
				});
				setRoofs(updatedRoofs);
			} else if (activeDrag.type === "object") {
				const updatedObjs = objects.map((obj) => {
					if (obj.id !== activeDrag.targetId) return obj;
					return dragService.handleObjectDrag(orig, dx, dy, roofs, objects);
				});
				setObjects(updatedObjs);
			} else if (activeDrag.type === "object-vertex" && activeDrag.vertexIndex !== undefined) {
				const updatedObjs = objects.map((obj) => {
					if (obj.id !== activeDrag.targetId) return obj;
					return dragService.handleObjectVertexDrag(orig, mx, my, activeDrag.vertexIndex!, roofs);
				});
				setObjects(updatedObjs);
			} else if (activeDrag.type === "group") {
				const candidateGroup = dragService.handleGroupDrag(orig, dx, dy);
				const tempGroups = panelGroups.map((g) => g.id === activeDrag.targetId ? candidateGroup : g);
				const validation = panelService.validatePanelGroup(candidateGroup, tempGroups, panelPlacement.panelSpec, roofs, objects);
				if (!validation) {
					setPanelGroups(tempGroups);
				}
			}
		}
	}, [viewport, activeDrag, roofs, objects, panelGroups, panelPlacement.panelSpec, setRoofs, setObjects, setPanelGroups]);

	const handleMouseUp = useCallback(() => {
		viewport.setIsPanning(false);
		if (activeDrag) {
			if (activeDrag.type === "roof-vertex") {
				// Only save if the vertex actually moved
				const roof = roofs.find((r) => r.id === activeDrag.targetId);
				const origRoof = activeDrag.originalState;
				const didMove = roof && origRoof && JSON.stringify(roof.points) !== JSON.stringify(origRoof.points);
				if (didMove) {
					autoSave.saveRoofDesign(roofs);
				}
			} else if (activeDrag.type === "object") {
				const obj = objects.find((o) => o.id === activeDrag.targetId);
				const orig = activeDrag.originalState;

				// Check if the object actually moved
				const didMove = obj && (
					obj.center_x !== orig.center_x ||
					obj.center_y !== orig.center_y
				);

				if (obj && obj.type !== "wall" && obj.type !== "polygon") {
					const expectedOnRoof = orig.on_roof;

					if (expectedOnRoof && !obj.on_roof) {
						const restored = objects.map((o) => o.id === obj.id ? {
							...o,
							center_x: orig.center_x,
							center_y: orig.center_y,
							on_roof: orig.on_roof,
							roof_id: orig.roof_id,
							z_init: orig.z_init,
							z_end: orig.z_end,
						} : o);
						setObjects(restored);
						autoSave.saveObjectsDesign(restored);
						setActiveDrag(null);
						setToastMessage(`This object (${obj.name}) must remain inside a mapped roof boundary.`);
						return;
					}

					if (!expectedOnRoof && obj.on_roof) {
						const restored = objects.map((o) => o.id === obj.id ? {
							...o,
							center_x: orig.center_x,
							center_y: orig.center_y,
							on_roof: orig.on_roof,
							roof_id: orig.roof_id,
							z_init: orig.z_init,
							z_end: orig.z_end,
						} : o);
						setObjects(restored);
						autoSave.saveObjectsDesign(restored);
						setActiveDrag(null);
						setToastMessage(`This object (${obj.name}) must remain on the ground (outside all roof boundaries).`);
						return;
					}
				}
				// Only save if the object actually moved
				if (didMove) {
					autoSave.saveObjectsDesign(objects);
				}
			} else if (activeDrag.type === "group") {
				const group = panelGroups.find((g) => g.id === activeDrag.targetId);
				const orig = activeDrag.originalState;

				// Check if the group actually moved
				const didMove = group && (
					group.center_x !== orig.center_x ||
					group.center_y !== orig.center_y
				);

				if (group) {
					const validation = panelService.validatePanelGroup(group, panelGroups, panelPlacement.panelSpec, roofs, objects);
					if (validation) {
						const restored = panelGroups.map((g) => g.id === activeDrag.targetId ? orig : g);
						setPanelGroups(restored);
						setToastMessage(validation);
						setActiveDrag(null);
						return;
					}
				}
				// Only save if the group actually moved
				if (didMove) {
					autoSave.savePanelsDesign(panelGroups);
				}
			} else if (activeDrag.type === "object-vertex") {
				// Vertex drag on wall/polygon — check if position changed
				const obj = objects.find((o) => o.id === activeDrag.targetId);
				const orig = activeDrag.originalState;
				const didMove = obj && JSON.stringify(obj) !== JSON.stringify(orig);
				if (didMove) {
					autoSave.saveObjectsDesign(objects);
				}
			}
			setActiveDrag(null);
		}
	}, [viewport, activeDrag, roofs, objects, panelGroups, panelPlacement.panelSpec, autoSave, setObjects, setPanelGroups, setToastMessage, setActiveDrag]);

	const handleMouseLeave = useCallback(() => {
		viewport.setIsPanning(false);
		setActiveDrag(null);
	}, [viewport, setActiveDrag]);

	const startDraggingRoofVertex = useCallback((e: React.MouseEvent, roofId: string, ptIdx: number) => {
		e.stopPropagation();
		if (roofEditor.isDrawingRoofs || stage !== "roof") return;
		selection.setSelectedRoofId(roofId);
		const roof = roofs.find((r) => r.id === roofId);
		if (!roof) return;
		setActiveDrag({
			type: "roof-vertex",
			targetId: roofId,
			vertexIndex: ptIdx,
			startMousePos: viewport.getMouseMeters(e),
			originalState: JSON.parse(JSON.stringify(roof)),
		});
	}, [roofEditor.isDrawingRoofs, stage, selection, roofs, viewport, setActiveDrag]);

	const startDraggingObject = useCallback((e: React.MouseEvent, objId: string) => {
		e.stopPropagation();
		if (objectEditor.objectDrawingMode !== "none" || stage !== "obstruction") return;
		selection.setSelectedObjectId(objId);
		const obj = objects.find((o) => o.id === objId);
		if (!obj) return;
		setActiveDrag({
			type: "object",
			targetId: objId,
			startMousePos: viewport.getMouseMeters(e),
			originalState: JSON.parse(JSON.stringify(obj)),
		});
	}, [objectEditor.objectDrawingMode, stage, selection, objects, viewport, setActiveDrag]);

	const startDraggingObjectVertex = useCallback((e: React.MouseEvent, objId: string, vIdx: number) => {
		e.stopPropagation();
		if (objectEditor.objectDrawingMode !== "none" || stage !== "obstruction") return;
		const obj = objects.find((o) => o.id === objId);
		if (!obj) return;
		setActiveDrag({
			type: "object-vertex",
			targetId: objId,
			vertexIndex: vIdx,
			startMousePos: viewport.getMouseMeters(e),
			originalState: JSON.parse(JSON.stringify(obj)),
		});
	}, [objectEditor.objectDrawingMode, stage, objects, viewport, setActiveDrag]);

	const startDraggingGroup = useCallback((e: React.MouseEvent, gId: string) => {
		e.stopPropagation();
		if (panelPlacement.isPlacingGroup || stage !== "placement") return;
		selection.setSelectedGroupId(gId);
		const group = panelGroups.find((g) => g.id === gId);
		if (!group) return;
		setActiveDrag({
			type: "group",
			targetId: gId,
			startMousePos: viewport.getMouseMeters(e),
			originalState: JSON.parse(JSON.stringify(group)),
		});
	}, [panelPlacement.isPlacingGroup, stage, selection, panelGroups, viewport, setActiveDrag]);

	const handlePlacementClick = useCallback((mx: number, my: number) => {
		const clickedRoofIdx = roofs.findIndex((r) => isPointInPolygon([mx, my], r.points));
		if (clickedRoofIdx === -1) {
			setToastMessage("Structures must be placed inside a mapped roof boundary.");
			return;
		}

		// ── Duplicate mode: place the pending template at click position ──
		if (panelPlacement.pendingDuplicateGroup) {
			const template = panelPlacement.pendingDuplicateGroup;
			const panelsInTemplate = panelService.groupPanelCount(template);
			if (panelPlacement.remainingPanelSlots !== Infinity && panelsInTemplate > panelPlacement.remainingPanelSlots) {
				setToastMessage(`Panel limit reached. Only ${panelPlacement.remainingPanelSlots} panel${panelPlacement.remainingPanelSlots !== 1 ? "s" : ""} remaining.`);
				return;
			}
			const placed: PlacedPanelGroup = { ...template, center_x: mx, center_y: my };
			const validation = panelService.validatePanelGroup(placed, [...panelGroups, placed], panelPlacement.panelSpec, roofs, objects);
			if (validation) {
				setToastMessage(validation);
				return;
			}
			const updated = [...panelGroups, placed];
			setPanelGroups(updated);
			selection.setSelectedGroupId(placed.id);
			panelPlacement.setIsPlacingGroup(false);
			panelPlacement.setPendingDuplicateGroup(null);
			autoSave.savePanelsDesign(updated);
			return;
		}

		// ── Normal placement mode: use placementConfig ──
		const panelsNeeded = panelPlacement.placementConfig.grid_cols * panelPlacement.placementConfig.grid_rows;
		const activeCells = panelPlacement.placementConfig.cells?.length ? panelPlacement.placementConfig.cells : undefined;
		const activePanelsNeeded = activeCells?.length || panelsNeeded;
		if (panelPlacement.remainingPanelSlots !== Infinity && activePanelsNeeded > panelPlacement.remainingPanelSlots) {
			setToastMessage(`Panel limit reached. Only ${panelPlacement.remainingPanelSlots} panel${panelPlacement.remainingPanelSlots !== 1 ? "s" : ""} remaining.`);
			return;
		}
		const newGroupId = generateUUID("group");
		const newGroup: PlacedPanelGroup = {
			id: newGroupId,
			type: "table-together",
			orientation: panelPlacement.placementConfig.orientation,
			grid_cols: panelPlacement.placementConfig.grid_cols,
			grid_rows: panelPlacement.placementConfig.grid_rows,
			table_angle: panelPlacement.placementConfig.table_angle,
			tilt_angle: panelPlacement.placementConfig.tilt_angle,
			center_x: mx,
			center_y: my,
			pillar_count: panelPlacement.placementConfig.pillar_count,
			cells: activeCells,
			pillars_per_structure_ew: panelPlacement.placementConfig.pillars_per_structure_ew,
			panels_per_structure: panelPlacement.placementConfig.panels_per_structure,
			...DEFAULT_PREFERENCES,
		};
		const validation = panelService.validatePanelGroup(newGroup, [...panelGroups, newGroup], panelPlacement.panelSpec, roofs, objects);
		if (validation) {
			setToastMessage(validation);
			return;
		}
		const updated = [...panelGroups, newGroup];
		setPanelGroups(updated);
		selection.setSelectedGroupId(newGroupId);
		panelPlacement.setIsPlacingGroup(false);
		autoSave.savePanelsDesign(updated);
	}, [roofs, objects, panelPlacement, selection, autoSave, panelGroups, setPanelGroups, setToastMessage]);

	const handleRoofClick = useCallback((mx: number, my: number) => {
		const isFirstPointClose = roofEditor.currentPoints.length > 0 &&
			Math.hypot(mx - roofEditor.currentPoints[0][0], my - roofEditor.currentPoints[0][1]) < 0.8;

		if (isFirstPointClose && roofEditor.currentPoints.length >= 3) {
			const newRoof: RoofData = {
				id: generateUUID("roof"),
				name: `Roof Boundary ${roofs.length + 1}`,
				height: 3.5,
				points: roofEditor.currentPoints,
				area: calculateArea(roofEditor.currentPoints),
				parapetEnabled: true,
				parapetHeight: 1.0,
				parapetThickness: 0.3,
				parapetSetback: 0.0,
				parapetSameDimensions: true,
				parapetEdges: roofEditor.currentPoints.map(() => ({
					enabled: true,
					height: 1.0,
					thickness: 0.3,
					setback: 0.0,
				})),
			};
			const updated = [...roofs, newRoof];
			setRoofs(updated);
			selection.setSelectedRoofId(newRoof.id);
			roofEditor.setCurrentPoints([]);
			roofEditor.setIsDrawingRoofs(false);
			autoSave.saveRoofDesign(updated);
		} else {
			roofEditor.setCurrentPoints((prev: any) => [...prev, [mx, my]]);
		}
	}, [roofs, roofEditor, selection, autoSave, setRoofs]);

	const handleObstructionClick = useCallback((mx: number, my: number) => {
		if (roofs.length === 0) {
			objectEditor.setObjectDrawingMode("none");
			roofEditor.setCurrentPoints([]);
			objectEditor.setWallStartPoint(null);
			return;
		}

		const config = CATEGORY_DEFAULTS[objectEditor.objectDrawingMode];
		if (config) {
			const snapRoof = roofs.find((r) => isPointInPolygon([mx, my], r.points));
			if (config.on_roof && !snapRoof) {
				setToastMessage(`This object (${config.name}) must be placed inside a mapped roof boundary.`);
				return;
			}
			if (!config.on_roof && snapRoof) {
				setToastMessage(`This object (${config.name}) must be placed on the ground (outside all roof boundaries).`);
				return;
			}
			const zInit = config.on_roof ? snapRoof!.height : 0;
			const count = objects.filter((o) => o.tag === config.tag || (o.type === config.type && !o.tag)).length + 1;

			const newObj: LocalObject = {
				id: generateUUID(),
				name: `${config.name} ${count}`,
				type: config.type,
				tag: config.tag,
				roof_id: config.on_roof ? snapRoof!.id : undefined,
				on_roof: config.on_roof,
				cast_shadow: true,
				center_x: mx,
				center_y: my,
				z_init: zInit,
				z_end: zInit + (config.z_end ?? 2.0),
				length: config.length,
				width: config.width,
				angle: 0,
				radius: config.radius,
				p1: undefined,
				p2: undefined,
				thickness: 0.23,
				polygon: undefined,
			};
			const updated = [...objects, newObj];
			setObjects(updated);
			selection.setSelectedObjectId(newObj.id);
			objectEditor.setObjectDrawingMode("none");
			autoSave.saveObjectsDesign(updated);
		} else if (objectEditor.objectDrawingMode === "wall") {
			if (!objectEditor.wallStartPoint) {
				objectEditor.setWallStartPoint([mx, my]);
			} else {
				const count = objects.filter((o) => o.type === "wall").length + 1;
				const nextX = (objectEditor.wallStartPoint[0] + mx) / 2;
				const nextY = (objectEditor.wallStartPoint[1] + my) / 2;
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
					p1: objectEditor.wallStartPoint,
					p2: [mx, my],
					thickness: 0.23,
					polygon: undefined,
				};
				const updated = [...objects, newWall];
				setObjects(updated);
				selection.setSelectedObjectId(newWall.id);
				objectEditor.setWallStartPoint(null);
				objectEditor.setObjectDrawingMode("none");
				autoSave.saveObjectsDesign(updated);
			}
		} else if (objectEditor.objectDrawingMode === "polygon") {
			const isFirstPoint = roofEditor.currentPoints.length > 0 &&
				Math.hypot(mx - roofEditor.currentPoints[0][0], my - roofEditor.currentPoints[0][1]) < 0.8;

			if (isFirstPoint && roofEditor.currentPoints.length >= 3) {
				const polyCenter: [number, number] = [
					roofEditor.currentPoints.reduce((acc: any, p: any) => acc + p[0], 0) / roofEditor.currentPoints.length,
					roofEditor.currentPoints.reduce((acc: any, p: any) => acc + p[1], 0) / roofEditor.currentPoints.length,
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
					polygon: roofEditor.currentPoints,
				};
				const updated = [...objects, newPoly];
				setObjects(updated);
				selection.setSelectedObjectId(newPoly.id);
				roofEditor.setCurrentPoints([]);
				objectEditor.setObjectDrawingMode("none");
				autoSave.saveObjectsDesign(updated);
			} else {
				roofEditor.setCurrentPoints((prev: any) => [...prev, [mx, my]]);
			}
		}
	}, [roofs, objects, objectEditor, roofEditor, selection, autoSave, setObjects, setToastMessage]);

	const handleCanvasClick = useCallback((e: React.MouseEvent) => {
		const [mx, my] = viewport.getMouseMeters(e);

		if (!roofEditor.isDrawingRoofs && objectEditor.objectDrawingMode === "none" && !panelPlacement.isPlacingGroup) {
			selection.clearSelection();
			return;
		}

		if (stage === "placement" && panelPlacement.isPlacingGroup) {
			handlePlacementClick(mx, my);
			return;
		}

		if (stage === "roof" && roofEditor.isDrawingRoofs) {
			handleRoofClick(mx, my);
			return;
		}

		if (stage === "obstruction" && objectEditor.objectDrawingMode !== "none") {
			handleObstructionClick(mx, my);
			return;
		}
	}, [viewport, roofEditor, objectEditor, panelPlacement, stage, selection, handlePlacementClick, handleRoofClick, handleObstructionClick]);

	return {
		handleMouseDown,
		handleMouseMove,
		handleMouseUp,
		handleMouseLeave,
		handleCanvasClick,
		startDraggingRoofVertex,
		startDraggingObject,
		startDraggingObjectVertex,
		startDraggingGroup,
	};
}
