import type { Prisma } from "@prisma/client";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ClipboardCheck, ClipboardList, Receipt, Wallet, Users, Sparkles, PackageX } from "lucide-react";
import { formatDa } from "@/lib/currency";
import { getReorderSuggestions } from "@/server/services/procurement-reports";

type TransactionClient = Prisma.TransactionClient;

export interface KpiWidgetResult {
  value: string | number;
  tone?: "default" | "warning" | "destructive";
}

export interface KpiWidget {
  key: string;
  labelKey: string;
  icon: LucideIcon;
  requiredPermission: string;
  fetch: (tx: TransactionClient, ctx: { tenantId: string; storeId?: string }) => Promise<KpiWidgetResult>;
}

/**
 * Static in-code catalog, same shape as src/config/nav.ts — widgets render
 * via the existing StatTile component, no new table for widget definitions.
 * Each entry is permission-gated so a CASHIER's available set is naturally
 * smaller than BUSINESS_OWNER's; DashboardLayout.widgets just stores which
 * keys (from this catalog) a role has enabled/ordered.
 */
export const KPI_WIDGETS: KpiWidget[] = [
  {
    key: "lowStock",
    labelKey: "kpi.lowStock",
    icon: AlertTriangle,
    requiredPermission: "inventory:read",
    fetch: async (tx) => {
      const suggestions = await getReorderSuggestions(tx);
      return { value: suggestions.length, tone: suggestions.length > 0 ? "warning" : "default" };
    },
  },
  {
    key: "openPurchaseOrders",
    labelKey: "kpi.openPurchaseOrders",
    icon: ClipboardList,
    requiredPermission: "purchases:read",
    fetch: async (tx) => {
      const count = await tx.purchaseOrder.count({ where: { status: { notIn: ["received", "cancelled"] } } });
      return { value: count };
    },
  },
  {
    key: "pendingStockCounts",
    labelKey: "kpi.pendingStockCounts",
    icon: ClipboardCheck,
    requiredPermission: "inventory:read",
    fetch: async (tx) => {
      const count = await tx.stockCount.count({ where: { status: { in: ["in_progress", "pending_review"] } } });
      return { value: count };
    },
  },
  {
    key: "todaySales",
    labelKey: "kpi.todaySales",
    icon: Receipt,
    requiredPermission: "pos:operate",
    fetch: async (tx, { storeId }) => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const result = await tx.sale.aggregate({
        where: { status: "completed", createdAt: { gte: startOfToday }, ...(storeId ? { storeId } : {}) },
        _sum: { total: true },
      });
      return { value: formatDa(result._sum.total ?? 0) };
    },
  },
  {
    key: "arOverdue",
    labelKey: "kpi.arOverdue",
    icon: Wallet,
    requiredPermission: "finance:read",
    fetch: async (tx) => {
      // amountPaid < totalTtc is a cross-column comparison Prisma can't
      // express in `where` — filtered in JS, same pattern getReorderSuggestions
      // uses for quantityOnHand <= minStockLevel.
      const invoices = await tx.invoice.findMany({
        where: { dueDate: { lt: new Date() } },
        select: { totalTtc: true, amountPaid: true },
      });
      const overdue = invoices.filter((inv) => inv.amountPaid < inv.totalTtc);
      const total = overdue.reduce((sum, inv) => sum + (inv.totalTtc - inv.amountPaid), 0);
      return { value: formatDa(total), tone: total > 0 ? "warning" : "default" };
    },
  },
  {
    key: "employeeHeadcount",
    labelKey: "kpi.employeeHeadcount",
    icon: Users,
    requiredPermission: "employees:read",
    fetch: async (tx) => {
      const count = await tx.employee.count({ where: { deletedAt: null } });
      return { value: count };
    },
  },
  {
    key: "aiRecommendations",
    labelKey: "kpi.aiRecommendations",
    icon: Sparkles,
    requiredPermission: "ai:view_recommendations",
    fetch: async (tx) => {
      const count = await tx.aiRecommendation.count({ where: { isRead: false } });
      return { value: count };
    },
  },
  {
    key: "expiringBatches",
    labelKey: "kpi.expiringBatches",
    icon: PackageX,
    requiredPermission: "inventory:read",
    fetch: async (tx) => {
      const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const count = await tx.productBatch.count({
        where: { quantityRemaining: { gt: 0 }, expirationDate: { not: null, lte: horizon }, deletedAt: null },
      });
      return { value: count, tone: count > 0 ? "warning" : "default" };
    },
  },
];

export const DEFAULT_WIDGET_KEYS = ["lowStock", "openPurchaseOrders", "pendingStockCounts", "todaySales"];
