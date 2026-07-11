import { useState, useEffect, useMemo, useCallback } from "react";
import type { RoofData, PlacedPanelGroup, DragState } from "../types";
import type { LocalObject, SceneData } from "../../../utils/design/types";
import { useSelection } from "./useSelection";
import { useViewport } from "./useViewport";
import { useAutoSave } from "./useAutoSave";
import { useRoofEditor } from "./useRoofEditor";
import { useObjectEditor } from "./useObjectEditor";
import { usePanelPlacement } from "./usePanelPlacement";
import { useKeyboard } from "./useKeyboard";
import { dragService } from "../services/dragService";
import { panelService } from "../services/panelService";
import { CATEGORY_DEFAULTS, DEFAULT_PREFERENCES } from "../constants";
import { generateUUID, isPointInPolygon, calculateArea } from "../../../utils/design/coords";
import { buildLiveSceneData } from "../../../utils/design/sceneDataBuilder";

interface UseDesignEditorParams {
	sitevisitId: string;
	widthMeters: number;
	heightMeters: number;
	initialRoofs: RoofData[];
	initialObjects: LocalObject[];
	stage: string;
	onSaveStatusChange?: (saving: boolean) => void;
	sceneData?: SceneData | null;
	onContinue?: () => void;
}

export function useDesignEditor({
	sitevisitId,
	widthMeters,
	heightMeters,
	initialRoofs,
	initialObjects,
	stage,
	onSaveStatusChange,
	sceneData,
	onContinue,
}: UseDesignEditorParams) {
	// ────────────────────────────────────────────────────────────────────────
	// CORE DATA STATES (Owned by orchestrator to prevent circular hook links)
	// ────────────────────────────────────────────────────────────────────────
	const [roofs, setRoofs] = useState<RoofData[]>(initialRoofs);
	const [objects, setObjects] = useState<LocalObject[]>(initialObjects);
	
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	// Dragging states
	const [activeDrag, setActiveDrag] = useState<DragState | null>(null);

	// 1. Selection Composition
	const selection = useSelection();

	// 2. Viewport Composition (zoom, pan, scale)
	const viewport = useViewport({ widthMeters, heightMeters });

	// 3. Panel placement orchestration
	const panelPlacement = usePanelPlacement({
		sitevisitId,
		sceneData,
		selectedGroupId: selection.selectedGroupId,
		setSelectedGroupId: selection.setSelectedGroupId,
		savePanelsDesign: (groups) => autoSave.savePanelsDesign(groups),
		savePanelsDesignDebounced: (groups) => autoSave.savePanelsDesignDebounced(groups),
		roofs,
		objects,
		setToastMessage,
		onContinue,
	});

	// 4. AutoSave Composition (delegates to mutations)
	const autoSave = useAutoSave({
		sitevisitId,
		roofs,
		objects,
		panelGroups: panelPlacement.panelGroups,
		panelSpec: panelPlacement.panelSpec,
		onSaveStatusChange,
	});

	// 5. Roof editor Composition
	const roofEditor = useRoofEditor({
		initialRoofs,
		selectedRoofId: selection.selectedRoofId,
		setSelectedRoofId: selection.setSelectedRoofId,
		saveRoofDesign: (list) => {
			setRoofs(list);
			autoSave.saveRoofDesign(list);
		},
		saveRoofDesignDebounced: (list) => {
			setRoofs(list);
			autoSave.saveRoofDesignDebounced(list);
		},
	});

	// 6. Object/Obstruction Composition
	const objectEditor = useObjectEditor({
		initialObjects,
		selectedObjectId: selection.selectedObjectId,
		setSelectedObjectId: selection.setSelectedObjectId,
		saveObjectsDesign: (list) => {
			setObjects(list);
			autoSave.saveObjectsDesign(list);
		},
		saveObjectsDesignDebounced: (list) => {
			setObjects(list);
			autoSave.saveObjectsDesignDebounced(list);
		},
	});

	// 7. Keyboard escape controls Composition
	useKeyboard({
		setIsDrawingRoofs: roofEditor.setIsDrawingRoofs,
		setObjectDrawingMode: objectEditor.setObjectDrawingMode,
		setIsPlacingGroup: panelPlacement.setIsPlacingGroup,
		setCurrentPoints: roofEditor.setCurrentPoints,
		setWallStartPoint: objectEditor.setWallStartPoint,
	});

	// Re-sync inner collection states when raw updates arrive from hooks
	useEffect(() => {
		setRoofs(roofEditor.roofs);
	}, [roofEditor.roofs]);

	useEffect(() => {
		setObjects(objectEditor.objects);
	}, [objectEditor.objects]);

	// ────────────────────────────────────────────────────────────────────────
	// SCENE COMPILING (Derived Preview Data)
	// ────────────────────────────────────────────────────────────────────────
	const liveSceneData = useMemo(() => {
		return buildLiveSceneData(sceneData, roofs, objects, stage, panelPlacement.panelGroups, panelPlacement.panelSpec);
	}, [sceneData, roofs, objects, stage, panelPlacement.panelGroups, panelPlacement.panelSpec]);

	// ────────────────────────────────────────────────────────────────────────
	// MOUSE DRAGGING CALLBACKS
	// ────────────────────────────────────────────────────────────────────────
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
				roofEditor.setRoofs(updatedRoofs);
			} else if (activeDrag.type === "object") {
				const updatedObjs = objects.map((obj) => {
					if (obj.id !== activeDrag.targetId) return obj;
					return dragService.handleObjectDrag(orig, dx, dy, roofs, objects);
				});
				objectEditor.setObjects(updatedObjs);
			} else if (activeDrag.type === "object-vertex" && activeDrag.vertexIndex !== undefined) {
				const updatedObjs = objects.map((obj) => {
					if (obj.id !== activeDrag.targetId) return obj;
					return dragService.handleObjectVertexDrag(orig, mx, my, activeDrag.vertexIndex!, roofs);
				});
				objectEditor.setObjects(updatedObjs);
			} else if (activeDrag.type === "group") {
				const updatedGroups = panelPlacement.panelGroups.map((g) => {
					if (g.id !== activeDrag.targetId) return g;
					return dragService.handleGroupDrag(orig, dx, dy);
				});
				panelPlacement.setPanelGroups(updatedGroups);
			}
		}
	}, [viewport, activeDrag, roofs, objects, panelPlacement, roofEditor, objectEditor]);

	const handleMouseUp = useCallback(() => {
		viewport.setIsPanning(false);
		if (activeDrag) {
			if (activeDrag.type === "roof-vertex") {
				autoSave.saveRoofDesign(roofs);
			} else if (activeDrag.type === "object") {
				const obj = objects.find((o) => o.id === activeDrag.targetId);
				if (obj && obj.type !== "wall" && obj.type !== "polygon") {
					const expectedOnRoof = activeDrag.originalState.on_roof;

					if (expectedOnRoof && !obj.on_roof) {
						const restored = objects.map((o) => o.id === obj.id ? {
							...o,
							center_x: activeDrag.originalState.center_x,
							center_y: activeDrag.originalState.center_y,
							on_roof: activeDrag.originalState.on_roof,
							roof_id: activeDrag.originalState.roof_id,
							z_init: activeDrag.originalState.z_init,
							z_end: activeDrag.originalState.z_end,
						} : o);
						objectEditor.setObjects(restored);
						autoSave.saveObjectsDesign(restored);
						setActiveDrag(null);
						setToastMessage(`This object (${obj.name}) must remain inside a mapped roof boundary.`);
						return;
					}

					if (!expectedOnRoof && obj.on_roof) {
						const restored = objects.map((o) => o.id === obj.id ? {
							...o,
							center_x: activeDrag.originalState.center_x,
							center_y: activeDrag.originalState.center_y,
							on_roof: activeDrag.originalState.on_roof,
							roof_id: activeDrag.originalState.roof_id,
							z_init: activeDrag.originalState.z_init,
							z_end: activeDrag.originalState.z_end,
						} : o);
						objectEditor.setObjects(restored);
						autoSave.saveObjectsDesign(restored);
						setActiveDrag(null);
						setToastMessage(`This object (${obj.name}) must remain on the ground (outside all roof boundaries).`);
						return;
					}
				}
				autoSave.saveObjectsDesign(objects);
			} else if (activeDrag.type === "group") {
				const group = panelPlacement.panelGroups.find((g) => g.id === activeDrag.targetId);
				if (group) {
					const validation = panelService.validatePanelGroup(group, panelPlacement.panelGroups, panelPlacement.panelSpec, roofs, objects);
					if (validation) {
						const restored = panelPlacement.panelGroups.map((g) => g.id === activeDrag.targetId ? activeDrag.originalState : g);
						panelPlacement.setPanelGroups(restored);
						setToastMessage(validation);
						setActiveDrag(null);
						return;
					}
				}
				autoSave.savePanelsDesign(panelPlacement.panelGroups);
			} else {
				autoSave.saveObjectsDesign(objects);
			}
			setActiveDrag(null);
		}
	}, [viewport, activeDrag, roofs, objects, panelPlacement, objectEditor, autoSave]);

	const handleMouseLeave = useCallback(() => {
		viewport.setIsPanning(false);
		setActiveDrag(null);
	}, [viewport]);

	// ────────────────────────────────────────────────────────────────────────
	// DRAG STARTERS
	// ────────────────────────────────────────────────────────────────────────
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
	}, [roofEditor.isDrawingRoofs, stage, selection, roofs, viewport]);

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
	}, [objectEditor.objectDrawingMode, stage, selection, objects, viewport]);

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
	}, [objectEditor.objectDrawingMode, stage, objects, viewport]);

	const startDraggingGroup = useCallback((e: React.MouseEvent, gId: string) => {
		e.stopPropagation();
		if (panelPlacement.isPlacingGroup || stage !== "placement") return;
		selection.setSelectedGroupId(gId);
		const group = panelPlacement.panelGroups.find((g) => g.id === gId);
		if (!group) return;
		setActiveDrag({
			type: "group",
			targetId: gId,
			startMousePos: viewport.getMouseMeters(e),
			originalState: JSON.parse(JSON.stringify(group)),
		});
	}, [panelPlacement.isPlacingGroup, stage, selection, panelPlacement.panelGroups, viewport]);

	// ────────────────────────────────────────────────────────────────────────
	// TOOL CLICK DISPATCHERS
	// ────────────────────────────────────────────────────────────────────────
	const handlePlacementClick = useCallback((mx: number, my: number) => {
		const clickedRoofIdx = roofs.findIndex((r) => isPointInPolygon([mx, my], r.points));
		if (clickedRoofIdx === -1) {
			setToastMessage("Structures must be placed inside a mapped roof boundary.");
			return;
		}
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
			type: "table",
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
		const validation = panelService.validatePanelGroup(newGroup, [...panelPlacement.panelGroups, newGroup], panelPlacement.panelSpec, roofs, objects);
		if (validation) {
			setToastMessage(validation);
			return;
		}
		const updated = [...panelPlacement.panelGroups, newGroup];
		panelPlacement.setPanelGroups(updated);
		selection.setSelectedGroupId(newGroupId);
		panelPlacement.setIsPlacingGroup(false);
		autoSave.savePanelsDesign(updated);
	}, [roofs, objects, panelPlacement, selection, autoSave]);

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
			roofEditor.setCurrentPoints((prev) => [...prev, [mx, my]]);
		}
	}, [roofs, roofEditor, selection, autoSave]);

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
					roofEditor.currentPoints.reduce((acc, p) => acc + p[0], 0) / roofEditor.currentPoints.length,
					roofEditor.currentPoints.reduce((acc, p) => acc + p[1], 0) / roofEditor.currentPoints.length,
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
				roofEditor.setCurrentPoints((prev) => [...prev, [mx, my]]);
			}
		}
	}, [roofs, objects, objectEditor, roofEditor, selection, autoSave]);

	const handleCanvasClick = useCallback((e: React.MouseEvent) => {
		const [mx, my] = viewport.getMouseMeters(e);

		// If not drawing/placing, clicking on empty canvas clears selections
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
		// States
		roofs,
		objects,
		panelGroups: panelPlacement.panelGroups,
		selectedRoofId: selection.selectedRoofId,
		setSelectedRoofId: selection.setSelectedRoofId,
		selectedObjectId: selection.selectedObjectId,
		setSelectedObjectId: selection.setSelectedObjectId,
		selectedGroupId: selection.selectedGroupId,
		setSelectedGroupId: selection.setSelectedGroupId,
		toastMessage,
		setToastMessage,
		objectDrawingMode: objectEditor.objectDrawingMode,
		setObjectDrawingMode: objectEditor.setObjectDrawingMode,
		currentPoints: roofEditor.currentPoints,
		setCurrentPoints: roofEditor.setCurrentPoints,
		isDrawingRoofs: roofEditor.isDrawingRoofs,
		setIsDrawingRoofs: roofEditor.setIsDrawingRoofs,
		mousePosMeters: viewport.mousePosMeters,
		setMousePosMeters: viewport.setMousePosMeters,
		wallStartPoint: objectEditor.wallStartPoint,
		setWallStartPoint: objectEditor.setWallStartPoint,
		scale: viewport.scale,
		setScale: viewport.setScale,
		panOffset: viewport.panOffset,
		setPanOffset: viewport.setPanOffset,
		isPanning: viewport.isPanning,
		setIsPanning: viewport.setIsPanning,
		activeDrag,
		setActiveDrag,
		isPlacingGroup: panelPlacement.isPlacingGroup,
		setIsPlacingGroup: panelPlacement.setIsPlacingGroup,
		targetPanelCount: panelPlacement.targetPanelCount,
		placementConfig: panelPlacement.placementConfig,
		setPlacementConfig: panelPlacement.setPlacementConfig,
		showConfigModal: panelPlacement.showConfigModal,
		setShowConfigModal: panelPlacement.setShowConfigModal,
		configModalMode: panelPlacement.configModalMode,
		setConfigModalMode: panelPlacement.setConfigModalMode,
		activeCaptureTarget: panelPlacement.activeCaptureTarget,
		setActiveCaptureTarget: panelPlacement.setActiveCaptureTarget,
		
		// Derived
		placedPanelCount: panelPlacement.placedPanelCount,
		remainingPanelSlots: panelPlacement.remainingPanelSlots,
		selectedGroup: panelPlacement.selectedGroup,
		selectedGroupPanelCount: panelPlacement.selectedGroupPanelCount,
		configModalRemainingSlots: panelPlacement.configModalRemainingSlots,
		liveSceneData,
		panelSpec: panelPlacement.panelSpec,

		// Actions
		updateSelectedGroup: panelPlacement.updateSelectedGroup,
		deleteSelectedGroup: panelPlacement.deleteSelectedGroup,
		handleConfigConfirm: panelPlacement.handleConfigConfirm,
		startDraggingRoofVertex,
		startDraggingObject,
		startDraggingObjectVertex,
		startDraggingGroup,
		handleCanvasClick,
		deleteSelectedRoof: roofEditor.deleteSelectedRoof,
		updateSelectedRoof: roofEditor.updateSelectedRoof,
		undoLastRoofPoint: roofEditor.undoLastRoofPoint,
		cancelRoofDrawing: roofEditor.cancelRoofDrawing,
		deleteSelectedObject: objectEditor.deleteSelectedObject,
		updateSelectedObject: objectEditor.updateSelectedObject,
		handleWheel: viewport.handleWheel,
		zoomIn2D: viewport.zoomIn2D,
		zoomOut2D: viewport.zoomOut2D,
		handleMouseDown,
		handleMouseMove,
		handleMouseUp,
		handleMouseLeave,
		handlePlacementContinue: panelPlacement.handlePlacementContinue,

		// Refs
		viewportRef: viewport.viewportRef,
		innerContainerRef: viewport.innerContainerRef,
	};
}
