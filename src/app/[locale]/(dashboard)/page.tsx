import { getTranslations } from "next-intl/server";
import { AlertTriangle, ClipboardCheck, ClipboardList, Receipt } from "lucide-react";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { StatTile } from "@/components/ui/stat-tile";
import { formatDa } from "@/lib/currency";
import { getReorderSuggestions } from "@/server/services/procurement-reports";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const session = await auth();
  const tenantId = session!.user.tenantId;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Proves the full pipeline: verified session -> tenant-scoped transaction
  // -> RLS-scoped Prisma query -> only this tenant's own row can ever come
  // back.
  const [tenant, reorderSuggestions, openPurchaseOrders, pendingStockCounts, todaySales] =
    await withTenant(tenantId, (tx) =>
      Promise.all([
        tx.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
        getReorderSuggestions(tx),
        tx.purchaseOrder.count({ where: { status: { notIn: ["received", "cancelled"] } } }),
        tx.stockCount.count({ where: { status: { in: ["in_progress", "pending_review"] } } }),
        tx.sale.aggregate({
          where: { status: "completed", createdAt: { gte: startOfToday } },
          _sum: { total: true },
        }),
      ]),
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t("welcome", { name: session!.user.name ?? "" })}</h1>
        <p className="text-muted-foreground">
          {t("tenant", { tenantName: tenant.name })}
        </p>
      </div>

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
