import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const session = await auth();
  const tenantId = session!.user.tenantId;

  // Proves the full pipeline: verified session -> tenant-scoped transaction
  // -> RLS-scoped Prisma query -> only this tenant's own row can ever come
  // back.
  const tenant = await withTenant(tenantId, (tx) =>
    tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
  );

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">{t("welcome", { name: session!.user.name ?? "" })}</h1>
      <p className="text-[var(--color-muted-foreground)]">
        {t("tenant", { tenantName: tenant.name })}
      </p>
    </div>
  );
}
