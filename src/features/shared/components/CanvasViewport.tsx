import React from "react";
import SVGCanvas from "./SVGCanvas";
import { Plus, Minus } from "lucide-react";
import type { RoofData, PlacedPanelGroup } from "../types";
import type { LocalObject, PanelSpec } from "../../../utils/design/types";

interface CanvasViewportProps {
	viewportRef: React.RefObject<HTMLDivElement | null>;
	innerContainerRef: React.RefObject<HTMLDivElement | null>;
	scale: number;
	panOffset: { x: number; y: number };
	imageUrl: string;
	widthMeters: number;
	heightMeters: number;
	stage: string;
	roofs: RoofData[];
	selectedRoofId: string | null;
	setSelectedRoofId: (id: string | null) => void;
	isDrawingRoofs: boolean;
	currentPoints: [number, number][];
	mousePosMeters: [number, number] | null;
	wallStartPoint: [number, number] | null;
	objectDrawingMode: string;
	objects: LocalObject[];
	selectedObjectId: string | null;
	setSelectedObjectId: (id: string | null) => void;
	startDraggingRoofVertex: (e: React.MouseEvent, id: string, idx: number) => void;
	startDraggingObject: (e: React.MouseEvent, id: string) => void;
	startDraggingObjectVertex: (e: React.MouseEvent, id: string, idx: number) => void;
	panelGroups: PlacedPanelGroup[];
	selectedGroupId: string | null;
	setSelectedGroupId: (id: string | null) => void;
	startDraggingGroup: (e: React.MouseEvent, id: string) => void;
	panelSpec: PanelSpec | null;
	overlappingObjectIds?: Set<string>;
	isPanning: boolean;
	isPlacingGroup: boolean;
	handleWheel: (e: React.WheelEvent) => void;
	handleMouseDown: (e: React.MouseEvent) => void;
	handleMouseMove: (e: React.MouseEvent) => void;
	handleMouseUp: () => void;
	handleMouseLeave: () => void;
	handleCanvasClick: (e: React.MouseEvent) => void;
	zoomIn2D: () => void;
	zoomOut2D: () => void;
	helperText?: string | null;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
	viewportRef,
	innerContainerRef,
	scale,
	panOffset,
	imageUrl,
	widthMeters,
	heightMeters,
	stage,
	roofs,
	selectedRoofId,
	setSelectedRoofId,
	isDrawingRoofs,
	currentPoints,
	mousePosMeters,
	wallStartPoint,
	objectDrawingMode,
	objects,
	selectedObjectId,
	setSelectedObjectId,
	startDraggingRoofVertex,
	startDraggingObject,
	startDraggingObjectVertex,
	panelGroups,
	selectedGroupId,
	setSelectedGroupId,
	startDraggingGroup,
	panelSpec,
	overlappingObjectIds,
	isPanning,
	isPlacingGroup,
	handleWheel,
	handleMouseDown,
	handleMouseMove,
	handleMouseUp,
	handleMouseLeave,
	handleCanvasClick,
	zoomIn2D,
	zoomOut2D,
	helperText,
}) => {
	return (
		<div
			ref={viewportRef}
			onWheel={handleWheel}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseUp={handleMouseUp}
			onMouseLeave={handleMouseLeave}
			onClick={handleCanvasClick}
			className={`flex-grow flex-1 h-full bg-background flex items-center justify-center relative overflow-hidden p-6 border-r border-border ${
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
				className="relative w-full max-w-[70vh] aspect-square border border-border rounded-3xl overflow-hidden shadow-2xl bg-card select-none flex items-center justify-center transition-transform duration-75 ease-out"
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
					overlappingObjectIds={overlappingObjectIds}
				/>
			</div>

			{helperText && (
				<div className="absolute top-6 left-1/2 -translate-x-1/2 bg-card/95 border border-border rounded-2xl px-5 py-2.5 text-[11px] font-bold text-text shadow-xl z-30 pointer-events-none text-center max-w-[92%] animate-in fade-in slide-in-from-top-4 duration-200">
					{helperText}
				</div>
			)}

			{/* 2D Zoom Control buttons overlay */}
			<div className="absolute bottom-6 right-6 flex flex-col gap-1.5 z-25">
				<button
					onClick={zoomIn2D}
					className="w-10 h-10 bg-background/75 hover:bg-background text-text rounded-xl border border-border flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
					title="Zoom In"
				>
					<Plus className="w-4.5 h-4.5" />
				</button>
				<button
					onClick={zoomOut2D}
					className="w-10 h-10 bg-background/75 hover:bg-background text-text rounded-xl border border-border flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95"
					title="Zoom Out"
				>
					<Minus className="w-4.5 h-4.5" />
				</button>
			</div>
		</div>
	);
};
