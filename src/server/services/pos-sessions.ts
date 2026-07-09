import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export class SessionAlreadyOpenError extends Error {
  constructor() {
    super("This cashier already has an open POS session on this terminal.");
    this.name = "SessionAlreadyOpenError";
  }
}

export class SessionClosedError extends Error {
  constructor() {
    super("No open POS session for this terminal — open a session before selling.");
    this.name = "SessionClosedError";
  }
}

export class SessionNotFoundError extends Error {
  constructor() {
    super("POS session not found.");
    this.name = "SessionNotFoundError";
  }
}

interface OpenSessionInput {
  storeId: string;
  cashierId: string;
  terminalName: string;
  openingCash: number;
}

export async function openSession(tx: TransactionClient, input: OpenSessionInput) {
  const existing = await tx.posSession.findFirst({
    where: { storeId: input.storeId, terminalName: input.terminalName, status: "open" },
  });
  if (existing) {
    throw new SessionAlreadyOpenError();
  }

  const session = await tx.posSession.create({
    data: {
      storeId: input.storeId,
      cashierId: input.cashierId,
      terminalName: input.terminalName,
      openingCash: input.openingCash,
    },
  });

  await tx.posCashMovement.create({
    data: {
      sessionId: session.id,
      movementType: "OPENING",
      amount: input.openingCash,
      createdBy: input.cashierId,
    },
  });

  return session;
}

async function getOpenSessionOrThrow(tx: TransactionClient, sessionId: string) {
  const session = await tx.posSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new SessionNotFoundError();
  if (session.status !== "open") throw new SessionClosedError();
  return session;
}

interface RecordCashMovementInput {
  sessionId: string;
  movementType: "WITHDRAWAL" | "DEPOSIT" | "ADJUSTMENT";
  amount: number;
  reason?: string | null;
  createdBy: string;
}

export async function recordCashMovement(tx: TransactionClient, input: RecordCashMovementInput) {
  await getOpenSessionOrThrow(tx, input.sessionId);
  return tx.posCashMovement.create({
    data: {
      sessionId: input.sessionId,
      movementType: input.movementType,
      amount: input.amount,
      reason: input.reason,
      createdBy: input.createdBy,
    },
  });
}

interface CloseSessionInput {
  sessionId: string;
  closingCash: number;
  closedBy: string;
}

/**
 * expectedCash = opening float + cash sales recorded on this session +
 * manual deposits - manual withdrawals. Card/check/transfer payments never
 * touch the drawer, so they're deliberately excluded.
 */
export async function closeSession(tx: TransactionClient, input: CloseSessionInput) {
  const session = await getOpenSessionOrThrow(tx, input.sessionId);

  const movements = await tx.posCashMovement.findMany({ where: { sessionId: session.id } });
  const deposits = movements
    .filter((m) => m.movementType === "DEPOSIT")
    .reduce((sum, m) => sum + m.amount, 0);
  const withdrawals = movements
    .filter((m) => m.movementType === "WITHDRAWAL")
    .reduce((sum, m) => sum + m.amount, 0);

  const [cashSales, totalSales] = await Promise.all([
    tx.salePayment.aggregate({
      _sum: { amount: true },
      where: { paymentMethod: "CASH", sale: { posSessionId: session.id, status: "completed" } },
    }),
    tx.sale.aggregate({
      _sum: { total: true },
      where: { posSessionId: session.id, status: "completed" },
    }),
  ]);

  const expectedCash = session.openingCash + (cashSales._sum.amount ?? 0) + deposits - withdrawals;
  const cashDifference = input.closingCash - expectedCash;

  const updated = await tx.posSession.update({
    where: { id: session.id },
    data: {
      status: "closed",
      closedAt: new Date(),
      closingCash: input.closingCash,
      expectedCash,
      cashDifference,
      totalSales: totalSales._sum.total ?? 0,
      // Returns land in Chunk B — no RETURN_IN sales to subtract yet.
      totalRefunds: 0,
    },
  });

  await tx.posCashMovement.create({
    data: {
      sessionId: session.id,
      movementType: "CLOSING",
      amount: input.closingCash,
      createdBy: input.closedBy,
    },
  });

  return updated;
}

export async function getCurrentSession(tx: TransactionClient, storeId: string, cashierId: string) {
  return tx.posSession.findFirst({
    where: { storeId, cashierId, status: "open" },
    orderBy: { openedAt: "desc" },
  });
}

/**
 * X report (mid-shift, session still open) and Z report (after closeSession)
 * are the same read-only aggregation — closing just additionally persists
 * totalSales/totalRefunds onto the session row. Doesn't require the session
 * to be closed.
 */
export async function getSessionReport(tx: TransactionClient, sessionId: string) {
  const session = await getOpenOrClosedSessionOrThrow(tx, sessionId);

  const [sales, payments, returns, cashMovements] = await Promise.all([
    tx.sale.findMany({ where: { posSessionId: sessionId, status: "completed" } }),
    tx.salePayment.findMany({
      where: { sale: { posSessionId: sessionId, status: "completed" } },
    }),
    tx.saleReturn.findMany({ where: { originalSale: { posSessionId: sessionId } } }),
    tx.posCashMovement.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } }),
  ]);

  const paymentsByMethod = payments.reduce<Record<string, number>>((acc, payment) => {
    acc[payment.paymentMethod] = (acc[payment.paymentMethod] ?? 0) + payment.amount;
    return acc;
  }, {});

  const totalRefunds = returns.reduce((sum, saleReturn) => sum + saleReturn.totalRefunded, 0);
  const grossSales = sales.reduce((sum, sale) => sum + sale.total, 0);

  return {
    session,
    saleCount: sales.length,
    returnCount: returns.length,
    grossSales,
    totalRefunds,
    netSales: grossSales - totalRefunds,
    paymentsByMethod,
    cashMovements,
  };
}

async function getOpenOrClosedSessionOrThrow(tx: TransactionClient, sessionId: string) {
  const session = await tx.posSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new SessionNotFoundError();
  return session;
}
