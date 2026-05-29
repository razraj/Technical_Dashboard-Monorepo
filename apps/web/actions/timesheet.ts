import { Project, TimesheetEntry, TimesheetScope, WeekDetail, WeeksResponse } from "@/types";
import { fetchWithAuth } from "@/utils/api";

export interface EntryPayload {
    date: string;
    projectId: string;
    workType: string;
    description: string;
    hours: number;
}

type TimesheetQueryOptions = {
    scope?: TimesheetScope;
    projectId?: string;
};

function buildTimesheetQuery(options?: TimesheetQueryOptions): string {
    const params = new URLSearchParams();
    if (options?.scope) params.set("scope", options.scope);
    if (options?.projectId) params.set("projectId", options.projectId);
    const query = params.toString();
    return query ? `?${query}` : "";
}

export const getWeeks = (
    page = 1,
    pageSize = 10,
    options?: TimesheetQueryOptions
): Promise<WeeksResponse> => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (options?.scope) params.set("scope", options.scope);
    if (options?.projectId) params.set("projectId", options.projectId);
    return fetchWithAuth(`/timesheet/weeks?${params.toString()}`, { method: "GET" });
};

export const getWeekDetail = (weekStart: string, options?: TimesheetQueryOptions): Promise<WeekDetail> =>
    fetchWithAuth(`/timesheet/weeks/${weekStart}${buildTimesheetQuery(options)}`, { method: "GET" });

export const getProjects = (): Promise<{ projects: Project[] }> =>
    fetchWithAuth(`/project`, { method: "GET" });

export const createEntry = (payload: EntryPayload): Promise<{ entry: TimesheetEntry }> =>
    fetchWithAuth(`/timesheet/entries`, { method: "POST", body: JSON.stringify(payload) });

export const updateEntry = (
    entryId: string,
    payload: Partial<EntryPayload>
): Promise<{ entry: TimesheetEntry }> =>
    fetchWithAuth(`/timesheet/entries/${entryId}`, { method: "PATCH", body: JSON.stringify(payload) });

export const deleteEntry = (entryId: string): Promise<{ success: boolean; id: string }> =>
    fetchWithAuth(`/timesheet/entries/${entryId}`, { method: "DELETE" });
