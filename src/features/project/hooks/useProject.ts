import { useQuery } from "@tanstack/react-query";
import { getProject } from "../api/getProject";
import { mapProject } from "../utils/projectMapper";

export function useProject(id: string) {
    return useQuery({
        queryKey: ["project", id],
        queryFn: async () => {
            const project = await getProject(id);
            return mapProject(project);
        },
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
    });

}