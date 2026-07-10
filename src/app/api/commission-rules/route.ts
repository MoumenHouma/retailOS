import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateCommissionRuleSchema } from "@/lib/validators/commission-rules";
import { createCommissionRule, listCommissionRules } from "@/server/services/commission-rules";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "employees:payroll");
    const rules = await withTenant(session!.user.tenantId, (tx) => listCommissionRules(tx));
    return apiSuccess(rules);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:payroll");
    const body = await request.json();
    const parsed = CreateCommissionRuleSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const rule = await withTenant(session!.user.tenantId, (tx) => createCommissionRule(tx, parsed.data));
    return apiSuccess(rule, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
