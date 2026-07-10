import type { Prisma, PaymentMethodType } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export class DebtOverpaymentError extends Error {
  constructor() {
    super("Payment amount exceeds the remaining balance on this debt.");
    this.name = "DebtOverpaymentError";
  }
}

export class CreditLimitExceededError extends Error {
  constructor() {
    super("This debt would exceed the customer's credit limit.");
    this.name = "CreditLimitExceededError";
  }
}

/** Sum of `remaining` across every open (non-paid, non-written_off) debt — the source of Customer.currentDebt. */
async function recomputeCurrentDebt(tx: TransactionClient, customerId: string): Promise<void> {
  const open = await tx.customerDebt.findMany({
    where: { customerId, status: { notIn: ["paid", "written_off"] } },
    select: { remaining: true },
  });
  const currentDebt = open.reduce((sum, debt) => sum + debt.remaining, 0);
  await tx.customer.update({ where: { id: customerId }, data: { currentDebt } });
}

export async function createDebt(
  tx: TransactionClient,
  input: { customerId: string; amount: number; saleId?: string | null; dueDate?: Date | null; notes?: string | null },
) {
  const customer = await tx.customer.findUniqueOrThrow({
    where: { id: input.customerId },
    select: { creditLimit: true, currentDebt: true },
  });
  // creditLimit === 0 means "no limit configured" (the column's own
  // default), not "zero credit allowed" — enforcing it unconditionally
  // would block every debt for every customer until an owner explicitly
  // sets a limit, which defeats the point of a default. Only enforce once
  // a tenant has actually opted in by setting a positive limit.
  if (customer.creditLimit > 0 && customer.currentDebt + input.amount > customer.creditLimit) {
    throw new CreditLimitExceededError();
  }

  const debt = await tx.customerDebt.create({
    data: {
      customerId: input.customerId,
      amount: input.amount,
      remaining: input.amount,
      saleId: input.saleId ?? null,
      dueDate: input.dueDate ?? null,
      notes: input.notes ?? null,
    },
  });
  await recomputeCurrentDebt(tx, input.customerId);
  return debt;
}

export async function recordDebtPayment(
  tx: TransactionClient,
  debtId: string,
  input: { amount: number; paymentMethod: PaymentMethodType; reference?: string | null; paidAt: Date },
  recordedBy: string | null,
) {
  const debt = await tx.customerDebt.findUniqueOrThrow({ where: { id: debtId } });
  if (input.amount > debt.remaining) {
    throw new DebtOverpaymentError();
  }

  const payment = await tx.customerDebtPayment.create({
    data: {
      debtId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      reference: input.reference ?? null,
      paidAt: input.paidAt,
      recordedBy,
    },
  });

  const remaining = debt.remaining - input.amount;
  const updatedDebt = await tx.customerDebt.update({
    where: { id: debtId },
    data: { remaining, status: remaining === 0 ? "paid" : "partially_paid" },
  });
  await recomputeCurrentDebt(tx, debt.customerId);

  return { payment, debt: updatedDebt };
}

export async function listDebtsForCustomer(tx: TransactionClient, customerId: string) {
  return tx.customerDebt.findMany({ where: { customerId }, orderBy: { createdAt: "desc" } });
}

export async function listDebtPayments(tx: TransactionClient, debtId: string) {
  return tx.customerDebtPayment.findMany({ where: { debtId }, orderBy: { paidAt: "desc" } });
}
