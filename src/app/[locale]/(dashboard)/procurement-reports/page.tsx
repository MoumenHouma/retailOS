import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { ProcurementReportsView } from "@/components/purchasing/procurement-reports-view";

export default async function ProcurementReportsPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("purchases:read")) {
    return <ForbiddenState />;
  }

  return <ProcurementReportsView />;
}
