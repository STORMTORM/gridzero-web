import { useQuery } from "@tanstack/react-query";
import * as siteVisitApi from "../../../api/siteVisitApi";
import { queryKeys } from "../../../api/queryKeys";

export function useDesign(id: string | undefined) {
	return useQuery({
		queryKey: queryKeys.design(id),
		queryFn: () => (id ? siteVisitApi.getDesign(id) : null),
		enabled: !!id,
		staleTime: 5 * 60 * 1000,
		gcTime: 10 * 60 * 1000,
	});
}
