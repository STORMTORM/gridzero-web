import type { PanelGroup } from "../../../utils/design/types";

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

export type PlacedPanelGroup = PanelGroup & { id: string; center_x: number; center_y: number };

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

export interface CategoryConfig {
	type: "cuboid" | "cylinder" | "wall" | "polygon" | "tree";
	tag?: string;
	name: string;
	on_roof: boolean;
	length?: number;
	width?: number;
	radius?: number;
	z_end?: number;
}

export interface DragState {
	type: "roof-vertex" | "object" | "object-vertex" | "group";
	targetId: string;
	vertexIndex?: number;
	startMousePos: [number, number];
	originalState: any;
}
