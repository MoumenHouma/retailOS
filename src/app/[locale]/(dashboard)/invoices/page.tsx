import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { InvoicesView } from "@/components/invoices/invoices-view";

export default async function InvoicesPage() {
  const session = await auth();

  if (!session?.user.permissions.includes("finance:read")) {
    const t = await getTranslations("invoices");
    return <p className="text-[var(--color-muted-foreground)]">{t("forbidden")}</p>;
  }

  return <InvoicesView />;
}
