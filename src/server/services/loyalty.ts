import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export class InsufficientLoyaltyPointsError extends Error {
  constructor() {
    super("Customer does not have enough loyalty points for this redemption.");
    this.name = "InsufficientLoyaltyPointsError";
  }
}

// Hardcoded per PHASE4_FINANCE_PLAN.md Chunk B (ARCHITECTURE.md §4.8's own
// example ratios) — not a per-tenant setting this phase. Tenant.settings
// (already a Json column) is the natural home if a later phase needs
// per-tenant configurability; no migration needed to add that later.
const POINTS_PER_CENTIME_SPENT = 1 / 10_000; // 1 point per 100 DZD (10,000 centimes)
const CENTIMES_PER_POINT_REDEEMED = 50; // 100 points = 50 DA = 5,000 centimes

export function computeEarnedPoints(saleTotal: number): number {
  return Math.floor(saleTotal * POINTS_PER_CENTIME_SPENT);
}

export function computeRedemptionValue(points: number): number {
  return points * CENTIMES_PER_POINT_REDEEMED;
}

/** Appends a ledger row and bumps Customer.loyaltyPoints — same shape as StockMovement/InvoicePayment. */
export async function earnPoints(
  tx: TransactionClient,
  input: { customerId: string; saleId: string; points: number },
) {
  if (input.points <= 0) return null;

  const customer = await tx.customer.update({
    where: { id: input.customerId },
    data: { loyaltyPoints: { increment: input.points } },
    select: { loyaltyPoints: true },
  });

  return tx.loyaltyPointTransaction.create({
    data: {
      customerId: input.customerId,
      points: input.points,
      balanceAfter: customer.loyaltyPoints,
      reason: "purchase",
      referenceId: input.saleId,
    },
  });
}

export async function redeemPoints(
  tx: TransactionClient,
  input: { customerId: string; points: number; reason?: string },
) {
  const customer = await tx.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    select: { loyaltyPoints: true },
  });
  if (customer.loyaltyPoints < input.points) {
    throw new InsufficientLoyaltyPointsError();
  }

  const updated = await tx.customer.update({
    where: { id: input.customerId },
    data: { loyaltyPoints: { decrement: input.points } },
    select: { loyaltyPoints: true },
  });

  return tx.loyaltyPointTransaction.create({
    data: {
      customerId: input.customerId,
      points: -input.points,
      balanceAfter: updated.loyaltyPoints,
      reason: input.reason ?? "redemption",
    },
  });
}

export async function listLoyaltyTransactions(tx: TransactionClient, customerId: string) {
  return tx.loyaltyPointTransaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
}
