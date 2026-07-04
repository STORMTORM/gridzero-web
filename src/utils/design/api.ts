import api from "../../api/client";

const _dataCache = new Map<string, Promise<any>>();

export function prime3DDataCache(sitevisitId: string, p: Promise<any>): void {
	if (!_dataCache.has(sitevisitId)) _dataCache.set(sitevisitId, p);
}

export async function fetch3DData(sitevisitId: string, forceRefresh = false) {
	if (forceRefresh) {
		_dataCache.delete(sitevisitId);
	}
	const cached = _dataCache.get(sitevisitId);
	if (cached) return cached;
	const p = (async () => {
		const res = await api.get(`/visit/3d/${sitevisitId}`);
		return res.data;
	})();
	_dataCache.set(sitevisitId, p);
	return p;
}
