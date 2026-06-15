import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

/** Invalidate all week-detail variants (scope/project filters) for a given week. */
export function invalidateWeekCaches(queryClient: QueryClient, weekStart: string) {
    queryClient.invalidateQueries({ queryKey: [...queryKeys.weeks.all, "detail", weekStart] });
    queryClient.invalidateQueries({ queryKey: queryKeys.weeks.all });
}
