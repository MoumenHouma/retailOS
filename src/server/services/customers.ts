import type { Prisma } from "@prisma/client";
import type {
  CreateCustomerInput,
  CustomerSearchQuery,
  UpdateCustomerInput,
} from "@/lib/validators/customers";

type TransactionClient = Prisma.TransactionClient;

export async function createCustomer(tx: TransactionClient, input: CreateCustomerInput) {
  return tx.customer.create({ data: input });
}

export async function updateCustomer(tx: TransactionClient, id: string, input: UpdateCustomerInput) {
  return tx.customer.update({ where: { id }, data: input });
}

export async function softDeleteCustomer(tx: TransactionClient, id: string): Promise<void> {
  await tx.customer.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}

interface PurchaseHistoryQuery {
  page: number;
  pageSize: number;
}

export async function getPurchaseHistory(
  tx: TransactionClient,
  customerId: string,
  query: PurchaseHistoryQuery,
) {
  const { page, pageSize } = query;
  const where: Prisma.SaleWhereInput = { customerId, status: "completed", deletedAt: null };

  const [items, total] = await Promise.all([
    tx.sale.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.sale.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
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
