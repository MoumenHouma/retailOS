import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { FinancialReportsView } from "@/components/finance/financial-reports-view";

export default async function FinancialReportsPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("finance:report")) {
    return <ForbiddenState />;
  }

  return <FinancialReportsView />;
}
