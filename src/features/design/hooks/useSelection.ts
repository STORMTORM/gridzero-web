import { useState, useCallback } from "react";

export interface Selection {
	type: "roof" | "object" | "group" | null;
	id: string | null;
}

export function useSelection() {
	const [selection, setSelection] = useState<Selection>({ type: null, id: null });

	const selectedRoofId = selection.type === "roof" ? selection.id : null;
	const selectedObjectId = selection.type === "object" ? selection.id : null;
	const selectedGroupId = selection.type === "group" ? selection.id : null;

	const setSelectedRoofId = useCallback((id: string | null) => {
		setSelection({ type: id ? "roof" : null, id });
	}, []);

	const setSelectedObjectId = useCallback((id: string | null) => {
		setSelection({ type: id ? "object" : null, id });
	}, []);

	const setSelectedGroupId = useCallback((id: string | null) => {
		setSelection({ type: id ? "group" : null, id });
	}, []);

	const clearSelection = useCallback(() => {
		setSelection({ type: null, id: null });
	}, []);

	return {
		selectedRoofId,
		selectedObjectId,
		selectedGroupId,
		setSelectedRoofId,
		setSelectedObjectId,
		setSelectedGroupId,
		clearSelection,
	};
}
