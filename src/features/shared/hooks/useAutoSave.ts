import { useEffect, useRef, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as siteVisitApi from "../../../api/siteVisitApi";
import { queryKeys } from "../../../api/queryKeys";
import type { RoofData, PlacedPanelGroup } from "../types";
import type { LocalObject, PanelSpec } from "../../../utils/design/types";

interface AutoSaveParams {
	sitevisitId: string;
	roofs: RoofData[];
	objects: LocalObject[];
	panelGroups: PlacedPanelGroup[];
	getPanelSpec: () => PanelSpec | null;
	onSaveStatusChange?: (saving: boolean) => void;
}

export function useAutoSave({
	sitevisitId,
	roofs,
	objects,
	panelGroups,
	getPanelSpec,
	onSaveStatusChange,
}: AutoSaveParams) {
	const queryClient = useQueryClient();

	const latestPanelSpecRef = useRef<PanelSpec | null>(null);
	useEffect(() => {
		latestPanelSpecRef.current = getPanelSpec();
	}, [getPanelSpec]);

	// TanStack Query Mutations
	const roofMutation = useMutation({
		mutationFn: ({ sitevisitId, roofs }: { sitevisitId: string; roofs: RoofData[] }) =>
			siteVisitApi.saveRoof(sitevisitId, roofs),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.siteVisit(variables.sitevisitId) });
			queryClient.invalidateQueries({ queryKey: queryKeys.design(variables.sitevisitId) });
		}
	});

	const objectMutation = useMutation({
		mutationFn: ({ sitevisitId, objects }: { sitevisitId: string; objects: LocalObject[] }) =>
			siteVisitApi.saveObjects(sitevisitId, objects),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.siteVisit(variables.sitevisitId) });
			queryClient.invalidateQueries({ queryKey: queryKeys.design(variables.sitevisitId) });
		}
	});

	const panelMutation = useMutation({
		mutationFn: ({ sitevisitId, groups, spec, roofs }: { sitevisitId: string; groups: PlacedPanelGroup[]; spec: PanelSpec | null; roofs: RoofData[] }) =>
			siteVisitApi.savePanels(sitevisitId, groups, spec, roofs),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.siteVisit(variables.sitevisitId) });
			queryClient.invalidateQueries({ queryKey: queryKeys.design(variables.sitevisitId) });
		}
	});

	// State indicator callbacks
	const saving = roofMutation.isPending || objectMutation.isPending || panelMutation.isPending;
	useEffect(() => {
		onSaveStatusChange?.(saving);
	}, [saving, onSaveStatusChange]);

	// Save timeouts refs
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveObjectsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveDebounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const latestRoofsRef = useRef(roofs);
	const latestObjectsRef = useRef(objects);
	const latestPanelGroupsRef = useRef(panelGroups);

	useEffect(() => { latestRoofsRef.current = roofs; }, [roofs]);
	useEffect(() => { latestObjectsRef.current = objects; }, [objects]);
	useEffect(() => { latestPanelGroupsRef.current = panelGroups; }, [panelGroups]);

	const saveRoofDesign = useCallback(async (currentRoofs = latestRoofsRef.current) => {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = null;
		}
		try {
			await roofMutation.mutateAsync({ sitevisitId, roofs: currentRoofs });
		} catch (e) {
			console.error("Failed to save roof design", e);
		}
	}, [sitevisitId, roofMutation]);

	const saveRoofDesignDebounced = useCallback((currentRoofs = latestRoofsRef.current) => {
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}
		saveTimeoutRef.current = setTimeout(() => {
			saveRoofDesign(currentRoofs);
			saveTimeoutRef.current = null;
		}, 2000);
	}, [saveRoofDesign]);

	const saveObjectsDesign = useCallback(async (list = latestObjectsRef.current) => {
		if (saveObjectsTimeoutRef.current) {
			clearTimeout(saveObjectsTimeoutRef.current);
			saveObjectsTimeoutRef.current = null;
		}
		try {
			await objectMutation.mutateAsync({ sitevisitId, objects: list });
		} catch (e) {
			console.error("Failed to save objects design", e);
		}
	}, [sitevisitId, objectMutation]);

	const saveObjectsDesignDebounced = useCallback((list = latestObjectsRef.current) => {
		if (saveObjectsTimeoutRef.current) {
			clearTimeout(saveObjectsTimeoutRef.current);
		}
		saveObjectsTimeoutRef.current = setTimeout(() => {
			saveObjectsDesign(list);
			saveObjectsTimeoutRef.current = null;
		}, 2000);
	}, [saveObjectsDesign]);

	const savePanelsDesign = useCallback(async (currentGroups = latestPanelGroupsRef.current) => {
		if (saveDebounceTimeoutRef.current) {
			clearTimeout(saveDebounceTimeoutRef.current);
			saveDebounceTimeoutRef.current = null;
		}
		try {
			await panelMutation.mutateAsync({ sitevisitId, groups: currentGroups, spec: latestPanelSpecRef.current, roofs: latestRoofsRef.current });
		} catch (e) {
			console.error("Failed to save panels design", e);
		}
	}, [sitevisitId, panelMutation]);

	const savePanelsDesignDebounced = useCallback((currentGroups = latestPanelGroupsRef.current) => {
		if (saveDebounceTimeoutRef.current) {
			clearTimeout(saveDebounceTimeoutRef.current);
		}
		saveDebounceTimeoutRef.current = setTimeout(async () => {
			await savePanelsDesign(currentGroups);
			saveDebounceTimeoutRef.current = null;
		}, 2000);
	}, [savePanelsDesign]);

	// Flush changes on unmount
	useEffect(() => {
		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
				siteVisitApi.saveRoof(sitevisitId, latestRoofsRef.current).catch(console.error);
			}
			if (saveObjectsTimeoutRef.current) {
				clearTimeout(saveObjectsTimeoutRef.current);
				siteVisitApi.saveObjects(sitevisitId, latestObjectsRef.current).catch(console.error);
			}
			if (saveDebounceTimeoutRef.current) {
				clearTimeout(saveDebounceTimeoutRef.current);
				siteVisitApi.savePanels(sitevisitId, latestPanelGroupsRef.current, latestPanelSpecRef.current, latestRoofsRef.current).catch(console.error);
			}
		};
	}, [sitevisitId]);

	return {
		saveRoofDesign,
		saveRoofDesignDebounced,
		saveObjectsDesign,
		saveObjectsDesignDebounced,
		savePanelsDesign,
		savePanelsDesignDebounced,
		saving,
		savingRoofs: roofMutation.isPending,
		savingObjects: objectMutation.isPending,
		savingPanels: panelMutation.isPending,
		saveDebounceTimeoutRef,
	};
}
