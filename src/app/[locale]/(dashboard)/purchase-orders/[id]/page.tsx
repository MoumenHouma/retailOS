import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { PurchaseOrderDetailView } from "@/components/purchasing/purchase-order-detail-view";

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user.permissions.includes("purchases:read")) {
    const t = await getTranslations("purchaseOrders");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <PurchaseOrderDetailView id={id} />;
}
