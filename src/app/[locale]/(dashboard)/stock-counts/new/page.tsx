import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { StockCountForm } from "@/components/warehouses/stock-count-form";

export default async function NewStockCountPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:count")) {
    const t = await getTranslations("stockCounts");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  const t = await getTranslations("stockCounts");
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("newCount")}</h1>
      <StockCountForm />
    </div>
  );
}
