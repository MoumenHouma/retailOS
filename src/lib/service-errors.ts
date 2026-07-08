import { apiError } from "./api-response";
import { ForbiddenError } from "./permissions";
import { InvalidParentError } from "@/server/services/categories";
import { InUseError } from "@/server/services/brands";
import { InvalidReferenceError } from "@/server/services/products";
import { DuplicateBarcodeError, BarcodeInUseError } from "@/server/services/barcodes";
import { InsufficientStockError } from "@/server/services/stock";

/** Maps known service-layer error classes to the standard API error shape/status. */
export function mapServiceError(error: unknown) {
  if (error instanceof ForbiddenError) {
    return apiError("FORBIDDEN", error.message, 403);
  }
  if (error instanceof InvalidParentError || error instanceof InvalidReferenceError) {
    return apiError("INVALID_REFERENCE", error.message, 422);
  }
  if (error instanceof InUseError) {
    return apiError("IN_USE", error.message, 409);
  }
  if (error instanceof DuplicateBarcodeError) {
    return apiError("DUPLICATE_BARCODE", error.message, 409);
  }
  if (error instanceof BarcodeInUseError) {
    return apiError("BARCODE_IN_USE", error.message, 409);
  }
  if (error instanceof InsufficientStockError) {
    return apiError("INSUFFICIENT_STOCK", error.message, 409);
  }
  if ((error as { code?: string })?.code === "P2025") {
    return apiError("NOT_FOUND", "Resource not found.", 404);
  }

  console.error(error);
  return apiError("INTERNAL_ERROR", "Une erreur interne est survenue.", 500);
}
