import { useQuery } from "@tanstack/react-query";
import * as siteVisitApi from "../../../api/siteVisitApi";
import { queryKeys } from "../../../api/queryKeys";

export function useProjects() {
	return useQuery({
		queryKey: queryKeys.projects,
		queryFn: () => siteVisitApi.getProjects(),
		staleTime: 1 * 60 * 1000, // 1 minute stale time
	});
}
