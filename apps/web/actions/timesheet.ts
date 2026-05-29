import { Project, TimesheetEntry, WeekDetail, WeeksResponse } from "@/types";
import { fetchWithAuth } from "@/utils/api";

export interface EntryPayload {
    date: string;
    projectId: string;
    workType: string;
    description: string;
    hours: number;
}

export const getWeeks = (page = 1, pageSize = 10): Promise<WeeksResponse> =>
    fetchWithAuth(`/timesheet/weeks?page=${page}&pageSize=${pageSize}`, { method: "GET" });

export const getWeekDetail = (weekStart: string): Promise<WeekDetail> =>
    fetchWithAuth(`/timesheet/weeks/${weekStart}`, { method: "GET" });

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
