-- Replaces the fixed EnquirySource enum with a persistent, organization-scoped
-- EnquirySource lookup table, and converts Enquiry.source (required enum) into
-- Enquiry.sourceId (optional FK).
--
-- Ordered specifically so no existing Enquiry's source information is lost:
--   1. Create the new enquiry_source table (empty).
--   2. Add the new, nullable enquiry.sourceId column alongside the still-live
--      enquiry.source enum column.
--   3. Backfill: for every (organizationId, distinct legacy source value)
--      combination actually used by an existing Enquiry, create exactly one
--      enquiry_source row, named from the enum's existing human-readable
--      label. No organization receives a source it never used, and no
--      organization created after this migration receives any seeded rows —
--      this INSERT only ever reads from enquiry.source, which is empty for a
--      brand-new org.
--   4. Point every existing Enquiry's sourceId at its matching new row.
--   5. Only now — with every Enquiry's source information preserved on the
--      new column — drop the old enum column and type.
--   6. Add the index/foreign key for the new column.

-- Step 1: CreateTable
CREATE TABLE "enquiry_source" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enquiry_source_pkey" PRIMARY KEY ("id")
);

-- Step 1: CreateIndex
CREATE INDEX "enquiry_source_organizationId_idx" ON "enquiry_source"("organizationId");

-- Step 1: CreateIndex — case-sensitive at the database level; duplicate
-- detection is case-insensitive and enforced at the service layer (see
-- EnquirySourcesService.create).
CREATE UNIQUE INDEX "enquiry_source_organizationId_name_key" ON "enquiry_source"("organizationId", "name");

-- Step 1: AddForeignKey
ALTER TABLE "enquiry_source" ADD CONSTRAINT "enquiry_source_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 2: AlterTable — nullable, added alongside the still-live "source"
-- enum column so the backfill below can read one while writing the other.
ALTER TABLE "enquiry" ADD COLUMN "sourceId" TEXT;

-- Step 3: Backfill — one enquiry_source row per organization per distinct
-- legacy enum value that organization's Enquiries actually used. An id is
-- generated with plain built-in functions (no pgcrypto/uuid-ossp extension
-- required) since this INSERT runs outside Prisma Client and cannot call
-- its cuid() generator.
INSERT INTO "enquiry_source" ("id", "organizationId", "name", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || legacy."organizationId" || legacy."source"::text),
  legacy."organizationId",
  CASE legacy."source"
    WHEN 'WEBSITE' THEN 'Website'
    WHEN 'REFERRAL' THEN 'Referral'
    WHEN 'COLD_CALL' THEN 'Cold Call'
    WHEN 'SOCIAL_MEDIA' THEN 'Social Media'
    WHEN 'EMAIL' THEN 'Email Campaign'
    WHEN 'TRADE_SHOW' THEN 'Trade Show'
    WHEN 'ADVERTISEMENT' THEN 'Advertisement'
    WHEN 'PARTNER' THEN 'Partner'
    WHEN 'OTHER' THEN 'Other'
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (SELECT DISTINCT "organizationId", "source" FROM "enquiry") AS legacy;

-- Step 4: Point every existing Enquiry at its migrated EnquirySource row.
UPDATE "enquiry" AS e
SET "sourceId" = es."id"
FROM "enquiry_source" AS es
WHERE es."organizationId" = e."organizationId"
  AND es."name" = CASE e."source"
    WHEN 'WEBSITE' THEN 'Website'
    WHEN 'REFERRAL' THEN 'Referral'
    WHEN 'COLD_CALL' THEN 'Cold Call'
    WHEN 'SOCIAL_MEDIA' THEN 'Social Media'
    WHEN 'EMAIL' THEN 'Email Campaign'
    WHEN 'TRADE_SHOW' THEN 'Trade Show'
    WHEN 'ADVERTISEMENT' THEN 'Advertisement'
    WHEN 'PARTNER' THEN 'Partner'
    WHEN 'OTHER' THEN 'Other'
  END;

-- Step 5: AlterTable — safe now that every Enquiry's source information has
-- been carried over to sourceId above.
ALTER TABLE "enquiry" DROP COLUMN "source";

-- Step 5: DropEnum
DROP TYPE "EnquirySource";

-- Step 6: CreateIndex
CREATE INDEX "enquiry_sourceId_idx" ON "enquiry"("sourceId");

-- Step 6: AddForeignKey
ALTER TABLE "enquiry" ADD CONSTRAINT "enquiry_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "enquiry_source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
