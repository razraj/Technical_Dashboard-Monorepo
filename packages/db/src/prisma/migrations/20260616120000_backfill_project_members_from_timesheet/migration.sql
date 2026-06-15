-- Backfill ProjectMember rows from existing timesheet entries (idempotent).
INSERT INTO "ProjectMember" ("userId", "projectId", "createdAt")
SELECT DISTINCT te."userId", te."projectId", NOW()
FROM "TimesheetEntry" te
INNER JOIN "Project" p ON p."id" = te."projectId" AND p."deletedAt" IS NULL
WHERE te."deletedAt" IS NULL
ON CONFLICT ("userId", "projectId") DO NOTHING;
