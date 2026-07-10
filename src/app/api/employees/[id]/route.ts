import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateEmployeeSchema } from "@/lib/validators/employees";
import { getEmployee, softDeleteEmployee, updateEmployee } from "@/server/services/employees";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:read");
    const employee = await withTenant(session!.user.tenantId, (tx) => getEmployee(tx, id));
    const canSeePayroll = session!.user.permissions.includes("employees:payroll");
    return apiSuccess(canSeePayroll ? employee : { ...employee, salary: null });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:manage");
    const body = await request.json();
    const parsed = UpdateEmployeeSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const input = { ...parsed.data };
    if (!session!.user.permissions.includes("employees:payroll")) {
      delete input.salary;
    }

    const employee = await withTenant(session!.user.tenantId, (tx) => updateEmployee(tx, id, input));
    return apiSuccess(employee);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:manage");
    await withTenant(session!.user.tenantId, (tx) => softDeleteEmployee(tx, id));
    return apiSuccess({ id });
  } catch (error) {
    return mapServiceError(error);
  }
}
