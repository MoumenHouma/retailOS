import type { Prisma } from "@prisma/client";
import type { AddBarcodeInput } from "@/lib/validators/products";

type TransactionClient = Prisma.TransactionClient;

export class DuplicateBarcodeError extends Error {
  constructor(public readonly barcode: string) {
    super(`Barcode ${barcode} is already in use.`);
    this.name = "DuplicateBarcodeError";
  }
}

export class BarcodeInUseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BarcodeInUseError";
  }
}

/**
 * Computes a valid EAN-13 barcode from a sequence number, using the GS1
 * "restricted circulation" prefix range (20-29, reserved for internal/
 * in-store use — no registration required). Pure function, no DB access —
 * the caller supplies a sequence number (e.g. a per-tenant counter).
 */
export function generateEan13(sequence: number, prefix = "20"): string {
  if (prefix.length !== 2 || !/^\d{2}$/.test(prefix)) {
    throw new Error("prefix must be exactly 2 digits");
  }
  if (sequence < 0 || sequence > 9_999_999_999) {
    throw new Error("sequence out of range for a 10-digit body");
  }
  const body = `${prefix}${String(sequence).padStart(10, "0")}`; // 12 digits
  const digits = body.split("").map(Number);
  const sum = digits.reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 1 : 3), 0);
  const checkDigit = (10 - (sum % 10)) % 10;
  return `${body}${checkDigit}`;
}

export async function addBarcode(
  tx: TransactionClient,
  productId: string,
  input: AddBarcodeInput,
) {
  try {
    const barcode = await tx.productBarcode.create({
      data: { productId, ...input },
    });
    if (input.isPrimary) {
      await setPrimaryBarcode(tx, productId, barcode.id);
    }
    return barcode;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new DuplicateBarcodeError(input.barcode);
    }
    throw error;
  }
}

export async function setPrimaryBarcode(
  tx: TransactionClient,
  productId: string,
  barcodeId: string,
): Promise<void> {
  const target = await tx.productBarcode.findUniqueOrThrow({ where: { id: barcodeId } });

  await tx.productBarcode.updateMany({
    where: { productId, isPrimary: true },
    data: { isPrimary: false },
  });
  await tx.productBarcode.update({ where: { id: barcodeId }, data: { isPrimary: true } });
  await tx.product.update({ where: { id: productId }, data: { barcode: target.barcode } });
}

export async function removeBarcode(
  tx: TransactionClient,
  productId: string,
  barcodeId: string,
): Promise<void> {
  const target = await tx.productBarcode.findUniqueOrThrow({ where: { id: barcodeId } });
  const remainingCount = await tx.productBarcode.count({
    where: { productId, deletedAt: null, id: { not: barcodeId } },
  });

  if (target.isPrimary && remainingCount > 0) {
    throw new BarcodeInUseError(
      "Cannot remove the primary barcode while other barcodes exist — set a new primary first.",
    );
  }

  await tx.productBarcode.update({ where: { id: barcodeId }, data: { deletedAt: new Date() } });

  if (target.isPrimary) {
    await tx.product.update({ where: { id: productId }, data: { barcode: null } });
  }
}
