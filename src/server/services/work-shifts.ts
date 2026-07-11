import type { Prisma } from "@prisma/client";
import type { CreateShiftInput, ShiftListQuery, UpdateShiftInput } from "@/lib/validators/work-shifts";

type TransactionClient = Prisma.TransactionClient;

export async function createShift(tx: TransactionClient, input: CreateShiftInput, createdBy: string | null) {
  return tx.workShift.create({ data: { ...input, createdBy } });
}

export async function updateShift(tx: TransactionClient, id: string, input: UpdateShiftInput) {
  return tx.workShift.update({ where: { id }, data: input });
}

export async function cancelShift(tx: TransactionClient, id: string) {
  return tx.workShift.update({ where: { id }, data: { status: "cancelled" } });
}

export async function listShifts(tx: TransactionClient, query: ShiftListQuery) {
  const { employeeId, storeId, from, to } = query;

  const where: Prisma.WorkShiftWhereInput = {
    ...(employeeId ? { employeeId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(from || to
      ? {
          startsAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  // Phase 6 findMany audit: same optional-from/to gap as attendance.ts's
  // listAttendance — employee-detail-view.tsx calls this with only
  // employeeId, no date range. Safety-net cap, not UX pagination.
  return tx.workShift.findMany({
    where,
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { startsAt: "asc" },
    take: 500,
  });
}
