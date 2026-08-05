import { ReportViewer } from "@/features/reports/report-viewer";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ type: string }>;
}

export default async function ReportTypePage({ params }: PageProps) {
  const resolvedParams = await params;
  
  if (!resolvedParams.type) {
    notFound();
  }

  return <ReportViewer type={resolvedParams.type} />;
}
