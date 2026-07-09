import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { PosView } from "@/components/pos/pos-view";

export default async function PosPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("pos:operate")) {
    const t = await getTranslations("pos");
    return <p className="p-6 text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <PosView />;
}
