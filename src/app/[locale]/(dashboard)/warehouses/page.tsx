import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { WarehousesView } from "@/components/warehouses/warehouses-view";

export default async function WarehousesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:read")) {
    const t = await getTranslations("warehouses");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <WarehousesView />;
}
