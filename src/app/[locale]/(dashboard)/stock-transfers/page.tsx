import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { StockTransfersView } from "@/components/warehouses/stock-transfers-view";

export default async function StockTransfersPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:read")) {
    const t = await getTranslations("stockTransfers");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <StockTransfersView />;
}
