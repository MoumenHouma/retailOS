import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { SuppliersView } from "@/components/suppliers/suppliers-view";

export default async function SuppliersPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("suppliers:read")) {
    const t = await getTranslations("suppliers");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <SuppliersView />;
}
