import type { Prisma } from "@prisma/client";
import type { CreateBrandInput, UpdateBrandInput } from "@/lib/validators/products";

type TransactionClient = Prisma.TransactionClient;

export class InUseError extends Error {
  constructor(
    public readonly entity: string,
    public readonly count: number,
  ) {
    super(`${entity} is still referenced by ${count} product(s).`);
    this.name = "InUseError";
  }
}

export async function listBrands(
  tx: TransactionClient,
  { q, page, pageSize }: { q?: string; page: number; pageSize: number },
) {
  const where: Prisma.BrandWhereInput = {
    deletedAt: null,
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };
  const [items, total] = await Promise.all([
    tx.brand.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.brand.count({ where }),
  ]);
  return { items, total };
}

export async function createBrand(tx: TransactionClient, input: CreateBrandInput) {
  return tx.brand.create({ data: input });
}

export async function updateBrand(tx: TransactionClient, id: string, input: UpdateBrandInput) {
  return tx.brand.update({ where: { id }, data: input });
}

export async function deleteBrand(tx: TransactionClient, id: string): Promise<void> {
  const count = await tx.product.count({ where: { brandId: id, deletedAt: null } });
  if (count > 0) {
    throw new InUseError("Brand", count);
  }
  await tx.brand.update({ where: { id }, data: { deletedAt: new Date() } });
}
