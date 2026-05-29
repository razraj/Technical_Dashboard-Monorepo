export interface User {
    id: string;
    email?: string;
    username?: string;
    firstName?: string | null;
    lastName?: string | null;
    profilePic?: string | null;
    refreshToken?: string | null;
}

export const UserResponseDefault = {
    users: [] as User[],
    total: 0,
    message: ""
};
export type UserResponse = typeof UserResponseDefault;

export interface Project {
    id: string;
    name: string;
}

export type WeekStatus = "MISSING" | "INCOMPLETE" | "COMPLETED";

export interface WeekSummary {
    weekNumber: number;
    weekYear: number;
    periodStart: string; // YYYY-MM-DD (Monday)
    periodEnd: string; // YYYY-MM-DD (Friday)
    totalHours: number;
    status: WeekStatus;
}

export interface WeeksResponse {
    weeks: WeekSummary[];
    page: number;
    pageSize: number;
    total: number;
}

export interface TimesheetEntry {
    id: string;
    date: string;
    hours: number;
    workType: string;
    description: string;
    projectId: string;
    project: { id: string; name: string } | null;
    createdAt: string;
    updatedAt: string;
}

export interface DayDetail {
    date: string; // YYYY-MM-DD
    dayLabel: string; // Mon..Fri
    totalHours: number;
    entries: TimesheetEntry[];
}

export interface WeekDetail {
    weekNumber: number;
    weekYear: number;
    periodStart: string;
    periodEnd: string;
    totalHours: number;
    capacity: number;
    utilization: number;
    status: WeekStatus;
    days: DayDetail[];
}
