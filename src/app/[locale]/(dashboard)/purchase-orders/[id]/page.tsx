import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { PurchaseOrderDetailView } from "@/components/purchasing/purchase-order-detail-view";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user.permissions.includes("purchases:read")) {
    return <ForbiddenState />;
  }

  return <PurchaseOrderDetailView id={id} />;
}
