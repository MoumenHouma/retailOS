import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateRoleSchema } from "@/lib/validators/roles";
import { createRole, listRoles } from "@/server/services/roles";

export async function GET() {
  const session = await auth();
  try {
    requirePermission(session, "employees:roles");
    const roles = await withTenant(session!.user.tenantId, (tx) => listRoles(tx));
    return apiSuccess(roles);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "employees:roles");
    const body = await request.json();
    const parsed = CreateRoleSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const role = await withTenant(session!.user.tenantId, (tx) =>
      createRole(tx, session!.user.tenantId, parsed.data),
    );
    return apiSuccess(role, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
