export const DesignStage = {
	Roof: "roof",
	Obstruction: "obstruction",
	PanelPlacement: "placement",
	Snapshot: "snapshots",
} as const;
export type DesignStage = typeof DesignStage[keyof typeof DesignStage];

export const EditorTool = {
	Select: "select",
	DrawRoof: "draw-roof",
	PlaceGroup: "place-group",
	DrawCuboid: "draw-obstruction-cuboid",
	DrawCylinder: "draw-obstruction-cylinder",
	DrawWall: "draw-obstruction-wall",
	DrawPolygon: "draw-obstruction-polygon",
	DrawTree: "draw-obstruction-tree",
	DrawAcUnit: "draw-obstruction-ac_unit",
	DrawWaterTanker: "draw-obstruction-water_tanker",
	DrawElevated: "draw-obstruction-elevated",
	DrawSkylight: "draw-obstruction-skylight",
	DrawMumtee: "draw-obstruction-mumtee",
	DrawBuilding: "draw-obstruction-building",
	DrawCuboidGround: "draw-obstruction-cuboid_ground",
	DrawCylinderGround: "draw-obstruction-cylinder_ground",
	DrawTanker: "draw-obstruction-tanker",
	DrawTower: "draw-obstruction-tower",
} as const;
export type EditorTool = typeof EditorTool[keyof typeof EditorTool];
