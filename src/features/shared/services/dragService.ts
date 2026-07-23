import type { LocalObject } from "../../../utils/design/types";
import type { RoofData, PlacedPanelGroup } from "../types";
import { isPointInPolygon, calculateArea } from "../../../utils/design/coords";

export const dragService = {
	handleRoofVertexDrag: (
		origRoof: RoofData,
		dx: number,
		dy: number,
		vertexIndex: number
	): RoofData => {
		const nextPoints = [...origRoof.points];
		nextPoints[vertexIndex] = [
			origRoof.points[vertexIndex][0] + dx,
			origRoof.points[vertexIndex][1] + dy,
		];
		return {
			...origRoof,
			points: nextPoints,
			area: calculateArea(nextPoints),
		};
	},

	/**
	 * Returns the corner/edge sample points for an object at a given center position.
	 * Used to check that the entire object footprint is inside a roof polygon.
	 */
	getObjectBoundaryPoints: (
		obj: LocalObject,
		cx: number,
		cy: number
	): [number, number][] => {
		if (obj.type === "cuboid") {
			const hw = (obj.length || 2) / 2;
			const hh = (obj.width || 2) / 2;
			const angleRad = ((obj.angle || 0) * Math.PI) / 180;
			const cos = Math.cos(angleRad);
			const sin = Math.sin(angleRad);
			// Four rotated corners of the cuboid
			const corners: [number, number][] = [
				[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]
			].map(([lx, ly]) => [
				cx + lx * cos - ly * sin,
				cy + lx * sin + ly * cos,
			]);
			return corners;
		}

		if (obj.type === "cylinder" || obj.type === "tree") {
			const r = obj.radius || 1;
			// Sample 8 points around the circle perimeter
			const samples: [number, number][] = [];
			for (let i = 0; i < 8; i++) {
				const angle = (i * Math.PI * 2) / 8;
				samples.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
			}
			return samples;
		}

		// Fallback: just the center
		return [[cx, cy]];
	},

	/**
	 * Checks whether ALL boundary points of an object are inside at least one
	 * of the given roof polygons. Returns the matching roof or undefined.
	 */
	findContainingRoof: (
		obj: LocalObject,
		cx: number,
		cy: number,
		roofs: RoofData[]
	): RoofData | undefined => {
		const points = dragService.getObjectBoundaryPoints(obj, cx, cy);
		// The object must be fully inside a single roof
		return roofs.find((r) =>
			points.every((p) => isPointInPolygon(p, r.points))
		);
	},

	handleObjectDrag: (
		origObj: LocalObject,
		dx: number,
		dy: number,
		roofs: RoofData[],
		currentObjects: LocalObject[]
	): LocalObject => {
		if (origObj.type === "cuboid" || origObj.type === "cylinder" || origObj.type === "tree") {
			const nextX = origObj.center_x + dx;
			const nextY = origObj.center_y + dy;

			if (origObj.on_roof) {
				// On-roof objects: check that entire footprint stays inside a roof
				const snapRoof = dragService.findContainingRoof(origObj, nextX, nextY, roofs);
				if (!snapRoof) {
					// Object would go off the edge — block the drag
					return currentObjects.find(o => o.id === origObj.id) || origObj;
				}
				const objHeight = origObj.z_end - origObj.z_init;

				// Resolve support surface (roof-on-roof)
				const rorObjects = currentObjects.filter(
					(o) => o.is_roof_on_roof && o.type === "polygon" && o.polygon && o.polygon.length >= 3 && o.id !== origObj.id
				);
				const containing = rorObjects.filter((ror) => isPointInPolygon([nextX, nextY], ror.polygon!));
				let zInit = snapRoof.height;
				let supportSurfaceId: string | null = null;
				if (containing.length > 0) {
					containing.sort((a, b) => calculateArea(a.polygon!) - calculateArea(b.polygon!));
					const ror = containing[0];
					zInit = ror.z_end;
					supportSurfaceId = ror.id;
				}

				return {
					...origObj,
					center_x: nextX,
					center_y: nextY,
					on_roof: true,
					roof_id: snapRoof.id,
					z_init: zInit,
					z_end: zInit + objHeight,
					support_surface_id: supportSurfaceId,
				};
			}

			// Off-roof objects: block if ANY boundary/perimeter point or center enters any roof
			const points = dragService.getObjectBoundaryPoints(origObj, nextX, nextY);
			const intersectsAnyRoof = roofs.some((r) =>
				points.some((p) => isPointInPolygon(p, r.points)) || isPointInPolygon([nextX, nextY], r.points)
			);
			if (intersectsAnyRoof) {
				return currentObjects.find(o => o.id === origObj.id) || origObj;
			}

			return {
				...origObj,
				center_x: nextX,
				center_y: nextY,
				on_roof: false,
				roof_id: undefined,
				z_init: 0,
				z_end: origObj.z_end - origObj.z_init,
				support_surface_id: null,
			};
		}

		if (origObj.type === "wall" && origObj.p1 && origObj.p2) {
			const nextP1: [number, number] = [origObj.p1[0] + dx, origObj.p1[1] + dy];
			const nextP2: [number, number] = [origObj.p2[0] + dx, origObj.p2[1] + dy];
			const nextX = (nextP1[0] + nextP2[0]) / 2;
			const nextY = (nextP1[1] + nextP2[1]) / 2;

			if (origObj.on_roof) {
				const snapRoof = roofs.find((r) =>
					isPointInPolygon(nextP1, r.points) && isPointInPolygon(nextP2, r.points)
				);
				if (!snapRoof) {
					return currentObjects.find(o => o.id === origObj.id) || origObj;
				}
				const objHeight = origObj.z_end - origObj.z_init;

				// Resolve support surface (roof-on-roof)
				const rorObjects = currentObjects.filter(
					(o) => o.is_roof_on_roof && o.type === "polygon" && o.polygon && o.polygon.length >= 3 && o.id !== origObj.id
				);
				const containing = rorObjects.filter((ror) => isPointInPolygon([nextX, nextY], ror.polygon!));
				let zInit = snapRoof.height;
				let supportSurfaceId: string | null = null;
				if (containing.length > 0) {
					containing.sort((a, b) => calculateArea(a.polygon!) - calculateArea(b.polygon!));
					const ror = containing[0];
					zInit = ror.z_end;
					supportSurfaceId = ror.id;
				}

				return {
					...origObj,
					p1: nextP1,
					p2: nextP2,
					center_x: nextX,
					center_y: nextY,
					on_roof: true,
					roof_id: snapRoof.id,
					z_init: zInit,
					z_end: zInit + objHeight,
					support_surface_id: supportSurfaceId,
				};
			}

			// Off-roof wall logic:
			const intersectsAnyRoof = roofs.some((r) =>
				isPointInPolygon(nextP1, r.points) || isPointInPolygon(nextP2, r.points) || isPointInPolygon([nextX, nextY], r.points)
			);
			if (intersectsAnyRoof) {
				return currentObjects.find(o => o.id === origObj.id) || origObj;
			}

			return {
				...origObj,
				p1: nextP1,
				p2: nextP2,
				center_x: nextX,
				center_y: nextY,
				on_roof: false,
				roof_id: undefined,
				z_init: 0,
				z_end: origObj.z_end - origObj.z_init,
				support_surface_id: null,
			};
		}

		if (origObj.type === "polygon" && origObj.polygon) {
			const translatedPoly = origObj.polygon.map((p) => [p[0] + dx, p[1] + dy] as [number, number]);
			const nextX = translatedPoly.reduce((acc, p) => acc + p[0], 0) / translatedPoly.length;
			const nextY = translatedPoly.reduce((acc, p) => acc + p[1], 0) / translatedPoly.length;

			if (origObj.on_roof) {
				const snapRoof = roofs.find((r) =>
					translatedPoly.every((p) => isPointInPolygon(p, r.points))
				);
				if (!snapRoof) {
					return currentObjects.find(o => o.id === origObj.id) || origObj;
				}
				const objHeight = origObj.z_end - origObj.z_init;

				// Resolve support surface (roof-on-roof)
				const rorObjects = currentObjects.filter(
					(o) => o.is_roof_on_roof && o.type === "polygon" && o.polygon && o.polygon.length >= 3 && o.id !== origObj.id
				);
				const containing = rorObjects.filter((ror) => isPointInPolygon([nextX, nextY], ror.polygon!));
				let zInit = snapRoof.height;
				let supportSurfaceId: string | null = null;
				if (containing.length > 0) {
					containing.sort((a, b) => calculateArea(a.polygon!) - calculateArea(b.polygon!));
					const ror = containing[0];
					zInit = ror.z_end;
					supportSurfaceId = ror.id;
				}

				return {
					...origObj,
					polygon: translatedPoly,
					center_x: nextX,
					center_y: nextY,
					on_roof: true,
					roof_id: snapRoof.id,
					z_init: zInit,
					z_end: zInit + objHeight,
					support_surface_id: supportSurfaceId,
				};
			}

			// Off-roof polygon logic:
			const intersectsAnyPolyRoof = roofs.some((r) =>
				translatedPoly.some((p) => isPointInPolygon(p, r.points)) || isPointInPolygon([nextX, nextY], r.points)
			);
			if (intersectsAnyPolyRoof) {
				return currentObjects.find(o => o.id === origObj.id) || origObj;
			}

			return {
				...origObj,
				polygon: translatedPoly,
				center_x: nextX,
				center_y: nextY,
				on_roof: false,
				roof_id: undefined,
				z_init: 0,
				z_end: origObj.z_end - origObj.z_init,
				support_surface_id: null,
			};
		}

		return origObj;
	},

	handleObjectVertexDrag: (
		origObj: LocalObject,
		mx: number,
		my: number,
		vertexIndex: number,
		roofs: RoofData[],
		currentObjects: LocalObject[]
	): LocalObject => {
		if (origObj.type === "wall" && origObj.p1 && origObj.p2) {
			const p1 = vertexIndex === 0 ? [mx, my] as [number, number] : origObj.p1;
			const p2 = vertexIndex === 1 ? [mx, my] as [number, number] : origObj.p2;

			if (origObj.on_roof) {
				const targetRoof = roofs.find((r) => r.id === origObj.roof_id);
				if (targetRoof) {
					if (!isPointInPolygon(p1, targetRoof.points) || !isPointInPolygon(p2, targetRoof.points)) {
						return origObj;
					}
				}
			} else {
				const intersectsAnyRoof = roofs.some((r) =>
					isPointInPolygon(p1, r.points) || isPointInPolygon(p2, r.points)
				);
				if (intersectsAnyRoof) {
					return origObj;
				}
			}

			const nextX = (p1[0] + p2[0]) / 2;
			const nextY = (p1[1] + p2[1]) / 2;
			const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
			const onRoof = !!snapRoof;
			const roofId = snapRoof ? snapRoof.id : undefined;

			// Resolve support surface (roof-on-roof)
			const rorObjects = currentObjects.filter(
				(o) => o.is_roof_on_roof && o.type === "polygon" && o.polygon && o.polygon.length >= 3 && o.id !== origObj.id
			);
			const containing = rorObjects.filter((ror) => isPointInPolygon([nextX, nextY], ror.polygon!));
			let zInit = snapRoof ? snapRoof.height : 0;
			let supportSurfaceId: string | null = null;
			if (onRoof && containing.length > 0) {
				containing.sort((a, b) => calculateArea(a.polygon!) - calculateArea(b.polygon!));
				const ror = containing[0];
				zInit = ror.z_end;
				supportSurfaceId = ror.id;
			}
			const objHeight = origObj.z_end - origObj.z_init;

			return {
				...origObj,
				p1,
				p2,
				center_x: nextX,
				center_y: nextY,
				on_roof: onRoof,
				roof_id: roofId,
				z_init: zInit,
				z_end: zInit + objHeight,
				support_surface_id: supportSurfaceId,
			};
		}

		if (origObj.type === "polygon" && origObj.polygon) {
			const nextPoly = [...origObj.polygon];
			nextPoly[vertexIndex] = [mx, my];

			if (origObj.on_roof) {
				const targetRoof = roofs.find((r) => r.id === origObj.roof_id);
				if (targetRoof) {
					if (!isPointInPolygon([mx, my], targetRoof.points)) {
						return origObj;
					}
				}
			} else {
				const intersectsAnyRoof = roofs.some((r) =>
					isPointInPolygon([mx, my], r.points)
				);
				if (intersectsAnyRoof) {
					return origObj;
				}
			}

			const nextX = nextPoly.reduce((acc, p) => acc + p[0], 0) / nextPoly.length;
			const nextY = nextPoly.reduce((acc, p) => acc + p[1], 0) / nextPoly.length;
			const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
			const onRoof = !!snapRoof;
			const roofId = snapRoof ? snapRoof.id : undefined;

			// Resolve support surface (roof-on-roof)
			const rorObjects = currentObjects.filter(
				(o) => o.is_roof_on_roof && o.type === "polygon" && o.polygon && o.polygon.length >= 3 && o.id !== origObj.id
			);
			const containing = rorObjects.filter((ror) => isPointInPolygon([nextX, nextY], ror.polygon!));
			let zInit = snapRoof ? snapRoof.height : 0;
			let supportSurfaceId: string | null = null;
			if (onRoof && containing.length > 0) {
				containing.sort((a, b) => calculateArea(a.polygon!) - calculateArea(b.polygon!));
				const ror = containing[0];
				zInit = ror.z_end;
				supportSurfaceId = ror.id;
			}
			const objHeight = origObj.z_end - origObj.z_init;

			return {
				...origObj,
				polygon: nextPoly,
				center_x: nextX,
				center_y: nextY,
				on_roof: onRoof,
				roof_id: roofId,
				z_init: zInit,
				z_end: zInit + objHeight,
				support_surface_id: supportSurfaceId,
			};
		}

		return origObj;
	},

	handleGroupDrag: (
		origGroup: PlacedPanelGroup,
		dx: number,
		dy: number
	): PlacedPanelGroup => {
		return {
			...origGroup,
			center_x: origGroup.center_x + dx,
			center_y: origGroup.center_y + dy,
		};
	}
};
