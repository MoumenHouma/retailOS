import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { withTenant } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { mapServiceError } from "@/lib/service-errors";
import { getInvoiceById } from "@/server/services/invoices";
import { getPdfBuffer } from "@/lib/storage";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const session = await auth();
  const { id } = await params;
  try {
    requirePermission(session, "finance:read");
    const invoice = await withTenant(session!.user.tenantId, (tx) => getInvoiceById(tx, id));
    if (!invoice.pdfUrl) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "PDF not generated." } }, { status: 404 });
    }

    const buffer = await getPdfBuffer(invoice.pdfUrl);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="facture-${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    return mapServiceError(error);
  }
}
