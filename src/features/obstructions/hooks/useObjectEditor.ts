import { useState, useCallback } from "react";
import type { LocalObject } from "../../../utils/design/types";

interface ObjectEditorParams {
	objects: LocalObject[];
	setObjects: React.Dispatch<React.SetStateAction<LocalObject[]>>;
	selectedObjectId: string | null;
	setSelectedObjectId: (id: string | null) => void;
	saveObjectsDesign: (list: LocalObject[]) => void;
	saveObjectsDesignDebounced: (list: LocalObject[]) => void;
}

export function useObjectEditor({
	objects,
	setObjects,
	selectedObjectId,
	setSelectedObjectId,
	saveObjectsDesign,
	saveObjectsDesignDebounced,
}: ObjectEditorParams) {
	const [objectDrawingMode, setObjectDrawingMode] = useState<string>("none");
	const [wallStartPoint, setWallStartPoint] = useState<[number, number] | null>(null);

	const deleteSelectedObject = useCallback(() => {
		if (!selectedObjectId) return;
		const updated = objects.filter((o) => o.id !== selectedObjectId);
		setObjects(updated);
		setSelectedObjectId(null);
		saveObjectsDesign(updated);
	}, [objects, selectedObjectId, setSelectedObjectId, setObjects, saveObjectsDesign]);

	const updateSelectedObject = useCallback((fields: Partial<LocalObject>) => {
		if (!selectedObjectId) return;
		const updated = objects.map((obj) => obj.id === selectedObjectId ? { ...obj, ...fields } : obj);
		setObjects(updated);
		saveObjectsDesignDebounced(updated);
	}, [objects, selectedObjectId, setObjects, saveObjectsDesignDebounced]);

	return {
		objectDrawingMode,
		setObjectDrawingMode,
		wallStartPoint,
		setWallStartPoint,
		deleteSelectedObject,
		updateSelectedObject,
	};
}
