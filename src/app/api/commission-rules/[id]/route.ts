import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateCommissionRuleSchema } from "@/lib/validators/commission-rules";
import { deactivateCommissionRule, updateCommissionRule } from "@/server/services/commission-rules";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:payroll");
    const body = await request.json();
    const parsed = UpdateCommissionRuleSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const rule = await withTenant(session!.user.tenantId, (tx) => updateCommissionRule(tx, id, parsed.data));
    return apiSuccess(rule);
  } catch (error) {
    return mapServiceError(error);
  }
}

// Deactivate, not delete — a CommissionRule referenced by past SaleCommission
// rows shouldn't disappear from the historical record, same "isActive-only"
// precedent as ExpenseCategory.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:payroll");
    const rule = await withTenant(session!.user.tenantId, (tx) => deactivateCommissionRule(tx, id));
    return apiSuccess(rule);
  } catch (error) {
    return mapServiceError(error);
  }
}
