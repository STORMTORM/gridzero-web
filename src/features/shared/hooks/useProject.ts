import { useQuery } from "@tanstack/react-query";
import * as siteVisitApi from "../../../api/siteVisitApi";
import { queryKeys } from "../../../api/queryKeys";

export function useProject(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.siteVisit(id),
		queryFn: () => (id ? siteVisitApi.getSiteVisit(id) : null),
		enabled: !!id,
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		gcTime: 10 * 60 * 1000,
	});
}
