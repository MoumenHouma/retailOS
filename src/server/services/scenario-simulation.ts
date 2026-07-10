import type { Prisma } from "@prisma/client";
import { getProfitAndLoss } from "@/server/services/financial-reports";

type TransactionClient = Prisma.TransactionClient;

export interface ScenarioInput {
  storeId?: string;
  from: Date;
  to: Date;
  priceChangePct?: number; // e.g. 10 = +10%, -5 = -5%
  demandChangePct?: number;
  costChangePct?: number;
}

export interface ScenarioFinancials {
  revenue: number;
  cogs: number;
  grossMargin: number;
  operatingExpenses: number;
  netProfit: number;
}

/**
 * No new table — stateless request/response computation over data that's
 * already there, same "pure aggregation, no new schema" precedent as Phase
 * 3/4's own reporting chunks. Reuses Phase 4's getProfitAndLoss formula
 * rather than reimplementing it; applies the requested price/demand/cost
 * deltas on top. Sync, not a BullMQ job — this is arithmetic over already-
 * computed numbers, fast enough for a plain request/response API route
 * (unlike Chunk A's genuinely slow Prophet fitting).
 */
export async function simulateScenario(
  tx: TransactionClient,
  input: ScenarioInput,
): Promise<{ baseline: ScenarioFinancials; projected: ScenarioFinancials; delta: ScenarioFinancials }> {
  const priceMultiplier = 1 + (input.priceChangePct ?? 0) / 100;
  const demandMultiplier = 1 + (input.demandChangePct ?? 0) / 100;
  const costMultiplier = 1 + (input.costChangePct ?? 0) / 100;

  const baseline = await getProfitAndLoss(tx, {
    storeId: input.storeId,
    from: input.from,
    to: input.to,
  });

  // Revenue scales with both price and demand changes (a 10% price hike on
  // 10% higher demand compounds, same way real revenue = price * quantity
  // does). COGS scales with demand and cost changes, not price. Operating
  // expenses are treated as a fixed run-rate over the window — a real
  // "what if we sell more" scenario doesn't imply proportionally higher
  // rent/salaries.
  const projectedRevenue = baseline.revenue * priceMultiplier * demandMultiplier;
  const projectedCogs = baseline.cogs * demandMultiplier * costMultiplier;
  const projectedGrossMargin = projectedRevenue - projectedCogs;
  const projectedOperatingExpenses = baseline.operatingExpenses;
  const projectedNetProfit = projectedGrossMargin - projectedOperatingExpenses;

  const projected: ScenarioFinancials = {
    revenue: Math.round(projectedRevenue),
    cogs: Math.round(projectedCogs),
    grossMargin: Math.round(projectedGrossMargin),
    operatingExpenses: projectedOperatingExpenses,
    netProfit: Math.round(projectedNetProfit),
  };

  const delta: ScenarioFinancials = {
    revenue: projected.revenue - baseline.revenue,
    cogs: projected.cogs - baseline.cogs,
    grossMargin: projected.grossMargin - baseline.grossMargin,
    operatingExpenses: projected.operatingExpenses - baseline.operatingExpenses,
    netProfit: projected.netProfit - baseline.netProfit,
  };

  return { baseline, projected, delta };
}
