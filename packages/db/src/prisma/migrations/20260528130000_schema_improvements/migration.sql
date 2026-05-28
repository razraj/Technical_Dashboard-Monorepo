-- ── 1. Drop low-cardinality boolean indexes (near-zero selectivity) ──────────
DROP INDEX IF EXISTS "User_isDeleted_idx";
DROP INDEX IF EXISTS "Project_isDeleted_idx";
DROP INDEX IF EXISTS "Task_isDeleted_idx";

-- ── 2. Drop redundant Timesheet userId index (covered by composite prefix) ───
DROP INDEX IF EXISTS "Timesheet_userId_idx";

-- ── 3. Remove updatedAt from ActivityLog (audit logs are immutable) ───────────
ALTER TABLE "ActivityLog" DROP COLUMN IF EXISTS "updatedAt";

-- ── 4. Add updatedAt to ProjectMember (tracks role changes) ──────────────────
ALTER TABLE "ProjectMember" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ── 5. Apply VarChar length constraints ──────────────────────────────────────
ALTER TABLE "User"      ALTER COLUMN "email"    TYPE VARCHAR(255);
ALTER TABLE "User"      ALTER COLUMN "username" TYPE VARCHAR(30);
ALTER TABLE "Project"   ALTER COLUMN "name"     TYPE VARCHAR(100);
ALTER TABLE "Project"   ALTER COLUMN "color"    TYPE VARCHAR(9);
ALTER TABLE "Task"      ALTER COLUMN "title"    TYPE VARCHAR(255);
ALTER TABLE "Timesheet" ALTER COLUMN "title"    TYPE VARCHAR(100);

-- ── 6. New composite indexes ──────────────────────────────────────────────────

-- Task: "my active tasks" (primary employee query)
CREATE INDEX IF NOT EXISTS "Task_assignedToId_status_idx" ON "Task"("assignedToId", "status");

-- Task: "tasks I created with status X"
CREATE INDEX IF NOT EXISTS "Task_createdById_status_idx" ON "Task"("createdById", "status");

-- Timesheet: "my MISSING/INCOMPLETE weeks" and PM dashboard queries
CREATE INDEX IF NOT EXISTS "Timesheet_userId_status_idx" ON "Timesheet"("userId", "status");

-- ActivityLog: "recent activity for user" (paginated by time)
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- ActivityLog: filter/aggregate by event type
CREATE INDEX IF NOT EXISTS "ActivityLog_type_idx" ON "ActivityLog"("type");
