import api from "../../../api/client";

export async function getProject(id: string) {
	const res = await api.get(`/visit/map/${id}`);
	return res.data?.data || res.data;
}