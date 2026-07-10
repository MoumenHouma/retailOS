import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { FinancialPeriodsView } from "@/components/finance/financial-periods-view";

export default async function FinancialPeriodsPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("finance:report")) {
    return <ForbiddenState />;
  }

  return <FinancialPeriodsView />;
}
