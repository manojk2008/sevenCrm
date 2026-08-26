-- DropForeignKey
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_organizationId_fkey";

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
