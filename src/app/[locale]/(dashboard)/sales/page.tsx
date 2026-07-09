import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { SalesHistoryView } from "@/components/sales/sales-history-view";

export default async function SalesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("pos:operate")) {
    const t = await getTranslations("sales");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <SalesHistoryView />;
}
