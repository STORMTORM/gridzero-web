import { useState, useEffect, useMemo } from "react";
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
}: UnifiedDesignStepProps) {

	// ────────────────────────────────────────────────────────────────────────
	// CORE DATA STATES (Synchronous single source of truth)
	// ────────────────────────────────────────────────────────────────────────
	const [roofs, setRoofs] = useState<RoofData[]>(initialRoofs);
	const [objects, setObjects] = useState<LocalObject[]>(initialObjects);
	const [panelGroups, setPanelGroups] = useState<PlacedPanelGroup[]>(initialPanelGroups);
	const [loadedSitevisitId, setLoadedSitevisitId] = useState<string | null>(null);
	
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	// Dragging states
	const [activeDrag, setActiveDrag] = useState<DragState | null>(null);

	// Sync initial collections from server props only on first load/project switch
	useEffect(() => {
		if (sitevisitId !== loadedSitevisitId) {
			setRoofs(initialRoofs);
			setObjects(initialObjects);
			setPanelGroups(initialPanelGroups);
			setLoadedSitevisitId(sitevisitId);
		}
	}, [initialRoofs, initialObjects, initialPanelGroups, sitevisitId, loadedSitevisitId]);

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
	});

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

	return (
		<div className="flex-grow w-full flex flex-col md:flex-row overflow-hidden relative">

			{/* Column 1: 2D drawing canvas */}
			{stage !== DesignStage.Snapshot && (
				<CanvasViewport
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
					panelGroups={panelGroups}
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

			{/* Column 2: 3D live preview container */}
			<ThreeDViewport
				liveSceneData={liveSceneData}
				stage={stage}
				activeCaptureTarget={panelPlacement.activeCaptureTarget}
			/>

			{/* Column 3: Design Sidebar step component */}
			<div className="w-full md:w-[380px] bg-neutral-900/60 p-6 flex flex-col justify-between flex-shrink-0 border-l border-white/10 gap-6 overflow-y-auto z-20 font-sans text-neutral-200">
				{stage === DesignStage.Roof && (
					<RoofMappingStep
						roofs={roofs}
						selectedRoofId={selection.selectedRoofId}
						setSelectedRoofId={selection.setSelectedRoofId}
						isDrawing={roofEditor.isDrawingRoofs}
						setIsDrawing={roofEditor.setIsDrawingRoofs}
						currentPoints={roofEditor.currentPoints}
						undoLastPoint={roofEditor.undoLastRoofPoint}
						cancelDrawing={roofEditor.cancelRoofDrawing}
						deleteSelectedRoof={roofEditor.deleteSelectedRoof}
						updateSelectedRoof={roofEditor.updateSelectedRoof}
						onContinue={onContinue || (() => {})}
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
				<div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900 border border-white/10 rounded-2xl px-5 py-3 text-xs font-bold text-white shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 flex items-center gap-2 select-none">
					<span className="text-amber-500">⚠️</span>
					<span>{toastMessage}</span>
					<button onClick={() => setToastMessage(null)} className="text-neutral-500 hover:text-white ml-2">✕</button>
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

		</div>
	);
}
