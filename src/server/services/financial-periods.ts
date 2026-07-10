import type { Prisma } from "@prisma/client";
import type { CreatePeriodInput } from "@/lib/validators/financial-periods";

type TransactionClient = Prisma.TransactionClient;

export class PeriodAlreadyClosedError extends Error {
  constructor() {
    super("This financial period is already closed.");
    this.name = "PeriodAlreadyClosedError";
  }
}

export async function createPeriod(tx: TransactionClient, input: CreatePeriodInput) {
  return tx.financialPeriod.create({ data: input });
}

/** Advisory-only close — does not block new Expense/Sale/Invoice rows dated inside this period (see the schema doc comment). */
export async function closePeriod(tx: TransactionClient, id: string, closedBy: string | null) {
  const period = await tx.financialPeriod.findUniqueOrThrow({ where: { id } });
  if (period.status === "closed") {
    throw new PeriodAlreadyClosedError();
  }
  return tx.financialPeriod.update({
    where: { id },
    data: { status: "closed", closedAt: new Date(), closedBy },
  });
}

export async function listPeriods(tx: TransactionClient) {
  return tx.financialPeriod.findMany({ orderBy: { startDate: "desc" } });
}
