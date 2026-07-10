import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import type { FinancialReportQuery } from "@/lib/validators/financial-reports";
import type { MarginAnalysisQuery, TaxReportQuery } from "@/lib/validators/financial-reports-advanced";

type TransactionClient = Prisma.TransactionClient;

// Kept as its own copy rather than imported — financial-reports.ts and
// procurement-reports.ts each already carry an identical local copy of this
// constant, same "no shared cross-file constant" precedent this repo has
// followed since Phase 3.
const COMMITTED_PO_STATUSES = ["ordered", "partially_received", "received"] as const;
const OPEN_INVOICE_STATUSES = ["issued", "partially_paid"] as const;
const OPEN_DEBT_STATUSES_EXCLUDED = ["paid", "written_off"] as const;

/**
 * Simplified balance sheet per PHASE4_FINANCE_PLAN.md Chunk C — all-time,
 * no date range (a balance sheet is a point-in-time snapshot, not a period
 * report). Assets = cash-in-hand proxy + accounts receivable + inventory
 * value. Liabilities = full total of every non-cancelled PurchaseOrder —
 * flagged known limitation: Phase 4 only tracks AR, never AP/supplier-
 * payment status, so this overstates liabilities (treats the whole PO as
 * unpaid) rather than inventing an out-of-scope AP-payment ledger. Equity
 * is a plug (assets − liabilities), not independently tracked.
 */
export async function getBalanceSheet(tx: TransactionClient) {
  // withTenant wraps every call in a Prisma interactive transaction with a
  // 5s default timeout — eight independent reads awaited one at a time blew
  // past it under this dev environment's cold-compile latency (confirmed
  // live: P2028 "Transaction already closed"). None of these reads depend
  // on each other, so running them concurrently is both the fix and the
  // more honest shape for a set of unrelated aggregate queries.
  const [sales, invoicePayments, debtPayments, expenses, openInvoices, openDebts, stockLevels, purchaseOrders] =
    await Promise.all([
      tx.sale.findMany({ where: { status: "completed", deletedAt: null }, select: { totalPaid: true } }),
      tx.invoicePayment.findMany({ select: { amount: true } }),
      tx.customerDebtPayment.findMany({ select: { amount: true } }),
      tx.expense.findMany({ where: { deletedAt: null }, select: { amount: true } }),
      tx.invoice.findMany({
        where: { status: { in: [...OPEN_INVOICE_STATUSES] } },
        select: { netToPay: true, amountPaid: true },
      }),
      tx.customerDebt.findMany({
        where: { status: { notIn: [...OPEN_DEBT_STATUSES_EXCLUDED] } },
        select: { remaining: true },
      }),
      tx.stockLevel.findMany({ include: { product: { select: { costPrice: true } } } }),
      tx.purchaseOrder.findMany({
        where: { status: { in: [...COMMITTED_PO_STATUSES] }, deletedAt: null },
        select: { total: true },
      }),
    ]);

  const cashFromSales = sales.reduce((sum, sale) => sum + sale.totalPaid, 0);
  const cashFromInvoicePayments = invoicePayments.reduce((sum, payment) => sum + payment.amount, 0);
  const cashFromDebtPayments = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const cash = cashFromSales + cashFromInvoicePayments + cashFromDebtPayments - totalExpenses;

  const invoiceReceivable = openInvoices.reduce(
    (sum, invoice) => sum + (invoice.netToPay - invoice.amountPaid),
    0,
  );
  const debtReceivable = openDebts.reduce((sum, debt) => sum + debt.remaining, 0);
  const accountsReceivable = invoiceReceivable + debtReceivable;

  const inventoryValue = stockLevels.reduce(
    (sum, level) => sum + level.quantityOnHand * (level.product.costPrice ?? 0),
    0,
  );

  const assetsTotal = cash + accountsReceivable + inventoryValue;
  const liabilitiesTotal = purchaseOrders.reduce((sum, po) => sum + po.total, 0);

  return {
    assets: { cash, accountsReceivable, inventoryValue, total: assetsTotal },
    liabilities: { accountsPayable: liabilitiesTotal, total: liabilitiesTotal },
    equity: assetsTotal - liabilitiesTotal,
  };
}

/**
 * Simplified cash flow per the plan: cash in = Sale.totalPaid +
 * InvoicePayment.amount + CustomerDebtPayment.amount for the period; cash
 * out = Expense.amount. PO-driven spend is surfaced as a separate
 * "purchasesAccrual" line rather than mixed into cash out — same AP-ledger
 * gap as the balance sheet, kept honestly labeled instead of silently
 * blending accrual and cash bases.
 */
export async function getCashFlowStatement(tx: TransactionClient, query: FinancialReportQuery) {
  const { storeId, from, to } = query;

  // Run independently rather than sequentially — same 5s transaction-
  // timeout fix as getBalanceSheet above.
  const [sales, invoicePayments, debtPayments, expenses, purchaseOrders] = await Promise.all([
    tx.sale.findMany({
      where: {
        status: "completed",
        deletedAt: null,
        createdAt: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      select: { totalPaid: true },
    }),
    // InvoicePayment/CustomerDebtPayment carry no storeId of their own
    // (invoices and debts are tenant-wide concepts in this schema, not
    // store-scoped) — the storeId filter only narrows Sale/Expense/PurchaseOrder.
    tx.invoicePayment.findMany({
      where: { paidAt: { gte: from, lte: to } },
      select: { amount: true },
    }),
    tx.customerDebtPayment.findMany({
      where: { paidAt: { gte: from, lte: to } },
      select: { amount: true },
    }),
    tx.expense.findMany({
      where: {
        deletedAt: null,
        expenseDate: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      select: { amount: true },
    }),
    tx.purchaseOrder.findMany({
      where: {
        status: { in: [...COMMITTED_PO_STATUSES] },
        deletedAt: null,
        orderedAt: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      select: { total: true },
    }),
  ]);

  const fromSales = sales.reduce((sum, sale) => sum + sale.totalPaid, 0);
  const fromInvoicePayments = invoicePayments.reduce((sum, payment) => sum + payment.amount, 0);
  const fromDebtPayments = debtPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const cashIn = fromSales + fromInvoicePayments + fromDebtPayments;

  const cashOut = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const purchasesAccrual = purchaseOrders.reduce((sum, po) => sum + po.total, 0);

  return {
    cashIn: { fromSales, fromInvoicePayments, fromDebtPayments, total: cashIn },
    cashOut: { expenses: cashOut, total: cashOut },
    netCashFlow: cashIn - cashOut,
    purchasesAccrual,
  };
}

function taxBucketKey(date: Date, bucket: "monthly" | "quarterly"): string {
  const year = date.getFullYear();
  if (bucket === "quarterly") {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${year}-T${quarter}`;
  }
  return `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

interface TaxReportBucket {
  period: string;
  collected: number;
  paidPurchases: number;
  paidExpenses: number;
  paidTotal: number;
  net: number;
}

/** Reuses Chunk A's getTvaSummary collected/paid formula, bucketed monthly/quarterly to match the G50 declaration cadence. */
export async function getTaxReport(tx: TransactionClient, query: TaxReportQuery): Promise<TaxReportBucket[]> {
  const { storeId, from, to, bucket } = query;

  // Run independently rather than sequentially — same 5s transaction-
  // timeout fix as getBalanceSheet.
  const [sales, purchaseOrders, expenses] = await Promise.all([
    tx.sale.findMany({
      where: {
        status: "completed",
        deletedAt: null,
        createdAt: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      select: { createdAt: true, tvaAmount: true },
    }),
    tx.purchaseOrder.findMany({
      where: {
        status: { in: [...COMMITTED_PO_STATUSES] },
        deletedAt: null,
        orderedAt: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      select: { orderedAt: true, tvaAmount: true },
    }),
    tx.expense.findMany({
      where: {
        deletedAt: null,
        expenseDate: { gte: from, lte: to },
        tvaRate: { gt: 0 },
        ...(storeId ? { storeId } : {}),
      },
      select: { expenseDate: true, amount: true, tvaRate: true },
    }),
  ]);

  const buckets = new Map<string, { period: string; collected: number; paidPurchases: number; paidExpenses: number }>();
  function bucketFor(key: string) {
    const existing = buckets.get(key);
    if (existing) return existing;
    const created = { period: key, collected: 0, paidPurchases: 0, paidExpenses: 0 };
    buckets.set(key, created);
    return created;
  }

  for (const sale of sales) {
    bucketFor(taxBucketKey(sale.createdAt, bucket)).collected += sale.tvaAmount;
  }
  for (const po of purchaseOrders) {
    // orderedAt is guaranteed non-null here — the where clause's date-range
    // filter on it excludes null rows.
    bucketFor(taxBucketKey(po.orderedAt!, bucket)).paidPurchases += po.tvaAmount;
  }
  for (const expense of expenses) {
    const decomposedTva = expense.amount - expense.amount / (1 + expense.tvaRate / 100);
    bucketFor(taxBucketKey(expense.expenseDate, bucket)).paidExpenses += decomposedTva;
  }

  return [...buckets.values()]
    .map((entry) => {
      const paidExpenses = Math.round(entry.paidExpenses);
      const paidTotal = entry.paidPurchases + paidExpenses;
      return {
        period: entry.period,
        collected: entry.collected,
        paidPurchases: entry.paidPurchases,
        paidExpenses,
        paidTotal,
        net: entry.collected - paidTotal,
      };
    })
    .sort((a, b) => a.period.localeCompare(b.period));
}

interface ExpenseCategoryRollup {
  categoryId: string;
  categoryName: string;
  parentId: string | null;
  ownAmount: number;
  totalAmount: number;
}

/** Groups Expense by category, then rolls each category's own total up through every ancestor — same recursive-tree shape category hierarchies already require (see categories.ts), no new pattern. */
export async function getExpenseAnalysis(
  tx: TransactionClient,
  query: FinancialReportQuery,
): Promise<ExpenseCategoryRollup[]> {
  const { storeId, from, to } = query;

  const [categories, expenses] = await Promise.all([
    tx.expenseCategory.findMany({ select: { id: true, name: true, parentId: true } }),
    tx.expense.findMany({
      where: {
        deletedAt: null,
        expenseDate: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      select: { categoryId: true, amount: true },
    }),
  ]);

  const ownAmounts = new Map<string, number>();
  for (const expense of expenses) {
    ownAmounts.set(expense.categoryId, (ownAmounts.get(expense.categoryId) ?? 0) + expense.amount);
  }

  const byId = new Map(categories.map((category) => [category.id, category]));
  const totalAmounts = new Map<string, number>();
  for (const [categoryId, amount] of ownAmounts) {
    let current: string | undefined = categoryId;
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      totalAmounts.set(current, (totalAmounts.get(current) ?? 0) + amount);
      current = byId.get(current)?.parentId ?? undefined;
    }
  }

  return categories
    .filter((category) => (totalAmounts.get(category.id) ?? 0) > 0)
    .map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      parentId: category.parentId,
      ownAmount: ownAmounts.get(category.id) ?? 0,
      totalAmount: totalAmounts.get(category.id) ?? 0,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

interface MarginAnalysisEntry {
  key: string;
  label: string;
  quantity: number;
  revenue: number;
  margin: number;
}

/** sum(SaleItem.quantity * (unitPrice - costPrice)) grouped by product/category/brand — same "join SaleItem through Product" shape Phase 3 Chunk D used for spend-by-category. */
export async function getMarginAnalysis(
  tx: TransactionClient,
  query: MarginAnalysisQuery,
): Promise<MarginAnalysisEntry[]> {
  const { storeId, from, to, groupBy } = query;

  const saleItems = await tx.saleItem.findMany({
    where: {
      sale: {
        status: "completed",
        deletedAt: null,
        createdAt: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
    },
    select: {
      quantity: true,
      unitPrice: true,
      costPrice: true,
      product: {
        select: {
          id: true,
          name: true,
          categoryId: true,
          category: { select: { name: true } },
          brandId: true,
          brand: { select: { name: true } },
        },
      },
    },
  });

  const groups = new Map<string, MarginAnalysisEntry>();
  for (const item of saleItems) {
    const cost = item.costPrice ?? 0;
    const margin = item.quantity * (item.unitPrice - cost);
    const revenue = item.quantity * item.unitPrice;

    let key: string;
    let label: string;
    if (groupBy === "product") {
      key = item.product.id;
      label = item.product.name;
    } else if (groupBy === "category") {
      key = item.product.categoryId ?? "__uncategorized__";
      label = item.product.category?.name ?? "Sans catégorie";
    } else {
      key = item.product.brandId ?? "__unbranded__";
      label = item.product.brand?.name ?? "Sans marque";
    }

    const entry = groups.get(key) ?? { key, label, quantity: 0, revenue: 0, margin: 0 };
    entry.quantity += item.quantity;
    entry.revenue += revenue;
    entry.margin += margin;
    groups.set(key, entry);
  }

  return [...groups.values()].sort((a, b) => b.margin - a.margin);
}

/**
 * CSV export is the MVP deliverable for the tax report's "Accountants can
 * export financial data" exit criterion (a compliant G50-format PDF is an
 * explicit stretch goal, out of this chunk's scope). Reuses the xlsx
 * library already proven in product-export.ts rather than hand-rolling
 * CSV-escaping.
 */
export async function exportTaxReportCsv(tx: TransactionClient, query: TaxReportQuery): Promise<Buffer> {
  const buckets = await getTaxReport(tx, query);

  const rows = buckets.map((bucket) => ({
    Période: bucket.period,
    "TVA collectée (DA)": bucket.collected / 100,
    "TVA payée — achats (DA)": bucket.paidPurchases / 100,
    "TVA payée — dépenses (DA)": bucket.paidExpenses / 100,
    "TVA payée — total (DA)": bucket.paidTotal / 100,
    "Net (DA)": bucket.net / 100,
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "TVA");

  return XLSX.write(workbook, { type: "buffer", bookType: "csv" }) as Buffer;
}
