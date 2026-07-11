import { useEffect } from "react";

interface KeyboardParams {
	setIsDrawingRoofs: (drawing: boolean) => void;
	setObjectDrawingMode: (mode: string) => void;
	setIsPlacingGroup: (placing: boolean) => void;
	setCurrentPoints: (pts: [number, number][]) => void;
	setWallStartPoint: (pt: [number, number] | null) => void;
}

export function useKeyboard({
	setIsDrawingRoofs,
	setObjectDrawingMode,
	setIsPlacingGroup,
	setCurrentPoints,
	setWallStartPoint,
}: KeyboardParams) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setIsDrawingRoofs(false);
				setObjectDrawingMode("none");
				setIsPlacingGroup(false);
				setCurrentPoints([]);
				setWallStartPoint(null);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [setIsDrawingRoofs, setObjectDrawingMode, setIsPlacingGroup, setCurrentPoints, setWallStartPoint]);
}
