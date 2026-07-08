import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { ProductImportRowSchema, type ProductImportRow } from "@/lib/validators/products";
import { createProduct } from "./products";
import type { ApiErrorDetail } from "@/lib/api-response";

type TransactionClient = Prisma.TransactionClient;

// Maps the fixed French column headers (what the exported template / user
// docs use) to the internal ProductImportRow field names.
const COLUMN_MAP: Record<string, keyof ProductImportRow> = {
  Nom: "name",
  "Nom (arabe)": "nameAr",
  "Nom (anglais)": "nameEn",
  SKU: "sku",
  "Code-barres": "barcode",
  Catégorie: "categoryName",
  Marque: "brandName",
  Unité: "unitAbbreviation",
  "Prix d'achat": "costPrice",
  "Prix de vente": "sellingPrice",
  "Prix de gros": "wholesalePrice",
  "Prix minimum": "minPrice",
  "TVA (%)": "tvaRate",
  "Stock minimum": "minStockLevel",
  "Stock maximum": "maxStockLevel",
  Actif: "isActive",
};

const PRICE_FIELDS = new Set(["costPrice", "sellingPrice", "wholesalePrice", "minPrice"]);
const INT_FIELDS = new Set(["tvaRate", "minStockLevel", "maxStockLevel"]);

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value == null || value === "") return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (["oui", "true", "1", "yes"].includes(normalized)) return true;
  if (["non", "false", "0", "no"].includes(normalized)) return false;
  return undefined;
}

function toCentimes(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : parseFloat(String(value).replace(",", "."));
  if (Number.isNaN(parsed)) return undefined;
  return Math.round(parsed * 100);
}

export interface ImportRowResult {
  row: number;
  success: boolean;
  data?: ProductImportRow;
  errors?: ApiErrorDetail[];
}

/** Parses an uploaded .xlsx/.csv buffer and validates every row — no DB writes. */
export function parseAndValidateImportRows(buffer: ArrayBuffer): ImportRowResult[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: false,
  });

  return rawRows.map((rawRow, index) => {
    const mapped: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(rawRow)) {
      const field = COLUMN_MAP[header];
      if (!field) continue;
      if (PRICE_FIELDS.has(field)) {
        mapped[field] = toCentimes(value);
      } else if (field === "isActive") {
        mapped[field] = parseBoolean(value) ?? true;
      } else if (INT_FIELDS.has(field)) {
        mapped[field] = value == null || value === "" ? undefined : Number(value);
      } else {
        mapped[field] = value === "" ? null : value;
      }
    }

    const parsed = ProductImportRowSchema.safeParse(mapped);
    if (parsed.success) {
      return { row: index + 2, success: true, data: parsed.data }; // +2: header row + 1-indexed
    }
    return {
      row: index + 2,
      success: false,
      errors: parsed.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  });
}

/**
 * Resolves a validated import row's human-readable references (category/
 * brand names, unit abbreviation) to ids — auto-creating category/brand if
 * missing, but requiring the unit to already exist (small fixed list) — then
 * creates the product. Runs inside the caller's transaction.
 */
export async function resolveAndCreateProductFromImportRow(
  tx: TransactionClient,
  row: ProductImportRow,
  userId: string,
) {
  let categoryId: string | undefined;
  if (row.categoryName) {
    const existingCategory = await tx.productCategory.findFirst({
      where: { name: row.categoryName, deletedAt: null },
    });
    const category =
      existingCategory ?? (await tx.productCategory.create({ data: { name: row.categoryName } }));
    categoryId = category.id;
  }

  let brandId: string | undefined;
  if (row.brandName) {
    const existingBrand = await tx.brand.findFirst({
      where: { name: row.brandName, deletedAt: null },
    });
    const brand = existingBrand ?? (await tx.brand.create({ data: { name: row.brandName } }));
    brandId = brand.id;
  }

  const unit = await tx.unit.findFirst({
    where: { abbreviation: row.unitAbbreviation, deletedAt: null },
  });
  if (!unit) {
    throw new Error(`Unit "${row.unitAbbreviation}" does not exist for this tenant.`);
  }

  return createProduct(
    tx,
    {
      sku: row.sku,
      name: row.name,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      categoryId,
      brandId,
      unitId: unit.id,
      barcode: row.barcode,
      costPrice: row.costPrice,
      sellingPrice: row.sellingPrice,
      wholesalePrice: row.wholesalePrice,
      minPrice: row.minPrice,
      tvaRate: row.tvaRate,
      isTaxable: true,
      isTrackable: true,
      isExpirable: false,
      minStockLevel: row.minStockLevel,
      maxStockLevel: row.maxStockLevel,
      isActive: row.isActive,
    },
    userId,
  );
}
