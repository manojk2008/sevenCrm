-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'DEMO', 'VISIT');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "follow_up" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "assignedToId" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "type" "FollowUpType" NOT NULL,
    "priority" "Priority" NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "notes" TEXT,
    "reminder" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_up_organizationId_status_idx" ON "follow_up"("organizationId", "status");

-- CreateIndex
CREATE INDEX "follow_up_organizationId_scheduledAt_idx" ON "follow_up"("organizationId", "scheduledAt");

-- CreateIndex
CREATE INDEX "follow_up_organizationId_clientId_idx" ON "follow_up"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "follow_up_organizationId_enquiryId_idx" ON "follow_up"("organizationId", "enquiryId");

-- CreateIndex
CREATE INDEX "follow_up_organizationId_priority_idx" ON "follow_up"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "follow_up_assignedToId_idx" ON "follow_up"("assignedToId");

-- AddForeignKey
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
