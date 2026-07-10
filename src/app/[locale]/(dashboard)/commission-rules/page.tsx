import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { CommissionRulesView } from "@/components/employees/commission-rules-view";

export default async function CommissionRulesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("employees:payroll")) {
    return <ForbiddenState />;
  }

  return <CommissionRulesView />;
}
