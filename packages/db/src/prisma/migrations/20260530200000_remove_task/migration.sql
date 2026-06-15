-- Drop Task model and optional taskId link from TimesheetEntry.

ALTER TABLE "TimesheetEntry" DROP CONSTRAINT IF EXISTS "TimesheetEntry_taskId_fkey";
DROP INDEX IF EXISTS "TimesheetEntry_taskId_idx";
ALTER TABLE "TimesheetEntry" DROP COLUMN IF EXISTS "taskId";

DROP TABLE IF EXISTS "Task";
DROP TYPE IF EXISTS "TaskStatus";
