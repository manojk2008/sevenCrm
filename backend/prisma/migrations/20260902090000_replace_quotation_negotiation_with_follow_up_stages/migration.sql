-- Replaces the old singular FOLLOW_UP stage plus QUOTATION_SENT/NEGOTIATION
-- with three numbered Follow-up stages (FOLLOW_UP_1/2/3). NEW, CONTACTED,
-- WON and LOST are unchanged.
--
-- `prisma migrate dev --create-only` cannot generate this migration
-- non-interactively (it detects the removed enum values as a potential data
-- loss and refuses to run without a TTY), so this file is hand-written,
-- following the same approach used by
-- 20260901120000_replace_enquiry_source_with_lookup: convert the column to
-- TEXT, remap the values while they are plain text, then convert back to a
-- freshly-defined enum that only contains the final values. This avoids
-- Postgres's restriction on using a newly-added enum value inside the same
-- transaction that added it (ALTER TYPE ... ADD VALUE), which the
-- straightforward "add the new values, update, remove the old values"
-- sequence would hit.
--
-- Existing data mapping (approved):
--   NEW             -> NEW              (unchanged)
--   CONTACTED       -> CONTACTED        (unchanged)
--   FOLLOW_UP       -> FOLLOW_UP_1
--   QUOTATION_SENT  -> FOLLOW_UP_2
--   NEGOTIATION     -> FOLLOW_UP_3
--   WON             -> WON              (unchanged)
--   LOST            -> LOST             (unchanged)
--
-- No FollowUp row is touched by this migration — only Enquiry.stage.

BEGIN;

-- 1. Drop the default and widen the column to plain text so it is no longer
--    constrained by the enum type at all, and the old values remain exactly
--    as they are while we remap them.
ALTER TABLE "enquiry" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "enquiry" ALTER COLUMN "stage" TYPE TEXT USING "stage"::TEXT;

-- 2. Remap the removed values to their approved new stage. Every other
--    value (NEW/CONTACTED/WON/LOST) passes through unchanged via ELSE.
UPDATE "enquiry"
SET "stage" = CASE "stage"
  WHEN 'FOLLOW_UP' THEN 'FOLLOW_UP_1'
  WHEN 'QUOTATION_SENT' THEN 'FOLLOW_UP_2'
  WHEN 'NEGOTIATION' THEN 'FOLLOW_UP_3'
  ELSE "stage"
END;

-- 3. Drop the old enum type (nothing references it anymore — the column is
--    TEXT) and create the new one with only the final, approved values.
DROP TYPE "EnquiryStage";
CREATE TYPE "EnquiryStage" AS ENUM ('NEW', 'CONTACTED', 'FOLLOW_UP_1', 'FOLLOW_UP_2', 'FOLLOW_UP_3', 'WON', 'LOST');

-- 4. Cast the column back to the enum (every value was remapped in step 2,
--    so every row is guaranteed to be a valid member here) and restore the
--    default.
ALTER TABLE "enquiry" ALTER COLUMN "stage" TYPE "EnquiryStage" USING "stage"::"EnquiryStage";
ALTER TABLE "enquiry" ALTER COLUMN "stage" SET DEFAULT 'NEW';

COMMIT;
