import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import ProjectTopbar from "../../components/ProjectTopbar";
import UnifiedDesignStep from "../../features/shared/components/UnifiedDesignStep";
import WorkspaceSettingsModal from "../../features/shared/components/WorkspaceSettingsModal";
import type { RoofData, PlacedPanelGroup } from "../../features/shared/types";
import type { LocalObject } from "../../utils/design/types";
import { useProject } from "../../features/shared/hooks/useProject";
import { useDesign } from "../../features/shared/hooks/useDesign";
import { calculateArea } from "../../utils/design/coords";

export default function DesignWorkspace() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const stageParam = searchParams.get("stage") || "roof";

	const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

	const stage = (stageParam === "obstruction" || stageParam === "placement" || stageParam === "snapshots") ? stageParam : "roof";
	const setStage = (s: "roof" | "obstruction" | "placement" | "snapshots") => {
		setSearchParams({ stage: s });
	};

	const stageNumberMap: Record<string, number> = {
		roof: 2,
		obstruction: 3,
		placement: 5,
		snapshots: 6,
	};
	const currentStageNumber = stageNumberMap[stage] || 2;

	// UI State Indicators
	const [_saving, setSaving] = useState(false);

	const [layoutMode, setLayoutMode] = useState<"split" | "toggle">(() => {
		return (localStorage.getItem("workspace_layout_mode") as "split" | "toggle") || "split";
	});
	const [activeViewport, setActiveViewport] = useState<"2d" | "3d">("2d");
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);

	const handleSetLayoutMode = (mode: "split" | "toggle") => {
		setLayoutMode(mode);
		localStorage.setItem("workspace_layout_mode", mode);
	};

	// React Query Server States
	const { data: projectData } = useProject(id);
	const { data: designData } = useDesign(id);

	// Derive values synchronously
	const projectName = projectData?.map_details?.project_name || `Project ${id}`;
	const imageUrl = projectData?.image_link || "";
	const widthMeters = parseFloat(projectData?.map_details?.width_meters || projectData?.width_meters || 50);
	const heightMeters = parseFloat(projectData?.map_details?.height_meters || projectData?.height_meters || 50);

	// 1. Load image and get its dimensions once (only when image_link changes)
	useEffect(() => {
		if (!projectData) return;
		const imgUrl = projectData.image_link;
		if (!imgUrl) return;

		const img = new Image();
		img.src = imgUrl;
		img.onload = () => {
			setImageDimensions({
				width: img.naturalWidth || 1000,
				height: img.naturalHeight || 1000,
			});
		};
	}, [projectData?.image_link]);

	// 2. Derive layouts synchronously once data and dimensions are ready
	const initialRoofs = useMemo<RoofData[]>(() => {
		if (!projectData || !imageDimensions) return [];
		const data = projectData;
		const wMeters = parseFloat(data.map_details?.width_meters || data.width_meters || 50);
		const hMeters = parseFloat(data.map_details?.height_meters || data.height_meters || 50);
		const { width: naturalW, height: naturalH } = imageDimensions;

		if (!data.roofs) return [];

		return Object.entries(data.roofs).map(([roofId, roofInfo]: [string, any]) => {
			const rawCoords = roofInfo.roof || [];
			
			// Infer coordinate space (pixels vs meters)
			let coordSpace: "meters" | "pixels" = "meters";
			if (rawCoords.length > 0) {
				const maxX = Math.max(...rawCoords.map(([x]: number[]) => Math.abs(x)));
				const maxY = Math.max(...rawCoords.map(([_, y]: number[]) => Math.abs(y)));
				const fitsMeters = maxX <= wMeters + 1 && maxY <= hMeters + 1;
				coordSpace = fitsMeters ? "meters" : "pixels";
			}

			// Map coordinates to meters if they are stored in pixel coords
			const points: [number, number][] = rawCoords.map(([cx, cy]: number[]) => {
				if (coordSpace === "pixels") {
					return [
						(cx / naturalW) * wMeters,
						(cy / naturalH) * hMeters
					];
				}
				return [cx, cy];
			});

			const apiWalls = {
				...(data.walls || {}),
				...(data.objects?.wall || {})
			};
			const relatedWalls = Object.values(apiWalls).filter((w: any) => w.roof_id === roofId);
			
			const parapetEdges = points.map((p1: any, i: number) => {
				const p2 = points[(i + 1) % points.length];
				const matchedWall = relatedWalls.find((w: any) => {
					const wp1 = w.p1;
					const wp2 = w.p2;
					if (!wp1 || !wp2) return false;
					
					const matchesForward =
						Math.abs(p1[0] - wp1[0]) <= 0.05 &&
						Math.abs(p1[1] - wp1[1]) <= 0.05 &&
						Math.abs(p2[0] - wp2[0]) <= 0.05 &&
						Math.abs(p2[1] - wp2[1]) <= 0.05;
						
					const matchesReverse =
						Math.abs(p1[0] - wp2[0]) <= 0.05 &&
						Math.abs(p1[1] - wp2[1]) <= 0.05 &&
						Math.abs(p2[0] - wp1[0]) <= 0.05 &&
						Math.abs(p2[1] - wp1[1]) <= 0.05;
						
					return matchesForward || matchesReverse;
				});
				
				const wall = matchedWall as any;
				return {
					enabled: !!matchedWall,
					height: matchedWall ? Math.max(0, (wall.z_end || 0) - (wall.z_init || 0)) : 1.0,
					thickness: matchedWall ? (wall.thickness || 0.3) : 0.3,
					setback: matchedWall ? (wall.setback || 0) : 0,
				};
			});

			const enabledEdges = parapetEdges.filter(e => e.enabled);
			const hasParapet = enabledEdges.length > 0;
			
			let parapetSameDimensions = true;
			if (enabledEdges.length > 1) {
				const first = enabledEdges[0];
				parapetSameDimensions = enabledEdges.every(e => 
					Math.abs(e.height - first.height) < 0.01 &&
					Math.abs(e.thickness - first.thickness) < 0.01 &&
					Math.abs(e.setback - first.setback) < 0.01
				);
			}

			const firstWall = enabledEdges[0] || { height: 1.0, thickness: 0.3, setback: 0.0 };

			return {
				id: roofId,
				name: roofInfo.name || "Roof Boundary",
				height: roofInfo.height || 3,
				points,
				area: calculateArea(points),
				parapetEnabled: hasParapet,
				parapetHeight: firstWall.height,
				parapetThickness: firstWall.thickness,
				parapetSetback: firstWall.setback,
				parapetSameDimensions,
				parapetEdges,
			};
		});
	}, [projectData, imageDimensions]);

	const initialObjects = useMemo<LocalObject[]>(() => {
		if (!projectData) return [];
		const data = projectData;

		const parsedObjects: LocalObject[] = [];
		if (data.objects) {
			const categories: ("cuboid" | "cylinder" | "wall" | "polygon" | "tree")[] = ["cuboid", "cylinder", "wall", "polygon", "tree"];
			categories.forEach((cat) => {
				const catDict = data.objects[cat] || {};
				Object.entries(catDict).forEach(([key, val]: [string, any]) => {
					// Exclude parapet walls from draggable objects list
					if (cat === "wall" && val.roof_id) {
						const parentRoof = data.roofs?.[val.roof_id];
						if (parentRoof) {
							const pts = parentRoof.roof || [];
							const wp1 = val.p1;
							const wp2 = val.p2;
							if (wp1 && wp2 && pts.length > 0) {
								let isParapetEdge = false;
								for (let i = 0; i < pts.length; i++) {
									const nextIdx = (i + 1) % pts.length;
									const edgeStart = pts[i];
									const edgeEnd = pts[nextIdx];
									
									const matchesForward =
										Math.abs(edgeStart[0] - wp1[0]) <= 0.05 &&
										Math.abs(edgeStart[1] - wp1[1]) <= 0.05 &&
										Math.abs(edgeEnd[0] - wp2[0]) <= 0.05 &&
										Math.abs(edgeEnd[1] - wp2[1]) <= 0.05;
										
									const matchesReverse =
										Math.abs(edgeStart[0] - wp2[0]) <= 0.05 &&
										Math.abs(edgeStart[1] - wp2[1]) <= 0.05 &&
										Math.abs(edgeEnd[0] - wp1[0]) <= 0.05 &&
										Math.abs(edgeEnd[1] - wp1[1]) <= 0.05;
										
									if (matchesForward || matchesReverse) {
										isParapetEdge = true;
										break;
									}
								}
								if (isParapetEdge) {
									return; // Skip parapet wall objects
								}
							}
						}
					}

					parsedObjects.push({
						id: key,
						name: val.name || `${cat.toUpperCase()} ${key}`,
						type: cat,
						tag: val.tag || undefined,
						roof_id: val.roof_id || undefined,
						on_roof: val.on_roof || false,
						cast_shadow: val.cast_shadow !== false,
						center_x: val.center_x ?? 0,
						center_y: val.center_y ?? 0,
						z_init: val.z_init ?? 0,
						z_end: val.z_end ?? 3,
						length: val.length ?? 2,
						width: val.width ?? 2,
						angle: val.angle ?? 0,
						radius: val.radius ?? 1,
						p1: val.p1 || undefined,
						p2: val.p2 || undefined,
						thickness: val.thickness ?? 0.23,
						polygon: val.polygon || undefined,
					});
				});
			});
		}
		return parsedObjects;
	}, [projectData]);

	const initialPanelGroups = useMemo<PlacedPanelGroup[]>(() => {
		const groups: PlacedPanelGroup[] = [];
		if (designData && designData.panel_groups) {
			Object.entries(designData.panel_groups).forEach(([gId, g]: [string, any]) => {
				const matched = designData.panel_placements?.filter((p: any) => p.group_id === gId) || [];
				if (matched.length > 0) {
					const sumX = matched.reduce((sum: number, p: any) => sum + p.center_x, 0);
					const sumY = matched.reduce((sum: number, p: any) => sum + p.center_y, 0);
					groups.push({
						...g,
						id: gId,
						center_x: sumX / matched.length,
						center_y: sumY / matched.length,
					});
				}
			});
		}
		return groups;
	}, [designData]);

	const loading = !projectData || !designData || !imageDimensions;

	if (loading) {
		return (
			<div className="flex-grow flex items-center justify-center bg-background h-screen w-screen overflow-hidden">
				<div className="flex flex-col items-center gap-3">
					<RefreshCw className="w-8 h-8 text-text animate-spin" />
					<span className="text-sm font-semibold text-placeholder animate-pulse">Loading...</span>
				</div>
			</div>
		);
	}

	const handleContinue = () => {
		if (stage === "roof") setStage("obstruction");
		else if (stage === "obstruction") {
			navigate(`/project/${id}/equipment`);
		}
		else if (stage === "placement") setStage("snapshots");
		else if (stage === "snapshots") {
			navigate(`/project/${id}/pricing`);
		}
	};

	return (
		<div className="flex flex-col h-screen w-screen bg-background overflow-hidden text-text font-sans select-none">
			
			{/* Project Workspace header */}
			<ProjectTopbar
				projectName={projectName}
				currentStage={currentStageNumber}
				saving={_saving}
				onOpenSettings={() => setIsSettingsOpen(true)}
			/>

			{/* Main Split Layout Panel */}
			<div className="flex-grow w-full flex flex-col md:flex-row overflow-hidden relative">
				<UnifiedDesignStep
					sitevisitId={id!}
					widthMeters={widthMeters}
					heightMeters={heightMeters}
					imageUrl={imageUrl}
					initialRoofs={initialRoofs}
					initialObjects={initialObjects}
					initialPanelGroups={initialPanelGroups}
					stage={stage}
					onSaveStatusChange={setSaving}
					sceneData={designData}
					onContinue={handleContinue}
					layoutMode={layoutMode}
					activeViewport={activeViewport}
					setActiveViewport={setActiveViewport}
				/>
			</div>

			<WorkspaceSettingsModal
				isOpen={isSettingsOpen}
				onClose={() => setIsSettingsOpen(false)}
				layoutMode={layoutMode}
				setLayoutMode={handleSetLayoutMode}
			/>

		</div>
	);
}
