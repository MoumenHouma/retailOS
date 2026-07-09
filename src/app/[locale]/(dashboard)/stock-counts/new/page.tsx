import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { PageHeader } from "@/components/layout/page-header";
import { StockCountForm } from "@/components/warehouses/stock-count-form";

export default async function NewStockCountPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:count")) {
    return <ForbiddenState />;
  }

  const t = await getTranslations("stockCounts");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("newCount")} />
      <StockCountForm />
    </div>
  );
}
