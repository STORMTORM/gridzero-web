import type { PanelGroup, PanelSpec, LocalObject } from "../../../utils/design/types";
import type { PlacedPanelGroup, RoofData } from "../types";
import { getPanelsInGroup, isPointInPolygon } from "../../../utils/design/coords";
import { panelCorners, panelIntersectsObject, rectsOverlap } from "../geometry";

export const panelService = {
	groupPanelCount: (g: Pick<PanelGroup, "grid_cols" | "grid_rows" | "cells">): number => {
		return g.cells?.length || ((g.grid_cols || 1) * (g.grid_rows || 1));
	},

	validatePanelGroup: (
		group: PlacedPanelGroup,
		allGroups: PlacedPanelGroup[],
		panelSpec: PanelSpec | null,
		roofs: RoofData[],
		objects: LocalObject[]
	): string | null => {
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
	}
};
