import { useState, useCallback } from "react";
import type { LocalObject } from "../../../utils/design/types";
import { generateUUID } from "../../../utils/design/coords";

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

	const duplicateSelectedObject = useCallback(() => {
		if (!selectedObjectId) return;
		const original = objects.find((o) => o.id === selectedObjectId);
		if (!original) return;
		const OFFSET = 1.0; // offset 1 metre so it doesn't stack on top
		const duplicate: LocalObject = {
			...original,
			id: generateUUID(),
			name: `${original.name} (copy)`,
			center_x: original.center_x + OFFSET,
			center_y: original.center_y + OFFSET,
			// Offset polygon points if present
			...(original.polygon ? {
				polygon: original.polygon.map(([x, y]) => [x + OFFSET, y + OFFSET] as [number, number]),
			} : {}),
			// Offset wall endpoints if present
			...(original.p1 && original.p2 ? {
				p1: [original.p1[0] + OFFSET, original.p1[1] + OFFSET] as [number, number],
				p2: [original.p2[0] + OFFSET, original.p2[1] + OFFSET] as [number, number],
			} : {}),
		};
		const updated = [...objects, duplicate];
		setObjects(updated);
		setSelectedObjectId(duplicate.id);
		saveObjectsDesign(updated);
	}, [objects, selectedObjectId, setObjects, setSelectedObjectId, saveObjectsDesign]);

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
		duplicateSelectedObject,
		updateSelectedObject,
	};
}
