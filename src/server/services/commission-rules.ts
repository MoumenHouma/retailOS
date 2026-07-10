import type { Prisma } from "@prisma/client";
import type { CreateCommissionRuleInput, UpdateCommissionRuleInput } from "@/lib/validators/commission-rules";

type TransactionClient = Prisma.TransactionClient;

export async function createCommissionRule(tx: TransactionClient, input: CreateCommissionRuleInput) {
  return tx.commissionRule.create({ data: input });
}

export async function updateCommissionRule(
  tx: TransactionClient,
  id: string,
  input: UpdateCommissionRuleInput,
) {
  return tx.commissionRule.update({ where: { id }, data: input });
}

export async function deactivateCommissionRule(tx: TransactionClient, id: string) {
  return tx.commissionRule.update({ where: { id }, data: { isActive: false } });
}

export async function listCommissionRules(tx: TransactionClient) {
  return tx.commissionRule.findMany({
    include: { targetEmployee: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
}
