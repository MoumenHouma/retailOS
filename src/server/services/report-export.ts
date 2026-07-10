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
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

  return XLSX.write(workbook, { type: "buffer", bookType: format }) as Buffer;
}
