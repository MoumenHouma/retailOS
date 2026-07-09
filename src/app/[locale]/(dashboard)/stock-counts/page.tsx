import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { StockCountsView } from "@/components/warehouses/stock-counts-view";

export default async function StockCountsPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:read")) {
    return <ForbiddenState />;
  }

  return <StockCountsView />;
}
