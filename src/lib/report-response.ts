import { NextResponse } from "next/server";
import { exportReportToBuffer } from "@/server/services/report-export";
import { renderReportPdf, type ReportPdfColumn } from "@/server/services/report-pdf";

export type ReportExportFormat = "pdf" | "xlsx" | "csv";

export function parseReportFormat(value: string | null): ReportExportFormat | null {
  if (value === "pdf" || value === "xlsx" || value === "csv") return value;
  return null;
}

/**
 * Shared response builder for the `?format=pdf|xlsx|csv` handler every
 * report route adds. `rows` are plain objects keyed by column header (same
 * convention as exportProductsBuffer); `pdfColumns` maps those same keys to
 * PDF column definitions since the PDF renderer needs an explicit column
 * order/alignment that a plain object can't carry.
 */
export async function buildReportExportResponse(
  format: ReportExportFormat,
  rows: Record<string, string | number>[],
  pdfColumns: ReportPdfColumn[],
  options: { title: string; subtitle?: string; filterSummary?: string; filenameBase: string },
): Promise<NextResponse> {
  if (format === "pdf") {
    const buffer = await renderReportPdf({
      title: options.title,
      subtitle: options.subtitle,
      filterSummary: options.filterSummary,
      columns: pdfColumns,
      rows,
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${options.filenameBase}.pdf"`,
      },
    });
  }

  const buffer = exportReportToBuffer(rows, format, options.title);
  const contentType = format === "csv" ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${options.filenameBase}.${format}"`,
    },
  });
}
