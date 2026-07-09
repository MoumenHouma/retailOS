import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { PurchaseOrdersView } from "@/components/purchasing/purchase-orders-view";

export default async function PurchaseOrdersPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("purchases:read")) {
    const t = await getTranslations("purchaseOrders");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <PurchaseOrdersView />;
}
