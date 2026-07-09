import type { Prisma } from "@prisma/client";
import { amountToFrenchWords } from "@/lib/number-to-french-words";
import { uploadPdf } from "@/lib/storage";
import { renderInvoicePdf, type InvoicePdfData } from "./invoice-pdf";

type TransactionClient = Prisma.TransactionClient;

export class InvoiceAlreadyExistsError extends Error {
  constructor() {
    super("An invoice already exists for this sale.");
    this.name = "InvoiceAlreadyExistsError";
  }
}

export class SaleNotFoundError extends Error {
  constructor() {
    super("Sale not found.");
    this.name = "SaleNotFoundError";
  }
}

/**
 * Locks and increments the tenant's InvoiceSequence row inside the caller's
 * transaction (SELECT ... FOR UPDATE — Prisma has no native row-locking API,
 * same "hand-append what Prisma can't express" pattern already used for RLS
 * policies and the stock-movement trigger). Resets to 1 when the calendar
 * year rolls over. Format: YYYY-NNNNN, gapless per tenant.
 */
async function nextInvoiceNumber(tx: TransactionClient): Promise<string> {
  const year = new Date().getFullYear();

  await tx.$executeRaw`
    INSERT INTO invoice_sequences (tenant_id, last_number, year)
    VALUES (NULLIF(current_setting('app.current_tenant_id', true), '')::uuid, 0, ${year})
    ON CONFLICT (tenant_id) DO NOTHING
  `;

  const rows = await tx.$queryRaw<{ last_number: number; year: number }[]>`
    SELECT last_number, year FROM invoice_sequences
    WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
    FOR UPDATE
  `;
  const current = rows[0];
  if (!current) {
    throw new Error("invoice_sequences row missing after upsert — this should be unreachable.");
  }
  const nextNumber = current.year === year ? current.last_number + 1 : 1;

  await tx.$executeRaw`
    UPDATE invoice_sequences SET last_number = ${nextNumber}, year = ${year}
    WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  `;

  return `${year}-${String(nextNumber).padStart(5, "0")}`;
}

/** tax_stamp = max(100 DA, round(TTC * 1%)); net_to_pay = TTC + tax_stamp — ARCHITECTURE.md §4.7. */
function computeTaxStamp(totalTtcCentimes: number): number {
  return Math.max(10_000, Math.round(totalTtcCentimes * 0.01));
}

interface CreateInvoiceRecordInput {
  saleId: string;
  createdBy: string;
  paymentTerms?: string | null;
}

/**
 * All the DB work only — deliberately excludes PDF rendering and the MinIO
 * upload. Both are slow, latency-variable operations (first-ever PDF render
 * pays font-loading/JIT cost) that have no business holding a Postgres
 * transaction open: doing them inside this transaction blew past Prisma's
 * 5s interactive-transaction timeout in testing ("Transaction already
 * closed... 7230 ms passed"). Callers render+upload after this resolves,
 * then call attachInvoicePdf in a second, fast transaction.
 */
export async function createInvoiceRecord(tx: TransactionClient, input: CreateInvoiceRecordInput) {
  const existing = await tx.invoice.findFirst({ where: { saleId: input.saleId } });
  if (existing) {
    throw new InvoiceAlreadyExistsError();
  }

  const sale = await tx.sale.findUnique({
    where: { id: input.saleId },
    include: {
      customer: true,
      store: { include: { tenant: true } },
      items: { include: { product: { include: { unit: true } } } },
    },
  });
  if (!sale) {
    throw new SaleNotFoundError();
  }

  const tenant = sale.store.tenant;

  const tvaDetails: Record<string, number> = {};
  for (const item of sale.items) {
    const key = String(item.tvaRate);
    tvaDetails[key] = (tvaDetails[key] ?? 0) + item.tvaAmount;
  }

  const taxStampAmount = computeTaxStamp(sale.total);
  const netToPay = sale.total + taxStampAmount;
  const amountInWords = amountToFrenchWords(netToPay);
  const invoiceNumber = await nextInvoiceNumber(tx);

  const itemsData = sale.items.map((item, index) => ({
    lineNumber: index + 1,
    productId: item.productId,
    description: item.productName,
    quantity: item.quantity,
    unit: item.product.unit.abbreviation,
    unitPrice: item.unitPrice,
    tvaRate: item.tvaRate,
    amountHt: item.subtotal,
    tvaAmount: item.tvaAmount,
    amountTtc: item.total,
  }));

  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber,
      saleId: sale.id,
      customerId: sale.customerId,
      customerName: sale.customer?.name ?? "Client de passage",
      customerNif: null,
      issueDate: new Date(),
      subtotal: sale.subtotal,
      discountAmount: sale.discountAmount,
      tvaAmount: sale.tvaAmount,
      tvaDetails,
      taxStampAmount,
      totalTtc: sale.total,
      netToPay,
      amountInWords,
      paymentTerms: input.paymentTerms ?? "À réception",
      createdBy: input.createdBy,
      items: { create: itemsData },
    },
    include: { items: true },
  });

  const pdfData: InvoicePdfData = {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toLocaleDateString("fr-FR"),
    seller: {
      name: tenant.name,
      nif: tenant.nif,
      nis: tenant.nis,
      rc: tenant.rc,
      ai: tenant.ai,
      address: tenant.address,
    },
    buyer: {
      name: invoice.customerName ?? "Client de passage",
      address: invoice.customerAddress,
      nif: invoice.customerNif,
    },
    items: itemsData,
    subtotal: invoice.subtotal,
    discountAmount: invoice.discountAmount,
    tvaDetails,
    tvaAmount: invoice.tvaAmount,
    taxStampAmount: invoice.taxStampAmount,
    totalTtc: invoice.totalTtc,
    netToPay: invoice.netToPay,
    amountInWords: invoice.amountInWords,
    paymentTerms: invoice.paymentTerms,
  };

  return { invoice, pdfData, tenantId: tenant.id };
}

export async function attachInvoicePdf(tx: TransactionClient, invoiceId: string, pdfUrl: string) {
  return tx.invoice.update({ where: { id: invoiceId }, data: { pdfUrl }, include: { items: true } });
}

/**
 * Convenience wrapper for callers that don't need the split (e.g. a future
 * background job) — renders and uploads inline. The route handler uses the
 * split form so the render/upload happen outside the DB transaction.
 */
export async function renderAndUploadInvoicePdf(
  pdfData: InvoicePdfData,
  tenantId: string,
  invoiceNumber: string,
): Promise<string> {
  const pdfBuffer = await renderInvoicePdf(pdfData);
  const objectName = `invoices/${tenantId}/${invoiceNumber}.pdf`;
  await uploadPdf(objectName, pdfBuffer);
  return objectName;
}

interface InvoiceListQuery {
  page: number;
  pageSize: number;
}

export async function listInvoices(tx: TransactionClient, query: InvoiceListQuery) {
  const { page, pageSize } = query;
  const [items, total] = await Promise.all([
    tx.invoice.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    tx.invoice.count(),
  ]);
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getInvoiceById(tx: TransactionClient, id: string) {
  return tx.invoice.findUniqueOrThrow({ where: { id }, include: { items: true } });
}
