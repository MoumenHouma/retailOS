import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { AssignUserRoleSchema } from "@/lib/validators/roles";
import { assignUserRole } from "@/server/services/roles";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:roles");
    const body = await request.json();
    const parsed = AssignUserRoleSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const userRole = await withTenant(session!.user.tenantId, (tx) => assignUserRole(tx, id, parsed.data));
    return apiSuccess(userRole, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
