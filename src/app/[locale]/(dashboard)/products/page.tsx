import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { ProductsView } from "@/components/products/products-view";

export default async function ProductsPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("products:read")) {
    const t = await getTranslations("products");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <ProductsView />;
}
