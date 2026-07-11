import { useQuery } from "@tanstack/react-query";
import { getProject } from "../api/getProject";

export function useProject(id: string | undefined) {
	return useQuery({
		queryKey: ["project-raw", id],
		queryFn: () => (id ? getProject(id) : null),
		enabled: !!id,
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		gcTime: 10 * 60 * 1000,
	});
}