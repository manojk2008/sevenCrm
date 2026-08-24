-- CreateEnum
CREATE TYPE "EnquiryStage" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP', 'QUOTATION_SENT', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "EnquirySource" AS ENUM ('WEBSITE', 'REFERRAL', 'COLD_CALL', 'SOCIAL_MEDIA', 'EMAIL', 'TRADE_SHOW', 'ADVERTISEMENT', 'PARTNER', 'OTHER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "enquiry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "title" TEXT NOT NULL,
    "stage" "EnquiryStage" NOT NULL DEFAULT 'NEW',
    "expectedRevenue" DECIMAL(14,2) NOT NULL,
    "probability" INTEGER NOT NULL,
    "priority" "Priority" NOT NULL,
    "source" "EnquirySource" NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "expectedCloseDate" TIMESTAMP(3) NOT NULL,
    "lostReason" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquiry_organizationId_stage_idx" ON "enquiry"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "enquiry_organizationId_clientId_idx" ON "enquiry"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "enquiry_organizationId_priority_idx" ON "enquiry"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "enquiry_assignedToId_idx" ON "enquiry"("assignedToId");

-- CreateIndex
CREATE INDEX "enquiry_organizationId_expectedCloseDate_idx" ON "enquiry"("organizationId", "expectedCloseDate");

-- AddForeignKey
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
