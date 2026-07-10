import type { Prisma } from "@prisma/client";
import type {
  AttendanceListQuery,
  ClockInInput,
  CreateAttendanceInput,
} from "@/lib/validators/attendance";

type TransactionClient = Prisma.TransactionClient;

export class AlreadyClockedInError extends Error {
  constructor() {
    super("This employee is already clocked in today with no clock-out recorded.");
    this.name = "AlreadyClockedInError";
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function clockIn(tx: TransactionClient, input: ClockInInput, createdBy: string | null) {
  const workDate = startOfUtcDay(new Date());
  const open = await tx.attendanceRecord.findFirst({
    where: { employeeId: input.employeeId, workDate, clockOut: null },
  });
  if (open) {
    throw new AlreadyClockedInError();
  }

  return tx.attendanceRecord.create({
    data: {
      employeeId: input.employeeId,
      storeId: input.storeId,
      workDate,
      clockIn: new Date(),
      shiftId: input.shiftId ?? null,
      status: "present",
      createdBy,
    },
  });
}

export async function clockOut(tx: TransactionClient, recordId: string) {
  return tx.attendanceRecord.update({ where: { id: recordId }, data: { clockOut: new Date() } });
}

/** Manual backfill entry for a full attendance row (e.g. a forgotten clock-in), distinct from the live clock-in/clock-out flow above. */
export async function createAttendanceRecord(
  tx: TransactionClient,
  input: CreateAttendanceInput,
  createdBy: string | null,
) {
  return tx.attendanceRecord.create({
    data: {
      employeeId: input.employeeId,
      storeId: input.storeId,
      workDate: startOfUtcDay(input.workDate),
      clockIn: input.clockIn ?? null,
      clockOut: input.clockOut ?? null,
      status: input.status,
      notes: input.notes ?? null,
      createdBy,
    },
  });
}

export async function listAttendance(tx: TransactionClient, query: AttendanceListQuery) {
  const { employeeId, storeId, from, to } = query;

  const where: Prisma.AttendanceRecordWhereInput = {
    ...(employeeId ? { employeeId } : {}),
    ...(storeId ? { storeId } : {}),
    ...(from || to
      ? {
          workDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  return tx.attendanceRecord.findMany({
    where,
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { workDate: "desc" },
  });
}
