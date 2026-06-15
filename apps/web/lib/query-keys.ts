export const queryKeys = {
    user: {
        me: ["user", "me"] as const,
    },
    weeks: {
        all: ["weeks"] as const,
        list: (page: number, pageSize: number, scope?: string, projectId?: string) =>
            [...queryKeys.weeks.all, "list", page, pageSize, scope ?? "default", projectId ?? "all"] as const,
        detail: (weekStart: string, scope?: string, projectId?: string) =>
            [...queryKeys.weeks.all, "detail", weekStart, scope ?? "default", projectId ?? "all"] as const,
    },
    projects: {
        all: ["projects"] as const,
        detail: (id: string) => [...queryKeys.projects.all, id] as const,
    },
} as const;
