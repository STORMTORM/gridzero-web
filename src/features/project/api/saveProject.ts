import api from "../../../api/client";

export async function saveProject(payload: any) {
	const res = await api.post("/visit/map/save", payload);
	return res.data;
}
