import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { SubscriptionView } from "@/components/reports/subscription-view";

export default async function SubscriptionPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("subscription:read")) {
    return <ForbiddenState />;
  }

  return <SubscriptionView />;
}
