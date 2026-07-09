import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { ProcurementReportsView } from "@/components/purchasing/procurement-reports-view";

export default async function ProcurementReportsPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("purchases:read")) {
    const t = await getTranslations("procurementReports");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <ProcurementReportsView />;
}
