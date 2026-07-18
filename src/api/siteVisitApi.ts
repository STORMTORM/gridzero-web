import api from "./client";
import { generateUUID } from "../utils/design/coords";
import type { RoofData, PlacedPanelGroup } from "../features/shared/types";
import type { LocalObject, PanelSpec } from "../utils/design/types";
import { getPanelsInGroup, isPointInPolygon } from "../utils/design/coords";

// ============================================================================
// Dashboard Workflow
// ============================================================================

export async function getProjects() {
	const res = await api.get("/visit/all", { params: { limit: "100", sort: "-created_at" } });
	return res.data;
}

export async function deleteProject(id: string) {
	const res = await api.delete(`/visit/${id}`);
	return res.data;
}

export async function createProject(formData: FormData) {
	const res = await api.post("/visit/file/upload", formData, {
		headers: { "Content-Type": "multipart/form-data" },
	});
	return res.data;
}

// ============================================================================
// Customer Details Workflow
// ============================================================================

export async function getSiteVisit(id: string) {
	const res = await api.get(`/visit/map/${id}`);
	return res.data?.data || res.data;
}

export async function saveCustomer(payload: any) {
	const res = await api.post("/visit/map/save", payload);
	return res.data;
}

// ============================================================================
// Roof Mapping Workflow
// ============================================================================

export async function getDesign(id: string) {
	const res = await api.get(`/visit/3d/${id}`);
	return res.data;
}

export async function saveRoof(sitevisitId: string, roofsList: RoofData[]) {
	const payloadRoofs: Record<string, { name: string; height: number; area: number; roof: [number, number][] }> = {};
	const payloadWalls: Record<string, { name: string; z_init: number; z_end: number; roof_id: string; p1: [number, number]; p2: [number, number]; thickness: number; setback: number }> = {};
	
	let wallCounter = 0;

	roofsList.forEach((r) => {
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

	const res = await api.post("/visit/roof/create", {
		sitevisit_id: sitevisitId,
		roofs: payloadRoofs,
		walls: payloadWalls,
	});
	return res.data;
}

// ============================================================================
// Obstructions Workflow
// ============================================================================

export async function saveObjects(sitevisitId: string, objectsList: LocalObject[]) {
	const objectsDict: Record<string, any> = {};

	objectsList.forEach((obj) => {
		// Calculate area if applicable
		let area: number | null = null;
		if (obj.on_roof) {
			if (obj.type === "cuboid") {
				area = (obj.length ?? 0) * (obj.width ?? 0);
			} else if (obj.type === "cylinder" || obj.type === "tree") {
				area = Math.PI * Math.pow(obj.radius ?? 0, 2);
			}
		}

		// Check if elevated
		const normalizedName = (obj.name || "").trim().toLowerCase();
		const isElevated = obj.tag === "elevated" || normalizedName.startsWith("elevated");

		const item: any = {
			name: obj.name,
			type: obj.type,
			tag: obj.tag || null,
			area,
			elevated: isElevated,
			roof_id: obj.roof_id || null,
			on_roof: !!obj.on_roof,
			cast_shadow: obj.cast_shadow !== false,
			center_x: (obj.type === "wall") ? null : (obj.center_x ?? null),
			center_y: (obj.type === "wall") ? null : (obj.center_y ?? null),
			z_init: obj.z_init ?? 0,
			z_end: obj.z_end ?? 3,
			length: obj.type === "cuboid" ? (obj.length ?? null) : null,
			width: obj.type === "cuboid" ? (obj.width ?? null) : null,
			angle: obj.type === "cuboid" ? (obj.angle ?? null) : null,
			radius: (obj.type === "cylinder" || obj.type === "tree") ? (obj.radius ?? null) : null,
			p1: obj.type === "wall" ? (obj.p1 || null) : null,
			p2: obj.type === "wall" ? (obj.p2 || null) : null,
			thickness: obj.type === "wall" ? (obj.thickness ?? null) : null,
			polygon: obj.type === "polygon" ? (obj.polygon || null) : null,
			setback_type: obj.setback_type || null,
			setback: obj.setback ?? null,
		};
		objectsDict[obj.id] = item;
	});

	try {
		const res = await api.post("/visit/objects/create", {
			sitevisit_id: sitevisitId,
			objects: objectsDict,
		});
		return res.data;
	} catch (e: any) {
		if (e.response?.data) {
			console.error("saveObjects API error response:", JSON.stringify(e.response.data, null, 2));
		}
		throw e;
	}
}

// ============================================================================
// Panel Placement Workflow
// ============================================================================

export async function savePanels(sitevisitId: string, groupsList: PlacedPanelGroup[], panelSpec: PanelSpec | null, roofsList: RoofData[]) {
	const panelsPayload: Record<string, any> = {};
	const groupsPayload: Record<string, any> = {};

	groupsList.forEach((g) => {
		const panels = getPanelsInGroup(g, panelSpec);
		
		panels.forEach((p) => {
			const roofIdx = roofsList.findIndex((r) => isPointInPolygon([p.x, p.y], r.points));
			panelsPayload[generateUUID()] = {
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
			type: g.type || "table-together",
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

	const res = await api.post("/visit/panels/create", {
		sitevisit_id: sitevisitId,
		panels: panelsPayload,
		groups: groupsPayload,
	});
	return res.data;
}

export async function getSelectionInfo(sitevisitId: string) {
	const res = await api.get(`/visit/selection/info/${sitevisitId}`);
	return res.data;
}

// ============================================================================
// Snapshots Workflow
// ============================================================================

export async function getSnapshots(sitevisitId: string) {
	const res = await api.get(`/visit/snapshots/${sitevisitId}`);
	return res.data;
}

export async function uploadSnapshot(formData: FormData) {
	const res = await api.post("/visit/file/upload", formData, {
		headers: { "Content-Type": "multipart/form-data" },
	});
	return res.data;
}

// ============================================================================
// Equipment / Panel Selection Workflow
// ============================================================================

export async function getPanelBrands() {
	const res = await api.get("/visit/selection/panel-brands");
	return res.data;
}

export async function getAccessoryBrands() {
	const res = await api.get("/visit/selection/accessory-brands");
	return res.data;
}

export async function getPanels(params?: any) {
	const res = await api.get("/visit/selection/panel", { params });
	return res.data;
}

export async function getInverterFilterOptions(sitevisitId: string, payload: any) {
	const res = await api.post(`/visit/selection/inverter-filter-options/${sitevisitId}`, payload);
	return res.data;
}

export async function getInverter(sitevisitId: string, payload: any) {
	const res = await api.post(`/visit/selection/get-inverter/${sitevisitId}`, payload);
	return res.data;
}

export async function selectPanel(sitevisitId: string, panelId: string) {
	const res = await api.post(`/visit/selection/panel/${sitevisitId}`, { panel_id: panelId });
	return res.data;
}

export async function selectInverter(sitevisitId: string, inverterId: string) {
	const res = await api.post(`/visit/selection/inverter/${sitevisitId}`, { inverter_id: inverterId });
	return res.data;
}

export async function saveEquipmentProposal(payload: any) {
	const res = await api.post("/visit/proposal-only/equipment", payload);
	return res.data;
}

export async function saveSldParams(sitevisitId: string, payload: any) {
	const res = await api.post(`/visit/sld/params/${sitevisitId}`, payload);
	return res.data;
}

// ============================================================================
// Proposal / Pricing Workflow
// ============================================================================

export async function getProposal(id: string) {
	const res = await api.get(`/visit/proposal/${id}`);
	return res.data;
}

export async function saveProposal(payload: any) {
	const res = await api.post("/visit/proposal/save", payload);
	return res.data;
}

export async function updateProfile(payload: any) {
	const res = await api.put("/auth/profile", payload);
	return res.data;
}

export async function getPlacesAutocomplete(input: string, sessiontoken: string) {
	const res = await api.get("/visit/places/autocomplete", {
		params: { input, sessiontoken },
	});
	return res.data;
}

export async function getPlacesDetails(placeId: string, sessiontoken: string) {
	const res = await api.get("/visit/places/details", {
		params: { place_id: placeId, sessiontoken },
	});
	return res.data;
}

