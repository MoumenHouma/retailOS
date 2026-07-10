import type { Prisma } from "@prisma/client";
import type { EmployeePerformanceQuery } from "@/lib/validators/employee-performance";

type TransactionClient = Prisma.TransactionClient;

interface EmployeePerformanceRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  salesTotal: number;
  salesCount: number;
  commissionTotal: number;
  shiftsScheduled: number;
  attendanceRecords: number;
  attendanceRate: number | null;
}

/**
 * Pure aggregation, no new table — per-employee sales total (Sale via
 * cashierId -> Employee.userId), commission total (SaleCommission),
 * attendance rate (AttendanceRecord count vs. WorkShift count in range).
 * Employees with no linked User (no cashierId to join against) still show
 * up with zeroed sales/commission figures rather than being dropped, since
 * a warehouse-only employee's shift/attendance stats are still meaningful.
 */
export async function getEmployeePerformance(
  tx: TransactionClient,
  query: EmployeePerformanceQuery,
): Promise<EmployeePerformanceRow[]> {
  const { storeId, from, to } = query;

  const [employees, sales, commissions, shifts, attendance] = await Promise.all([
    tx.employee.findMany({ where: { deletedAt: null }, select: { id: true, userId: true, firstName: true, lastName: true } }),
    tx.sale.findMany({
      where: {
        status: "completed",
        deletedAt: null,
        createdAt: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      select: { cashierId: true, total: true },
    }),
    tx.saleCommission.findMany({
      where: { calculatedAt: { gte: from, lte: to } },
      select: { employeeId: true, amount: true },
    }),
    tx.workShift.findMany({
      where: {
        startsAt: { gte: from, lte: to },
        status: { not: "cancelled" },
        ...(storeId ? { storeId } : {}),
      },
      select: { employeeId: true },
    }),
    tx.attendanceRecord.findMany({
      where: {
        workDate: { gte: from, lte: to },
        ...(storeId ? { storeId } : {}),
      },
      select: { employeeId: true, status: true },
    }),
  ]);

  const salesByUserId = new Map<string, { total: number; count: number }>();
  for (const sale of sales) {
    const entry = salesByUserId.get(sale.cashierId) ?? { total: 0, count: 0 };
    entry.total += sale.total;
    entry.count += 1;
    salesByUserId.set(sale.cashierId, entry);
  }

  const commissionByEmployeeId = new Map<string, number>();
  for (const commission of commissions) {
    commissionByEmployeeId.set(
      commission.employeeId,
      (commissionByEmployeeId.get(commission.employeeId) ?? 0) + commission.amount,
    );
  }

  const shiftsByEmployeeId = new Map<string, number>();
  for (const shift of shifts) {
    shiftsByEmployeeId.set(shift.employeeId, (shiftsByEmployeeId.get(shift.employeeId) ?? 0) + 1);
  }

  const attendanceByEmployeeId = new Map<string, { total: number; present: number }>();
  for (const record of attendance) {
    const entry = attendanceByEmployeeId.get(record.employeeId) ?? { total: 0, present: 0 };
    entry.total += 1;
    if (record.status === "present" || record.status === "late") entry.present += 1;
    attendanceByEmployeeId.set(record.employeeId, entry);
  }

  return employees.map((employee) => {
    const sales = employee.userId ? salesByUserId.get(employee.userId) : undefined;
    const attendanceEntry = attendanceByEmployeeId.get(employee.id);
    const shiftsScheduled = shiftsByEmployeeId.get(employee.id) ?? 0;

    return {
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      salesTotal: sales?.total ?? 0,
      salesCount: sales?.count ?? 0,
      commissionTotal: commissionByEmployeeId.get(employee.id) ?? 0,
      shiftsScheduled,
      attendanceRecords: attendanceEntry?.total ?? 0,
      attendanceRate:
        shiftsScheduled > 0 && attendanceEntry ? attendanceEntry.present / shiftsScheduled : null,
    };
  });
}
