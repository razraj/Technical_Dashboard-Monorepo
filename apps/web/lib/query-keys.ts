export const queryKeys = {
    weeks: {
        all: ["weeks"] as const,
        list: (page: number, pageSize: number) => [...queryKeys.weeks.all, "list", page, pageSize] as const,
        detail: (weekStart: string) => [...queryKeys.weeks.all, "detail", weekStart] as const,
    },
    projects: {
        all: ["projects"] as const,
    },
} as const;
