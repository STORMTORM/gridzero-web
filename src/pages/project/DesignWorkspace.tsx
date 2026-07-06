import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import api from "../../api/client";
import ProjectTopbar from "../../components/ProjectTopbar";
import UnifiedDesignStep from "../../components/design/UnifiedDesignStep";
import type { RoofData } from "../../components/design/UnifiedDesignStep";
import type { SceneData, LocalObject } from "../../utils/design/types";

export default function DesignWorkspace() {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();

	// Project & Map Metadata
	const [projectName, setProjectName] = useState("");
	const [loading, setLoading] = useState(true);
	const [imageUrl, setImageUrl] = useState("");
	const [widthMeters, setWidthMeters] = useState(50);
	const [heightMeters, setHeightMeters] = useState(50);
	const [initialRoofs, setInitialRoofs] = useState<RoofData[]>([]);
	const [initialObjects, setInitialObjects] = useState<LocalObject[]>([]);
	const [stage, setStage] = useState<number>(2);

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

								const apiWalls = {
									...(data.walls || {}),
									...(data.objects?.wall || {})
								};
								const relatedWalls = Object.values(apiWalls).filter((w: any) => w.roof_id === roofId);
								const hasParapet = relatedWalls.length > 0;
								const firstWall = relatedWalls[0] as any;

								return {
									id: roofId,
									name: roofInfo.name || "Roof Boundary",
									height: roofInfo.height || 3,
									points,
									area: roofInfo.area || 0,
									parapetEnabled: hasParapet,
									parapetHeight: hasParapet ? Math.max(0, (firstWall.z_end || 0) - (firstWall.z_init || 0)) : 1,
									parapetThickness: hasParapet ? (firstWall.thickness || 0.23) : 0.23,
									parapetSetback: hasParapet ? (firstWall.setback || 0) : 0,
								};
							});
							setInitialRoofs(parsedRoofs);
						}

						// Parse objects
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
						setInitialObjects(parsedObjects);

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
				currentStage={stage}
			/>

			{/* Main Split Layout Panel */}
			<div className="flex-grow w-full flex flex-col md:flex-row overflow-hidden relative">
				
				<UnifiedDesignStep
					sitevisitId={id || ""}
					widthMeters={widthMeters}
					heightMeters={heightMeters}
					imageUrl={imageUrl}
					initialRoofs={initialRoofs}
					initialObjects={initialObjects}
					stage={stage}
					onSaveStatusChange={setSaving}
					sceneData={sceneData}
					onContinue={() => {
						if (stage === 2) {
							setStage(3);
						} else {
							navigate("/");
						}
					}}
				/>

			</div>

		</div>
	);
}
