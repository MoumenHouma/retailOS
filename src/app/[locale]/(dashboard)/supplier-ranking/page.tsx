import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { SupplierRankingView } from "@/components/ai/supplier-ranking-view";

export default async function SupplierRankingPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("suppliers:evaluate")) {
    return <ForbiddenState />;
  }

  return <SupplierRankingView />;
}
