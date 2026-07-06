/**
 * Coordinate Geometry and Helper Utilities for Design Canvas
 */

export function generateUUID(_prefix?: string): string {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Calculates the area of a polygon using the Shoelace (surveyor's) formula.
 * Coordinates are represented as [x, y] in meters.
 */
export function calculateArea(pts: [number, number][]): number {
	if (pts.length < 3) return 0;
	let area = 0;
	for (let i = 0; i < pts.length; i++) {
		const p1 = pts[i];
		const p2 = pts[(i + 1) % pts.length];
		area += (p1[0] + p2[0]) * (p1[1] - p2[1]);
	}
	return Math.abs(area / 2);
}

/**
 * Checks if a point [x, y] is inside a polygon using the Ray-Casting algorithm.
 * Coordinates are in meters.
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
	const [x, y] = point;
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const xi = polygon[i][0], yi = polygon[i][1];
		const xj = polygon[j][0], yj = polygon[j][1];
		
		const intersect = ((yi > y) !== (yj > y))
			&& (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
		if (intersect) inside = !inside;
	}
	return inside;
}
