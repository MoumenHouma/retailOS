import type { Prisma } from "@prisma/client";
import type { RecordInvoicePaymentInput } from "@/lib/validators/invoice-payments";

type TransactionClient = Prisma.TransactionClient;

export class InvoiceOverpaymentError extends Error {
  constructor() {
    super("Payment amount exceeds the remaining balance on this invoice.");
    this.name = "InvoiceOverpaymentError";
  }
}

/**
 * Writes the ledger row and the denormalized Invoice.amountPaid balance in
 * the same transaction — same "ledger row + denormalized balance on the
 * parent" relationship as StockMovement -> StockLevel. `overdue` is never
 * written here; it's computed at read time from dueDate (see
 * PHASE4_FINANCE_PLAN.md Chunk A) — only paid/partially_paid are ever
 * written by this function.
 */
export async function recordInvoicePayment(
  tx: TransactionClient,
  invoiceId: string,
  input: RecordInvoicePaymentInput,
  recordedBy: string | null,
) {
  const invoice = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { netToPay: true, amountPaid: true },
  });

  const remaining = invoice.netToPay - invoice.amountPaid;
  if (input.amount > remaining) {
    throw new InvoiceOverpaymentError();
  }

  // Already running inside withTenant's transaction — the caller's `tx` is
  // itself the atomic unit, so these two writes don't need a nested
  // $transaction (Prisma's TransactionClient doesn't expose one anyway).
  const payment = await tx.invoicePayment.create({
    data: {
      invoiceId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      reference: input.reference,
      paidAt: input.paidAt,
      recordedBy,
    },
  });
  const updatedInvoice = await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      amountPaid: { increment: input.amount },
      status: input.amount === remaining ? "paid" : "partially_paid",
    },
  });

  return { payment, invoice: updatedInvoice };
}

export async function listInvoicePayments(tx: TransactionClient, invoiceId: string) {
  return tx.invoicePayment.findMany({
    where: { invoiceId },
    orderBy: { paidAt: "desc" },
  });
}
