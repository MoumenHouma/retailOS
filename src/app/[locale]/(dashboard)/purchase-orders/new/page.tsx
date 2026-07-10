import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { PageHeader } from "@/components/layout/page-header";
import { PurchaseOrderForm } from "@/components/purchasing/purchase-order-form";

export default async function NewPurchaseOrderPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("purchases:create")) {
    return <ForbiddenState />;
  }

  const t = await getTranslations("purchaseOrders");

  if (!session.user.primaryStoreId) {
    return <p className="text-muted-foreground">{t("noStore")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("newPurchaseOrder")} />
      <PurchaseOrderForm storeId={session.user.primaryStoreId} />
    </div>
  );
}
