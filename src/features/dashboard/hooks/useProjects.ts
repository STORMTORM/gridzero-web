import { useQuery } from "@tanstack/react-query";
import { getProjects } from "../api/getProjects";
import { mapProject } from "../utils/projectMapper";

export function useProjects() {
	return useQuery({
		queryKey: ["projects"],
		queryFn: async () => {
            const data = await getProjects();
            return data.map(mapProject);
        },
	});
}