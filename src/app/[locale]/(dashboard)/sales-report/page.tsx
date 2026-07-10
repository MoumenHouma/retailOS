import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { SalesReportView } from "@/components/reports/sales-report-view";

export default async function SalesReportPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("reports:view")) {
    return <ForbiddenState />;
  }

  return <SalesReportView />;
}
