import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { StockTransferForm } from "@/components/warehouses/stock-transfer-form";

export default async function NewStockTransferPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:transfer")) {
    const t = await getTranslations("stockTransfers");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  const t = await getTranslations("stockTransfers");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("newTransfer")}</h1>
      <StockTransferForm />
    </div>
  );
}
