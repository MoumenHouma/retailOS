import type { Prisma } from "@prisma/client";
import type { CalculateCommissionsInput, CommissionsListQuery } from "@/lib/validators/commissions";

type TransactionClient = Prisma.TransactionClient;

/**
 * rateValue convention (no scale specified in the plan): for `percentage`,
 * a plain whole-number percent (e.g. 5 = 5%) — same convention as
 * Product.tvaRate/Expense.tvaRate elsewhere in this schema, not invented
 * basis points. For `fixed`, an Int amount in centimes per sale.
 */
function computeCommissionAmount(rateType: "percentage" | "fixed", rateValue: number, baseAmount: number): number {
  return rateType === "percentage" ? Math.round((baseAmount * rateValue) / 100) : rateValue;
}

/**
 * Batch/on-demand only — deliberately NOT hooked into completeSale (see
 * PHASE4_FINANCE_PLAN.md Chunk D: wiring commission resolution into the
 * hot, sub-500ms sale-completion path is a needless risk to already-shipped
 * code, especially since rules can change after the sale happened). Scans
 * completed Sales in the window, resolves the cashier's Employee record,
 * applies every active rule that covers that employee, and upserts
 * SaleCommission rows keyed by (saleId, ruleId) so recomputation (e.g.
 * after a rule correction) is idempotent rather than double-counting.
 */
export async function calculateCommissionsForPeriod(tx: TransactionClient, input: CalculateCommissionsInput) {
  const { from, to } = input;

  const [rules, sales, employees] = await Promise.all([
    tx.commissionRule.findMany({ where: { isActive: true } }),
    tx.sale.findMany({
      where: { status: "completed", deletedAt: null, createdAt: { gte: from, lte: to } },
      select: { id: true, cashierId: true, subtotal: true },
    }),
    tx.employee.findMany({ where: { userId: { not: null }, deletedAt: null }, select: { id: true, userId: true } }),
  ]);

  const employeeByUserId = new Map(employees.map((employee) => [employee.userId as string, employee.id]));

  // Every (sale, rule) pair is resolved independently of every other one —
  // same "don't await independent reads/writes one at a time inside a
  // withTenant transaction" fix Chunk C's report functions needed, since a
  // sequential await-per-pair loop over a real sales volume risks the same
  // 5s interactive-transaction timeout (P2028) that chunk hit.
  const tasks: Array<{ saleId: string; ruleId: string; employeeId: string; baseAmount: number; amount: number }> = [];
  for (const sale of sales) {
    const employeeId = employeeByUserId.get(sale.cashierId);
    if (!employeeId) continue;

    const applicableRules = rules.filter(
      (rule) => rule.scope === "global" || rule.targetEmployeeId === employeeId,
    );
    for (const rule of applicableRules) {
      const baseAmount = sale.subtotal;
      const amount = computeCommissionAmount(rule.rateType, rule.rateValue, baseAmount);
      tasks.push({ saleId: sale.id, ruleId: rule.id, employeeId, baseAmount, amount });
    }
  }

  const results = await Promise.all(
    tasks.map(async (task) => {
      const existing = await tx.saleCommission.findFirst({
        where: { saleId: task.saleId, ruleId: task.ruleId },
      });
      if (existing) {
        await tx.saleCommission.update({
          where: { id: existing.id },
          data: { baseAmount: task.baseAmount, amount: task.amount, calculatedAt: new Date() },
        });
        return "updated" as const;
      }
      await tx.saleCommission.create({
        data: {
          employeeId: task.employeeId,
          saleId: task.saleId,
          ruleId: task.ruleId,
          baseAmount: task.baseAmount,
          amount: task.amount,
          calculatedAt: new Date(),
        },
      });
      return "created" as const;
    }),
  );

  return {
    created: results.filter((r) => r === "created").length,
    updated: results.filter((r) => r === "updated").length,
    salesScanned: sales.length,
  };
}

export async function listCommissions(tx: TransactionClient, query: CommissionsListQuery) {
  const { employeeId, from, to } = query;

  const where: Prisma.SaleCommissionWhereInput = {
    ...(employeeId ? { employeeId } : {}),
    ...(from || to
      ? {
          calculatedAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  return tx.saleCommission.findMany({
    where,
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      rule: { select: { id: true, name: true } },
      sale: { select: { id: true, saleNumber: true } },
    },
    orderBy: { calculatedAt: "desc" },
  });
}

export async function listCommissionsForEmployee(tx: TransactionClient, employeeId: string) {
  return tx.saleCommission.findMany({
    where: { employeeId },
    include: { rule: { select: { id: true, name: true } }, sale: { select: { id: true, saleNumber: true } } },
    orderBy: { calculatedAt: "desc" },
  });
}
