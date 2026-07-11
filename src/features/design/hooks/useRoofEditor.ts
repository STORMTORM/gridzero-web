import { useState, useEffect, useCallback } from "react";
import type { RoofData } from "../types";

interface RoofEditorParams {
	initialRoofs: RoofData[];
	selectedRoofId: string | null;
	setSelectedRoofId: (id: string | null) => void;
	saveRoofDesign: (list: RoofData[]) => void;
	saveRoofDesignDebounced: (list: RoofData[]) => void;
}

export function useRoofEditor({
	initialRoofs,
	selectedRoofId,
	setSelectedRoofId,
	saveRoofDesign,
	saveRoofDesignDebounced,
}: RoofEditorParams) {
	const [roofs, setRoofs] = useState<RoofData[]>(initialRoofs);
	const [currentPoints, setCurrentPoints] = useState<[number, number][]>([]);
	const [isDrawingRoofs, setIsDrawingRoofs] = useState(false);

	// Sync initialRoofs
	useEffect(() => {
		setRoofs(initialRoofs);
	}, [initialRoofs]);

	const deleteSelectedRoof = useCallback(() => {
		if (!selectedRoofId) return;
		const updated = roofs.filter((r) => r.id !== selectedRoofId);
		setRoofs(updated);
		setSelectedRoofId(null);
		saveRoofDesign(updated);
	}, [roofs, selectedRoofId, setSelectedRoofId, saveRoofDesign]);

	const updateSelectedRoof = useCallback((updates: Partial<RoofData>) => {
		if (!selectedRoofId) return;
		const updated = roofs.map((r) => r.id === selectedRoofId ? { ...r, ...updates } : r);
		setRoofs(updated);
		saveRoofDesignDebounced(updated);
	}, [roofs, selectedRoofId, saveRoofDesignDebounced]);

	const undoLastRoofPoint = useCallback(() => {
		if (currentPoints.length > 0) {
			setCurrentPoints((prev) => prev.slice(0, -1));
		}
	}, [currentPoints]);

	const cancelRoofDrawing = useCallback(() => {
		setIsDrawingRoofs(false);
		setCurrentPoints([]);
	}, []);

	return {
		roofs,
		setRoofs,
		currentPoints,
		setCurrentPoints,
		isDrawingRoofs,
		setIsDrawingRoofs,
		deleteSelectedRoof,
		updateSelectedRoof,
		undoLastRoofPoint,
		cancelRoofDrawing,
	};
}
