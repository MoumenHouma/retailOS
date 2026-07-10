import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { CreateRoleSchema } from "@/lib/validators/roles";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:roles");
    const role = await withTenant(session!.user.tenantId, (tx) =>
      tx.role.findUniqueOrThrow({
        where: { id },
        include: {
          rolePermissions: { include: { permission: true } },
          userRoles: {
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true } },
              store: { select: { id: true, name: true } },
            },
          },
        },
      }),
    );
    return apiSuccess(role);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "employees:roles");
    const body = await request.json();
    const parsed = CreateRoleSchema.partial().safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const role = await withTenant(session!.user.tenantId, (tx) =>
      tx.role.update({ where: { id }, data: parsed.data }),
    );
    return apiSuccess(role);
  } catch (error) {
    return mapServiceError(error);
  }
}
