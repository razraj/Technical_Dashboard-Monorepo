-- Align database with flat TimesheetEntry model (schema.prisma on main/fix).
-- Clears existing rows first so NOT NULL column additions succeed; run db:seed after migrate.

TRUNCATE TABLE "TimesheetEntry", "Timesheet", "Task", "ProjectMember", "Project", "ActivityLog", "User" CASCADE;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'EMPLOYEE');

-- AlterEnum
BEGIN;
CREATE TYPE "TaskStatus_new" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED');
ALTER TABLE "public"."Task" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "status" TYPE "TaskStatus_new" USING (
  CASE "status"::text
    WHEN 'DONE' THEN 'COMPLETED'::"TaskStatus_new"
    WHEN 'BLOCKED' THEN 'IN_REVIEW'::"TaskStatus_new"
    ELSE "status"::text::"TaskStatus_new"
  END
);
ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";
ALTER TYPE "TaskStatus_new" RENAME TO "TaskStatus";
DROP TYPE "public"."TaskStatus_old";
ALTER TABLE "Task" ALTER COLUMN "status" SET DEFAULT 'TODO';
COMMIT;

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_createdById_fkey";
ALTER TABLE "ProjectMember" DROP CONSTRAINT IF EXISTS "ProjectMember_projectId_fkey";
ALTER TABLE "ProjectMember" DROP CONSTRAINT IF EXISTS "ProjectMember_userId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assignedToId_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_createdById_fkey";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_projectId_fkey";
ALTER TABLE "Timesheet" DROP CONSTRAINT IF EXISTS "Timesheet_userId_fkey";
ALTER TABLE "TimesheetEntry" DROP CONSTRAINT IF EXISTS "TimesheetEntry_taskId_fkey";
ALTER TABLE "TimesheetEntry" DROP CONSTRAINT IF EXISTS "TimesheetEntry_timesheetId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Project_createdById_idx";
DROP INDEX IF EXISTS "Project_isDeleted_idx";
DROP INDEX IF EXISTS "Project_name_idx";
DROP INDEX IF EXISTS "Task_assignedToId_idx";
DROP INDEX IF EXISTS "Task_createdById_idx";
DROP INDEX IF EXISTS "Task_isDeleted_idx";
DROP INDEX IF EXISTS "Task_projectId_status_idx";
DROP INDEX IF EXISTS "TimesheetEntry_timesheetId_workDate_idx";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN IF EXISTS "color",
DROP COLUMN IF EXISTS "createdById",
DROP COLUMN IF EXISTS "isDeleted",
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "managerId" TEXT;

UPDATE "Project" SET "managerId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "managerId" IS NULL;
ALTER TABLE "Project" ALTER COLUMN "managerId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN IF EXISTS "assignedToId",
DROP COLUMN IF EXISTS "createdById",
DROP COLUMN IF EXISTS "isDeleted",
DROP COLUMN IF EXISTS "type",
ADD COLUMN IF NOT EXISTS "assigneeId" TEXT,
ADD COLUMN IF NOT EXISTS "creatorId" TEXT,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "startDate" DATE;

UPDATE "Task" SET "creatorId" = (SELECT "id" FROM "User" LIMIT 1) WHERE "creatorId" IS NULL;
ALTER TABLE "Task" ALTER COLUMN "creatorId" SET NOT NULL;

ALTER TABLE "Task" ALTER COLUMN "estimatedHours" SET NOT NULL,
ALTER COLUMN "estimatedHours" SET DEFAULT 0,
ALTER COLUMN "estimatedHours" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TimesheetEntry" DROP COLUMN IF EXISTS "endTime",
DROP COLUMN IF EXISTS "isOvertime",
DROP COLUMN IF EXISTS "startTime",
DROP COLUMN IF EXISTS "timesheetId",
DROP COLUMN IF EXISTS "workDate",
ADD COLUMN IF NOT EXISTS "date" DATE,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "projectId" TEXT,
ADD COLUMN IF NOT EXISTS "userId" TEXT,
ADD COLUMN IF NOT EXISTS "workType" TEXT;

ALTER TABLE "TimesheetEntry" ALTER COLUMN "hours" SET DATA TYPE DOUBLE PRECISION;
ALTER TABLE "TimesheetEntry" ALTER COLUMN "description" SET NOT NULL;
ALTER TABLE "TimesheetEntry" ALTER COLUMN "taskId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "weeklyCapacity" DOUBLE PRECISION NOT NULL DEFAULT 40;
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";
ALTER TABLE "User" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'EMPLOYEE';

-- DropTable
DROP TABLE IF EXISTS "ProjectMember";
DROP TABLE IF EXISTS "Timesheet";

-- DropEnum
DROP TYPE IF EXISTS "ProjectRole";
DROP TYPE IF EXISTS "TaskType";
DROP TYPE IF EXISTS "TimesheetStatus";
DROP TYPE IF EXISTS "UserRole";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Project_managerId_idx" ON "Project"("managerId");
CREATE INDEX IF NOT EXISTS "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX IF NOT EXISTS "Task_creatorId_idx" ON "Task"("creatorId");
CREATE INDEX IF NOT EXISTS "Task_dueDate_idx" ON "Task"("dueDate");
CREATE INDEX IF NOT EXISTS "TimesheetEntry_userId_date_idx" ON "TimesheetEntry"("userId", "date");
CREATE INDEX IF NOT EXISTS "TimesheetEntry_projectId_idx" ON "TimesheetEntry"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
