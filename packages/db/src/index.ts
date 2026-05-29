export { prisma } from "./client";

// Explicit re-exports only (no `export *`) — Turbopack rejects `export *` from Prisma’s generated CJS bundle.
export { Prisma, PrismaClient, Role, TaskStatus } from "./generated/client";
export type { ActivityLog, Project, Task, TimesheetEntry, User } from "./generated/client";
