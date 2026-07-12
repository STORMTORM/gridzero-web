import type { LocalObject } from "../../../utils/design/types";
import { isPointInPolygon } from "../../../utils/design/coords";

export function rotatePoint(x: number, y: number, cx: number, cy: number, angleDeg: number): [number, number] {
	const theta = (angleDeg * Math.PI) / 180;
	const dx = x - cx;
	const dy = y - cy;
	return [
		cx + dx * Math.cos(theta) - dy * Math.sin(theta),
		cy + dx * Math.sin(theta) + dy * Math.cos(theta),
	];
}

export function panelCorners(center: [number, number], w: number, h: number, angleDeg: number): [number, number][] {
	const [cx, cy] = center;
	const raw: [number, number][] = [
		[cx - w / 2, cy - h / 2],
		[cx + w / 2, cy - h / 2],
		[cx + w / 2, cy + h / 2],
		[cx - w / 2, cy + h / 2],
	];
	return raw.map(([x, y]) => rotatePoint(x, y, cx, cy, angleDeg));
}

export function rectsOverlap(a: [number, number][], b: [number, number][]): boolean {
	const axes: [number, number][] = [];
	for (const poly of [a, b]) {
		for (let i = 0; i < poly.length; i++) {
			const p1 = poly[i];
			const p2 = poly[(i + 1) % poly.length];
			const edge: [number, number] = [p2[0] - p1[0], p2[1] - p1[1]];
			axes.push([-edge[1], edge[0]]);
		}
	}
	for (const axis of axes) {
		const len = Math.hypot(axis[0], axis[1]) || 1;
		const nx = axis[0] / len;
		const ny = axis[1] / len;
		const project = (poly: [number, number][]) => {
			const vals = poly.map(([x, y]) => x * nx + y * ny);
			return [Math.min(...vals), Math.max(...vals)];
		};
		const [aMin, aMax] = project(a);
		const [bMin, bMax] = project(b);
		if (aMax < bMin || bMax < aMin) return false;
	}
	return true;
}

export function distToSegment(p: [number, number], a: [number, number], b: [number, number]): number {
	const vx = b[0] - a[0];
	const vy = b[1] - a[1];
	const wx = p[0] - a[0];
	const wy = p[1] - a[1];
	const c1 = vx * wx + vy * wy;
	if (c1 <= 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
	const c2 = vx * vx + vy * vy;
	if (c2 <= c1) return Math.hypot(p[0] - b[0], p[1] - b[1]);
	const t = c1 / c2;
	return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
}

export function panelIntersectsObject(corners: [number, number][], obj: LocalObject): boolean {
	const center: [number, number] = [
		corners.reduce((sum, p) => sum + p[0], 0) / corners.length,
		corners.reduce((sum, p) => sum + p[1], 0) / corners.length,
	];

	if (obj.type === "cuboid") {
		const objCorners = panelCorners(
			[obj.center_x, obj.center_y],
			obj.length || 0,
			obj.width || 0,
			obj.angle || 0,
		);
		return rectsOverlap(corners, objCorners);
	}

	if (obj.type === "cylinder" || obj.type === "tree") {
		const radius = obj.radius || 0;
		if (Math.hypot(center[0] - obj.center_x, center[1] - obj.center_y) <= radius) return true;
		return corners.some((p) => Math.hypot(p[0] - obj.center_x, p[1] - obj.center_y) <= radius);
	}

	if (obj.type === "polygon" && obj.polygon?.length) {
		if (isPointInPolygon(center, obj.polygon)) return true;
		return corners.some((p) => isPointInPolygon(p, obj.polygon!));
	}

	if (obj.type === "wall" && obj.p1 && obj.p2) {
		const halfT = Math.max(0.1, (obj.thickness || 0.2) / 2);
		return corners.some((p) => distToSegment(p, obj.p1!, obj.p2!) <= halfT)
			|| distToSegment(center, obj.p1, obj.p2) <= halfT;
	}

	return false;
}
