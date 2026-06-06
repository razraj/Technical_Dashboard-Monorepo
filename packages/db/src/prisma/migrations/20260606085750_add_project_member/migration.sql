/*
  Warnings:

  - Made the column `date` on table `TimesheetEntry` required. This step will fail if there are existing NULL values in that column.
  - Made the column `projectId` on table `TimesheetEntry` required. This step will fail if there are existing NULL values in that column.
  - Made the column `userId` on table `TimesheetEntry` required. This step will fail if there are existing NULL values in that column.
  - Made the column `workType` on table `TimesheetEntry` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "TimesheetEntry" ALTER COLUMN "date" SET NOT NULL,
ALTER COLUMN "projectId" SET NOT NULL,
ALTER COLUMN "userId" SET NOT NULL,
ALTER COLUMN "workType" SET NOT NULL;

-- CreateTable
CREATE TABLE "ProjectMember" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
