import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { AiDashboardView } from "@/components/ai/ai-dashboard-view";

export default async function AiDashboardPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("ai:view_recommendations")) {
    return <ForbiddenState />;
  }

  return <AiDashboardView />;
}
