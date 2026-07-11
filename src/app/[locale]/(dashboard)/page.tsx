import { getTranslations } from "next-intl/server";
import { AlertTriangle, CheckCircle2, Circle, ClipboardCheck, ClipboardList, Receipt } from "lucide-react";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { StatTile } from "@/components/ui/stat-tile";
import { Card, CardContent } from "@/components/ui/card";
import { formatDa } from "@/lib/currency";
import { getReorderSuggestionsCached } from "@/server/services/procurement-reports";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const session = await auth();
  const tenantId = session!.user.tenantId;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Proves the full pipeline: verified session -> tenant-scoped transaction
  // -> RLS-scoped Prisma query -> only this tenant's own row can ever come
  // back.
  const [
    [tenant, openPurchaseOrders, pendingStockCounts, todaySales, productCount, storeCount],
    reorderSuggestions,
  ] = await Promise.all([
    withTenant(tenantId, (tx) =>
      Promise.all([
        tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
        tx.purchaseOrder.count({ where: { status: { notIn: ["received", "cancelled"] } } }),
        tx.stockCount.count({ where: { status: { in: ["in_progress", "pending_review"] } } }),
        tx.sale.aggregate({
          where: { status: "completed", createdAt: { gte: startOfToday } },
          _sum: { total: true },
        }),
        tx.product.count({ where: { deletedAt: null } }),
        tx.store.count({ where: { deletedAt: null, isActive: true } }),
      ]),
    ),
    // Cached separately (60s TTL) — opens its own withTenant, not part of
    // the transaction above, since it runs on every dashboard load and
    // rarely changes within a minute.
    getReorderSuggestionsCached(tenantId),
  ]);

  // Phase 6 Chunk C: lightweight setup checklist for brand-new tenants — no
  // persisted onboarding-progress table, just simple existence checks.
  const setupSteps = [
    { done: true, labelKey: "setup.accountCreated" },
    { done: storeCount > 0, labelKey: "setup.storeAdded" },
    { done: productCount > 0, labelKey: "setup.productsAdded" },
    { done: (todaySales._sum.total ?? 0) > 0, labelKey: "setup.firstSale" },
  ];
  const showSetupBanner = setupSteps.some((s) => !s.done);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("welcome", { name: session!.user.name ?? "" })}</h1>
        <p className="text-muted-foreground">
          {t("tenant", { tenantName: tenant.name })}
        </p>
      </div>

      {showSetupBanner && (
        <Card>
          <CardContent className="flex flex-col gap-2 p-4">
            <span className="text-sm font-semibold">{t("setup.title")}</span>
            <ul className="flex flex-col gap-1">
              {setupSteps.map((step) => (
                <li key={step.labelKey} className="flex items-center gap-2 text-sm">
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={step.done ? "text-muted-foreground line-through" : ""}>
                    {t(step.labelKey)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("kpi.lowStock")}
          value={reorderSuggestions.length}
          icon={AlertTriangle}
          tone={reorderSuggestions.length > 0 ? "warning" : "default"}
        />
        <StatTile label={t("kpi.openPurchaseOrders")} value={openPurchaseOrders} icon={ClipboardList} />
        <StatTile
          label={t("kpi.pendingStockCounts")}
          value={pendingStockCounts}
          icon={ClipboardCheck}
        />
        <StatTile
          label={t("kpi.todaySales")}
          value={formatDa(todaySales._sum.total ?? 0)}
          icon={Receipt}
        />
      </div>
    </div>
  );
}
