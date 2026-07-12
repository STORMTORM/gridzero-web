export const queryKeys = {
	projects: ["projects"] as const,
	siteVisit: (id: string | undefined) => ["project", id] as const,
	design: (id: string | undefined) => ["design", id] as const,
	selection: (id: string | undefined) => ["selection", id] as const,
	proposal: (id: string | undefined) => ["proposal", id] as const,
};
