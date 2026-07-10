import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, Minus } from "lucide-react";
import api from "../../api/client";
import RoofMappingStep from "./RoofMappingStep";
import ObstructionMappingStep from "./ObstructionMappingStep";
import PanelPlacementStep from "./PanelPlacementStep";
import { TableConfigModal } from "./TableConfigModal";
import SnapshotsStep from "./SnapshotsStep";
import Viewer from "./3d/Viewer";
import SVGCanvas from "./SVGCanvas";
import { generateUUID, calculateArea, isPointInPolygon, getPanelsInGroup } from "../../utils/design/coords";
import { buildLiveSceneData } from "../../utils/design/sceneDataBuilder";
import type { SceneData, LocalObject, PanelGroup, PanelSpec } from "../../utils/design/types";

/**
 * Interface representing a custom frontend mapped roof layout structure.
 */
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
	parapetSameDimensions?: boolean;
	parapetEdges?: {
		enabled: boolean;
		height: number;
		thickness: number;
		setback: number;
	}[];
}

type PlacedPanelGroup = PanelGroup & { id: string; center_x: number; center_y: number };

export interface PlacementConfig {
	orientation: "portrait" | "landscape";
	grid_cols: number;
	grid_rows: number;
	table_angle: number;
	tilt_angle: number;
	pillar_count: number;
	cells?: { r: number; c: number }[];
	pillars_per_structure_ew?: number;
	panels_per_structure?: number;
}

const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = {
	orientation: "portrait",
	grid_cols: 5,
	grid_rows: 2,
	table_angle: 0,
	tilt_angle: 15,
	pillar_count: 2,
};

const DEFAULT_PREFERENCES = {
	front_pillar_height: 1.2192,
	back_pillar_height: 2.1336,
	module_to_module_ns: 25.4,
	module_to_module_ew: 25.4,
	row_gap: 1.6,
	col_gap: 0,
	overhang_module_length: 100,
	overhang_module_width: 100,
	pillar_to_pillar_ns: 2.2,
	pillar_to_pillar_ew: 2.0,
	rafter_overhang: 0.1,
	purlin_overhang: 0.1,
	base_height: 0.3048,
	base_length: 0.3048,
	base_width: 0.3048,
};

function groupPanelCount(g: Pick<PanelGroup, "grid_cols" | "grid_rows" | "cells">): number {
	return g.cells?.length || ((g.grid_cols || 1) * (g.grid_rows || 1));
}

function rotatePoint(x: number, y: number, cx: number, cy: number, angleDeg: number): [number, number] {
	const theta = (angleDeg * Math.PI) / 180;
	const dx = x - cx;
	const dy = y - cy;
	return [
		cx + dx * Math.cos(theta) - dy * Math.sin(theta),
		cy + dx * Math.sin(theta) + dy * Math.cos(theta),
	];
}

function panelCorners(center: [number, number], w: number, h: number, angleDeg: number): [number, number][] {
	const [cx, cy] = center;
	const raw: [number, number][] = [
		[cx - w / 2, cy - h / 2],
		[cx + w / 2, cy - h / 2],
		[cx + w / 2, cy + h / 2],
		[cx - w / 2, cy + h / 2],
	];
	return raw.map(([x, y]) => rotatePoint(x, y, cx, cy, angleDeg));
}

function rectsOverlap(a: [number, number][], b: [number, number][]): boolean {
	const axes: [number, number][] = [];
	for (const poly of [a, b]) {
		for (let i = 0; i < poly.length; i++) {
			const p1 = poly[i];
			const p2 = poly[(i + 1) % poly.length];
			const edge: [number, number] = [p2[0] - p1[0], p2[1] - p1[1]];
			axes.push([-edge[1], edge[0]]);
		}
	}
	for (const axis of axes) {
		const len = Math.hypot(axis[0], axis[1]) || 1;
		const nx = axis[0] / len;
		const ny = axis[1] / len;
		const project = (poly: [number, number][]) => {
			const vals = poly.map(([x, y]) => x * nx + y * ny);
			return [Math.min(...vals), Math.max(...vals)];
		};
		const [aMin, aMax] = project(a);
		const [bMin, bMax] = project(b);
		if (aMax < bMin || bMax < aMin) return false;
	}
	return true;
}

function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
	const vx = b[0] - a[0];
	const vy = b[1] - a[1];
	const wx = p[0] - a[0];
	const wy = p[1] - a[1];
	const c1 = vx * wx + vy * wy;
	if (c1 <= 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
	const c2 = vx * vx + vy * vy;
	if (c2 <= c1) return Math.hypot(p[0] - b[0], p[1] - b[1]);
	const t = c1 / c2;
	return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
}

function panelIntersectsObject(corners: [number, number][], obj: LocalObject): boolean {
	const center: [number, number] = [
		corners.reduce((sum, p) => sum + p[0], 0) / corners.length,
		corners.reduce((sum, p) => sum + p[1], 0) / corners.length,
	];

	if (obj.type === "cuboid") {
		const objCorners = panelCorners(
			[obj.center_x, obj.center_y],
			obj.length || 0,
			obj.width || 0,
			obj.angle || 0,
		);
		return rectsOverlap(corners, objCorners);
	}

	if (obj.type === "cylinder" || obj.type === "tree") {
		const radius = obj.radius || 0;
		if (Math.hypot(center[0] - obj.center_x, center[1] - obj.center_y) <= radius) return true;
		return corners.some((p) => Math.hypot(p[0] - obj.center_x, p[1] - obj.center_y) <= radius);
	}

	if (obj.type === "polygon" && obj.polygon?.length) {
		if (isPointInPolygon(center, obj.polygon)) return true;
		return corners.some((p) => isPointInPolygon(p, obj.polygon!));
	}

	if (obj.type === "wall" && obj.p1 && obj.p2) {
		const halfT = Math.max(0.1, (obj.thickness || 0.2) / 2);
		return corners.some((p) => distToSegment(p, obj.p1!, obj.p2!) <= halfT)
			|| distToSegment(center, obj.p1, obj.p2) <= halfT;
	}

	return false;
}

interface CategoryConfig {
	type: "cuboid" | "cylinder" | "wall" | "polygon" | "tree";
	tag?: string;
	name: string;
	on_roof: boolean;
	length?: number;
	width?: number;
	radius?: number;
	z_end?: number;
}

const CATEGORY_DEFAULTS: Record<string, CategoryConfig> = {
	ac_unit: { type: "cuboid", tag: "ac_unit", name: "AC Unit", on_roof: true, length: 1.2, width: 0.8, z_end: 1.0 },
	water_tanker: { type: "cuboid", tag: "rectangular_tank", name: "Water Tank", on_roof: true, length: 2.0, width: 2.0, z_end: 2.0 },
	elevated: { type: "cuboid", tag: "elevated", name: "Elevated Struct", on_roof: true, length: 3.0, width: 3.0, z_end: 2.5 },
	cuboid: { type: "cuboid", tag: undefined, name: "Cuboid", on_roof: true, length: 2.0, width: 2.0, z_end: 2.0 },
	dish: { type: "cylinder", tag: "dish", name: "Dish Antenna", on_roof: true, radius: 0.6, z_end: 1.2 },
	chimney: { type: "cylinder", tag: "chimney", name: "Circular Chimney", on_roof: true, radius: 0.4, z_end: 2.0 },
	cylinder: { type: "cylinder", tag: undefined, name: "Cylinder", on_roof: true, radius: 1.0, z_end: 2.0 },
	skylight: { type: "cuboid", tag: "skylight", name: "Skylight Window", on_roof: true, length: 1.5, width: 1.0, z_end: 0.2 },
	mumtee: { type: "cuboid", tag: "mumtee", name: "Mumtee", on_roof: true, length: 4.0, width: 3.5, z_end: 2.8 },
	
	tree: { type: "tree", tag: "mango", name: "Tree", on_roof: false, radius: 2.5, z_end: 8.0 },
	building: { type: "cuboid", tag: "building", name: "Adjacent Bldg", on_roof: false, length: 8.0, width: 6.0, z_end: 9.0 },
	cuboid_ground: { type: "cuboid", tag: undefined, name: "Ground Cuboid", on_roof: false, length: 3.0, width: 3.0, z_end: 3.0 },
	cylinder_ground: { type: "cylinder", tag: undefined, name: "Ground Cylinder", on_roof: false, radius: 1.5, z_end: 3.0 },
	tanker: { type: "cylinder", tag: "overhead_tank", name: "Overhead Tank", on_roof: false, radius: 2.0, z_end: 6.0 },
	tower: { type: "cuboid", tag: "tower", name: "Utility Tower", on_roof: false, length: 2.0, width: 2.0, z_end: 15.0 },
};

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

	// ────────────────────────────────────────────────────────────────────────
	// SHARED DATA STATES
	// ────────────────────────────────────────────────────────────────────────
	const [roofs, setRoofs] = useState<RoofData[]>(initialRoofs);
	const [objects, setObjects] = useState<LocalObject[]>(initialObjects);

	// Selection & Mode States
	const [selectedRoofId, setSelectedRoofId] = useState<string | null>(null);
	const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState<string | null>(null);

	// Obstruction Drawing Options
	const [objectDrawingMode, setObjectDrawingMode] = useState<string>("none");

	const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
	const [mousePosMeters, setMousePosMeters] = useState<[number, number] | null>(null);
	const [wallStartPoint, setWallStartPoint] = useState<[number, number] | null>(null);

	// Stage 5: Panel Placement States
	const [panelGroups, setPanelGroups] = useState<PlacedPanelGroup[]>([]);
	const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
	const [isPlacingGroup, setIsPlacingGroup] = useState(false);
	const [targetPanelCount, setTargetPanelCount] = useState(0);
	const [placementConfig, setPlacementConfig] = useState<PlacementConfig>(DEFAULT_PLACEMENT_CONFIG);
	const [showConfigModal, setShowConfigModal] = useState(false);
	const [configModalMode, setConfigModalMode] = useState<"add" | "edit">("add");
	const [activeCaptureTarget, setActiveCaptureTarget] = useState<string | null>(null);
	const panelSpec: PanelSpec | null = useMemo(() => sceneData?.panel_spec || null, [sceneData]);

	const handleConfigConfirm = (config: any) => {
		if (configModalMode === "edit" && selectedGroupId) {
			// Edit mode
			updateSelectedGroup({
				orientation: config.orientation,
				grid_rows: config.grid_rows,
				grid_cols: config.grid_cols,
				table_angle: config.table_angle,
				tilt_angle: config.tilt_angle,
				pillar_count: config.pillar_count,
				cells: config.cells,
				pillars_per_structure_ew: config.pillars_per_structure_ew,
				panels_per_structure: config.panels_per_structure,
			});
			setShowConfigModal(false);
		} else {
			// Place mode
			setPlacementConfig({
				orientation: config.orientation,
				grid_cols: config.grid_cols,
				grid_rows: config.grid_rows,
				table_angle: config.table_angle,
				tilt_angle: config.tilt_angle,
				pillar_count: config.pillar_count,
				cells: config.cells,
				pillars_per_structure_ew: config.pillars_per_structure_ew,
				panels_per_structure: config.panels_per_structure,
			});
			setIsPlacingGroup(true);
			setShowConfigModal(false);
		}
	};

	// Dragging states (unified)
	const [activeDrag, setActiveDrag] = useState<{
		type: "roof-vertex" | "object" | "object-vertex" | "group";
		targetId: string;
		vertexIndex?: number;
		startMousePos: [number, number];
		originalState: any;
	} | null>(null);

	// Viewport Transform States (Zoom/Pan is preserved across steps!)
	const [scale, setScale] = useState(1);
	const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const panStart = useRef({ x: 0, y: 0 });

	// Saving States
	const [savingRoofs, setSavingRoofs] = useState(false);
	const [savingObjects, setSavingObjects] = useState(false);

	const placedPanelCount = useMemo(() => {
		return panelGroups.reduce((count, g) => count + groupPanelCount(g), 0);
	}, [panelGroups]);

	const remainingPanelSlots = useMemo(() => {
		if (!targetPanelCount) return Infinity;
		return Math.max(0, targetPanelCount - placedPanelCount);
	}, [targetPanelCount, placedPanelCount]);

	const selectedGroup = useMemo(() => {
		return panelGroups.find((g) => g.id === selectedGroupId) || null;
	}, [panelGroups, selectedGroupId]);

	const selectedGroupPanelCount = selectedGroup ? groupPanelCount(selectedGroup) : 0;
	const configModalRemainingSlots = configModalMode === "edit"
		? (remainingPanelSlots === Infinity ? Infinity : remainingPanelSlots + selectedGroupPanelCount)
		: remainingPanelSlots;

	const validatePanelGroup = (group: PlacedPanelGroup, allGroups = panelGroups): string | null => {
		if (!panelSpec) return "Select equipment before placing panels.";
		const panels = getPanelsInGroup(group, panelSpec);
		if (panels.length === 0) return "This table has no panels.";

		const otherGroups = allGroups.filter((g) => g.id !== group.id);
		const otherRects = otherGroups.flatMap((g) =>
			getPanelsInGroup(g, panelSpec).map((p) => panelCorners([p.x, p.y], p.pW, p.pH, g.table_angle || 0))
		);

		for (const p of panels) {
			const corners = panelCorners([p.x, p.y], p.pW, p.pH, group.table_angle || 0);
			const roof = roofs.find((r) => corners.every((pt) => isPointInPolygon(pt, r.points)));
			if (!roof) return "Panels must fit completely inside a mapped roof boundary.";
			if (objects.some((obj) => panelIntersectsObject(corners, obj))) {
				return "Panels cannot overlap an obstruction.";
			}
			if (otherRects.some((rect) => rectsOverlap(corners, rect))) {
				return "Panels cannot overlap another table.";
			}
		}
		return null;
	};

	const updateSelectedGroup = (updates: Partial<PanelGroup>) => {
		if (!selectedGroupId) return;
		const current = panelGroups.find((g) => g.id === selectedGroupId);
		if (!current) return;
		const candidate = { ...current, ...updates };
		const nextCount = panelGroups.reduce((sum, g) => sum + groupPanelCount(g.id === selectedGroupId ? candidate : g), 0);
		if (targetPanelCount && nextCount > targetPanelCount) {
			setToastMessage(`Panel limit reached. Only ${Math.max(0, targetPanelCount - (placedPanelCount - groupPanelCount(current)))} panel(s) can fit in this table.`);
			return;
		}
		const validation = validatePanelGroup(candidate, panelGroups.map((g) => g.id === selectedGroupId ? candidate : g));
		if (validation) {
			setToastMessage(validation);
			return;
		}
		const updated = panelGroups.map((g) => {
			if (g.id === selectedGroupId) {
				return candidate;
			}
			return g;
		});
		setPanelGroups(updated);
		savePanelsDesignDebounced(updated);
	};

	const deleteSelectedGroup = () => {
		if (!selectedGroupId) return;
		const updated = panelGroups.filter((g) => g.id !== selectedGroupId);
		setPanelGroups(updated);
		setSelectedGroupId(null);
		savePanelsDesign(updated);
	};

	const viewportRef = useRef<HTMLDivElement>(null);
	const innerContainerRef = useRef<HTMLDivElement>(null);

	// Debounce and auto-save state controllers
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestRoofsRef = useRef(roofs);
	const saveObjectsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestObjectsRef = useRef(objects);
	const saveDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestPanelGroupsRef = useRef(panelGroups);
	
	useEffect(() => {
		latestRoofsRef.current = roofs;
	}, [roofs]);

	useEffect(() => {
		latestObjectsRef.current = objects;
	}, [objects]);

	useEffect(() => {
		latestPanelGroupsRef.current = panelGroups;
	}, [panelGroups]);

	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
				saveRoofDesign(latestRoofsRef.current);
			}
			if (saveObjectsTimeoutRef.current) {
				clearTimeout(saveObjectsTimeoutRef.current);
				saveObjectsDesign(latestObjectsRef.current);
			}
			if (saveDebounceTimeoutRef.current) {
				clearTimeout(saveDebounceTimeoutRef.current);
				savePanelsDesign(latestPanelGroupsRef.current);
			}
		};
	}, []);

	// Coordinate Converters: SVG percentage (0-100) <-> real-world meters
	const pxToMX = (px: number) => (px / 100) * widthMeters;
	const pxToMY = (px: number) => (px / 100) * heightMeters;



	// Auto-hide Toast Message after 5 seconds
	useEffect(() => {
		if (toastMessage) {
			const timer = setTimeout(() => setToastMessage(null), 5000);
			return () => clearTimeout(timer);
		}
	}, [toastMessage]);

	// Sync initial data from workspace
	useEffect(() => {
		setRoofs(initialRoofs);
	}, [initialRoofs]);

	useEffect(() => {
		setObjects(initialObjects);
	}, [initialObjects]);

	// Load target selections panel count
	useEffect(() => {
		if (!sitevisitId) return;
		const fetchSelectionInfo = async () => {
			try {
				const res = await api.get(`/visit/selection/info/${sitevisitId}`);
				const rawCount = res.data?.panel_count ?? res.data?.sitevisit?.panel_count;
				const count = Number(rawCount);
				setTargetPanelCount(Number.isFinite(count) && count > 0 ? count : 0);
			} catch (err) {
				console.error("Failed to fetch selection panel count info", err);
			}
		};
		fetchSelectionInfo();
	}, [sitevisitId]);

	// Populate initial panel groups from sceneData
	useEffect(() => {
		if (!sceneData) return;
		const groups: PlacedPanelGroup[] = [];
		if (sceneData.panel_groups) {
			Object.entries(sceneData.panel_groups).forEach(([gId, g]) => {
				const matched = sceneData.panel_placements?.filter((p) => p.group_id === gId) || [];
				if (matched.length > 0) {
					const sumX = matched.reduce((sum, p) => sum + p.center_x, 0);
					const sumY = matched.reduce((sum, p) => sum + p.center_y, 0);
					groups.push({
						...g,
						id: gId,
						center_x: sumX / matched.length,
						center_y: sumY / matched.length,
					});
				}
			});
		}
		setPanelGroups(groups);
	}, [sceneData]);

	// Drawing states
	const [isDrawingRoofs, setIsDrawingRoofs] = useState(false);

	// ────────────────────────────────────────────────────────────────────────
	// SAVE CALLS
	// ────────────────────────────────────────────────────────────────────────
	const saveRoofDesignDebounced = (currentRoofsList = roofs) => {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}
		saveTimeoutRef.current = setTimeout(() => {
			saveRoofDesign(currentRoofsList);
			saveTimeoutRef.current = null;
		}, 2000);
	};

	const saveRoofDesign = async (currentRoofsList = roofs) => {
		if (!sitevisitId) return;
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		setSavingRoofs(true);
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
						
						const same = r.parapetSameDimensions ?? true;
						const edge = r.parapetEdges?.[i];
						
						const isEdgeEnabled = same ? true : (edge?.enabled ?? true);
						if (!isEdgeEnabled) continue;

						const wHeight = same ? r.parapetHeight : (edge?.height ?? r.parapetHeight);
						const wThickness = same ? r.parapetThickness : (edge?.thickness ?? r.parapetThickness);
						const wSetback = same ? r.parapetSetback : (edge?.setback ?? r.parapetSetback);

						const wallId = generateUUID();
						wallCounter++;

						payloadWalls[wallId] = {
							name: `Wall ${wallCounter}`,
							z_init: r.height,
							z_end: r.height + wHeight,
							roof_id: r.id,
							p1,
							p2,
							thickness: wThickness,
							setback: wSetback,
						};
					}
				}
			});

			await api.post("/visit/roof/create", {
				sitevisit_id: sitevisitId,
				roofs: payloadRoofs,
				walls: payloadWalls,
			});
		} catch (e) {
			console.error("Failed to save roof design payload", e);
		} finally {
			setSavingRoofs(false);
		}
	};

	const saveObjectsDesignDebounced = (list: LocalObject[]) => {
		if (saveObjectsTimeoutRef.current) {
			clearTimeout(saveObjectsTimeoutRef.current);
		}
		saveObjectsTimeoutRef.current = setTimeout(() => {
			saveObjectsDesign(list);
			saveObjectsTimeoutRef.current = null;
		}, 2000);
	};

	const saveObjectsDesign = async (list: LocalObject[]) => {
		if (saveObjectsTimeoutRef.current) {
			clearTimeout(saveObjectsTimeoutRef.current);
			saveObjectsTimeoutRef.current = null;
		}
		try {
			setSavingObjects(true);
			const objectsDict: Record<string, any> = {};

			list.forEach((obj) => {
				const item: any = {
					name: obj.name,
					type: obj.type,
					tag: obj.tag || undefined,
					roof_id: obj.roof_id || undefined,
					on_roof: obj.on_roof,
					cast_shadow: obj.cast_shadow,
					center_x: obj.center_x,
					center_y: obj.center_y,
					z_init: obj.z_init,
					z_end: obj.z_end,
					length: obj.type === "cuboid" ? obj.length : undefined,
					width: obj.type === "cuboid" ? obj.width : undefined,
					angle: obj.type === "cuboid" ? obj.angle : undefined,
					radius: (obj.type === "cylinder" || obj.type === "tree") ? obj.radius : undefined,
					p1: obj.type === "wall" ? obj.p1 || undefined : undefined,
					p2: obj.type === "wall" ? obj.p2 || undefined : undefined,
					thickness: obj.type === "wall" ? obj.thickness : undefined,
					polygon: obj.type === "polygon" ? obj.polygon || undefined : undefined,
				};
				objectsDict[obj.id] = item;
			});

			await api.post("/visit/objects/create", {
				sitevisit_id: sitevisitId,
				objects: objectsDict,
			});
		} catch (error) {
			console.error("Failed to save objects design:", error);
		} finally {
			setSavingObjects(false);
		}
	};

	const [savingPanels, setSavingPanels] = useState(false);

	// Update saving status change effect to also include savingPanels
	useEffect(() => {
		onSaveStatusChange?.(savingRoofs || savingObjects || savingPanels);
	}, [savingRoofs, savingObjects, savingPanels, onSaveStatusChange]);

	const savePanelsDesign = async (currentGroups = panelGroups) => {
		try {
			setSavingPanels(true);
			const panelsPayload: Record<string, any> = {};
			const groupsPayload: Record<string, any> = {};

			currentGroups.forEach((g) => {
				const panels = getPanelsInGroup(g, panelSpec);
				
				panels.forEach((p) => {
					const roofIdx = roofs.findIndex((r) => isPointInPolygon([p.x, p.y], r.points));
					panelsPayload[p.id] = {
						center_x: p.x,
						center_y: p.y,
						angle: g.table_angle || 0,
						roof_idx: roofIdx !== -1 ? roofIdx : 0,
						group_id: g.id,
						orientation: g.orientation || "portrait",
						cell_r: p.r,
						cell_c: p.c,
						tilt_angle: g.tilt_angle || 15,
						front_pillar_height: g.front_pillar_height,
						back_pillar_height: g.back_pillar_height,
						module_to_module_ns: g.module_to_module_ns,
						module_to_module_ew: g.module_to_module_ew,
						pillar_to_pillar_ns: g.pillar_to_pillar_ns,
						pillar_to_pillar_ew: g.pillar_to_pillar_ew,
						col_gap: g.col_gap,
					};
				});

				groupsPayload[g.id] = {
					type: g.type || "table",
					orientation: g.orientation || "portrait",
					grid_rows: g.grid_rows || 1,
					grid_cols: g.grid_cols || 1,
					table_angle: g.table_angle || 0,
					tilt_angle: g.tilt_angle || 15,
					cells: g.cells || null,
					pillar_count: g.pillar_count || 2,
					front_pillar_height: g.front_pillar_height,
					back_pillar_height: g.back_pillar_height,
					module_to_module_ns: g.module_to_module_ns,
					module_to_module_ew: g.module_to_module_ew,
					row_gap: g.row_gap,
					col_gap: g.col_gap,
					overhang_module_length: g.overhang_module_length,
					overhang_module_width: g.overhang_module_width,
					pillar_to_pillar_ns: g.pillar_to_pillar_ns,
					pillar_to_pillar_ew: g.pillar_to_pillar_ew,
					rafter_overhang: g.rafter_overhang,
					purlin_overhang: g.purlin_overhang,
					base_height: g.base_height,
					base_length: g.base_length,
					base_width: g.base_width,
				};
			});

			await api.post("/visit/panels/create", {
				sitevisit_id: sitevisitId,
				panels: panelsPayload,
				groups: groupsPayload,
			});
		} catch (error) {
			console.error("Failed to save panel design:", error);
		} finally {
			setSavingPanels(false);
		}
	};

	const savePanelsDesignDebounced = (currentGroups = panelGroups) => {
		if (saveDebounceTimeoutRef.current) {
			clearTimeout(saveDebounceTimeoutRef.current);
		}
		setSavingPanels(true);
		saveDebounceTimeoutRef.current = setTimeout(async () => {
			await savePanelsDesign(currentGroups);
			saveDebounceTimeoutRef.current = null;
		}, 2000);
	};

	// Compile active state lists (roofs, objects, panels) into the structured payload expected by the 3D Viewer
	const liveSceneData = useMemo(() => {
		return buildLiveSceneData(sceneData, roofs, objects, stage, panelGroups, panelSpec);
	}, [sceneData, roofs, objects, stage, panelGroups, panelSpec]);

	const handlePlacementContinue = async () => {
		if (!panelSpec) {
			setToastMessage("No panel selected. Complete equipment selection first.");
			return;
		}
		if (placedPanelCount <= 0) {
			setToastMessage("Place at least one panel table before continuing.");
			return;
		}
		if (targetPanelCount && placedPanelCount < targetPanelCount) {
			setToastMessage(`Place ${targetPanelCount - placedPanelCount} more panel${targetPanelCount - placedPanelCount !== 1 ? "s" : ""} to match the selected capacity.`);
			return;
		}
		if (saveDebounceTimeoutRef.current) {
			clearTimeout(saveDebounceTimeoutRef.current);
			saveDebounceTimeoutRef.current = null;
		}
		await savePanelsDesign(panelGroups);
		onContinue?.();
	};

	// ────────────────────────────────────────────────────────────────────────
	// VIEWPORT ZOOM & PAN
	// ────────────────────────────────────────────────────────────────────────
	const handleWheel = (e: React.WheelEvent) => {
		const zoomIntensity = 0.08;
		e.preventDefault();
		const zoomFactor = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
		setScale((prev) => Math.max(0.4, Math.min(prev * zoomFactor, 6)));
	};

	const zoomIn2D = () => {
		setScale((prev) => Math.min(prev + 0.15, 6));
	};

	const zoomOut2D = () => {
		setScale((prev) => Math.max(prev - 0.15, 0.4));
	};

	const getMouseMeters = (e: React.MouseEvent): [number, number] => {
		if (!innerContainerRef.current) return [0, 0];
		const rect = innerContainerRef.current.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * 100;
		const py = ((e.clientY - rect.top) / rect.height) * 100;
		return [pxToMX(px), pxToMY(py)];
	};

	// ────────────────────────────────────────────────────────────────────────
	// MOUSE EVENT LIFECYCLE
	// ────────────────────────────────────────────────────────────────────────
	const handleMouseDown = (e: React.MouseEvent) => {
		if (e.button === 2) return; // Right click

		const target = e.target as SVGElement;
		const isVertex = target.classList.contains("vertex-handle");
		const isObject = target.classList.contains("object-handle");

		if (!isVertex && !isObject) {
			setIsPanning(true);
			panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
		}
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		const [mx, my] = getMouseMeters(e);
		setMousePosMeters([mx, my]);

		if (isPanning) {
			setPanOffset({
				x: e.clientX - panStart.current.x,
				y: e.clientY - panStart.current.y,
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
					const nextPoints = [...r.points];
					nextPoints[activeDrag.vertexIndex!] = [
						orig.points[activeDrag.vertexIndex!][0] + dx,
						orig.points[activeDrag.vertexIndex!][1] + dy,
					];
					return {
						...r,
						points: nextPoints,
						area: calculateArea(nextPoints),
					};
				});
				setRoofs(updatedRoofs);
						} else if (activeDrag.type === "object") {
				const updatedObjs = objects.map((obj) => {
					if (obj.id !== activeDrag.targetId) return obj;

					if (obj.type === "cuboid" || obj.type === "cylinder" || obj.type === "tree") {
						const nextX = orig.center_x + dx;
						const nextY = orig.center_y + dy;
						
						const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));

						// Enforce dragging boundary constraints:
						if (orig.on_roof && !snapRoof) {
							const current = objects.find(o => o.id === obj.id);
							return current || obj;
						}
						if (!orig.on_roof && snapRoof) {
							const current = objects.find(o => o.id === obj.id);
							return current || obj;
						}

						const onRoof = !!snapRoof;
						const roofId = snapRoof ? snapRoof.id : undefined;
						const zInit = snapRoof ? snapRoof.height : 0;
						const objHeight = orig.z_end - orig.z_init;

						return {
							...obj,
							center_x: nextX,
							center_y: nextY,
							on_roof: onRoof,
							roof_id: roofId,
							z_init: zInit,
							z_end: zInit + objHeight,
						};
					} else if (obj.type === "wall" && orig.p1 && orig.p2) {
						const nextP1: [number, number] = [orig.p1[0] + dx, orig.p1[1] + dy];
						const nextP2: [number, number] = [orig.p2[0] + dx, orig.p2[1] + dy];
						const nextX = (nextP1[0] + nextP2[0]) / 2;
						const nextY = (nextP1[1] + nextP2[1]) / 2;

						const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
						const onRoof = !!snapRoof;
						const roofId = snapRoof ? snapRoof.id : undefined;
						const zInit = snapRoof ? snapRoof.height : 0;
						const objHeight = orig.z_end - orig.z_init;

						return {
							...obj,
							p1: nextP1,
							p2: nextP2,
							center_x: nextX,
							center_y: nextY,
							on_roof: onRoof,
							roof_id: roofId,
							z_init: zInit,
							z_end: zInit + objHeight,
						};
					} else if (obj.type === "polygon" && orig.polygon) {
						const translatedPoly = orig.polygon.map((p: [number, number]) => [p[0] + dx, p[1] + dy] as [number, number]);
						const nextX = translatedPoly.reduce((acc: number, p: [number, number]) => acc + p[0], 0) / translatedPoly.length;
						const nextY = translatedPoly.reduce((acc: number, p: [number, number]) => acc + p[1], 0) / translatedPoly.length;

						const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
						const onRoof = !!snapRoof;
						const roofId = snapRoof ? snapRoof.id : undefined;
						const zInit = snapRoof ? snapRoof.height : 0;
						const objHeight = orig.z_end - orig.z_init;

						return {
							...obj,
							polygon: translatedPoly,
							center_x: nextX,
							center_y: nextY,
							on_roof: onRoof,
							roof_id: roofId,
							z_init: zInit,
							z_end: zInit + objHeight,
						};
					}
					return obj;
				});
				setObjects(updatedObjs);
			} else if (activeDrag.type === "object-vertex" && activeDrag.vertexIndex !== undefined) {
				const updatedObjs = objects.map((obj) => {
					if (obj.id !== activeDrag.targetId) return obj;

					if (obj.type === "wall" && orig.p1 && orig.p2) {
						const p1 = activeDrag.vertexIndex === 0 ? [mx, my] as [number, number] : orig.p1;
						const p2 = activeDrag.vertexIndex === 1 ? [mx, my] as [number, number] : orig.p2;
						const nextX = (p1[0] + p2[0]) / 2;
						const nextY = (p1[1] + p2[1]) / 2;

						const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
						const onRoof = !!snapRoof;
						const roofId = snapRoof ? snapRoof.id : undefined;
						const zInit = snapRoof ? snapRoof.height : 0;
						const objHeight = orig.z_end - orig.z_init;

						return {
							...obj,
							p1,
							p2,
							center_x: nextX,
							center_y: nextY,
							on_roof: onRoof,
							roof_id: roofId,
							z_init: zInit,
							z_end: zInit + objHeight,
						};
					} else if (obj.type === "polygon" && orig.polygon) {
						const nextPoly = [...orig.polygon];
						nextPoly[activeDrag.vertexIndex!] = [mx, my];
						const nextX = nextPoly.reduce((acc: number, p: [number, number]) => acc + p[0], 0) / nextPoly.length;
						const nextY = nextPoly.reduce((acc: number, p: [number, number]) => acc + p[1], 0) / nextPoly.length;

						const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
						const onRoof = !!snapRoof;
						const roofId = snapRoof ? snapRoof.id : undefined;
						const zInit = snapRoof ? snapRoof.height : 0;
						const objHeight = orig.z_end - orig.z_init;

						return {
							...obj,
							polygon: nextPoly,
							center_x: nextX,
							center_y: nextY,
							on_roof: onRoof,
							roof_id: roofId,
							z_init: zInit,
							z_end: zInit + objHeight,
						};
					}
					return obj;
				});
				setObjects(updatedObjs);
			} else if (activeDrag.type === "group") {
				const nextX = orig.center_x + dx;
				const nextY = orig.center_y + dy;
				
				const updatedGroups = panelGroups.map((g) => {
					if (g.id !== activeDrag.targetId) return g;
					return {
						...g,
						center_x: nextX,
						center_y: nextY,
					};
				});
				setPanelGroups(updatedGroups);
			}
		}
	};

	const handleMouseUp = () => {
		setIsPanning(false);
		if (activeDrag) {
			if (activeDrag.type === "roof-vertex") {
				saveRoofDesign(roofs);
			} else if (activeDrag.type === "object") {
				const obj = objects.find((o) => o.id === activeDrag.targetId);
				if (obj && obj.type !== "wall" && obj.type !== "polygon") {
					const expectedOnRoof = activeDrag.originalState.on_roof;

					if (expectedOnRoof && !obj.on_roof) {
						// Revert back onto roof
						const restored = objects.map((o) => {
							if (o.id === obj.id) {
								return {
									...o,
									center_x: activeDrag.originalState.center_x,
									center_y: activeDrag.originalState.center_y,
									on_roof: activeDrag.originalState.on_roof,
									roof_id: activeDrag.originalState.roof_id,
									z_init: activeDrag.originalState.z_init,
									z_end: activeDrag.originalState.z_end,
								};
							}
							return o;
						});
						setObjects(restored);
						saveObjectsDesign(restored);
						setActiveDrag(null);
						setToastMessage(`This object (${obj.name}) must remain inside a mapped roof boundary.`);
						return;
					}

					if (!expectedOnRoof && obj.on_roof) {
						// Revert back onto ground
						const restored = objects.map((o) => {
							if (o.id === obj.id) {
								return {
									...o,
									center_x: activeDrag.originalState.center_x,
									center_y: activeDrag.originalState.center_y,
									on_roof: activeDrag.originalState.on_roof,
									roof_id: activeDrag.originalState.roof_id,
									z_init: activeDrag.originalState.z_init,
									z_end: activeDrag.originalState.z_end,
								};
							}
							return o;
						});
						setObjects(restored);
						saveObjectsDesign(restored);
						setActiveDrag(null);
						setToastMessage(`This object (${obj.name}) must remain on the ground (outside all roof boundaries).`);
						return;
					}
				}
				saveObjectsDesign(objects);
			} else if (activeDrag.type === "group") {
				const group = panelGroups.find((g) => g.id === activeDrag.targetId);
				if (group) {
					const validation = validatePanelGroup(group, panelGroups);
					if (validation) {
						const restored = panelGroups.map((g) => g.id === activeDrag.targetId ? activeDrag.originalState : g);
						setPanelGroups(restored);
						setToastMessage(validation);
						setActiveDrag(null);
						return;
					}
				}
				savePanelsDesign(panelGroups);
			} else {
				saveObjectsDesign(objects);
			}
			setActiveDrag(null);
		}
	};

	const handleMouseLeave = () => {
		setIsPanning(false);
		setActiveDrag(null);
	};

	// ────────────────────────────────────────────────────────────────────────
	// DRAG TRIGGERS
	// ────────────────────────────────────────────────────────────────────────
	const startDraggingRoofVertex = (e: React.MouseEvent, roofId: string, ptIdx: number) => {
		e.stopPropagation();
		if (isDrawingRoofs || stage !== "roof") return;

		setSelectedRoofId(roofId);
		const roof = roofs.find((r) => r.id === roofId);
		if (!roof) return;

		const mousePos = getMouseMeters(e);
		setActiveDrag({
			type: "roof-vertex",
			targetId: roofId,
			vertexIndex: ptIdx,
			startMousePos: mousePos,
			originalState: JSON.parse(JSON.stringify(roof)),
		});
	};

	const startDraggingObject = (e: React.MouseEvent, objId: string) => {
		e.stopPropagation();
		if (objectDrawingMode !== "none" || stage !== "obstruction") return;

		setSelectedObjectId(objId);
		const obj = objects.find((o) => o.id === objId);
		if (!obj) return;

		const mousePos = getMouseMeters(e);
		setActiveDrag({
			type: "object",
			targetId: objId,
			startMousePos: mousePos,
			originalState: JSON.parse(JSON.stringify(obj)),
		});
	};

	const startDraggingObjectVertex = (e: React.MouseEvent, objId: string, vIdx: number) => {
		e.stopPropagation();
		if (objectDrawingMode !== "none" || stage !== "obstruction") return;

		const obj = objects.find((o) => o.id === objId);
		if (!obj) return;

		const mousePos = getMouseMeters(e);
		setActiveDrag({
			type: "object-vertex",
			targetId: objId,
			vertexIndex: vIdx,
			startMousePos: mousePos,
			originalState: JSON.parse(JSON.stringify(obj)),
		});
	};

	const startDraggingGroup = (e: React.MouseEvent, gId: string) => {
		e.stopPropagation();
		if (isPlacingGroup || stage !== "placement") return;

		setSelectedGroupId(gId);
		const group = panelGroups.find((g) => g.id === gId);
		if (!group) return;

		const mousePos = getMouseMeters(e);
		setActiveDrag({
			type: "group",
			targetId: gId,
			startMousePos: mousePos,
			originalState: JSON.parse(JSON.stringify(group)),
		});
	};

	// ────────────────────────────────────────────────────────────────────────
	// CANVAS CLICKS (DRAWING CREATIONS)
	// ────────────────────────────────────────────────────────────────────────
	const handleCanvasClick = (e: React.MouseEvent) => {
		const [mx, my] = getMouseMeters(e);

		// If not drawing/placing, clicking on empty canvas clears selections
		if (!isDrawingRoofs && objectDrawingMode === "none" && !isPlacingGroup) {
			setSelectedRoofId(null);
			setSelectedObjectId(null);
			setSelectedGroupId(null);
			return;
		}

		// ── STAGE 5: PANEL PLACEMENT ──
		if (stage === "placement" && isPlacingGroup) {
			const clickedRoofIdx = roofs.findIndex((r) => isPointInPolygon([mx, my], r.points));
			if (clickedRoofIdx === -1) {
				setToastMessage("Structures must be placed inside a mapped roof boundary.");
				return;
			}

			const panelsNeeded = placementConfig.grid_cols * placementConfig.grid_rows;
			const activeCells = placementConfig.cells?.length ? placementConfig.cells : undefined;
			const activePanelsNeeded = activeCells?.length || panelsNeeded;
			if (remainingPanelSlots !== Infinity && activePanelsNeeded > remainingPanelSlots) {
				setToastMessage(`Panel limit reached. Only ${remainingPanelSlots} panel${remainingPanelSlots !== 1 ? "s" : ""} remaining.`);
				return;
			}

			const newGroupId = generateUUID("group");
			const newGroup: PlacedPanelGroup = {
				id: newGroupId,
				type: "table",
				orientation: placementConfig.orientation,
				grid_cols: placementConfig.grid_cols,
				grid_rows: placementConfig.grid_rows,
				table_angle: placementConfig.table_angle,
				tilt_angle: placementConfig.tilt_angle,
				center_x: mx,
				center_y: my,
				pillar_count: placementConfig.pillar_count,
				cells: activeCells,
				pillars_per_structure_ew: placementConfig.pillars_per_structure_ew,
				panels_per_structure: placementConfig.panels_per_structure,
				...DEFAULT_PREFERENCES,
			};
			const validation = validatePanelGroup(newGroup, [...panelGroups, newGroup]);
			if (validation) {
				setToastMessage(validation);
				return;
			}
			const updated = [...panelGroups, newGroup];
			setPanelGroups(updated);
			setSelectedGroupId(newGroupId);
			setIsPlacingGroup(false);
			savePanelsDesign(updated);
			return;
		}

		// ── STAGE 2: ROOF BOUNDARY DRAWING ──
		if (stage === "roof" && isDrawingRoofs) {
			const isFirstPointClose = currentPoints.length > 0 &&
				Math.hypot(mx - currentPoints[0][0], my - currentPoints[0][1]) < 0.8;

			if (isFirstPointClose && currentPoints.length >= 3) {
				// Close roof outline
				const newRoof: RoofData = {
					id: generateUUID("roof"),
					name: `Roof Boundary ${roofs.length + 1}`,
					height: 3.5,
					points: currentPoints,
					area: calculateArea(currentPoints),
					parapetEnabled: true,
					parapetHeight: 1.0,
					parapetThickness: 0.3,
					parapetSetback: 0.0,
					parapetSameDimensions: true,
					parapetEdges: currentPoints.map(() => ({
						enabled: true,
						height: 1.0,
						thickness: 0.3,
						setback: 0.0,
					})),
				};
				const updated = [...roofs, newRoof];
				setRoofs(updated);
				setSelectedRoofId(newRoof.id);
				setCurrentPoints([]);
				setIsDrawingRoofs(false);
				saveRoofDesign(updated);
			} else {
				setCurrentPoints([...currentPoints, [mx, my]]);
			}
			return;
		}

		// ── STAGE 3: OBSTRUCTION PLACEMENT ──
		if (stage === "obstruction" && objectDrawingMode !== "none") {
			// VALIDATION RULE: Don't let objects be placed unless there is a roof planned
			if (roofs.length === 0) {
				setObjectDrawingMode("none");
				setCurrentPoints([]);
				setWallStartPoint(null);
				return;
			}

			const config = CATEGORY_DEFAULTS[objectDrawingMode];
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
				setSelectedObjectId(newObj.id);
				setObjectDrawingMode("none");
				saveObjectsDesign(updated);
			} else if (objectDrawingMode === "wall") {
				if (!wallStartPoint) {
					setWallStartPoint([mx, my]);
				} else {
					const count = objects.filter((o) => o.type === "wall").length + 1;
					const nextX = (wallStartPoint[0] + mx) / 2;
					const nextY = (wallStartPoint[1] + my) / 2;
					
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
						p1: wallStartPoint,
						p2: [mx, my],
						thickness: 0.23,
						polygon: undefined,
					};
					const updated = [...objects, newWall];
					setObjects(updated);
					setSelectedObjectId(newWall.id);
					setWallStartPoint(null);
					setObjectDrawingMode("none");
					saveObjectsDesign(updated);
				}
			} else if (objectDrawingMode === "polygon") {
				const isFirstPoint = currentPoints.length > 0 &&
					Math.hypot(mx - currentPoints[0][0], my - currentPoints[0][1]) < 0.8;

				if (isFirstPoint && currentPoints.length >= 3) {
					const polyCenter: [number, number] = [
						currentPoints.reduce((acc, p) => acc + p[0], 0) / currentPoints.length,
						currentPoints.reduce((acc, p) => acc + p[1], 0) / currentPoints.length,
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
						polygon: currentPoints,
					};
					const updated = [...objects, newPoly];
					setObjects(updated);
					setSelectedObjectId(newPoly.id);
					setCurrentPoints([]);
					setObjectDrawingMode("none");
					saveObjectsDesign(updated);
				} else {
					setCurrentPoints([...currentPoints, [mx, my]]);
				}
			}
		}
	};

	// ESC Key listener
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setIsDrawingRoofs(false);
				setObjectDrawingMode("none");
				setIsPlacingGroup(false);
				setCurrentPoints([]);
				setWallStartPoint(null);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// ────────────────────────────────────────────────────────────────────────
	// ROOF PROP SIDEBAR EDITORS
	// ────────────────────────────────────────────────────────────────────────
	const deleteSelectedRoof = () => {
		if (!selectedRoofId) return;
		const updated = roofs.filter((r) => r.id !== selectedRoofId);
		setRoofs(updated);
		setSelectedRoofId(null);
		saveRoofDesign(updated);
	};

	const updateSelectedRoof = (updates: Partial<RoofData>) => {
		if (!selectedRoofId) return;
		const updated = roofs.map((r) => {
			if (r.id !== selectedRoofId) return r;
			return { ...r, ...updates };
		});
		setRoofs(updated);
		saveRoofDesignDebounced(updated);
	};

	const undoLastRoofPoint = () => {
		if (currentPoints.length > 0) {
			setCurrentPoints(currentPoints.slice(0, -1));
		}
	};

	const cancelRoofDrawing = () => {
		setIsDrawingRoofs(false);
		setCurrentPoints([]);
	};

	// ────────────────────────────────────────────────────────────────────────
	// OBJECT PROP SIDEBAR EDITORS
	// ────────────────────────────────────────────────────────────────────────
	const deleteSelectedObject = () => {
		if (!selectedObjectId) return;
		const updated = objects.filter((o) => o.id !== selectedObjectId);
		setObjects(updated);
		setSelectedObjectId(null);
		saveObjectsDesign(updated);
	};

	const updateSelectedObject = (fields: Partial<LocalObject>) => {
		if (!selectedObjectId) return;
		const updated = objects.map((obj) => {
			if (obj.id !== selectedObjectId) return obj;
			return { ...obj, ...fields };
		});
		setObjects(updated);
		saveObjectsDesignDebounced(updated);
	};

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

					{/* SVG vector drawings */}
										{/* Interactive SVG Overlays Canvas */}
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
