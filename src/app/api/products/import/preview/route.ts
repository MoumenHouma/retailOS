import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { parseAndValidateImportRows } from "@/server/services/product-import";

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "products:create");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiError("VALIDATION_ERROR", "No file uploaded.", 422);
    }

    const buffer = await file.arrayBuffer();
    const rows = parseAndValidateImportRows(buffer);
    const validCount = rows.filter((r) => r.success).length;

    return apiSuccess({
      rows,
      validCount,
      errorCount: rows.length - validCount,
    });
  } catch (error) {
    return mapServiceError(error);
  }
}
