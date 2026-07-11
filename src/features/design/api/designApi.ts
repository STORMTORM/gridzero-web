import api from "../../../api/client";
import { generateUUID } from "../../../utils/design/coords";
import type { RoofData, PlacedPanelGroup } from "../types";
import type { LocalObject, PanelSpec } from "../../../utils/design/types";
import { getPanelsInGroup, isPointInPolygon } from "../../../utils/design/coords";

export const designApi = {
	fetchSelectionInfo: async (sitevisitId: string) => {
		const res = await api.get(`/visit/selection/info/${sitevisitId}`);
		return res.data;
	},

	saveRoofDesign: async (sitevisitId: string, roofsList: RoofData[]) => {
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
	},

	saveObjectsDesign: async (sitevisitId: string, objectsList: LocalObject[]) => {
		const objectsDict: Record<string, any> = {};

		objectsList.forEach((obj) => {
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

		const res = await api.post("/visit/objects/create", {
			sitevisit_id: sitevisitId,
			objects: objectsDict,
		});
		return res.data;
	},

	savePanelsDesign: async (sitevisitId: string, groupsList: PlacedPanelGroup[], panelSpec: PanelSpec | null, roofsList: RoofData[]) => {
		const panelsPayload: Record<string, any> = {};
		const groupsPayload: Record<string, any> = {};

		groupsList.forEach((g) => {
			const panels = getPanelsInGroup(g, panelSpec);
			
			panels.forEach((p) => {
				const roofIdx = roofsList.findIndex((r) => isPointInPolygon([p.x, p.y], r.points));
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

		const res = await api.post("/visit/panels/create", {
			sitevisit_id: sitevisitId,
			panels: panelsPayload,
			groups: groupsPayload,
		});
		return res.data;
	},
};
