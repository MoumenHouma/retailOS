import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { SupplierQuotesView } from "@/components/purchasing/supplier-quotes-view";

export default async function SupplierQuotesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("purchases:read")) {
    const t = await getTranslations("supplierQuotes");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <SupplierQuotesView />;
}
