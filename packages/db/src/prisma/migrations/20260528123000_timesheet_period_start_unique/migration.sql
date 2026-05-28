-- Drop the createdAt index — not useful for week-range list queries
DROP INDEX "Timesheet_userId_createdAt_idx";

-- Add unique constraint: one timesheet per user per week start date
-- Enables safe upsert when auto-generating MISSING timesheets for a date range
CREATE UNIQUE INDEX "Timesheet_userId_periodStart_key" ON "Timesheet"("userId", "periodStart");

-- Add index to support efficient date-range list queries (WHERE periodStart BETWEEN ? AND ?)
CREATE INDEX "Timesheet_userId_periodStart_idx" ON "Timesheet"("userId", "periodStart");
