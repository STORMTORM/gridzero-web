import { useState, useCallback } from "react";
import type { RoofData } from "../../shared/types";
import { useHistoryState } from "../../shared/hooks/useHistoryState";

interface RoofEditorParams {
	roofs: RoofData[];
	setRoofs: (
		val: RoofData[] | ((prev: RoofData[]) => RoofData[]),
		options?: boolean | { overwrite?: boolean; forcePush?: boolean }
	) => void;
	selectedRoofId: string | null;
	setSelectedRoofId: (id: string | null) => void;
	saveRoofDesign: (list: RoofData[]) => void;
	saveRoofDesignDebounced: (list: RoofData[]) => void;
	onRoofDeleted?: (deletedRoofId: string) => void;
}

export function useRoofEditor({
	roofs,
	setRoofs,
	selectedRoofId,
	setSelectedRoofId,
	saveRoofDesign,
	saveRoofDesignDebounced,
	onRoofDeleted,
}: RoofEditorParams) {
	const {
		state: currentPoints,
		setState: setCurrentPoints,
		undo: undoPoints,
		redo: redoPoints,
		canUndo: canUndoPoint,
		canRedo: canRedoPoint,
		reset: resetPoints,
	} = useHistoryState<[number, number][]>([]);
	const [isDrawingRoofs, setIsDrawingRoofs] = useState(false);

	const deleteSelectedRoof = useCallback(() => {
		if (!selectedRoofId) return;
		const deletedId = selectedRoofId;
		const updated = roofs.filter((r) => r.id !== deletedId);
		setRoofs(updated, { forcePush: true });
		setSelectedRoofId(null);
		saveRoofDesign(updated);
		if (onRoofDeleted) {
			onRoofDeleted(deletedId);
		}
	}, [roofs, selectedRoofId, setSelectedRoofId, setRoofs, saveRoofDesign, onRoofDeleted]);

	const updateSelectedRoof = useCallback((updates: Partial<RoofData>) => {
		if (!selectedRoofId) return;
		const updated = roofs.map((r) => r.id === selectedRoofId ? { ...r, ...updates } : r);
		setRoofs(updated);
		saveRoofDesignDebounced(updated);
	}, [roofs, selectedRoofId, setRoofs, saveRoofDesignDebounced]);

	const undoLastRoofPoint = useCallback(() => {
		undoPoints();
	}, [undoPoints]);

	const redoLastRoofPoint = useCallback(() => {
		redoPoints();
	}, [redoPoints]);

	const cancelRoofDrawing = useCallback(() => {
		setIsDrawingRoofs(false);
		resetPoints([]);
	}, [resetPoints]);

	return {
		currentPoints,
		setCurrentPoints,
		isDrawingRoofs,
		setIsDrawingRoofs,
		deleteSelectedRoof,
		updateSelectedRoof,
		undoLastRoofPoint,
		redoLastRoofPoint,
		canUndoPoint,
		canRedoPoint,
		resetPoints,
		cancelRoofDrawing,
	};
}
