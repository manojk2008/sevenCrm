-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "quotation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "enquiryId" TEXT,
    "assignedToId" TEXT,
    "quotationNumber" TEXT NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "terms" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL,
    "discountAmount" DECIMAL(14,2) NOT NULL,
    "taxAmount" DECIMAL(14,2) NOT NULL,
    "grandTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_line_item" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT,
    "productNameSnapshot" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "unitPriceSnapshot" DECIMAL(14,2) NOT NULL,
    "discountPercentage" DECIMAL(5,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "lineAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_line_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_number_counter" (
    "organizationId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_number_counter_pkey" PRIMARY KEY ("organizationId","year")
);

-- CreateIndex
CREATE INDEX "quotation_organizationId_status_idx" ON "quotation"("organizationId", "status");

-- CreateIndex
CREATE INDEX "quotation_organizationId_clientId_idx" ON "quotation"("organizationId", "clientId");

-- CreateIndex
CREATE INDEX "quotation_organizationId_enquiryId_idx" ON "quotation"("organizationId", "enquiryId");

-- CreateIndex
CREATE INDEX "quotation_assignedToId_idx" ON "quotation"("assignedToId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_organizationId_quotationNumber_key" ON "quotation"("organizationId", "quotationNumber");

-- CreateIndex
CREATE INDEX "quotation_line_item_quotationId_idx" ON "quotation_line_item"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_line_item_productId_idx" ON "quotation_line_item"("productId");

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation" ADD CONSTRAINT "quotation_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_item" ADD CONSTRAINT "quotation_line_item_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_item" ADD CONSTRAINT "quotation_line_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
