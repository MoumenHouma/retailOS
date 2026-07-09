import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { ForbiddenState } from "@/components/layout/forbidden-state";
import { PageHeader } from "@/components/layout/page-header";
import { StockTransferForm } from "@/components/warehouses/stock-transfer-form";

export default async function NewStockTransferPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:transfer")) {
    return <ForbiddenState />;
  }

  const t = await getTranslations("stockTransfers");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("newTransfer")} />
      <StockTransferForm />
    </div>
  );
}
