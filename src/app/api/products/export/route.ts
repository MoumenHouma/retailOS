import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { mapServiceError } from "@/lib/service-errors";
import { exportProductsBuffer } from "@/server/services/product-export";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:read");
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";

    const buffer = await withTenant(session!.user.tenantId, (tx) =>
      exportProductsBuffer(tx, format),
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="produits.${format}"`,
      },
    });
  } catch (error) {
    return mapServiceError(error);
  }
}
