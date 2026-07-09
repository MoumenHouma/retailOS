import type { Prisma } from "@prisma/client";
import type { CreateCustomerInput, CustomerSearchQuery } from "@/lib/validators/customers";

type TransactionClient = Prisma.TransactionClient;

export async function createCustomer(tx: TransactionClient, input: CreateCustomerInput) {
  return tx.customer.create({ data: input });
}

export async function searchCustomers(tx: TransactionClient, query: CustomerSearchQuery) {
  const { q, page, pageSize } = query;

  const where: Prisma.CustomerWhereInput = {
    deletedAt: null,
    isActive: true,
    ...(q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }] }
      : {}),
  };

  const [items, total] = await Promise.all([
    tx.customer.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    tx.customer.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
