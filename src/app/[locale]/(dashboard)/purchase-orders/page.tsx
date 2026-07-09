import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { PurchaseOrdersView } from "@/components/purchasing/purchase-orders-view";

export default async function PurchaseOrdersPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("purchases:read")) {
    return <ForbiddenState />;
  }

  return <PurchaseOrdersView />;
}
