import { useState, useEffect, useMemo, useCallback } from "react";
import type { PlacedPanelGroup, PlacementConfig, RoofData } from "../../shared/types";
import type { SceneData, PanelSpec, PanelGroup, LocalObject } from "../../../utils/design/types";
import * as siteVisitApi from "../../../api/siteVisitApi";
import { panelService } from "../../shared/services/panelService";
import { DEFAULT_PLACEMENT_CONFIG } from "../../shared/constants";

interface PanelPlacementParams {
	sitevisitId: string;
	sceneData: SceneData | null | undefined;
	panelGroups: PlacedPanelGroup[];
	setPanelGroups: React.Dispatch<React.SetStateAction<PlacedPanelGroup[]>>;
	selectedGroupId: string | null;
	setSelectedGroupId: (id: string | null) => void;
	savePanelsDesign: (groups: PlacedPanelGroup[]) => Promise<void>;
	savePanelsDesignDebounced: (groups: PlacedPanelGroup[]) => void;
	roofs: RoofData[];
	objects: LocalObject[];
	setToastMessage: (msg: string | null) => void;
	onContinue?: () => void;
	stage?: string;
}

export function usePanelPlacement({
	sitevisitId,
	sceneData,
	panelGroups,
	setPanelGroups,
	selectedGroupId,
	setSelectedGroupId,
	savePanelsDesign,
	savePanelsDesignDebounced,
	roofs,
	objects,
	setToastMessage,
	onContinue,
	stage,
}: PanelPlacementParams) {
	const [isPlacingGroup, setIsPlacingGroup] = useState(false);
	const [targetPanelCount, setTargetPanelCount] = useState(0);
	const [placementConfig, setPlacementConfig] = useState<PlacementConfig>(DEFAULT_PLACEMENT_CONFIG);
	const [showConfigModal, setShowConfigModal] = useState(false);
	const [configModalMode, setConfigModalMode] = useState<"add" | "edit">("add");
	const [activeCaptureTarget, setActiveCaptureTarget] = useState<string | null>(null);

	const panelSpec: PanelSpec | null = useMemo(() => sceneData?.panel_spec || null, [sceneData]);

	// Load target selections panel count
	useEffect(() => {
		if (!sitevisitId || stage !== "placement") return;
		siteVisitApi.getSelectionInfo(sitevisitId)
			.then((data: any) => {
				const rawCount = data?.panel_count ?? data?.sitevisit?.panel_count;
				const count = Number(rawCount);
				setTargetPanelCount(Number.isFinite(count) && count > 0 ? count : 0);
			})
			.catch((err: any) => console.error("Failed to fetch selection panel count info", err));
	}, [sitevisitId, stage]);


	const placedPanelCount = useMemo(() => {
		return panelGroups.reduce((count, g) => count + panelService.groupPanelCount(g), 0);
	}, [panelGroups]);

	const remainingPanelSlots = useMemo(() => {
		if (!targetPanelCount) return Infinity;
		return Math.max(0, targetPanelCount - placedPanelCount);
	}, [targetPanelCount, placedPanelCount]);

	const selectedGroup = useMemo(() => {
		return panelGroups.find((g) => g.id === selectedGroupId) || null;
	}, [panelGroups, selectedGroupId]);

	const selectedGroupPanelCount = selectedGroup ? panelService.groupPanelCount(selectedGroup) : 0;
	const configModalRemainingSlots = useMemo(() => {
		return configModalMode === "edit"
			? (remainingPanelSlots === Infinity ? Infinity : remainingPanelSlots + selectedGroupPanelCount)
			: remainingPanelSlots;
	}, [configModalMode, remainingPanelSlots, selectedGroupPanelCount]);

	const updateSelectedGroup = useCallback((updates: Partial<PanelGroup>) => {
		if (!selectedGroupId) return;
		const current = panelGroups.find((g) => g.id === selectedGroupId);
		if (!current) return;
		const candidate = { ...current, ...updates };
		const nextCount = panelGroups.reduce((sum, g) => sum + panelService.groupPanelCount(g.id === selectedGroupId ? candidate : g), 0);
		if (targetPanelCount && nextCount > targetPanelCount) {
			setToastMessage(`Panel limit reached. Only ${Math.max(0, targetPanelCount - (placedPanelCount - panelService.groupPanelCount(current)))} panel(s) can fit in this table.`);
			return;
		}
		const validation = panelService.validatePanelGroup(candidate, panelGroups.map((g) => g.id === selectedGroupId ? candidate : g), panelSpec, roofs, objects);
		if (validation) {
			setToastMessage(validation);
			return;
		}
		const updated = panelGroups.map((g) => g.id === selectedGroupId ? candidate : g);
		setPanelGroups(updated);
		savePanelsDesignDebounced(updated);
	}, [panelGroups, selectedGroupId, targetPanelCount, placedPanelCount, panelSpec, roofs, objects, setToastMessage, savePanelsDesignDebounced, setPanelGroups]);

	const deleteSelectedGroup = useCallback(() => {
		if (!selectedGroupId) return;
		const updated = panelGroups.filter((g) => g.id !== selectedGroupId);
		setPanelGroups(updated);
		setSelectedGroupId(null);
		savePanelsDesign(updated);
	}, [panelGroups, selectedGroupId, setSelectedGroupId, savePanelsDesign, setPanelGroups]);

	const handleConfigConfirm = useCallback((config: any) => {
		if (configModalMode === "edit" && selectedGroupId) {
			updateSelectedGroup({
				orientation: config.orientation,
				grid_rows: config.grid_rows,
				grid_cols: config.grid_cols,
				table_angle: config.table_angle,
				tilt_angle: config.tilt_angle,
				pillar_count: config.pillar_count,
				cells: config.cells,
				pillars_per_structure_ew: config.pillars_per_structure_ew,
				panels_per_structure: config.panels_per_structure,
			});
			setShowConfigModal(false);
		} else {
			setPlacementConfig({
				orientation: config.orientation,
				grid_cols: config.grid_cols,
				grid_rows: config.grid_rows,
				table_angle: config.table_angle,
				tilt_angle: config.tilt_angle,
				pillar_count: config.pillar_count,
				cells: config.cells,
				pillars_per_structure_ew: config.pillars_per_structure_ew,
				panels_per_structure: config.panels_per_structure,
			});
			setIsPlacingGroup(true);
			setShowConfigModal(false);
		}
	}, [configModalMode, selectedGroupId, updateSelectedGroup]);

	const handlePlacementContinue = useCallback(async () => {
		if (!panelSpec) {
			setToastMessage("No panel selected. Complete equipment selection first.");
			return;
		}
		if (placedPanelCount <= 0) {
			setToastMessage("Place at least one panel table before continuing.");
			return;
		}
		if (targetPanelCount && placedPanelCount < targetPanelCount) {
			setToastMessage(`Place ${targetPanelCount - placedPanelCount} more panel${targetPanelCount - placedPanelCount !== 1 ? "s" : ""} to match the selected capacity.`);
			return;
		}
		await savePanelsDesign(panelGroups);
		onContinue?.();
	}, [panelSpec, placedPanelCount, targetPanelCount, panelGroups, savePanelsDesign, onContinue, setToastMessage]);

	return {
		isPlacingGroup,
		setIsPlacingGroup,
		targetPanelCount,
		setTargetPanelCount,
		placementConfig,
		setPlacementConfig,
		showConfigModal,
		setShowConfigModal,
		configModalMode,
		setConfigModalMode,
		activeCaptureTarget,
		setActiveCaptureTarget,
		panelSpec,
		placedPanelCount,
		remainingPanelSlots,
		selectedGroup,
		selectedGroupPanelCount,
		configModalRemainingSlots,
		updateSelectedGroup,
		deleteSelectedGroup,
		handleConfigConfirm,
		handlePlacementContinue,
	};
}
