import React from "react";
import type { RoofData, PlacedPanelGroup } from "../types";
import type { LocalObject, PanelSpec } from "../../../utils/design/types";
import { getPanelsInGroup } from "../../../utils/design/coords";

// ─────────────────────────────────────────────────────────────────────────────
// VISUAL STYLING VARIABLES (Tweak handles, lines, and thicknesses here!)
// ─────────────────────────────────────────────────────────────────────────────
const ROOF_VERTEX_RADIUS = 0.7;             // Radius of selected roof vertex dots
const ROOF_LINE_STROKE_WIDTH = 0.25;          // Default roof boundary outline width
const ROOF_LINE_SELECTED_STROKE_WIDTH = 0.3; // Selected active roof boundary outline width
const VERTEX_HANDLE_STROKE_WIDTH = 0.3;      // White circle handles stroke thickness

const OBSTACLE_STROKE_WIDTH = 0.5;           // Default obstacle border outline width
const OBSTACLE_SELECTED_STROKE_WIDTH = 0.8;  // Selected obstacle border outline width

const WALL_STROKE_WIDTH = 0.6;               // Default mapped wall stroke thickness
const WALL_SELECTED_STROKE_WIDTH = 0.9;      // Selected active wall stroke thickness
const WALL_VERTEX_RADIUS = 1.2;              // End points circle handle radius of walls

const DRAFT_LINE_STROKE_WIDTH = 0.25;         // Active drawing lines stroke width
const DRAFT_GUIDE_LINE_STROKE_WIDTH = 0.5;   // Active drawing dotted guides stroke width
const DRAFT_WALL_GUIDE_STROKE_WIDTH = 0.6;   // Active drawing wall guides stroke width
const DRAFT_POLYGON_STROKE_WIDTH = 0.6;      // Active drawing polygon lines stroke width
const DRAFT_VERTEX_STROKE_WIDTH = 0.3;       // Active drawing vertex handle stroke width

interface SVGCanvasProps {
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
	startDraggingRoofVertex: (e: React.MouseEvent, roofId: string, idx: number) => void;
	startDraggingObject: (e: React.MouseEvent, objId: string) => void;
	startDraggingObjectVertex: (e: React.MouseEvent, objId: string, idx: number) => void;
	
	// Stage 5 Placement props
	panelGroups: PlacedPanelGroup[];
	selectedGroupId: string | null;
	setSelectedGroupId: (id: string | null) => void;
	startDraggingGroup: (e: React.MouseEvent, gId: string) => void;
	panelSpec: PanelSpec | null;
}

/**
 * SVGCanvas Component - Renders all 2D interactive drawings on top of the satellite image.
 */
export default function SVGCanvas({
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
}: SVGCanvasProps) {

	return (
		<svg className="absolute inset-0 w-full h-full select-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
			
			{/* ──────────────────────────────────────────────────────────────────
					LAYER A: ROOF BOUNDARIES
			 ────────────────────────────────────────────────────────────────── */}
			{roofs.map((r) => {
				const pointsStr = r.points
					.map((p) => `${(p[0] / widthMeters) * 100},${(p[1] / heightMeters) * 100}`)
					.join(" ");
				
				const isSelected = selectedRoofId === r.id;

				if (stage === "roof") {
					return (
						<g key={r.id}>
							{/* Roof polygon shape */}
							<polygon
								points={pointsStr}
								fill={isSelected ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.07)"}
								stroke={isSelected ? "#4ade80" : "#22c55e"}
								strokeWidth={isSelected ? ROOF_LINE_SELECTED_STROKE_WIDTH : ROOF_LINE_STROKE_WIDTH}
								className="cursor-pointer pointer-events-auto"
								onClick={(e) => {
									e.stopPropagation();
									if (!isDrawingRoofs) setSelectedRoofId(r.id);
								}}
							/>
							{/* Draggable corner handles (only when selected in Stage 2) */}
							{isSelected && !isDrawingRoofs && r.points.map((p, idx) => (
								<circle
									key={idx}
									cx={(p[0] / widthMeters) * 100}
									cy={(p[1] / heightMeters) * 100}
									r={ROOF_VERTEX_RADIUS}
									fill="#ffffff"
									stroke="#000000"
									strokeWidth={VERTEX_HANDLE_STROKE_WIDTH}
									className="vertex-handle cursor-move pointer-events-auto"
									onMouseDown={(e) => startDraggingRoofVertex(e, r.id, idx)}
								/>
							))}
						</g>
					);
				} else {
					// Read-only guide outline in Stage 3
					return (
						<polygon
							key={r.id}
							points={pointsStr}
							fill="rgba(34,197,94,0.07)"
							stroke="#22c55e"
							strokeWidth={ROOF_LINE_STROKE_WIDTH}
							className="pointer-events-none"
						/>
					);
				}
			})}

			{/* ──────────────────────────────────────────────────────────────────
					LAYER B: OBSTRUCTION OBJECTS
			 ────────────────────────────────────────────────────────────────── */}
			{objects.map((obj) => {
				const isSelected = selectedObjectId === obj.id;
				const strokeColor = isSelected ? "#a7ce38" : "rgba(255,255,255,0.5)";
				const fillColor = isSelected ? "rgba(167,206,56,0.15)" : "rgba(255,255,255,0.08)";

				if (stage === "roof") {
					return null;
				}

				// Stage 3: Full interactive handles for placing and editing
				if (obj.type === "cuboid") {
					const wPx = (obj.length! / widthMeters) * 100;
					const hPx = (obj.width! / heightMeters) * 100;
					const xPx = (obj.center_x / widthMeters) * 100;
					const yPx = (obj.center_y / heightMeters) * 100;

					return (
						<rect
							key={obj.id}
							x={xPx - wPx / 2}
							y={yPx - hPx / 2}
							width={wPx}
							height={hPx}
							transform={`rotate(${obj.angle}, ${xPx}, ${yPx})`}
							fill={fillColor}
							stroke={strokeColor}
							strokeWidth={isSelected ? OBSTACLE_SELECTED_STROKE_WIDTH : OBSTACLE_STROKE_WIDTH}
							className="object-handle cursor-move pointer-events-auto"
							onMouseDown={(e) => startDraggingObject(e, obj.id)}
							onClick={(e) => {
								e.stopPropagation();
								setSelectedObjectId(obj.id);
							}}
						/>
					);
				}

				if (obj.type === "cylinder" || obj.type === "tree") {
					const cx = (obj.center_x / widthMeters) * 100;
					const cy = (obj.center_y / heightMeters) * 100;
					const rPx = (obj.radius! / widthMeters) * 100;

					return (
						<circle
							key={obj.id}
							cx={cx}
							cy={cy}
							r={rPx}
							fill={obj.type === "tree" ? "rgba(34,197,94,0.18)" : fillColor}
							stroke={obj.type === "tree" ? (isSelected ? "#a7ce38" : "rgba(34,197,94,0.6)") : strokeColor}
							strokeWidth={isSelected ? OBSTACLE_SELECTED_STROKE_WIDTH : OBSTACLE_STROKE_WIDTH}
							className="object-handle cursor-move pointer-events-auto"
							onMouseDown={(e) => startDraggingObject(e, obj.id)}
							onClick={(e) => {
								e.stopPropagation();
								setSelectedObjectId(obj.id);
							}}
						/>
					);
				}

				if (obj.type === "wall" && obj.p1 && obj.p2) {
					const x1 = (obj.p1[0] / widthMeters) * 100;
					const y1 = (obj.p1[1] / heightMeters) * 100;
					const x2 = (obj.p2[0] / widthMeters) * 100;
					const y2 = (obj.p2[1] / heightMeters) * 100;

					return (
						<g key={obj.id}>
							{/* Fatter transparent helper line for easier mouse grab selection */}
							<line
								x1={x1}
								y1={y1}
								x2={x2}
								y2={y2}
								stroke="transparent"
								strokeWidth="2.5"
								className="object-handle cursor-move pointer-events-auto"
								onMouseDown={(e) => startDraggingObject(e, obj.id)}
								onClick={(e) => {
									e.stopPropagation();
									setSelectedObjectId(obj.id);
								}}
							/>
							{/* Visual wall stroke */}
							<line
								x1={x1}
								y1={y1}
								x2={x2}
								y2={y2}
								stroke={strokeColor}
								strokeWidth={isSelected ? WALL_SELECTED_STROKE_WIDTH : WALL_STROKE_WIDTH}
							/>
							{/* Draggable wall endpoints */}
							{isSelected && (
								<>
									<circle
										cx={x1}
										cy={y1}
										r={WALL_VERTEX_RADIUS}
										fill="#ffffff"
										stroke="#000000"
										strokeWidth={VERTEX_HANDLE_STROKE_WIDTH}
										className="vertex-handle cursor-move pointer-events-auto"
										onMouseDown={(e) => startDraggingObjectVertex(e, obj.id, 0)}
									/>
									<circle
										cx={x2}
										cy={y2}
										r={WALL_VERTEX_RADIUS}
										fill="#ffffff"
										stroke="#000000"
										strokeWidth={VERTEX_HANDLE_STROKE_WIDTH}
										className="vertex-handle cursor-move pointer-events-auto"
										onMouseDown={(e) => startDraggingObjectVertex(e, obj.id, 1)}
									/>
								</>
							)}
						</g>
					);
				}

				if (obj.type === "polygon" && obj.polygon) {
					const pointsStr = obj.polygon
						.map((p) => `${(p[0] / widthMeters) * 100},${(p[1] / heightMeters) * 100}`)
						.join(" ");

					return (
						<g key={obj.id}>
							<polygon
								points={pointsStr}
								fill={fillColor}
								stroke={strokeColor}
								strokeWidth={isSelected ? OBSTACLE_SELECTED_STROKE_WIDTH : OBSTACLE_STROKE_WIDTH}
								className="object-handle cursor-move pointer-events-auto"
								onMouseDown={(e) => startDraggingObject(e, obj.id)}
								onClick={(e) => {
									e.stopPropagation();
									setSelectedObjectId(obj.id);
								}}
							/>
							{/* Draggable polygon corner handles */}
							{isSelected &&
								obj.polygon.map((p, idx) => (
									<circle
										key={idx}
										cx={(p[0] / widthMeters) * 100}
										cy={(p[1] / heightMeters) * 100}
										r={WALL_VERTEX_RADIUS}
										fill="#ffffff"
										stroke="#000000"
										strokeWidth={VERTEX_HANDLE_STROKE_WIDTH}
										className="vertex-handle cursor-move pointer-events-auto"
										onMouseDown={(e) => startDraggingObjectVertex(e, obj.id, idx)}
									/>
								))}
						</g>
					);
				}

				return null;
			})}

			{/* ──────────────────────────────────────────────────────────────────
					LAYER C: ACTIVE DRAWING OVERLAYS (DRAFTS)
			 ────────────────────────────────────────────────────────────────── */}
			
			{/* Stage 2 active roof outline draft */}
			{stage === "roof" && isDrawingRoofs && currentPoints.length > 0 && (
				<g>
					{/* Interior tint for draft roof */}
					<polygon
						points={currentPoints
							.map((p) => `${(p[0] / widthMeters) * 100},${(p[1] / heightMeters) * 100}`)
							.join(" ")}
						fill="rgba(34,197,94,0.07)"
						stroke="none"
					/>
					{/* Thin, straight connected borders */}
					<polyline
						points={currentPoints
							.map((p) => `${(p[0] / widthMeters) * 100},${(p[1] / heightMeters) * 100}`)
							.join(" ")}
						fill="none"
						stroke="#ffffff"
						strokeWidth={DRAFT_LINE_STROKE_WIDTH}
					/>
					{/* Dotted cursor tracking guide to mouse */}
					{mousePosMeters && (
						<line
							x1={(currentPoints[currentPoints.length - 1][0] / widthMeters) * 100}
							y1={(currentPoints[currentPoints.length - 1][1] / heightMeters) * 100}
							x2={(mousePosMeters[0] / widthMeters) * 100}
							y2={(mousePosMeters[1] / heightMeters) * 100}
							stroke="rgba(255,255,255,0.7)"
							strokeWidth={DRAFT_GUIDE_LINE_STROKE_WIDTH}
							strokeDasharray="1.2,1.2"
						/>
					)}
					{/* Plotted draft node dots */}
					{currentPoints.map((p, idx) => (
						<circle
							key={idx}
							cx={(p[0] / widthMeters) * 100}
							cy={(p[1] / heightMeters) * 100}
							r={ROOF_VERTEX_RADIUS}
							fill="#ffffff"
							stroke="#000000"
							strokeWidth={DRAFT_VERTEX_STROKE_WIDTH}
						/>
					))}
				</g>
			)}

			{/* Stage 3 wall segments outline draft */}
			{stage === "obstruction" && objectDrawingMode === "wall" && wallStartPoint && mousePosMeters && (
				<g>
					<line
						x1={(wallStartPoint[0] / widthMeters) * 100}
						y1={(wallStartPoint[1] / heightMeters) * 100}
						x2={(mousePosMeters[0] / widthMeters) * 100}
						y2={(mousePosMeters[1] / heightMeters) * 100}
						stroke="#a7ce38"
						strokeWidth={DRAFT_WALL_GUIDE_STROKE_WIDTH}
						strokeDasharray="1.5,1.5"
					/>
					<circle
						cx={(wallStartPoint[0] / widthMeters) * 100}
						cy={(wallStartPoint[1] / heightMeters) * 100}
						r={WALL_VERTEX_RADIUS}
						fill="#a7ce38"
						stroke="#000000"
						strokeWidth={DRAFT_VERTEX_STROKE_WIDTH}
					/>
				</g>
			)}

			{/* Stage 3 custom polygon outline draft */}
			{stage === "obstruction" && objectDrawingMode === "polygon" && currentPoints.length > 0 && (
				<g>
					<polyline
						points={currentPoints
							.map((p) => `${(p[0] / widthMeters) * 100},${(p[1] / heightMeters) * 100}`)
							.join(" ")}
						fill="none"
						stroke="#a7ce38"
						strokeWidth={DRAFT_POLYGON_STROKE_WIDTH}
					/>
					{mousePosMeters && (
						<line
							x1={(currentPoints[currentPoints.length - 1][0] / widthMeters) * 100}
							y1={(currentPoints[currentPoints.length - 1][1] / heightMeters) * 100}
							x2={(mousePosMeters[0] / widthMeters) * 100}
							y2={(mousePosMeters[1] / heightMeters) * 100}
							stroke="rgba(167,206,56,0.7)"
							strokeWidth={DRAFT_GUIDE_LINE_STROKE_WIDTH}
							strokeDasharray="1.2,1.2"
						/>
					)}
					{currentPoints.map((p, idx) => (
						<circle
							key={idx}
							cx={(p[0] / widthMeters) * 100}
							cy={(p[1] / heightMeters) * 100}
							r={ROOF_VERTEX_RADIUS}
							fill={idx === 0 ? "#a7ce38" : "rgba(167,206,56,0.8)"}
							stroke="#000000"
							strokeWidth={DRAFT_VERTEX_STROKE_WIDTH}
						/>
					))}
				</g>
			)}

			{/* ──────────────────────────────────────────────────────────────────
					LAYER D: PANEL STRUCTURES (STAGE 5/PLACEMENT ONLY)
			 ────────────────────────────────────────────────────────────────── */}
			{stage === "placement" && panelGroups.map((g) => {
				const isSelected = selectedGroupId === g.id;
				const panels = getPanelsInGroup(g, panelSpec);
				const orientation = g.orientation || "portrait";
				const L = (panelSpec?.length || 2279) / 1000;
				const W = (panelSpec?.width || 1134) / 1000;
				const pW = orientation === "portrait" ? W : L;
				const pH = orientation === "portrait" ? L : W;

				return (
					<g
						key={g.id}
						className="cursor-move pointer-events-auto"
						onMouseDown={(e) => startDraggingGroup(e, g.id)}
						onClick={(e) => {
							e.stopPropagation();
							setSelectedGroupId(g.id);
						}}
					>
						{panels.map((p) => {
							const xPx = (p.x / widthMeters) * 100;
							const yPx = (p.y / heightMeters) * 100;
							const wPx = (pW / widthMeters) * 100;
							const hPx = (pH / heightMeters) * 100;

							return (
								<g key={p.id}>
									<rect
										x={xPx - wPx / 2}
										y={yPx - hPx / 2}
										width={wPx}
										height={hPx}
										transform={`rotate(${g.table_angle || 0}, ${xPx}, ${yPx})`}
										fill={isSelected ? "rgba(167,206,56,0.35)" : "rgba(34,197,94,0.22)"}
										stroke={isSelected ? "#a7ce38" : "#22c55e"}
										strokeWidth={isSelected ? 0.35 : 0.22}
									/>
									<line
										x1={xPx - wPx / 2}
										y1={yPx}
										x2={xPx + wPx / 2}
										y2={yPx}
										transform={`rotate(${g.table_angle || 0}, ${xPx}, ${yPx})`}
										stroke="rgba(255,255,255,0.12)"
										strokeWidth={0.1}
									/>
									<line
										x1={xPx}
										y1={yPx - hPx / 2}
										x2={xPx}
										y2={yPx + hPx / 2}
										transform={`rotate(${g.table_angle || 0}, ${xPx}, ${yPx})`}
										stroke="rgba(255,255,255,0.12)"
										strokeWidth={0.1}
									/>
								</g>
							);
						})}
					</g>
				);
			})}
		</svg>
	);
}
