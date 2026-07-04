import { useState, useEffect, useRef, useMemo } from "react";
import { PenTool, Plus, Minus } from "lucide-react";
import api from "../../api/client";
import DesignSidebar from "./DesignSidebar";
import Viewer from "./3d/Viewer";
import type { SceneData } from "../../utils/design/types";

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

interface RoofMappingStepProps {
	sitevisitId: string;
	widthMeters: number;
	heightMeters: number;
	imageUrl: string;
	initialRoofs: RoofData[];
	onSaveStatusChange?: (saving: boolean) => void;
	sceneData?: SceneData | null;
}

export default function RoofMappingStep({
	sitevisitId,
	widthMeters,
	heightMeters,
	imageUrl,
	initialRoofs,
	onSaveStatusChange,
	sceneData,
}: RoofMappingStepProps) {

	// Drawing Engine States
	const [roofs, setRoofs] = useState<RoofData[]>(initialRoofs);
	const [selectedRoofId, setSelectedRoofId] = useState<string | null>(null);
	const [isDrawing, setIsDrawing] = useState(false);
	const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]); // in meters [x, y]
	const [mousePosMeters, setMousePosMeters] = useState<[number, number] | null>(null);

	// Compute reactive live scene data to update the 3D model in real time
	const liveSceneData = useMemo(() => {
		if (!sceneData) return null;

		const payloadRoofs: Record<string, { name: string; height: number; area: number; roof: [number, number][] }> = {};
		const payloadWalls: Record<string, any> = {};
		let wallCounter = 0;

		roofs.forEach((r) => {
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
					const wallId = `wall_${r.id}_edge_${i}`;
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

		return {
			...sceneData,
			roofs: payloadRoofs,
			objects: {
				...sceneData.objects,
				wall: payloadWalls,
			},
		};
	}, [sceneData, roofs]);

	// Viewport Transform States
	const [scale, setScale] = useState(1);
	const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const [panStart, setPanStart] = useState({ x: 0, y: 0 });
	const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });

	// Vertex Drag Editing State
	const [activeDragVertex, setActiveDragVertex] = useState<{ roofId: string; pointIdx: number } | null>(null);

	// UI State Indicators
	const [saving, setSaving] = useState(false);
	const [isDirty, setIsDirty] = useState(false);

	const viewportRef = useRef<HTMLDivElement>(null);
	const innerContainerRef = useRef<HTMLDivElement>(null);

	// Keep parent updated with saving state changes
	useEffect(() => {
		if (onSaveStatusChange) {
			onSaveStatusChange(saving);
		}
	}, [saving, onSaveStatusChange]);

	// Sync local roofs state if props initialRoofs changes
	useEffect(() => {
		setRoofs(initialRoofs);
	}, [initialRoofs]);

	// Shoelace Area Calculation
	const calculateArea = (pts: [number, number][]): number => {
		if (pts.length < 3) return 0;
		let area = 0;
		for (let i = 0; i < pts.length; i++) {
			const p1 = pts[i];
			const p2 = pts[(i + 1) % pts.length];
			area += (p1[0] + p2[0]) * (p1[1] - p2[1]);
		}
		return Math.abs(area / 2);
	};

	// Helper to generate UUIDs
	const generateUUID = () => {
		return "roof_" + Math.random().toString(36).substr(2, 9);
	};

	// Compile local roofs/walls state into backend structure and POST
	const saveRoofDesign = async (currentRoofsList = roofs) => {
		if (!sitevisitId) return;
		setSaving(true);
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
						const wallId = `wall_${r.id}_edge_${i}`;
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
			setIsDirty(false);
		} catch (e) {
			console.error("Failed to save roof design payload", e);
		} finally {
			setSaving(false);
		}
	};

	// Autosave Debounce (2 seconds)
	useEffect(() => {
		if (!isDirty || saving) return;
		const delayDebounce = setTimeout(() => {
			saveRoofDesign();
		}, 2000);
		return () => clearTimeout(delayDebounce);
	}, [roofs, isDirty]);

	// Viewport Zoom & Pan Transform Event Handlers
	const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		const zoomFactor = 0.08;
		const direction = e.deltaY < 0 ? 1 : -1;
		const newScale = Math.max(0.5, Math.min(8, scale + direction * zoomFactor));
		setScale(newScale);
	};

	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.button !== 0) return;
		setIsPanning(true);
		setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
		setMouseDownPos({ x: e.clientX, y: e.clientY });
	};

	const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
		if (activeDragVertex && innerContainerRef.current) {
			const rect = innerContainerRef.current.getBoundingClientRect();
			const rx = (e.clientX - rect.left) / rect.width;
			const ry = (e.clientY - rect.top) / rect.height;

			const mx = Math.max(0, Math.min(widthMeters, rx * widthMeters));
			const my = Math.max(0, Math.min(heightMeters, ry * heightMeters));

			const updated = roofs.map((r) => {
				if (r.id !== activeDragVertex.roofId) return r;
				const newPoints = [...r.points];
				newPoints[activeDragVertex.pointIdx] = [mx, my];
				return {
					...r,
					points: newPoints,
					area: calculateArea(newPoints)
				};
			});
			setRoofs(updated);
			setIsDirty(true);
		} else if (isPanning) {
			setPanOffset({
				x: e.clientX - panStart.x,
				y: e.clientY - panStart.y
			});
		} else if (isDrawing && innerContainerRef.current) {
			const rect = innerContainerRef.current.getBoundingClientRect();
			const rx = (e.clientX - rect.left) / rect.width;
			const ry = (e.clientY - rect.top) / rect.height;
			setMousePosMeters([rx * widthMeters, ry * heightMeters]);
		}
	};

	const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
		if (activeDragVertex) {
			setActiveDragVertex(null);
			saveRoofDesign(roofs);
		}
		setIsPanning(false);

		const dx = e.clientX - mouseDownPos.x;
		const dy = e.clientY - mouseDownPos.y;
		const dragDist = Math.sqrt(dx * dx + dy * dy);

		if (dragDist < 5 && !activeDragVertex) {
			handleCanvasClick(e);
		}
	};

	const handleMouseLeave = () => {
		setIsPanning(false);
		setActiveDragVertex(null);
	};

	const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!isDrawing || !innerContainerRef.current) return;

		const rect = innerContainerRef.current.getBoundingClientRect();
		const rx = (e.clientX - rect.left) / rect.width;
		const ry = (e.clientY - rect.top) / rect.height;

		const mx = rx * widthMeters;
		const my = ry * heightMeters;

		if (currentPoints.length >= 3) {
			const firstPt = currentPoints[0];
			const dx = mx - firstPt[0];
			const dy = my - firstPt[1];
			const dist = Math.sqrt(dx * dx + dy * dy);

			// Tolerance snap threshold of ~1.2 meters to close polygon loop
			if (dist < 1.2) {
				closePolygon();
				return;
			}
		}

		const newPts = [...currentPoints, [mx, my] as [number, number]];
		setCurrentPoints(newPts);
		setIsDirty(true);
	};

	const closePolygon = () => {
		if (currentPoints.length < 3) return;
		const newRoofId = generateUUID();
		const area = calculateArea(currentPoints);
		const newRoof: RoofData = {
			id: newRoofId,
			name: `Roof ${roofs.length + 1}`,
			height: 3,
			points: currentPoints,
			area,
			parapetEnabled: false,
			parapetHeight: 1,
			parapetThickness: 0.23,
			parapetSetback: 0,
		};

		const updatedRoofs = [...roofs, newRoof];
		setRoofs(updatedRoofs);
		setSelectedRoofId(newRoofId);
		setCurrentPoints([]);
		setIsDrawing(false);
		setMousePosMeters(null);
		setIsDirty(true);
		saveRoofDesign(updatedRoofs);
	};

	const undoLastPoint = () => {
		if (currentPoints.length === 0) return;
		setCurrentPoints(currentPoints.slice(0, -1));
		setIsDirty(true);
	};

	const cancelDrawing = () => {
		setCurrentPoints([]);
		setIsDrawing(false);
		setMousePosMeters(null);
	};

	const deleteSelectedRoof = () => {
		if (!selectedRoofId) return;
		const updated = roofs.filter((r) => r.id !== selectedRoofId);
		setRoofs(updated);
		setSelectedRoofId(null);
		setIsDirty(true);
		saveRoofDesign(updated);
	};

	const updateSelectedRoof = (fields: Partial<RoofData>) => {
		if (!selectedRoofId) return;
		const updated = roofs.map((r) => {
			if (r.id !== selectedRoofId) return r;
			return { ...r, ...fields };
		});
		setRoofs(updated);
		setIsDirty(true);
	};

	const zoomIn2D = () => {
		setScale((prev) => Math.min(prev + 0.15, 6));
	};

	const zoomOut2D = () => {
		setScale((prev) => Math.max(prev - 0.15, 0.4));
	};


	return (
		<div className="flex-grow w-full flex flex-col md:flex-row overflow-hidden">
			
			{/* Column 1: 2D drawing canvas */}
			<div
				ref={viewportRef}
				onWheel={handleWheel}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseLeave}
				className={`flex-grow flex-1 h-full bg-neutral-950 flex items-center justify-center relative overflow-hidden p-6 border-r border-white/10 ${
					isDrawing ? "cursor-crosshair" : isPanning ? "cursor-grabbing" : "cursor-grab"
				}`}
			>
				
				{/* Drawing HUD information overlay */}
				{isDrawing && (
					<div className="absolute top-8 left-8 bg-black/80 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl text-[10px] font-semibold text-neutral-350 shadow-lg z-25 flex flex-col gap-1 pointer-events-none">
						<div className="flex items-center gap-2 text-white font-bold text-xs">
							<PenTool className="w-4 h-4 text-white animate-pulse" />
							<span>Drawing Roof Boundary</span>
						</div>
						<span>Plot nodes around roof corners. Click first vertex to finish.</span>
						{currentPoints.length >= 3 && (
							<span className="text-white font-bold mt-1">
								Live Area: {calculateArea(currentPoints).toFixed(1)} m²
							</span>
						)}
					</div>
				)}

				{/* Square Canvas Bounding Frame */}
				<div
					ref={innerContainerRef}
					style={{
						transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
						transformOrigin: "center",
					}}
					className="relative w-full max-w-[70vh] aspect-square border border-white/10 rounded-3xl overflow-hidden shadow-2xl bg-neutral-900 select-none flex items-center justify-center transition-transform duration-75 ease-out"
				>
					{/* Underlying Satellite Snapshot Image */}
					{imageUrl && (
						<img
							src={imageUrl}
							alt="Captured Map Snapshot"
							className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
							draggable={false}
						/>
					)}

					{/* SVG Vector Drawing Overlay */}
					<svg className="absolute inset-0 w-full h-full select-none z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
						
						{/* 1. Draw existing roofs */}
						{roofs.map((r) => {
							const isSelected = r.id === selectedRoofId;
							const pointsStr = r.points
								.map((p) => `${(p[0] / widthMeters) * 100},${(p[1] / heightMeters) * 100}`)
								.join(" ");

							return (
								<g key={r.id}>
									{/* Polygon bounds */}
									<polygon
										points={pointsStr}
										fill={isSelected ? "rgba(255,193,7,0.12)" : "rgba(255,193,7,0.03)"}
										stroke={isSelected ? "#ffc107" : "rgba(255,193,7,0.6)"}
										strokeWidth={isSelected ? "0.8" : "0.5"}
										onClick={(e) => {
											e.stopPropagation();
											if (!isDrawing) setSelectedRoofId(r.id);
										}}
										className="cursor-pointer transition-all animate-in fade-in duration-200"
									/>

									{/* Vertex draggable dots for selected roof */}
									{isSelected &&
										r.points.map((p, idx) => (
											<circle
												key={idx}
												cx={(p[0] / widthMeters) * 100}
												cy={(p[1] / heightMeters) * 100}
												r="1.2"
												fill="#ffffff"
												stroke="#000000"
												strokeWidth="0.4"
												className="cursor-move pointer-events-auto"
												onMouseDown={(e) => {
													e.stopPropagation();
													setActiveDragVertex({ roofId: r.id, pointIdx: idx });
												}}
											/>
										))}
								</g>
							);
						})}

						{/* 2. Drawing Path (under construction) */}
						{isDrawing && currentPoints.length > 0 && (
							<g>
								{/* Completed segments */}
								<polyline
									points={currentPoints
										.map((p) => `${(p[0] / widthMeters) * 100},${(p[1] / heightMeters) * 100}`)
										.join(" ")}
									fill="none"
									stroke="#ffc107"
									strokeWidth="0.6"
								/>

								{/* Tracking segment to current mouse pointer */}
								{mousePosMeters && (
									<line
										x1={`${(currentPoints[currentPoints.length - 1][0] / widthMeters) * 100}`}
										y1={`${(currentPoints[currentPoints.length - 1][1] / heightMeters) * 100}`}
										x2={`${(mousePosMeters[0] / widthMeters) * 100}`}
										y2={`${(mousePosMeters[1] / heightMeters) * 100}`}
										stroke="rgba(255,193,7,0.7)"
										strokeWidth="0.5"
										strokeDasharray="1.2,1.2"
									/>
								)}

								{/* Vertices handles */}
								{currentPoints.map((p, idx) => (
									<circle
										key={idx}
										cx={(p[0] / widthMeters) * 100}
										cy={(p[1] / heightMeters) * 100}
										r={idx === 0 ? "1.6" : "1.0"}
										fill={idx === 0 ? "#ffffff" : "rgba(255,255,255,0.8)"}
										stroke="#000000"
										strokeWidth="0.3"
										className={idx === 0 ? "animate-pulse" : ""}
									/>
								))}
							</g>
						)}
					</svg>
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

			{/* RIGHT: Extracted Design Sidebar Component */}
			<DesignSidebar
				currentStage={2}
				roofs={roofs}
				selectedRoofId={selectedRoofId}
				setSelectedRoofId={setSelectedRoofId}
				isDrawing={isDrawing}
				setIsDrawing={setIsDrawing}
				currentPoints={currentPoints}
				undoLastPoint={undoLastPoint}
				cancelDrawing={cancelDrawing}
				deleteSelectedRoof={deleteSelectedRoof}
				updateSelectedRoof={updateSelectedRoof}
				saveRoofDesign={saveRoofDesign}
			/>

		</div>
	);
}
