import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateEmployeeSchema, EmployeeSearchQuerySchema } from "@/lib/validators/employees";
import { createEmployee, searchEmployees } from "@/server/services/employees";

// Salary is gated separately from base employee:read/manage — employees:payroll
// per PHASE4_FINANCE_PLAN.md Chunk D ("salary visibility/edits... BUSINESS_OWNER-only").
function redactSalary<T extends { salary: number | null }>(employee: T): T {
  return { ...employee, salary: null };
}

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:read");
    const { searchParams } = new URL(request.url);
    const parsed = EmployeeSearchQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => searchEmployees(tx, parsed.data),
    );
    const canSeePayroll = session!.user.permissions.includes("employees:payroll");
    const data = canSeePayroll ? items : items.map(redactSalary);
    return apiSuccess(data, { page, pageSize, total, totalPages });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:manage");
    const body = await request.json();
    const parsed = CreateEmployeeSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const input = { ...parsed.data };
    if (!session!.user.permissions.includes("employees:payroll")) {
      delete input.salary;
    }

    const employee = await withTenant(session!.user.tenantId, (tx) => createEmployee(tx, input));
    return apiSuccess(employee, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
