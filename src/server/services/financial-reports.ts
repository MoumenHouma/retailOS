import { Prisma } from "@prisma/client";
import type { FinancialReportQuery, RevenueDashboardQuery } from "@/lib/validators/financial-reports";

type TransactionClient = Prisma.TransactionClient;

const COMMITTED_PO_STATUSES = ["ordered", "partially_received", "received"] as const;

// Both the Node process and the Postgres session run in UTC (verified: `date`
// in the app container and `SHOW TIMEZONE` both report UTC) — date_trunc's
// bucketing matches the old JS bucketKey's UTC-based day/week/month math
// exactly, including week start on Monday (date_trunc('week', ...) is ISO
// 8601, same as the old (getDay()+6)%7 computation). If either side's
// timezone ever changes this needs `AT TIME ZONE 'UTC'` added explicitly.
const GRANULARITY_TO_TRUNC_UNIT = {
  daily: "day",
  weekly: "week",
  monthly: "month",
} as const;
const GRANULARITY_TO_FORMAT = {
  daily: "YYYY-MM-DD",
  weekly: "YYYY-MM-DD",
  monthly: "YYYY-MM",
} as const;

interface RevenueDashboardRow {
  period: string;
  revenue: bigint;
  tvaAmount: bigint;
  total: bigint;
  saleCount: bigint;
}

/** Revenue/TVA/sale-count buckets over completed sales, daily/weekly/monthly. */
export async function getRevenueDashboard(tx: TransactionClient, query: RevenueDashboardQuery) {
  const { storeId, from, to, granularity } = query;
  const truncUnit = GRANULARITY_TO_TRUNC_UNIT[granularity];
  const format = GRANULARITY_TO_FORMAT[granularity];

  const rows = await tx.$queryRaw<RevenueDashboardRow[]>`
    SELECT
      to_char(date_trunc(${truncUnit}, created_at), ${format}) AS period,
      COALESCE(SUM(subtotal), 0)   AS "revenue",
      COALESCE(SUM(tva_amount), 0) AS "tvaAmount",
      COALESCE(SUM(total), 0)      AS "total",
      COUNT(*)                     AS "saleCount"
    FROM sales
    WHERE status = 'completed'
      AND deleted_at IS NULL
      AND created_at >= ${from}
      AND created_at <= ${to}
      ${storeId ? Prisma.sql`AND store_id = ${storeId}::uuid` : Prisma.empty}
    GROUP BY 1
    ORDER BY 1
  `;

  // SUM/COUNT come back as bigint (Postgres numeric/int8) via node-postgres —
  // these are all well within JS's safe integer range for a POS's sale
  // volumes, so Number() is safe and matches the old code's plain numbers.
  return rows.map((row) => ({
    period: row.period,
    revenue: Number(row.revenue),
    tvaAmount: Number(row.tvaAmount),
    total: Number(row.total),
    saleCount: Number(row.saleCount),
  }));
}

/**
 * Simplified P&L per PHASE4_FINANCE_PLAN.md Chunk A: Revenue = sum(Sale.subtotal),
 * COGS = sum(SaleItem.quantity * SaleItem.costPrice), Gross margin = Revenue - COGS,
 * Operating expenses = sum(Expense.amount), Net = Gross margin - Operating expenses.
 * No accruals, no depreciation, no inventory-valuation reconciliation.
 */
export async function getProfitAndLoss(tx: TransactionClient, query: FinancialReportQuery) {
  const { storeId, from, to } = query;

  const expenseWhere: Prisma.ExpenseWhereInput = {
    deletedAt: null,
    expenseDate: { gte: from, lte: to },
    ...(storeId ? { storeId } : {}),
  };

  // SUM(subtotal)/SUM(amount) push down as Prisma `aggregate`; COGS is
  // SUM(quantity * costPrice) — a per-row product of two columns, which
  // `aggregate`/`groupBy` can't express (they only sum individual columns),
  // hence the one raw query. Previously: load every completed sale's full
  // item list into Node and `.reduce()` twice. Independent reads —
  // parallelized to stay under withTenant's 5s default transaction timeout,
  // the same P2028 lesson Phase 4 Chunk C hit running these sequentially.
  // Phase 5's scenario-simulation.ts calls this under real load and hit it
  // live.
  const [revenueAgg, cogsRows, expensesAgg] = await Promise.all([
    tx.sale.aggregate({
      where: {
        status: "completed",
        deletedAt: null,
        createdAt: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      _sum: { subtotal: true },
    }),
    tx.$queryRaw<{ cogs: bigint }[]>`
      SELECT COALESCE(SUM(si.quantity * COALESCE(si.cost_price, 0)), 0) AS cogs
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status = 'completed'
        AND s.deleted_at IS NULL
        AND s.created_at >= ${from}
        AND s.created_at <= ${to}
        ${storeId ? Prisma.sql`AND s.store_id = ${storeId}::uuid` : Prisma.empty}
    `,
    tx.expense.aggregate({ where: expenseWhere, _sum: { amount: true } }),
  ]);

  const revenue = revenueAgg._sum.subtotal ?? 0;
  const cogs = Number(cogsRows[0]?.cogs ?? 0);
  const grossMargin = revenue - cogs;
  const operatingExpenses = expensesAgg._sum.amount ?? 0;

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

  // paidExpenses' amount-minus-TTC-decomposition varies per row by tvaRate,
  // so it can't be a plain `_sum` — one raw query, run alongside the two
  // aggregates instead of 3 sequential findMany+reduce round-trips.
  const [collectedAgg, paidPurchasesAgg, paidExpensesRows] = await Promise.all([
    tx.sale.aggregate({
      where: {
        status: "completed",
        deletedAt: null,
        createdAt: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      _sum: { tvaAmount: true },
    }),
    tx.purchaseOrder.aggregate({
      where: {
        status: { in: [...COMMITTED_PO_STATUSES] },
        deletedAt: null,
        orderedAt: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      _sum: { tvaAmount: true },
    }),
    tx.$queryRaw<{ paidExpenses: number }[]>`
      SELECT COALESCE(SUM(amount - amount / (1 + tva_rate / 100.0)), 0) AS "paidExpenses"
      FROM expenses
      WHERE deleted_at IS NULL
        AND expense_date >= ${from}
        AND expense_date <= ${to}
        AND tva_rate > 0
        ${storeId ? Prisma.sql`AND store_id = ${storeId}::uuid` : Prisma.empty}
    `,
  ]);

  const collected = collectedAgg._sum.tvaAmount ?? 0;
  const paidPurchases = paidPurchasesAgg._sum.tvaAmount ?? 0;
  const paidExpenses = Number(paidExpensesRows[0]?.paidExpenses ?? 0);
  const paidTotal = paidPurchases + paidExpenses;

  return {
    collected,
    paidPurchases,
    paidExpenses: Math.round(paidExpenses),
    paidTotal: Math.round(paidTotal),
    net: Math.round(collected - paidTotal),
  };
}
