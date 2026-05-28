export { prisma } from "./client";

// Explicit re-exports only (no `export *`) — Turbopack rejects `export *` from Prisma’s generated CJS bundle.
export { Prisma, PrismaClient, TimesheetStatus } from "./generated/client";
export type { ActivityLog, Timesheet, TimesheetEntry, User } from "./generated/client";
