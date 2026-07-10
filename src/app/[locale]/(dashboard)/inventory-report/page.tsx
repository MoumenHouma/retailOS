import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { InventoryReportView } from "@/components/reports/inventory-report-view";

export default async function InventoryReportPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("reports:view")) {
    return <ForbiddenState />;
  }

  return <InventoryReportView />;
}
