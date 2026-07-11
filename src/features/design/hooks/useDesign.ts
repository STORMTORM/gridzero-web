import { useQuery } from "@tanstack/react-query";
import api from "../../../api/client";

export function useDesign(id: string | undefined) {
	return useQuery({
		queryKey: ["design-raw", id],
		queryFn: async () => {
			if (!id) return null;
			const res = await api.get(`/visit/3d/${id}`);
			return res.data;
		},
		enabled: !!id,
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		gcTime: 10 * 60 * 1000,
	});
}
