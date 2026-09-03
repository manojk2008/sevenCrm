-- CreateEnum
CREATE TYPE "FollowUpStatusOptionState" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "follow_up" ADD COLUMN     "customStatusId" TEXT;

-- CreateTable
CREATE TABLE "follow_up_status_option" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FollowUpStatusOptionState" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_up_status_option_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_up_status_option_organizationId_status_idx" ON "follow_up_status_option"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "follow_up_status_option_organizationId_name_key" ON "follow_up_status_option"("organizationId", "name");

-- CreateIndex
CREATE INDEX "follow_up_customStatusId_idx" ON "follow_up"("customStatusId");

-- AddForeignKey
ALTER TABLE "follow_up" ADD CONSTRAINT "follow_up_customStatusId_fkey" FOREIGN KEY ("customStatusId") REFERENCES "follow_up_status_option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_status_option" ADD CONSTRAINT "follow_up_status_option_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
