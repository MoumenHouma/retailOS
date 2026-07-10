import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { ForecastView } from "@/components/ai/forecast-view";

export default async function AiForecastsPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("ai:view_recommendations")) {
    return <ForbiddenState />;
  }

  return <ForecastView />;
}
