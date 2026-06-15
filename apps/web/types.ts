export interface User {
    id: string;
    email?: string;
    username?: string;
    firstName?: string | null;
    lastName?: string | null;
    profilePic?: string | null;
    refreshToken?: string | null;
    role: "ADMIN" | "MANAGER" | "EMPLOYEE";
    createdAt?: string;
    updatedAt?: string;
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
    description?: string | null;
    memberCount?: number;
}

export type WeekStatus = "MISSING" | "INCOMPLETE" | "COMPLETED";

export interface WeekSummary {
    weekNumber: number;
    weekYear: number;
    periodStart: string; // YYYY-MM-DD (Monday)
    periodEnd: string; // YYYY-MM-DD (Friday)
    totalHours: number;
    status: WeekStatus;
    project?: { id: string; name: string };
}

export type TimesheetScope = "self" | "team";

export interface WeeksResponse {
    view: "self" | "manager";
    canViewTeamTimesheets: boolean;
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
    user?: {
        id: string;
        username: string;
        firstName: string | null;
        lastName: string | null;
    };
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
    view: "self" | "manager";
    project: { id: string; name: string } | null;
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

export interface ProjectMemberUser {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
}

export interface ProjectDetail {
    id: string;
    name: string;
    description: string | null;
    managerId: string;
    createdAt: string;
    members: ProjectMemberUser[];
}
