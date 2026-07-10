import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { assignUserToStore, revokeUserFromStore, listUserStores } from "@/server/services/user-stores";
import { UserStoreAssignSchema } from "@/lib/validators/stores";

const ListUserStoresQuerySchema = z.object({ userId: z.string().uuid() });

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "stores:manage");
    const { searchParams } = new URL(request.url);
    const parsed = ListUserStoresQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const rows = await withTenant(session!.user.tenantId, (tx) => listUserStores(tx, parsed.data.userId));
    return apiSuccess(rows);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "stores:manage");
    const body = await request.json();
    const parsed = UserStoreAssignSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const assignment = await withTenant(session!.user.tenantId, (tx) =>
      assignUserToStore(tx, parsed.data.userId, parsed.data.storeId),
    );
    return apiSuccess(assignment, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "stores:manage");
    const body = await request.json();
    const parsed = UserStoreAssignSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    await withTenant(session!.user.tenantId, (tx) =>
      revokeUserFromStore(tx, parsed.data.userId, parsed.data.storeId),
    );
    return apiSuccess({ ...parsed.data });
  } catch (error) {
    return mapServiceError(error);
  }
}
