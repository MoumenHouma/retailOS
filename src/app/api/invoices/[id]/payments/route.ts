import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { apiSuccess, apiValidationError } from "@/lib/api-response";
import { mapServiceError } from "@/lib/service-errors";
import { RecordInvoicePaymentSchema } from "@/lib/validators/invoice-payments";
import { listInvoicePayments, recordInvoicePayment } from "@/server/services/invoice-payments";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "finance:read");
    const payments = await withTenant(session!.user.tenantId, (tx) => listInvoicePayments(tx, id));
    return apiSuccess(payments);
  } catch (error) {
    return mapServiceError(error);
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "finance:payment");
    const body = await request.json();
    const parsed = RecordInvoicePaymentSchema.safeParse(body);
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await withTenant(session!.user.tenantId, (tx) =>
      recordInvoicePayment(tx, id, parsed.data, session!.user.id),
    );
    return apiSuccess(result, undefined, 201);
  } catch (error) {
    return mapServiceError(error);
  }
}
