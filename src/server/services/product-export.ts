import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export async function exportProductsBuffer(
  tx: TransactionClient,
  format: "csv" | "xlsx",
): Promise<Buffer> {
  const products = await tx.product.findMany({
    where: { deletedAt: null },
    include: { category: true, brand: true, unit: true },
    orderBy: { name: "asc" },
  });

  const rows = products.map((p) => ({
    Nom: p.name,
    "Nom (arabe)": p.nameAr ?? "",
    "Nom (anglais)": p.nameEn ?? "",
    SKU: p.sku ?? "",
    "Code-barres": p.barcode ?? "",
    Catégorie: p.category?.name ?? "",
    Marque: p.brand?.name ?? "",
    Unité: p.unit.abbreviation,
    "Prix d'achat": p.costPrice != null ? p.costPrice / 100 : "",
    "Prix de vente": p.sellingPrice / 100,
    "Prix de gros": p.wholesalePrice != null ? p.wholesalePrice / 100 : "",
    "Prix minimum": p.minPrice != null ? p.minPrice / 100 : "",
    "TVA (%)": p.tvaRate,
    "Stock minimum": p.minStockLevel,
    "Stock maximum": p.maxStockLevel ?? "",
    Actif: p.isActive ? "Oui" : "Non",
  }));

  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Produits");

  return XLSX.write(workbook, { type: "buffer", bookType: format }) as Buffer;
}
