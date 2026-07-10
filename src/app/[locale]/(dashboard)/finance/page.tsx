import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { FinancialDashboardView } from "@/components/finance/financial-dashboard-view";

export default async function FinancePage() {
  const session = await auth();

  if (!session?.user.permissions.includes("finance:report")) {
    return <ForbiddenState />;
  }

  return <FinancialDashboardView />;
}
