import { useState, useRef, useCallback } from "react";

interface ViewportParams {
	widthMeters: number;
	heightMeters: number;
}

export function useViewport({ widthMeters, heightMeters }: ViewportParams) {
	const [scale, setScale] = useState(1);
	const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const [mousePosMeters, setMousePosMeters] = useState<[number, number] | null>(null);
	const panStart = useRef({ x: 0, y: 0 });

	const viewportRef = useRef<HTMLDivElement>(null);
	const innerContainerRef = useRef<HTMLDivElement>(null);

	const pxToMX = useCallback((px: number) => (px / 100) * widthMeters, [widthMeters]);
	const pxToMY = useCallback((py: number) => (py / 100) * heightMeters, [heightMeters]);

	const getMouseMeters = useCallback((e: React.MouseEvent): [number, number] => {
		if (!innerContainerRef.current) return [0, 0];
		const rect = innerContainerRef.current.getBoundingClientRect();
		const px = ((e.clientX - rect.left) / rect.width) * 100;
		const py = ((e.clientY - rect.top) / rect.height) * 100;
		return [pxToMX(px), pxToMY(py)];
	}, [pxToMX, pxToMY]);

	const handleWheel = useCallback((e: React.WheelEvent) => {
		const zoomIntensity = 0.08;
		e.preventDefault();
		const zoomFactor = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
		setScale((prev) => Math.max(0.4, Math.min(prev * zoomFactor, 6)));
	}, []);

	const zoomIn2D = useCallback(() => setScale((prev) => Math.min(prev + 0.15, 6)), []);
	const zoomOut2D = useCallback(() => setScale((prev) => Math.max(prev - 0.15, 0.4)), []);

	const handleMouseDown = useCallback((e: React.MouseEvent) => {
		if (e.button === 2) return; // Right click

		const target = e.target as SVGElement;
		const isVertex = target.classList.contains("vertex-handle");
		const isObject = target.classList.contains("object-handle");

		if (!isVertex && !isObject) {
			setIsPanning(true);
			panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
		}
	}, [panOffset]);

	return {
		scale,
		setScale,
		panOffset,
		setPanOffset,
		isPanning,
		setIsPanning,
		mousePosMeters,
		setMousePosMeters,
		panStart,
		viewportRef,
		innerContainerRef,
		pxToMX,
		pxToMY,
		getMouseMeters,
		handleWheel,
		zoomIn2D,
		zoomOut2D,
		handleMouseDown,
	};
}
