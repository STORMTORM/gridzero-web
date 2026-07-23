import type { PlacementConfig, CategoryConfig } from "../types";

export const DEFAULT_PLACEMENT_CONFIG: PlacementConfig = {
	orientation: "portrait",
	grid_cols: 5,
	grid_rows: 2,
	table_angle: 0,
	tilt_angle: 15,
	pillar_count: 2,
};

export const DEFAULT_PREFERENCES = {
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

export const CATEGORY_DEFAULTS: Record<string, CategoryConfig> = {
	ac_unit: { type: "cuboid", tag: "ac_unit", name: "AC Unit", on_roof: true, length: 1.2, width: 0.8, z_end: 1.0 },
	water_tanker: { type: "cuboid", tag: "rectangular_tank", name: "Water Tank", on_roof: true, length: 2.0, width: 2.0, z_end: 2.0 },
	elevated: { type: "polygon", tag: "elevated", name: "Elevated Struct", on_roof: true, z_end: 2.5 },
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
