-- CreateEnum
CREATE TYPE "TaxRateStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmailTemplateKey" AS ENUM ('QUOTATION_SENT', 'WELCOME', 'FOLLOW_UP_REMINDER');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "quotationFooterText" TEXT,
ADD COLUMN     "quotationHeaderText" TEXT,
ADD COLUMN     "secondaryColor" TEXT;

-- CreateTable
CREATE TABLE "tax_rate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "TaxRateStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_template" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" "EmailTemplateKey" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_rate_organizationId_status_idx" ON "tax_rate"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tax_rate_organizationId_name_key" ON "tax_rate"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "email_template_organizationId_key_key" ON "email_template"("organizationId", "key");

-- AddForeignKey
ALTER TABLE "tax_rate" ADD CONSTRAINT "tax_rate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_template" ADD CONSTRAINT "email_template_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
