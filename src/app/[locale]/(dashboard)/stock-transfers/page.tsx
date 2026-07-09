import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { StockTransfersView } from "@/components/warehouses/stock-transfers-view";

export default async function StockTransfersPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:read")) {
    return <ForbiddenState />;
  }

  return <StockTransfersView />;
}
