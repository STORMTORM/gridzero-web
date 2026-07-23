import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DesignStage } from "../enums";
import RoofMappingStep from "../../roof/components/RoofMappingStep";
import ObstructionMappingStep from "../../obstructions/components/ObstructionMappingStep";
import PanelPlacementStep from "../../placement/components/PanelPlacementStep";
import { TableConfigModal } from "./TableConfigModal";
import SnapshotsStep from "../../snapshots/components/SnapshotsStep";
import { CanvasViewport } from "./CanvasViewport";
import { ThreeDViewport } from "./ThreeDViewport";
import type { SceneData, LocalObject } from "../../../utils/design/types";
import type { RoofData, PlacedPanelGroup, DragState } from "../types";
import { getPanelsInGroup, isPointInPolygon } from "../../../utils/design/coords";
import { CATEGORY_DEFAULTS } from "../constants";
import { useHistoryState } from "../hooks/useHistoryState";
import SaveRoofPointsModal from "./SaveRoofPointsModal";
import DeleteRoofConfirmModal from "./DeleteRoofConfirmModal";

// Import individual hooks directly
import { useSelection } from "../hooks/useSelection";
import { useViewport } from "../hooks/useViewport";
import { useAutoSave } from "../hooks/useAutoSave";
import { useRoofEditor } from "../../roof/hooks/useRoofEditor";
import { useObjectEditor } from "../../obstructions/hooks/useObjectEditor";
import { usePanelPlacement } from "../../placement/hooks/usePanelPlacement";
import { useKeyboard } from "../hooks/useKeyboard";
import { useSceneBuilder } from "../hooks/useSceneBuilder";
import { useCanvasInteraction } from "../hooks/useCanvasInteraction";

interface UndoRedoHandlers {
	undo: () => void;
	redo: () => void;
	canUndo: boolean;
	canRedo: boolean;
}

interface UnifiedDesignStepProps {
	sitevisitId: string;
	widthMeters: number;
	heightMeters: number;
	imageUrl: string;
	initialRoofs: RoofData[];
	initialObjects: LocalObject[];
	initialPanelGroups: PlacedPanelGroup[];
	stage: string;
	onSaveStatusChange?: (saving: boolean) => void;
	sceneData?: SceneData | null;
	onContinue?: () => void;
	layoutMode?: "split" | "toggle";
	activeViewport?: "2d" | "3d";
	setActiveViewport?: (v: "2d" | "3d") => void;
	onRegisterUndoRedo?: (handlers: UndoRedoHandlers) => void;
}

export default function UnifiedDesignStep({
	sitevisitId,
	widthMeters,
	heightMeters,
	imageUrl,
	initialRoofs,
	initialObjects,
	initialPanelGroups,
	stage,
	onSaveStatusChange,
	sceneData,
	onContinue,
	layoutMode = "split",
	activeViewport = "2d",
	setActiveViewport,
	onRegisterUndoRedo,
}: UnifiedDesignStepProps) {

	// ────────────────────────────────────────────────────────────────────────
	// CORE DATA STATES (Synchronous single source of truth with History Stack)
	// ────────────────────────────────────────────────────────────────────────
	const {
		state: docState,
		setState: setDocState,
		undo: undoDoc,
		redo: redoDoc,
		canUndo: canUndoDoc,
		canRedo: canRedoDoc,
		reset: resetDoc,
	} = useHistoryState({
		roofs: initialRoofs,
		objects: initialObjects,
		panelGroups: initialPanelGroups,
	});

	const roofs = docState.roofs;
	const objects = docState.objects;
	const panelGroups = docState.panelGroups;

	// Setter adapters to maintain compatibility
	const setRoofs = useCallback((
		newRoofs: RoofData[] | ((prev: RoofData[]) => RoofData[]),
		options?: boolean | { overwrite?: boolean; forcePush?: boolean }
	) => {
		setDocState((prev) => ({
			...prev,
			roofs: typeof newRoofs === "function" ? newRoofs(prev.roofs) : newRoofs,
		}), options);
	}, [setDocState]);

	const setObjects = useCallback((
		newObjects: LocalObject[] | ((prev: LocalObject[]) => LocalObject[]),
		options?: boolean | { overwrite?: boolean; forcePush?: boolean }
	) => {
		setDocState((prev) => ({
			...prev,
			objects: typeof newObjects === "function" ? newObjects(prev.objects) : newObjects,
		}), options);
	}, [setDocState]);

	const setPanelGroups = useCallback((
		newGroups: PlacedPanelGroup[] | ((prev: PlacedPanelGroup[]) => PlacedPanelGroup[]),
		options?: boolean | { overwrite?: boolean; forcePush?: boolean }
	) => {
		setDocState((prev) => ({
			...prev,
			panelGroups: typeof newGroups === "function" ? newGroups(prev.panelGroups) : newGroups,
		}), options);
	}, [setDocState]);

	const [loadedSitevisitId, setLoadedSitevisitId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	const [unsavedRoofId, setUnsavedRoofId] = useState<string | null>(null);
	const [originalPoints, setOriginalPoints] = useState<[number, number][] | null>(null);
	const [isSavePointsModalOpen, setIsSavePointsModalOpen] = useState(false);

	const [roofToDeleteId, setRoofToDeleteId] = useState<string | null>(null);
	const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

	// Dragging states
	const [activeDrag, setActiveDrag] = useState<DragState | null>(null);

	// Sync initial collections from server props only on first load/project switch
	useEffect(() => {
		if (sitevisitId !== loadedSitevisitId) {
			resetDoc({
				roofs: initialRoofs,
				objects: initialObjects,
				panelGroups: initialPanelGroups,
			});
			setLoadedSitevisitId(sitevisitId);
			setUnsavedRoofId(null);
			setOriginalPoints(null);
			setIsSavePointsModalOpen(false);
			setRoofToDeleteId(null);
			setIsDeleteConfirmOpen(false);
		}
	}, [initialRoofs, initialObjects, initialPanelGroups, sitevisitId, loadedSitevisitId, resetDoc]);

	// 1. Selection Hook
	const selection = useSelection();

	// 2. Viewport Hook (zoom, pan, scale)
	const viewport = useViewport({ widthMeters, heightMeters });

	// 3. AutoSave Hook (delegates to mutations)
	const autoSave = useAutoSave({
		sitevisitId,
		roofs,
		objects,
		panelGroups,
		getPanelSpec: () => panelPlacement?.panelSpec || null,
		onSaveStatusChange,
	});

	// 4. Panel placement orchestration Hook
	const panelPlacement = usePanelPlacement({
		sitevisitId,
		sceneData,
		panelGroups,
		setPanelGroups,
		selectedGroupId: selection.selectedGroupId,
		setSelectedGroupId: selection.setSelectedGroupId,
		savePanelsDesign: (groups) => autoSave.savePanelsDesign(groups),
		savePanelsDesignDebounced: (groups) => autoSave.savePanelsDesignDebounced(groups),
		roofs,
		objects,
		setToastMessage,
		onContinue,
		stage,
	});

	// 5. Roof editor Hook
	const roofEditor = useRoofEditor({
		roofs,
		setRoofs,
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
		onRoofDeleted: (deletedRoofId) => {
			const deletedRoof = roofs.find((r) => r.id === deletedRoofId);
			
			const updatedObjects = objects.filter((obj) => {
				const matchesId = obj.roof_id === deletedRoofId;
				const isInside = deletedRoof ? isPointInPolygon([obj.center_x, obj.center_y], deletedRoof.points) : false;
				return !matchesId && !isInside;
			});
			
			const updatedPanelGroups = panelGroups.filter((g) => {
				const isInside = deletedRoof ? isPointInPolygon([g.center_x, g.center_y], deletedRoof.points) : false;
				return !isInside;
			});

			if (updatedObjects.length !== objects.length) {
				setObjects(updatedObjects);
				autoSave.saveObjectsDesign(updatedObjects);
			}
			if (updatedPanelGroups.length !== panelGroups.length) {
				setPanelGroups(updatedPanelGroups);
				autoSave.savePanelsDesign(updatedPanelGroups);
			}
		}
	});

	// 6. Object/Obstruction Hook
	const objectEditor = useObjectEditor({
		objects,
		setObjects,
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

	// 7. Keyboard escape controls Hook
	useKeyboard({
		setIsDrawingRoofs: roofEditor.setIsDrawingRoofs,
		setObjectDrawingMode: objectEditor.setObjectDrawingMode,
		setIsPlacingGroup: panelPlacement.setIsPlacingGroup,
		setCurrentPoints: roofEditor.setCurrentPoints,
		setWallStartPoint: objectEditor.setWallStartPoint,
	});

	// 8. Scene Builder Hook
	const liveSceneData = useSceneBuilder({
		sceneData,
		roofs,
		objects,
		stage,
		panelGroups,
		panelSpec: panelPlacement.panelSpec,
	});

	const handleRoofVertexDragged = useCallback((roofId: string, origPoints: [number, number][]) => {
		setUnsavedRoofId((prev) => {
			if (!prev) {
				setOriginalPoints(origPoints);
				return roofId;
			}
			return prev;
		});
	}, []);

	const handleRoofPointsCancel = useCallback(() => {
		if (!unsavedRoofId || !originalPoints) return;
		const reverted = roofs.map((r) => {
			if (r.id === unsavedRoofId) {
				return { ...r, points: originalPoints };
			}
			return r;
		});
		setRoofs(reverted, { forcePush: true });
		setUnsavedRoofId(null);
		setOriginalPoints(null);
	}, [roofs, unsavedRoofId, originalPoints, setRoofs]);

	const handleRoofPointsSaveClick = useCallback(() => {
		setIsSavePointsModalOpen(true);
	}, []);

	const handleConfirmSaveRoofPoints = useCallback(() => {
		if (!unsavedRoofId) return;

		const roof = roofs.find(r => r.id === unsavedRoofId);
		if (roof) {
			autoSave.saveRoofDesign(roofs);

			const updatedObjects = objects.filter(obj => {
				const matchesId = obj.roof_id === unsavedRoofId;
				const isInside = isPointInPolygon([obj.center_x, obj.center_y], roof.points);
				return !matchesId && !isInside;
			});
			const updatedPanelGroups = panelGroups.filter(g => {
				const isInside = isPointInPolygon([g.center_x, g.center_y], roof.points);
				return !isInside;
			});

			if (updatedObjects.length !== objects.length) {
				setObjects(updatedObjects, { forcePush: true });
				autoSave.saveObjectsDesign(updatedObjects);
			}
			if (updatedPanelGroups.length !== panelGroups.length) {
				setPanelGroups(updatedPanelGroups, { forcePush: true });
				autoSave.savePanelsDesign(updatedPanelGroups);
			}
		}

		setUnsavedRoofId(null);
		setOriginalPoints(null);
		setIsSavePointsModalOpen(false);
	}, [roofs, objects, panelGroups, unsavedRoofId, setObjects, setPanelGroups, autoSave]);

	const handleRequestDeleteRoof = useCallback(() => {
		if (selection.selectedRoofId) {
			setRoofToDeleteId(selection.selectedRoofId);
			setIsDeleteConfirmOpen(true);
		}
	}, [selection.selectedRoofId]);

	const handleConfirmDeleteRoof = useCallback(() => {
		if (roofToDeleteId) {
			selection.setSelectedRoofId(roofToDeleteId);
			roofEditor.deleteSelectedRoof();
			setRoofToDeleteId(null);
			setIsDeleteConfirmOpen(false);
		}
	}, [roofToDeleteId, roofEditor, selection]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Delete" || e.key === "Backspace") {
				const activeEl = document.activeElement;
				if (
					activeEl &&
					(activeEl.tagName === "INPUT" ||
						activeEl.tagName === "TEXTAREA" ||
						activeEl.hasAttribute("contenteditable"))
				) {
					return;
				}

				if (stage === "roof" && selection.selectedRoofId) {
					e.preventDefault();
					setRoofToDeleteId(selection.selectedRoofId);
					setIsDeleteConfirmOpen(true);
				}
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [stage, selection.selectedRoofId]);

	// 9. Canvas Interaction Hook (mouse dragging/clicking logic)
	const interaction = useCanvasInteraction({
		sitevisitId,
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
		onRoofVertexDragged: handleRoofVertexDragged,
	});

	const autoSaveRef = useRef(autoSave);
	useEffect(() => {
		autoSaveRef.current = autoSave;
	}, [autoSave]);

	const handleUndo = useCallback(() => {
		undoDoc((newState) => {
			autoSaveRef.current.saveRoofDesign(newState.roofs);
			autoSaveRef.current.saveObjectsDesign(newState.objects);
			autoSaveRef.current.savePanelsDesign(newState.panelGroups);
		});
	}, [undoDoc]);

	const handleRedo = useCallback(() => {
		redoDoc((newState) => {
			autoSaveRef.current.saveRoofDesign(newState.roofs);
			autoSaveRef.current.saveObjectsDesign(newState.objects);
			autoSaveRef.current.savePanelsDesign(newState.panelGroups);
		});
	}, [redoDoc]);

	const lastRegisteredRef = useRef<{
		undo: any;
		redo: any;
		canUndo: boolean;
		canRedo: boolean;
	} | null>(null);

	// Expose Undo/Redo handlers to parent workspace
	useEffect(() => {
		if (onRegisterUndoRedo) {
			const isDrawingActive = roofEditor.isDrawingRoofs || objectEditor.objectDrawingMode === "polygon";
			const undo = isDrawingActive ? roofEditor.undoLastRoofPoint : handleUndo;
			const redo = isDrawingActive ? roofEditor.redoLastRoofPoint : handleRedo;
			const canUndo = isDrawingActive ? roofEditor.canUndoPoint : canUndoDoc;
			const canRedo = isDrawingActive ? roofEditor.canRedoPoint : canRedoDoc;

			const last = lastRegisteredRef.current;
			if (!last || last.undo !== undo || last.redo !== redo || last.canUndo !== canUndo || last.canRedo !== canRedo) {
				const nextState = { undo, redo, canUndo, canRedo };
				lastRegisteredRef.current = nextState;
				onRegisterUndoRedo(nextState);
			}
		}
	}, [
		onRegisterUndoRedo,
		roofEditor.isDrawingRoofs,
		objectEditor.objectDrawingMode,
		roofEditor.undoLastRoofPoint,
		roofEditor.redoLastRoofPoint,
		roofEditor.canUndoPoint,
		roofEditor.canRedoPoint,
		handleUndo,
		handleRedo,
		canUndoDoc,
		canRedoDoc,
	]);

	// Compute which object IDs are overlapped by any panel (only in placement stage)
	const overlappingObjectIds = useMemo(() => {
		if (stage !== "placement" || panelGroups.length === 0 || objects.length === 0) {
			return new Set<string>();
		}
		const overlapping = new Set<string>();
		for (const group of panelGroups) {
			const panels = getPanelsInGroup(group, panelPlacement.panelSpec);
			for (const panel of panels) {
				for (const obj of objects) {
					if (overlapping.has(obj.id)) continue;
					// Check if the panel center falls inside the object's footprint
					if (obj.type === "cuboid" && obj.length && obj.width) {
						// Build rotated corners of the cuboid and check using polygon test
						const hw = obj.length / 2;
						const hh = obj.width / 2;
						const angle = ((obj.angle || 0) * Math.PI) / 180;
						const cos = Math.cos(angle);
						const sin = Math.sin(angle);
						const corners: [number, number][] = [
							[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]
						].map(([lx, ly]) => [
							obj.center_x + lx * cos - ly * sin,
							obj.center_y + lx * sin + ly * cos,
						] as [number, number]);
						if (isPointInPolygon([panel.x, panel.y], corners)) {
							overlapping.add(obj.id);
						}
					} else if ((obj.type === "cylinder" || obj.type === "tree") && obj.radius) {
						const dx = panel.x - obj.center_x;
						const dy = panel.y - obj.center_y;
						if (Math.sqrt(dx * dx + dy * dy) <= obj.radius) {
							overlapping.add(obj.id);
						}
					} else if (obj.type === "polygon" && obj.polygon) {
						if (isPointInPolygon([panel.x, panel.y], obj.polygon as [number, number][])) {
							overlapping.add(obj.id);
						}
					} else if (obj.type === "wall" && obj.p1 && obj.p2) {
						// Check if panel center is within wall thickness distance of the wall segment
						const [x1, y1] = obj.p1;
						const [x2, y2] = obj.p2;
						const dx = x2 - x1;
						const dy = y2 - y1;
						const lenSq = dx * dx + dy * dy;
						const t = lenSq > 0 ? Math.max(0, Math.min(1, ((panel.x - x1) * dx + (panel.y - y1) * dy) / lenSq)) : 0;
						const closestX = x1 + t * dx;
						const closestY = y1 + t * dy;
						const dist = Math.sqrt((panel.x - closestX) ** 2 + (panel.y - closestY) ** 2);
						if (dist <= (obj.thickness || 0.23) / 2) {
							overlapping.add(obj.id);
						}
					}
				}
			}
		}
		return overlapping;
	}, [stage, panelGroups, objects, panelPlacement.panelSpec]);

	const helperText = useMemo(() => {
		if (stage === DesignStage.Roof) {
			if (roofEditor.isDrawingRoofs) {
				const pts = roofEditor.currentPoints.length;
				if (pts === 0) return "Zoom and tap on any corner of the roof.";
				if (pts < 3) return "Tap on the next adjoining corner. Click Undo in the sidebar to go back one corner.";
				return "Click on the first point to close and complete the roof.";
			}
			if (selection.selectedRoofId !== null) {
				return "Configure the parapet wall and height for the selected roof in the sidebar.";
			}
			return roofs.length > 0
				? "Repeat this process for all remaining roofs, then click Save and Continue."
				: "Click \"Draw Roof\" in the sidebar to start mapping the roof.";
		}

		if (stage === DesignStage.Obstruction) {
			if (objectEditor.objectDrawingMode !== "none") {
				if (objectEditor.objectDrawingMode === "wall") {
					return objectEditor.wallStartPoint
						? "Click on the map to place the end point of the wall."
						: "Click on the map to place the start point of the wall.";
				}
				if (objectEditor.objectDrawingMode === "polygon") {
					const pts = roofEditor.currentPoints.length;
					if (pts === 0) return "Zoom and click on the roof to place the first corner of the polygon.";
					if (pts < 3) return "Click on the next adjoining corner of the polygon.";
					return "Click on the first point to close and place the polygon.";
				}
				const config = CATEGORY_DEFAULTS[objectEditor.objectDrawingMode];
				const isOnRoof = config ? config.on_roof : true;
				return isOnRoof
					? "Zoom and click on an available area on the roof to place the object."
					: "Zoom and click on an available area outside the roof to place the object.";
			}
			if (selection.selectedObjectId !== null) {
				return "Drag to reposition, rotate, or adjust the selected object's parameters in the sidebar.";
			}
			const nonWallObjects = objects.filter((o) => o.type !== "wall");
			return nonWallObjects.length > 0
				? "Repeat this process for all remaining objects, then click Save and Continue."
				: "Select an object category and click a shape to start placing obstructions.";
		}

		if (stage === DesignStage.PanelPlacement) {
			if (panelPlacement.pendingDuplicateGroup) {
				return "Zoom and click on an available area on the roof to place the copied table.";
			}
			if (panelPlacement.isPlacingGroup) {
				return "Zoom and click on an available area on the roof to place the configured table.";
			}
			if (selection.selectedGroupId !== null) {
				return "Drag to reposition, or modify the selected panel table parameters in the sidebar.";
			}
			return panelGroups.length > 0
				? "Repeat this process for all remaining panel layouts, then click Save and Continue."
				: "Click “Configure Grid Layout” to start adding panels.";
		}

		return null;
	}, [
		stage,
		roofs,
		objects,
		panelGroups,
		roofEditor.isDrawingRoofs,
		roofEditor.currentPoints,
		selection.selectedRoofId,
		selection.selectedObjectId,
		selection.selectedGroupId,
		objectEditor.objectDrawingMode,
		objectEditor.wallStartPoint,
		panelPlacement.isPlacingGroup,
		panelPlacement.pendingDuplicateGroup,
	]);

	return (
		<div className="flex-grow w-full flex flex-col md:flex-row overflow-hidden relative">

			{/* Floating switcher controls for Single View mode */}
			{layoutMode === "toggle" && setActiveViewport && (
				<div className="absolute top-4 left-4 z-40 bg-card border border-border p-0.5 rounded-xl flex text-[10px] font-bold text-placeholder shadow-lg">
					<button
						type="button"
						onClick={() => setActiveViewport("2d")}
						className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
							activeViewport === "2d" ? "bg-primary text-white" : "hover:text-text"
						}`}
					>
						2D Canvas
					</button>
					<button
						type="button"
						onClick={() => setActiveViewport("3d")}
						className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
							activeViewport === "3d" ? "bg-primary text-white" : "hover:text-text"
						}`}
					>
						3D View
					</button>
				</div>
			)}

			{/* Column 1: 3D live preview container */}
			{(layoutMode === "split" || activeViewport === "3d" || stage === DesignStage.Snapshot) && (
				<ThreeDViewport
					liveSceneData={liveSceneData}
					stage={stage}
					activeCaptureTarget={panelPlacement.activeCaptureTarget}
				/>
			)}

			{/* Column 2: 2D drawing canvas */}
			{stage !== DesignStage.Snapshot && (layoutMode === "split" || activeViewport === "2d") && (
				<CanvasViewport
					helperText={helperText}
					viewportRef={viewport.viewportRef}
					innerContainerRef={viewport.innerContainerRef}
					scale={viewport.scale}
					panOffset={viewport.panOffset}
					imageUrl={imageUrl}
					widthMeters={widthMeters}
					heightMeters={heightMeters}
					stage={stage}
					roofs={roofs}
					selectedRoofId={selection.selectedRoofId}
					setSelectedRoofId={selection.setSelectedRoofId}
					isDrawingRoofs={roofEditor.isDrawingRoofs}
					currentPoints={roofEditor.currentPoints}
					mousePosMeters={viewport.mousePosMeters}
					wallStartPoint={objectEditor.wallStartPoint}
					objectDrawingMode={objectEditor.objectDrawingMode}
					objects={objects}
					selectedObjectId={selection.selectedObjectId}
					setSelectedObjectId={selection.setSelectedObjectId}
					startDraggingRoofVertex={interaction.startDraggingRoofVertex}
					startDraggingObject={interaction.startDraggingObject}
					startDraggingObjectVertex={interaction.startDraggingObjectVertex}
					panelGroups={stage === "roof" ? [] : panelGroups}
					selectedGroupId={selection.selectedGroupId}
					setSelectedGroupId={selection.setSelectedGroupId}
					startDraggingGroup={interaction.startDraggingGroup}
					panelSpec={panelPlacement.panelSpec}
					overlappingObjectIds={overlappingObjectIds}
					isPanning={viewport.isPanning}
					isPlacingGroup={panelPlacement.isPlacingGroup}
					handleWheel={viewport.handleWheel}
					handleMouseDown={interaction.handleMouseDown}
					handleMouseMove={interaction.handleMouseMove}
					handleMouseUp={interaction.handleMouseUp}
					handleMouseLeave={interaction.handleMouseLeave}
					handleCanvasClick={interaction.handleCanvasClick}
					zoomIn2D={viewport.zoomIn2D}
					zoomOut2D={viewport.zoomOut2D}
				/>
			)}

			{/* Column 3: Design Sidebar step component */}
			<div className="w-full md:w-[380px] bg-card/60 p-6 flex flex-col justify-between flex-shrink-0 border-l border-border gap-6 overflow-hidden h-full z-20 font-sans text-text">
				{stage === DesignStage.Roof && (
					<RoofMappingStep
						roofs={roofs}
						selectedRoofId={selection.selectedRoofId}
						setSelectedRoofId={selection.setSelectedRoofId}
						isDrawing={roofEditor.isDrawingRoofs}
						setIsDrawing={roofEditor.setIsDrawingRoofs}
						cancelDrawing={roofEditor.cancelRoofDrawing}
						deleteSelectedRoof={handleRequestDeleteRoof}
						updateSelectedRoof={roofEditor.updateSelectedRoof}
						onContinue={onContinue || (() => {})}
						unsavedRoofId={unsavedRoofId}
						onSaveRoofPoints={handleRoofPointsSaveClick}
						onCancelRoofPoints={handleRoofPointsCancel}
					/>
				)}
				{stage === DesignStage.Obstruction && (
					<ObstructionMappingStep
						roofs={roofs}
						objects={objects}
						selectedObjectId={selection.selectedObjectId}
						setSelectedObjectId={selection.setSelectedObjectId}
						objectDrawingMode={objectEditor.objectDrawingMode}
						setObjectDrawingMode={objectEditor.setObjectDrawingMode}
						deleteSelectedObject={objectEditor.deleteSelectedObject}
						duplicateSelectedObject={objectEditor.duplicateSelectedObject}
						updateSelectedObject={objectEditor.updateSelectedObject}
						onContinue={onContinue || (() => {})}
					/>
				)}
				{stage === DesignStage.PanelPlacement && (
					<PanelPlacementStep
						panelSpec={panelPlacement.panelSpec}
						targetPanelCount={panelPlacement.targetPanelCount}
						placedPanelCount={panelPlacement.placedPanelCount}
						remainingPanelSlots={panelPlacement.remainingPanelSlots}
						selectedGroup={panelPlacement.selectedGroup}
						isPlacingGroup={panelPlacement.isPlacingGroup}
						setIsPlacingGroup={panelPlacement.setIsPlacingGroup}
						openAddConfigModal={() => {
							panelPlacement.setConfigModalMode("add");
							selection.setSelectedGroupId(null);
							panelPlacement.setShowConfigModal(true);
						}}
						openEditConfigModal={() => {
							panelPlacement.setConfigModalMode("edit");
							panelPlacement.setShowConfigModal(true);
						}}
						deleteSelectedGroup={panelPlacement.deleteSelectedGroup}
						duplicateSelectedGroup={panelPlacement.duplicateSelectedGroup}
						updateSelectedGroup={panelPlacement.updateSelectedGroup}
						onContinue={panelPlacement.handlePlacementContinue}
						pendingDuplicateGroup={panelPlacement.pendingDuplicateGroup}
					/>
				)}
				{stage === DesignStage.Snapshot && (
					<SnapshotsStep
						sitevisitId={sitevisitId}
						setActiveCaptureTarget={panelPlacement.setActiveCaptureTarget}
						onContinue={onContinue || (() => {})}
					/>
				)}
			</div>

			{toastMessage && (
				<div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-2xl px-5 py-3 text-xs font-bold text-text shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-2 select-none">
					<span>{toastMessage}</span>
					<button onClick={() => setToastMessage(null)} className="text-placeholder hover:text-text ml-2">✕</button>
				</div>
			)}

			<TableConfigModal
				visible={panelPlacement.showConfigModal}
				onClose={() => panelPlacement.setShowConfigModal(false)}
				remainingSlots={panelPlacement.configModalRemainingSlots}
				initialConfig={panelPlacement.configModalMode === "edit" ? panelPlacement.selectedGroup as any : panelPlacement.placementConfig}
				onConfirm={panelPlacement.handleConfigConfirm}
				panelSpec={panelPlacement.panelSpec}
				mode={panelPlacement.configModalMode}
			/>

			<SaveRoofPointsModal
				isOpen={isSavePointsModalOpen}
				onClose={() => setIsSavePointsModalOpen(false)}
				onConfirm={handleConfirmSaveRoofPoints}
			/>

			<DeleteRoofConfirmModal
				isOpen={isDeleteConfirmOpen}
				onClose={() => {
					setIsDeleteConfirmOpen(false);
					setRoofToDeleteId(null);
				}}
				onConfirm={handleConfirmDeleteRoof}
				roofName={roofs.find((r) => r.id === roofToDeleteId)?.name}
			/>

		</div>
	);
}
