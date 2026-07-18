export interface Coord2D {
  x: number;
  y: number;
}

export interface RoofData {
  name?: string;
  height: number;
  roof: [number, number][];
}

export interface ObjectData {
  name?: string;
  tag?: string;
  roof_id?: string;
  on_roof?: boolean;
  cast_shadow?: boolean;
  center_x: number;
  center_y: number;
  z_init: number;
  z_end: number;
  setback_type?: string;
  setback?: number;
  // cuboid
  length?: number;
  width?: number;
  angle?: number;
  // cylinder
  radius?: number;
  // wall
  p1?: [number, number];
  p2?: [number, number];
  thickness?: number;
  // polygon
  polygon?: [number, number][];
}

export interface PanelPlacement {
  id: string;
  center_x: number;
  center_y: number;
  angle: number;
  roof_idx: number;
  group_id?: string;
  orientation?: "portrait" | "landscape";
  front_pillar_height?: number;
  back_pillar_height?: number;
  tilt_angle?: number;
  module_to_module_ns?: number;
  module_to_module_ew?: number;
  row_gap?: number;
  overhang_module_length?: number;
  overhang_module_width?: number;
  pillar_to_pillar_ns?: number;
  pillar_to_pillar_ew?: number;
  rafter_overhang?: number;
  purlin_overhang?: number;
  base_height?: number;
  base_length?: number;
  base_width?: number;
  cell_r?: number;
  cell_c?: number;
  col_gap?: number;
}

export type PanelGroupType = "table-together" | "table-row";

export interface PanelGroup {
  type: PanelGroupType;
  orientation?: "portrait" | "landscape";
  spacing?: string;
  grid_rows?: number;
  grid_cols?: number;
  table_angle?: number;
  cells?: { r: number; c: number }[];
  front_pillar_height?: number;
  back_pillar_height?: number;
  tilt_angle?: number;
  module_to_module_ns?: number;
  module_to_module_ew?: number;
  row_gap?: number;
  col_gap?: number;
  overhang_module_length?: number;
  overhang_module_width?: number;
  pillar_to_pillar_ns?: number;
  pillar_to_pillar_ew?: number;
  rafter_overhang?: number;
  purlin_overhang?: number;
  base_height?: number;
  base_length?: number;
  base_width?: number;
  pillar_count?: number;
  pillars_per_structure_ew?: number;
  panels_per_structure?: number;
}

export interface PanelSpec {
  id: string;
  brand: string;
  name: string;
  rating: number;
  length: number; // mm
  width: number;  // mm
  height: number; // mm
}

export interface SalesmanOverlay {
  company_name?: string | null;
  company_phone?: string | null;
  phone?: string | null;
}

export interface SunPath {
  year: number;
  tz: string;
  interval_min: number;
  start_hour: number;
  end_hour: number;
  days: string[];
  slots: string[];
  enu: Record<string, [number, number, number][]>;
}

export interface SceneData {
  image_link: string;
  width_meters: number;
  height_meters: number;
  coordinates: [number, number][];
  angle_south_vertical_deg: number;
  sun_path?: SunPath | null;
  roofs: Record<string, RoofData>;
  objects: {
    wall: Record<string, ObjectData>;
    cuboid: Record<string, ObjectData>;
    cylinder: Record<string, ObjectData>;
    tree: Record<string, ObjectData>;
    polygon: Record<string, ObjectData>;
  };
  panel_placements: PanelPlacement[];
  panel_groups: Record<string, PanelGroup>;
  panel_spec: PanelSpec | null;
  salesman?: SalesmanOverlay;
  stage: number;
}

export type QualityLevel = "low" | "medium" | "high";

export interface LocalObject extends ObjectData {
  id: string;
  type: "cuboid" | "cylinder" | "wall" | "polygon" | "tree";
}
