-- CreateTable
CREATE TABLE "enquiry_product" (
    "id" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enquiry_product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "enquiry_product_productId_idx" ON "enquiry_product"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "enquiry_product_enquiryId_productId_key" ON "enquiry_product"("enquiryId", "productId");

-- AddForeignKey
ALTER TABLE "enquiry_product" ADD CONSTRAINT "enquiry_product_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enquiry_product" ADD CONSTRAINT "enquiry_product_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
