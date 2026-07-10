import type { Prisma } from "@prisma/client";
import type { FinancialReportQuery, RevenueDashboardQuery } from "@/lib/validators/financial-reports";

type TransactionClient = Prisma.TransactionClient;

const COMMITTED_PO_STATUSES = ["ordered", "partially_received", "received"] as const;

function bucketKey(date: Date, granularity: "daily" | "weekly" | "monthly"): string {
  if (granularity === "monthly") {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "weekly") {
    // ISO week start (Monday) as the bucket key, same "no date_trunc" JS
    // aggregation style as procurement-reports.ts.
    const weekStart = new Date(date);
    const day = (weekStart.getDay() + 6) % 7; // 0 = Monday
    weekStart.setDate(weekStart.getDate() - day);
    return weekStart.toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

/** Revenue/TVA/sale-count buckets over completed sales, daily/weekly/monthly. */
export async function getRevenueDashboard(tx: TransactionClient, query: RevenueDashboardQuery) {
  const { storeId, from, to, granularity } = query;

  const sales = await tx.sale.findMany({
    where: {
      status: "completed",
      deletedAt: null,
      createdAt: { gte: from, lte: to },
      ...(storeId ? { storeId } : {}),
    },
    select: { createdAt: true, subtotal: true, tvaAmount: true, total: true },
  });

  const buckets = new Map<
    string,
    { period: string; revenue: number; tvaAmount: number; total: number; saleCount: number }
  >();

  for (const sale of sales) {
    const key = bucketKey(sale.createdAt, granularity);
    const entry = buckets.get(key) ?? { period: key, revenue: 0, tvaAmount: 0, total: 0, saleCount: 0 };
    entry.revenue += sale.subtotal;
    entry.tvaAmount += sale.tvaAmount;
    entry.total += sale.total;
    entry.saleCount += 1;
    buckets.set(key, entry);
  }

  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Simplified P&L per PHASE4_FINANCE_PLAN.md Chunk A: Revenue = sum(Sale.subtotal),
 * COGS = sum(SaleItem.quantity * SaleItem.costPrice), Gross margin = Revenue - COGS,
 * Operating expenses = sum(Expense.amount), Net = Gross margin - Operating expenses.
 * No accruals, no depreciation, no inventory-valuation reconciliation.
 */
export async function getProfitAndLoss(tx: TransactionClient, query: FinancialReportQuery) {
  const { storeId, from, to } = query;

  const sales = await tx.sale.findMany({
    where: {
      status: "completed",
      deletedAt: null,
      createdAt: { gte: from, lte: to },
      ...(storeId ? { storeId } : {}),
    },
    select: {
      subtotal: true,
      items: { select: { quantity: true, costPrice: true } },
    },
  });

  const revenue = sales.reduce((sum, sale) => sum + sale.subtotal, 0);
  const cogs = sales.reduce(
    (sum, sale) =>
      sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity * (item.costPrice ?? 0), 0),
    0,
  );
  const grossMargin = revenue - cogs;

  const expenseWhere: Prisma.ExpenseWhereInput = {
    deletedAt: null,
    expenseDate: { gte: from, lte: to },
    ...(storeId ? { storeId } : {}),
  };
  const expenses = await tx.expense.findMany({ where: expenseWhere, select: { amount: true } });
  const operatingExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return {
    revenue,
    cogs,
    grossMargin,
    operatingExpenses,
    netProfit: grossMargin - operatingExpenses,
  };
}

/**
 * TVA collected (from Sale, not Invoice — an Invoice is a compliance
 * document generated from a Sale, not an independent revenue event; summing
 * both would double-count) vs. TVA paid (PurchaseOrderItem.tvaAmount for
 * committed POs + the TVA portion decomposed out of Expense.amount, treated
 * as TTC/gross). Flagged simplification: keys off PO/expense dates, not
 * supplier-invoice-received dates — acceptable given the roadmap's own
 * "simplified"/"summary" wording (see PHASE4_FINANCE_PLAN.md Chunk A).
 */
export async function getTvaSummary(tx: TransactionClient, query: FinancialReportQuery) {
  const { storeId, from, to } = query;

  const sales = await tx.sale.findMany({
    where: {
      status: "completed",
      deletedAt: null,
      createdAt: { gte: from, lte: to },
      ...(storeId ? { storeId } : {}),
    },
    select: { tvaAmount: true },
  });
  const collected = sales.reduce((sum, sale) => sum + sale.tvaAmount, 0);

  const purchaseOrders = await tx.purchaseOrder.findMany({
    where: {
      status: { in: [...COMMITTED_PO_STATUSES] },
      deletedAt: null,
      orderedAt: { gte: from, lte: to },
      ...(storeId ? { storeId } : {}),
    },
    select: { tvaAmount: true },
  });
  const paidPurchases = purchaseOrders.reduce((sum, po) => sum + po.tvaAmount, 0);

  const expenses = await tx.expense.findMany({
    where: {
      deletedAt: null,
      expenseDate: { gte: from, lte: to },
      tvaRate: { gt: 0 },
      ...(storeId ? { storeId } : {}),
    },
    select: { amount: true, tvaRate: true },
  });
  const paidExpenses = expenses.reduce(
    (sum, expense) => sum + (expense.amount - expense.amount / (1 + expense.tvaRate / 100)),
    0,
  );

  const paidTotal = paidPurchases + paidExpenses;

  return {
    collected,
    paidPurchases,
    paidExpenses: Math.round(paidExpenses),
    paidTotal: Math.round(paidTotal),
    net: Math.round(collected - paidTotal),
  };
}
