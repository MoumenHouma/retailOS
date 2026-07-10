import type { Prisma } from "@prisma/client";
import type { ScheduledReportCreate, ScheduledReportUpdate } from "@/lib/validators/reports";
import { getRevenueDashboard } from "@/server/services/financial-reports";
import { getSalesSummaryReport } from "@/server/services/sales-report";
import { getInventoryStatusReport } from "@/server/services/inventory-report";
import { getEmployeePerformance } from "@/server/services/employee-performance";
import { exportReportToBuffer } from "@/server/services/report-export";
import { renderReportPdf, type ReportPdfColumn } from "@/server/services/report-pdf";
import { formatDa } from "@/lib/currency";

type TransactionClient = Prisma.TransactionClient;

export class ScheduledReportNotFoundError extends Error {
  constructor() {
    super("Scheduled report not found");
    this.name = "ScheduledReportNotFoundError";
  }
}

export async function createScheduledReport(
  tx: TransactionClient,
  input: ScheduledReportCreate,
  createdBy: string,
) {
  return tx.scheduledReport.create({
    data: { ...input, filters: input.filters as Prisma.InputJsonValue, createdBy },
  });
}

export async function updateScheduledReport(
  tx: TransactionClient,
  id: string,
  input: ScheduledReportUpdate,
) {
  const existing = await tx.scheduledReport.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ScheduledReportNotFoundError();
  return tx.scheduledReport.update({
    where: { id },
    data: { ...input, filters: input.filters as Prisma.InputJsonValue | undefined },
  });
}

export async function listScheduledReports(tx: TransactionClient) {
  return tx.scheduledReport.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function softDeleteScheduledReport(tx: TransactionClient, id: string) {
  const existing = await tx.scheduledReport.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new ScheduledReportNotFoundError();
  await tx.scheduledReport.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
}

export async function recordScheduledReportRun(
  tx: TransactionClient,
  id: string,
  status: "success" | "failed",
  error?: string,
) {
  await tx.scheduledReport.update({
    where: { id },
    data: { lastRunAt: new Date(), lastRunStatus: status, lastRunError: error ?? null },
  });
}

interface GeneratedReport {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

/**
 * Dispatches a ScheduledReport's reportType to the matching report service
 * (default trailing-30-day window — scheduled reports don't carry a UI date
 * picker, they run recurring on a fixed cadence), then renders the result in
 * the row's configured format. Called from a short read-only transaction
 * inside the worker job — never wraps the email send.
 */
export async function generateReportForSchedule(
  tx: TransactionClient,
  scheduledReport: { reportType: string; format: string; name: string },
): Promise<GeneratedReport> {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  let rows: Record<string, string | number>[] = [];
  let columns: ReportPdfColumn[] = [];
  let title = scheduledReport.name;

  switch (scheduledReport.reportType) {
    case "sales": {
      const report = await getSalesSummaryReport(tx, { from, to, granularity: "daily" });
      rows = report.buckets.map((b) => ({ Période: b.period, CA: formatDa(b.revenue), Ventes: b.saleCount }));
      columns = [
        { key: "Période", label: "Période" },
        { key: "CA", label: "CA", align: "right" },
        { key: "Ventes", label: "Ventes", align: "right" },
      ];
      break;
    }
    case "inventory": {
      const report = await getInventoryStatusReport(tx, {});
      rows = report.rows.map((r) => ({
        Produit: r.productName,
        Magasin: r.storeName,
        Stock: r.quantityOnHand,
        Valeur: formatDa(r.stockValue),
      }));
      columns = [
        { key: "Produit", label: "Produit" },
        { key: "Magasin", label: "Magasin" },
        { key: "Stock", label: "Stock", align: "right" },
        { key: "Valeur", label: "Valeur", align: "right" },
      ];
      break;
    }
    case "financial": {
      const buckets = await getRevenueDashboard(tx, { from, to, granularity: "daily" });
      rows = buckets.map((b) => ({ Période: b.period, CA: formatDa(b.revenue), Total: formatDa(b.total) }));
      columns = [
        { key: "Période", label: "Période" },
        { key: "CA", label: "CA", align: "right" },
        { key: "Total", label: "Total", align: "right" },
      ];
      break;
    }
    case "employee": {
      const perf = await getEmployeePerformance(tx, { from, to });
      rows = perf.map((p) => ({ Employé: `${p.firstName} ${p.lastName}`, Ventes: formatDa(p.salesTotal) }));
      columns = [
        { key: "Employé", label: "Employé" },
        { key: "Ventes", label: "Ventes", align: "right" },
      ];
      break;
    }
    case "purchase": {
      // No date-scoped purchase-analytics accessor exists yet at this
      // granularity — reuse the reorder-suggestions signal, which is the
      // purchase-relevant view already available without a date range.
      const { getReorderSuggestions } = await import("@/server/services/procurement-reports");
      const suggestions = await getReorderSuggestions(tx);
      rows = suggestions.map((s) => ({ Produit: s.productName, Magasin: s.storeName, Stock: s.quantityOnHand }));
      columns = [
        { key: "Produit", label: "Produit" },
        { key: "Magasin", label: "Magasin" },
        { key: "Stock", label: "Stock", align: "right" },
      ];
      break;
    }
    default:
      throw new Error(`Unknown report type: ${scheduledReport.reportType}`);
  }

  const buffer =
    scheduledReport.format === "pdf"
      ? await renderReportPdf({ title, columns, rows })
      : exportReportToBuffer(rows, scheduledReport.format as "xlsx" | "csv", title);

  return {
    buffer,
    contentType: CONTENT_TYPES[scheduledReport.format] ?? "application/octet-stream",
    filename: `${scheduledReport.reportType}-${new Date().toISOString().slice(0, 10)}.${scheduledReport.format}`,
  };
}
