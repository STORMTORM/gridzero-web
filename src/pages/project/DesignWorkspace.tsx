import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import api from "../../api/client";
import ProjectTopbar from "../../components/ProjectTopbar";
import RoofMappingStep from "../../components/design/RoofMappingStep";
import type { SceneData } from "../../utils/design/types";

interface RoofData {
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

export default function DesignWorkspace() {
	const { id } = useParams<{ id: string }>();

	// Project & Map Metadata
	const [projectName, setProjectName] = useState("");
	const [loading, setLoading] = useState(true);
	const [imageUrl, setImageUrl] = useState("");
	const [widthMeters, setWidthMeters] = useState(50);
	const [heightMeters, setHeightMeters] = useState(50);
	const [initialRoofs, setInitialRoofs] = useState<RoofData[]>([]);

	const [sceneData, setSceneData] = useState<SceneData | null>(null);

	// UI State Indicators
	const [_saving, setSaving] = useState(false);

	// Fetch map capture details and existing roof layouts from database
	useEffect(() => {
		if (!id) return;
		const fetchDesignData = async () => {
			try {
				setLoading(true);
				const [mapRes, sceneRes] = await Promise.all([
					api.get(`/visit/map/${id}`),
					api.get(`/visit/3d/${id}`)
				]);
				const data = mapRes.data;
				const sceneDataPayload = sceneRes.data as SceneData;

				setProjectName(data.map_details?.project_name || data.project_name || `Project ${id}`);
				const imgUrl = data.image_link || data.file_url || data.map_image_url || data.image_url || "";
				setImageUrl(imgUrl);
				
				const wMeters = parseFloat(data.map_details?.width_meters || data.width_meters || 50);
				const hMeters = parseFloat(data.map_details?.height_meters || data.height_meters || 50);
				setWidthMeters(wMeters);
				setHeightMeters(hMeters);

				setSceneData(sceneDataPayload);

				if (imgUrl) {
					const img = new Image();
					img.src = imgUrl;
					img.onload = () => {
						const naturalW = img.naturalWidth || 1000;
						const naturalH = img.naturalHeight || 1000;

						if (data.roofs) {
							const parsedRoofs: RoofData[] = Object.entries(data.roofs).map(([roofId, roofInfo]: [string, any]) => {
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

								const walls = data.walls || {};
								const relatedWalls = Object.values(walls).filter((w: any) => w.roof_id === roofId);
								const hasParapet = relatedWalls.length > 0;
								const firstWall = relatedWalls[0] as any;

								return {
									id: roofId,
									name: roofInfo.name || "Roof Boundary",
									height: roofInfo.height || 3,
									points,
									area: roofInfo.area || 0,
									parapetEnabled: hasParapet,
									parapetHeight: hasParapet ? (firstWall.z_end - firstWall.z_init) : 1,
									parapetThickness: hasParapet ? (firstWall.thickness || 0.23) : 0.23,
									parapetSetback: hasParapet ? (firstWall.setback || 0) : 0,
								};
							});
							setInitialRoofs(parsedRoofs);
						}
						setLoading(false);
					};
					img.onerror = () => {
						setLoading(false);
					};
				} else {
					setLoading(false);
				}
			} catch (err) {
				console.error("Failed to load project details for design workspace", err);
				setLoading(false);
			}
		};
		fetchDesignData();
	}, [id]);

	if (loading) {
		return (
			<div className="flex-grow flex items-center justify-center bg-black h-screen w-screen overflow-hidden">
				<div className="flex flex-col items-center gap-3">
					<RefreshCw className="w-8 h-8 text-white animate-spin" />
					<span className="text-sm font-semibold text-neutral-400 animate-pulse">Loading design cockpit...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen w-screen bg-black overflow-hidden text-neutral-100 font-sans select-none">
			
			{/* Project Workspace header */}
			<ProjectTopbar
				projectName={projectName}
				currentStage={2}
			/>

			{/* Main Split Layout Panel */}
			<div className="flex-grow w-full flex flex-col md:flex-row overflow-hidden relative">
				
				<RoofMappingStep
					sitevisitId={id || ""}
					widthMeters={widthMeters}
					heightMeters={heightMeters}
					imageUrl={imageUrl}
					initialRoofs={initialRoofs}
					onSaveStatusChange={setSaving}
					sceneData={sceneData}
				/>

			</div>

		</div>
	);
}
