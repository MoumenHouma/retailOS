import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { StockTransferDetailView } from "@/components/warehouses/stock-transfer-detail-view";

export default async function StockTransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user.permissions.includes("inventory:read")) {
    const t = await getTranslations("stockTransfers");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <StockTransferDetailView id={id} />;
}
