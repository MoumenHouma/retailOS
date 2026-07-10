import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { MultiStoreDashboardView } from "@/components/reports/multi-store-dashboard-view";

export default async function MultiStorePage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:read")) {
    return <ForbiddenState />;
  }

  return <MultiStoreDashboardView />;
}
