export { prisma } from "./client";

// Explicit re-exports only (no `export *`) — Turbopack rejects `export *` from Prisma’s generated CJS bundle.
export { Prisma, PrismaClient, TimesheetStatus, TaskType, TaskStatus, ProjectRole, UserRole } from "./generated/client";
export type { ActivityLog, Project, ProjectMember, Task, Timesheet, TimesheetEntry, User } from "./generated/client";
