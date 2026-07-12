import { useMemo } from "react";
import { buildLiveSceneData } from "../../../utils/design/sceneDataBuilder";
import type { SceneData, LocalObject, PanelSpec } from "../../../utils/design/types";
import type { RoofData, PlacedPanelGroup } from "../types";

interface SceneBuilderParams {
	sceneData: SceneData | null | undefined;
	roofs: RoofData[];
	objects: LocalObject[];
	stage: string;
	panelGroups: PlacedPanelGroup[];
	panelSpec: PanelSpec | null;
}

export function useSceneBuilder({
	sceneData,
	roofs,
	objects,
	stage,
	panelGroups,
	panelSpec,
}: SceneBuilderParams) {
	return useMemo(() => {
		return buildLiveSceneData(sceneData, roofs, objects, stage, panelGroups, panelSpec);
	}, [sceneData, roofs, objects, stage, panelGroups, panelSpec]);
}
