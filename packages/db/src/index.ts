export { prisma } from "./client"; // exports instance of prisma
// Explicit re-exports only (no `export *`) — Turbopack rejects `export *` from Prisma’s generated CJS bundle.
export * from "./generated/client";
