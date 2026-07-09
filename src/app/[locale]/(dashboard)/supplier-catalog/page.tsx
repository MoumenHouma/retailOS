import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { SupplierCatalogView } from "@/components/purchasing/supplier-catalog-view";

export default async function SupplierCatalogPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("purchases:read")) {
    const t = await getTranslations("supplierCatalog");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <SupplierCatalogView />;
}
