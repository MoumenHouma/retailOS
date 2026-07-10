import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { UpdateRolePermissionsSchema } from "@/lib/validators/roles";
import { updateRolePermissions } from "@/server/services/roles";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:roles");
    const body = await request.json();
    const parsed = UpdateRolePermissionsSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const role = await withTenant(session!.user.tenantId, (tx) => updateRolePermissions(tx, id, parsed.data));
    return apiSuccess(role);
  } catch (error) {
    return mapServiceError(error);
  }
}
