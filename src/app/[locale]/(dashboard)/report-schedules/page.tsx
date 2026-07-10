import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { ReportSchedulesView } from "@/components/reports/report-schedules-view";

export default async function ReportSchedulesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("reports:customize")) {
    return <ForbiddenState />;
  }

  return <ReportSchedulesView />;
}
