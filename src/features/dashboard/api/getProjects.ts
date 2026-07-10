import api from "../../../api/client";

export async function getProjects() {
    const res = await api.get("/visit/all", { params: { limit: "100", sort: "-created_at" } });
    return res.data?.data;
}