import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { InventoryView } from "@/components/inventory/inventory-view";

export default async function InventoryPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("inventory:read")) {
    const t = await getTranslations("inventory");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <InventoryView />;
}
