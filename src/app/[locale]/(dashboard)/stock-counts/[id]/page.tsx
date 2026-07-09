import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { StockCountDetailView } from "@/components/warehouses/stock-count-detail-view";

export default async function StockCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user.permissions.includes("inventory:read")) {
    const t = await getTranslations("stockCounts");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <StockCountDetailView id={id} />;
}
