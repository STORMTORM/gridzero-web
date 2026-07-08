import type { SceneData, LocalObject } from "./types";
import type { RoofData } from "../../components/design/UnifiedDesignStep";

/**
 * Builds the nested SceneData payload for the Three.js 3D Viewer.
 * Takes current flat state lists of roofs and objects and returns a compiled SceneData object,
 * ensuring that previous step elements (roofs) are visible in subsequent steps (objects).
 */
export function buildLiveSceneData(
	sceneData: SceneData | null | undefined,
	roofs: RoofData[],
	objects: LocalObject[],
	stage: number
): SceneData | null {
	if (!sceneData) return null;

	const payloadRoofs: Record<string, any> = {};
	const payloadCuboids: Record<string, any> = {};
	const payloadCylinders: Record<string, any> = {};
	const payloadWalls: Record<string, any> = {};
	const payloadPolygons: Record<string, any> = {};
	const payloadTrees: Record<string, any> = {};

	// 1. Roofs and Parapets are structural foundations and are visible in both Stage 2 and Stage 3
	roofs.forEach((r) => {
		payloadRoofs[r.id] = {
			name: r.name,
			height: r.height,
			area: r.area,
			roof: r.points,
		};
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

	// 2. Stage 3 (Obstruction Mapping): Renders objects (AC units, water tanks, trees, walls, custom polygons)
	if (stage === 3) {
		objects.forEach((obj) => {
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
			};

			if (obj.type === "cuboid") payloadCuboids[obj.id] = item;
			else if (obj.type === "cylinder") payloadCylinders[obj.id] = item;
			else if (obj.type === "wall") payloadWalls[obj.id] = item;
			else if (obj.type === "polygon") payloadPolygons[obj.id] = item;
			else if (obj.type === "tree") payloadTrees[obj.id] = item;
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
	};
}
