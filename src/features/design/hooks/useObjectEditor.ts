import { useState, useEffect, useCallback } from "react";
import type { LocalObject } from "../../../utils/design/types";

interface ObjectEditorParams {
	initialObjects: LocalObject[];
	selectedObjectId: string | null;
	setSelectedObjectId: (id: string | null) => void;
	saveObjectsDesign: (list: LocalObject[]) => void;
	saveObjectsDesignDebounced: (list: LocalObject[]) => void;
}

export function useObjectEditor({
	initialObjects,
	selectedObjectId,
	setSelectedObjectId,
	saveObjectsDesign,
	saveObjectsDesignDebounced,
}: ObjectEditorParams) {
	const [objects, setObjects] = useState<LocalObject[]>(initialObjects);
	const [objectDrawingMode, setObjectDrawingMode] = useState<string>("none");
	const [wallStartPoint, setWallStartPoint] = useState<[number, number] | null>(null);

	// Sync initialObjects
	useEffect(() => {
		setObjects(initialObjects);
	}, [initialObjects]);

	const deleteSelectedObject = useCallback(() => {
		if (!selectedObjectId) return;
		const updated = objects.filter((o) => o.id !== selectedObjectId);
		setObjects(updated);
		setSelectedObjectId(null);
		saveObjectsDesign(updated);
	}, [objects, selectedObjectId, setSelectedObjectId, saveObjectsDesign]);

	const updateSelectedObject = useCallback((fields: Partial<LocalObject>) => {
		if (!selectedObjectId) return;
		const updated = objects.map((obj) => obj.id === selectedObjectId ? { ...obj, ...fields } : obj);
		setObjects(updated);
		saveObjectsDesignDebounced(updated);
	}, [objects, selectedObjectId, saveObjectsDesignDebounced]);

	return {
		objects,
		setObjects,
		objectDrawingMode,
		setObjectDrawingMode,
		wallStartPoint,
		setWallStartPoint,
		deleteSelectedObject,
		updateSelectedObject,
	};
}
