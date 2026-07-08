import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { ImportCommitSchema } from "@/lib/validators/products";
import { resolveAndCreateProductFromImportRow } from "@/server/services/product-import";

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:create");
    const body = await request.json();
    const parsed = ImportCommitSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const { rows, skipErrors } = parsed.data;
    const tenantId = session!.user.tenantId;
    const userId = session!.user.id;

    if (skipErrors) {
      // Partial success: each row is its own transaction, failures don't
      // affect rows already committed. Sequential (not Promise.all) — rows
      // sharing a brand-new category/brand name would otherwise race on the
      // find-or-create check and spuriously collide on the partial unique
      // index.
      const results = [];
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index]!;
        try {
          const product = await withTenant(tenantId, (tx) =>
            resolveAndCreateProductFromImportRow(tx, row, userId),
          );
          results.push({ row: index + 1, success: true, productId: product.id });
        } catch (error) {
          results.push({
            row: index + 1,
            success: false,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      return apiSuccess({ results, committed: results.filter((r) => r.success).length });
    }

    // Strict all-or-nothing: one shared transaction, any failure rolls everything back.
    const created = await withTenant(tenantId, async (tx) => {
      const products = [];
      for (const row of rows) {
        products.push(await resolveAndCreateProductFromImportRow(tx, row, userId));
      }
      return products;
    });
    return apiSuccess({
      results: created.map((p, i) => ({ row: i + 1, success: true, productId: p.id })),
      committed: created.length,
    });
  } catch (error) {
    return mapServiceError(error);
  }
}
