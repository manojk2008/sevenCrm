import { EnquiriesContent } from "@/features/enquiries/enquiries-content";

export const metadata = {
  title: "Enquiries | SevenCRM",
  description: "Manage your sales pipeline",
};

export default function EnquiriesPage() {
  return (
    <div className="flex-1 w-full flex flex-col min-h-0 bg-slate-50/50 dark:bg-slate-900/50">
      <EnquiriesContent />
    </div>
  );
}
