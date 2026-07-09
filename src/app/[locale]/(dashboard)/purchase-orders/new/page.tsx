import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { PurchaseOrderForm } from "@/components/purchasing/purchase-order-form";

export default async function NewPurchaseOrderPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("purchases:create")) {
    const t = await getTranslations("purchaseOrders");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  const t = await getTranslations("purchaseOrders");

  if (!session.user.storeId) {
    return <p className="text-[var(--color-muted-foreground)]">{t("noStore")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("newPurchaseOrder")}</h1>
      <PurchaseOrderForm storeId={session.user.storeId} />
    </div>
  );
}
