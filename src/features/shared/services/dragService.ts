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
			const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));

			if (origObj.on_roof && !snapRoof) {
				return currentObjects.find(o => o.id === origObj.id) || origObj;
			}
			if (!origObj.on_roof && snapRoof) {
				return currentObjects.find(o => o.id === origObj.id) || origObj;
			}

			const onRoof = !!snapRoof;
			const roofId = snapRoof ? snapRoof.id : undefined;
			const zInit = snapRoof ? snapRoof.height : 0;
			const objHeight = origObj.z_end - origObj.z_init;

			return {
				...origObj,
				center_x: nextX,
				center_y: nextY,
				on_roof: onRoof,
				roof_id: roofId,
				z_init: zInit,
				z_end: zInit + objHeight,
			};
		}

		if (origObj.type === "wall" && origObj.p1 && origObj.p2) {
			const nextP1: [number, number] = [origObj.p1[0] + dx, origObj.p1[1] + dy];
			const nextP2: [number, number] = [origObj.p2[0] + dx, origObj.p2[1] + dy];
			const nextX = (nextP1[0] + nextP2[0]) / 2;
			const nextY = (nextP1[1] + nextP2[1]) / 2;
			const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
			const onRoof = !!snapRoof;
			const roofId = snapRoof ? snapRoof.id : undefined;
			const zInit = snapRoof ? snapRoof.height : 0;
			const objHeight = origObj.z_end - origObj.z_init;

			return {
				...origObj,
				p1: nextP1,
				p2: nextP2,
				center_x: nextX,
				center_y: nextY,
				on_roof: onRoof,
				roof_id: roofId,
				z_init: zInit,
				z_end: zInit + objHeight,
			};
		}

		if (origObj.type === "polygon" && origObj.polygon) {
			const translatedPoly = origObj.polygon.map((p) => [p[0] + dx, p[1] + dy] as [number, number]);
			const nextX = translatedPoly.reduce((acc, p) => acc + p[0], 0) / translatedPoly.length;
			const nextY = translatedPoly.reduce((acc, p) => acc + p[1], 0) / translatedPoly.length;
			const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
			const onRoof = !!snapRoof;
			const roofId = snapRoof ? snapRoof.id : undefined;
			const zInit = snapRoof ? snapRoof.height : 0;
			const objHeight = origObj.z_end - origObj.z_init;

			return {
				...origObj,
				polygon: translatedPoly,
				center_x: nextX,
				center_y: nextY,
				on_roof: onRoof,
				roof_id: roofId,
				z_init: zInit,
				z_end: zInit + objHeight,
			};
		}

		return origObj;
	},

	handleObjectVertexDrag: (
		origObj: LocalObject,
		mx: number,
		my: number,
		vertexIndex: number,
		roofs: RoofData[]
	): LocalObject => {
		if (origObj.type === "wall" && origObj.p1 && origObj.p2) {
			const p1 = vertexIndex === 0 ? [mx, my] as [number, number] : origObj.p1;
			const p2 = vertexIndex === 1 ? [mx, my] as [number, number] : origObj.p2;
			const nextX = (p1[0] + p2[0]) / 2;
			const nextY = (p1[1] + p2[1]) / 2;
			const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
			const onRoof = !!snapRoof;
			const roofId = snapRoof ? snapRoof.id : undefined;
			const zInit = snapRoof ? snapRoof.height : 0;
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
			};
		}

		if (origObj.type === "polygon" && origObj.polygon) {
			const nextPoly = [...origObj.polygon];
			nextPoly[vertexIndex] = [mx, my];
			const nextX = nextPoly.reduce((acc, p) => acc + p[0], 0) / nextPoly.length;
			const nextY = nextPoly.reduce((acc, p) => acc + p[1], 0) / nextPoly.length;
			const snapRoof = roofs.find((r) => isPointInPolygon([nextX, nextY], r.points));
			const onRoof = !!snapRoof;
			const roofId = snapRoof ? snapRoof.id : undefined;
			const zInit = snapRoof ? snapRoof.height : 0;
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
