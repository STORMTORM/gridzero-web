import type { SceneData, LocalObject, PanelGroup, PanelSpec, PanelPlacement } from "./types";
import type { RoofData } from "../../features/shared/types";
import { getPanelsInGroup, isPointInPolygon, calculateArea } from "./coords";

/**
 * Builds the nested SceneData payload for the Three.js 3D Viewer.
 * Takes current flat state lists of roofs, objects, and panel structures and returns a compiled SceneData object.
 */
export function buildLiveSceneData(
	sceneData: SceneData | null | undefined,
	roofs: RoofData[],
	objects: LocalObject[],
	stage: string,
	panelGroups: (PanelGroup & { id: string; center_x: number; center_y: number })[] = [],
	panelSpec: PanelSpec | null = null
): SceneData | null {
	if (!sceneData) return null;

	const payloadRoofs: Record<string, any> = {};
	const payloadCuboids: Record<string, any> = {};
	const payloadCylinders: Record<string, any> = {};
	const payloadWalls: Record<string, any> = {};
	const payloadPolygons: Record<string, any> = {};
	const payloadTrees: Record<string, any> = {};

	// 1. Base roofs and Parapets are structural foundations and are visible in all design stages
	roofs.forEach((r) => {
		payloadRoofs[r.id] = {
			name: r.name,
			height: r.height,
			area: r.area,
			roof: r.points,
			base_height: 0,
		};
	});

	// 2. Child roofs (roof-on-roof objects)
	objects.forEach((obj) => {
		if (obj.is_roof_on_roof && obj.polygon && obj.polygon.length >= 3) {
			payloadRoofs[obj.id] = {
				name: obj.name,
				height: obj.z_end - obj.z_init,
				base_height: obj.z_init,
				roof: obj.polygon,
				area: calculateArea(obj.polygon) || 0,
			};
		}
	});

	// Dynamically generate parapet wall segments so they render live in 3D
	let wallCounter = 0;
	roofs.forEach((r) => {
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

				const wallId = `parapet_${r.id}_edge_${i}`;
				wallCounter++;

				payloadWalls[wallId] = {
					name: `Parapet Wall ${wallCounter}`,
					roof_id: r.id,
					on_roof: true,
					z_init: r.height,
					z_end: r.height + wHeight,
					p1,
					p2,
					thickness: wThickness,
				};
			}
		}
	});

	// 2. Obstructions are visible in both Stage obstruction and placement
	if (stage === "obstruction" || stage === "placement") {
		objects.forEach((obj) => {
			if (obj.is_roof_on_roof) return; // Already added as a roof!

			const item = {
				name: obj.name,
				tag: obj.tag || undefined,
				roof_id: obj.roof_id || undefined,
				on_roof: obj.on_roof,
				cast_shadow: obj.cast_shadow,
				center_x: obj.center_x,
				center_y: obj.center_y,
				z_init: obj.z_init,
				z_end: obj.z_end,
				length: obj.length,
				width: obj.width,
				angle: obj.angle,
				radius: obj.radius,
				p1: obj.p1 || undefined,
				p2: obj.p2 || undefined,
				thickness: obj.thickness,
				polygon: obj.polygon || undefined,
				support_surface_id: obj.support_surface_id || null,
			};

			if (obj.type === "cuboid") payloadCuboids[obj.id] = item;
			else if (obj.type === "cylinder") payloadCylinders[obj.id] = item;
			else if (obj.type === "wall") payloadWalls[obj.id] = item;
			else if (obj.type === "polygon") payloadPolygons[obj.id] = item;
			else if (obj.type === "tree") payloadTrees[obj.id] = item;
		});
	}

	// 3. Panels calculations
	const placements: PanelPlacement[] = [];
	const groupsRecord: Record<string, PanelGroup> = {};

	if (stage === "placement") {
		panelGroups.forEach((g) => {
			groupsRecord[g.id] = {
				type: g.type || "table-together",
				orientation: g.orientation || "portrait",
				grid_rows: g.grid_rows || 1,
				grid_cols: g.grid_cols || 1,
				table_angle: g.table_angle || 0,
				tilt_angle: g.tilt_angle || 15,
				cells: g.cells || undefined,
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

			const panels = getPanelsInGroup(g, panelSpec);
			panels.forEach((p) => {
				const roofIdx = roofs.findIndex((r) => isPointInPolygon([p.x, p.y], r.points));
				placements.push({
					id: p.id,
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
				});
			});
		});
	}

	return {
		...sceneData,
		roofs: payloadRoofs,
		objects: {
			...sceneData.objects,
			cuboid: payloadCuboids,
			cylinder: payloadCylinders,
			wall: payloadWalls,
			polygon: payloadPolygons,
			tree: payloadTrees,
		},
		panel_placements: (stage === "placement" || stage === "snapshots") ? (stage === "placement" ? placements : (sceneData.panel_placements || [])) : [],
		panel_groups: (stage === "placement" || stage === "snapshots") ? (stage === "placement" ? groupsRecord : (sceneData.panel_groups || {})) : {},
	};
}
