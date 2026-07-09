import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { GenerateInvoiceSchema, InvoiceListQuerySchema } from "@/lib/validators/invoices";
import {
  attachInvoicePdf,
  createInvoiceRecord,
  listInvoices,
  renderAndUploadInvoicePdf,
} from "@/server/services/invoices";

export async function GET(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:read");
    const { searchParams } = new URL(request.url);
    const parsed = InvoiceListQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) return apiValidationError(parsed.error);

    const { items, total, page, pageSize, totalPages } = await withTenant(
      session!.user.tenantId,
      (tx) => listInvoices(tx, parsed.data),
    );
    return apiSuccess(items, { page, pageSize, total, totalPages });
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  try {
    requirePermission(session, "finance:invoice");
    const body = await request.json();
    const parsed = GenerateInvoiceSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const tenantId = session!.user.tenantId;
    const { invoice, pdfData } = await withTenant(tenantId, (tx) =>
      createInvoiceRecord(tx, { ...parsed.data, createdBy: session!.user.id }),
    );

    // Rendering + upload happen outside any DB transaction — see
    // createInvoiceRecord's doc comment for why.
    const pdfUrl = await renderAndUploadInvoicePdf(pdfData, tenantId, invoice.invoiceNumber);
    const updated = await withTenant(tenantId, (tx) => attachInvoicePdf(tx, invoice.id, pdfUrl));

    return apiSuccess(updated, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
