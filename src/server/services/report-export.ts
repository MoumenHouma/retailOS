import * as XLSX from "xlsx";

/**
 * Generic tabular export, generalizing product-export.ts's XLSX pattern over
 * any row shape. Report services build `rows` as plain objects keyed by the
 * column header they want to appear in the sheet — same convention as
 * exportProductsBuffer's French-labeled keys.
 */
export function exportReportToBuffer(
  rows: Record<string, string | number>[],
  format: "csv" | "xlsx",
  sheetName = "Rapport",
): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  // XLSX's book_append_sheet throws on sheet names over 31 chars (a hard
  // Excel format limit) — real report titles like "Suggestions de
  // réapprovisionnement" blow past that, confirmed live (500 error).
  // Truncate the sheet name only; the full title still appears in the PDF
  // variant and the report page itself, this is purely an Excel-tab-name
  // constraint.
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));

  return XLSX.write(workbook, { type: "buffer", bookType: format }) as Buffer;
}
