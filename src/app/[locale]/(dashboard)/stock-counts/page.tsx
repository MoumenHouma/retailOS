import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { StockCountsView } from "@/components/warehouses/stock-counts-view";

export default async function StockCountsPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:read")) {
    const t = await getTranslations("stockCounts");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <StockCountsView />;
}
