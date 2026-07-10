import type { Prisma } from "@prisma/client";
import type { CreateEmployeeInput, EmployeeSearchQuery, UpdateEmployeeInput } from "@/lib/validators/employees";

type TransactionClient = Prisma.TransactionClient;

export async function createEmployee(tx: TransactionClient, input: CreateEmployeeInput) {
  return tx.employee.create({ data: input });
}

export async function updateEmployee(tx: TransactionClient, id: string, input: UpdateEmployeeInput) {
  return tx.employee.update({ where: { id }, data: input });
}

export async function softDeleteEmployee(tx: TransactionClient, id: string): Promise<void> {
  await tx.employee.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}

export async function getEmployee(tx: TransactionClient, id: string) {
  return tx.employee.findUniqueOrThrow({ where: { id } });
}

export async function searchEmployees(tx: TransactionClient, query: EmployeeSearchQuery) {
  const { q, page, pageSize } = query;

  const where: Prisma.EmployeeWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { position: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    tx.employee.findMany({ where, orderBy: { lastName: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
    tx.employee.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
