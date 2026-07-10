import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import {
  ListSupplierEvaluationsQuerySchema,
  RunSupplierEvaluationSchema,
} from "@/lib/validators/suppliers-mcda";
import { getSupplierScoreHistory, runSupplierEvaluation } from "@/server/services/supplier-mcda";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "suppliers:read");
    const { searchParams } = new URL(request.url);
    const parsed = ListSupplierEvaluationsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    if (!parsed.data.supplierId) {
      return apiSuccess([]);
    }
    const history = await withTenant(session!.user.tenantId, (tx) =>
      getSupplierScoreHistory(tx, { supplierId: parsed.data.supplierId! }),
    );
    return apiSuccess(history);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "suppliers:evaluate");
    const body = await request.json();
    const parsed = RunSupplierEvaluationSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await withTenant(session!.user.tenantId, (tx) =>
      runSupplierEvaluation(tx, { ...parsed.data, userId: session!.user.id }),
    );
    return apiSuccess(result, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
