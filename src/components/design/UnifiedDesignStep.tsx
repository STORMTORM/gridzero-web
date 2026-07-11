import { Plus, Minus } from "lucide-react";
import RoofMappingStep from "./RoofMappingStep";
import ObstructionMappingStep from "./ObstructionMappingStep";
import PanelPlacementStep from "./PanelPlacementStep";
import { TableConfigModal } from "./TableConfigModal";
import SnapshotsStep from "./SnapshotsStep";
import Viewer from "./3d/Viewer";
import SVGCanvas from "./SVGCanvas";
import type { SceneData, LocalObject } from "../../utils/design/types";
import type { RoofData } from "../../features/design/types";
import { useDesignEditor } from "../../features/design/hooks/useDesignEditor";

export type { RoofData };

interface UnifiedDesignStepProps {
	sitevisitId: string;
	widthMeters: number;
	heightMeters: number;
	imageUrl: string;
	initialRoofs: RoofData[];
	initialObjects: LocalObject[];
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
	stage,
	onSaveStatusChange,
	sceneData,
	onContinue,
}: UnifiedDesignStepProps) {
	
	const {
		roofs,
		objects,
		panelGroups,
		selectedRoofId,
		setSelectedRoofId,
		selectedObjectId,
		setSelectedObjectId,
		selectedGroupId,
		setSelectedGroupId,
		toastMessage,
		setToastMessage,
		objectDrawingMode,
		setObjectDrawingMode,
		currentPoints,
		isDrawingRoofs,
		setIsDrawingRoofs,
		mousePosMeters,
		wallStartPoint,
		scale,
		panOffset,
		isPanning,
		isPlacingGroup,
		setIsPlacingGroup,
		targetPanelCount,
		placementConfig,
		showConfigModal,
		setShowConfigModal,
		configModalMode,
		setConfigModalMode,
		activeCaptureTarget,
		setActiveCaptureTarget,
		
		// Derived
		placedPanelCount,
		remainingPanelSlots,
		selectedGroup,
		configModalRemainingSlots,
		liveSceneData,
		panelSpec,

		// Actions
		deleteSelectedGroup,
		updateSelectedGroup,
		handleConfigConfirm,
		startDraggingRoofVertex,
		startDraggingObject,
		startDraggingObjectVertex,
		startDraggingGroup,
		handleCanvasClick,
		deleteSelectedRoof,
		updateSelectedRoof,
		undoLastRoofPoint,
		cancelRoofDrawing,
		deleteSelectedObject,
		updateSelectedObject,
		handleWheel,
		zoomIn2D,
		zoomOut2D,
		handleMouseDown,
		handleMouseMove,
		handleMouseUp,
		handleMouseLeave,
		handlePlacementContinue,

		// Refs
		viewportRef,
		innerContainerRef,
	} = useDesignEditor({
		sitevisitId,
		widthMeters,
		heightMeters,
		initialRoofs,
		initialObjects,
		stage,
		onSaveStatusChange,
		sceneData,
		onContinue,
	});

	return (
		<div className="flex-grow w-full flex flex-col md:flex-row overflow-hidden relative">

			{/* Column 1: 2D drawing canvas */}
			{stage !== "snapshots" && (
				<div
					ref={viewportRef}
					onWheel={handleWheel}
					onMouseDown={handleMouseDown}
					onMouseMove={handleMouseMove}
					onMouseUp={handleMouseUp}
					onMouseLeave={handleMouseLeave}
					onClick={handleCanvasClick}
					className={`flex-grow flex-1 h-full bg-neutral-950 flex items-center justify-center relative overflow-hidden p-6 border-r border-white/10 ${
						(isDrawingRoofs || objectDrawingMode !== "none" || isPlacingGroup) ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab"
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

						{/* SVG vector drawings Overlay Canvas */}
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
							panelGroups={panelGroups}
							selectedGroupId={selectedGroupId}
							setSelectedGroupId={setSelectedGroupId}
							startDraggingGroup={startDraggingGroup}
							panelSpec={panelSpec}
						/>
					</div>

					{stage === "placement" && isPlacingGroup && (
						<div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/75 border border-white/10 rounded-2xl px-4 py-2 text-[11px] font-bold text-white shadow-xl z-30 pointer-events-none">
							Tap inside a clear roof area to place the configured table
						</div>
					)}

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
			)}

			{/* Column 2: 3D live preview container */}
			<div className="flex-grow flex-1 h-full relative overflow-hidden bg-neutral-950 border-r border-white/10">
				{liveSceneData ? (
					<>
						<Viewer data={liveSceneData} />
						{stage === "snapshots" && activeCaptureTarget && (
							<div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
								<div
									style={{ aspectRatio: activeCaptureTarget === "corner_snapshot" ? 190 / 80 : 1 }}
									className="w-full max-w-[90%] max-h-[90%] border-2 border-white rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] relative"
								>
									<div className="absolute -top-6 left-0 text-[9px] font-bold text-white uppercase tracking-wider bg-black/60 px-2 py-0.5 rounded">
										{activeCaptureTarget === "corner_snapshot" ? "Proposal Cover Frame (190:80)" : "Shadow Analysis Grid (1:1)"}
									</div>
								</div>
							</div>
						)}
					</>
				) : (
					<div className="flex flex-col items-center justify-center h-full gap-3 text-neutral-500 bg-neutral-950">
						<span className="text-xs font-semibold animate-pulse">Initializing 3D viewport...</span>
					</div>
				)}
			</div>

			{/* Column 3: Design Sidebar step component */}
			<div className="w-full md:w-[380px] bg-neutral-900/60 p-6 flex flex-col justify-between flex-shrink-0 border-l border-white/10 gap-6 overflow-y-auto z-20 font-sans text-neutral-200">
				{stage === "roof" && (
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
				)}
				{stage === "obstruction" && (
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
				{stage === "placement" && (
					<PanelPlacementStep
						panelSpec={panelSpec}
						targetPanelCount={targetPanelCount}
						placedPanelCount={placedPanelCount}
						remainingPanelSlots={remainingPanelSlots}
						selectedGroup={selectedGroup}
						isPlacingGroup={isPlacingGroup}
						setIsPlacingGroup={setIsPlacingGroup}
						openAddConfigModal={() => {
							setConfigModalMode("add");
							setSelectedGroupId(null);
							setShowConfigModal(true);
						}}
						openEditConfigModal={() => {
							setConfigModalMode("edit");
							setShowConfigModal(true);
						}}
						deleteSelectedGroup={deleteSelectedGroup}
						updateSelectedGroup={updateSelectedGroup}
						onContinue={handlePlacementContinue}
					/>
				)}
				{stage === "snapshots" && (
					<SnapshotsStep
						sitevisitId={sitevisitId}
						setActiveCaptureTarget={setActiveCaptureTarget}
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
				visible={showConfigModal}
				onClose={() => setShowConfigModal(false)}
				remainingSlots={configModalRemainingSlots}
				initialConfig={configModalMode === "edit" ? selectedGroup as any : placementConfig}
				onConfirm={handleConfigConfirm}
				panelSpec={panelSpec}
			/>

		</div>
	);
}
