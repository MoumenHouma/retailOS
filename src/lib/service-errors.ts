import { apiError } from "./api-response";
import { ForbiddenError } from "./permissions";
import { InvalidParentError } from "@/server/services/categories";
import { InUseError } from "@/server/services/brands";
import { InvalidReferenceError } from "@/server/services/products";
import { DuplicateBarcodeError, BarcodeInUseError } from "@/server/services/barcodes";
import { InsufficientStockError } from "@/server/services/stock";
import {
  SessionAlreadyOpenError,
  SessionClosedError,
  SessionNotFoundError,
} from "@/server/services/pos-sessions";
import { EmptySaleError, PaymentMismatchError, SaleNotHeldError } from "@/server/services/sales";
import { InvalidReturnQuantityError } from "@/server/services/returns";
import { InvoiceAlreadyExistsError, SaleNotFoundError } from "@/server/services/invoices";
import {
  InvalidPoStatusTransitionError,
  MissingUnitPriceError,
} from "@/server/services/purchase-orders";
import { InvalidDeliveryQuantityError } from "@/server/services/purchase-deliveries";
import {
  InvalidTransferQuantityError,
  InvalidTransferStatusTransitionError,
} from "@/server/services/stock-transfers";
import { InvalidCountStatusTransitionError } from "@/server/services/stock-counts";
import { InvoiceOverpaymentError } from "@/server/services/invoice-payments";
import { InvalidParentError as InvalidExpenseCategoryParentError } from "@/server/services/expense-categories";
import { InsufficientLoyaltyPointsError } from "@/server/services/loyalty";
import { CreditLimitExceededError, DebtOverpaymentError } from "@/server/services/customer-debts";
import { PeriodAlreadyClosedError } from "@/server/services/financial-periods";
import { AlreadyClockedInError } from "@/server/services/attendance";
import { NoActiveScopeError } from "@/server/services/forecasting";

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
  if (error instanceof SessionAlreadyOpenError) {
    return apiError("SESSION_ALREADY_OPEN", error.message, 409);
  }
  if (error instanceof SessionClosedError) {
    return apiError("SESSION_CLOSED", error.message, 409);
  }
  if (error instanceof SessionNotFoundError) {
    return apiError("NOT_FOUND", error.message, 404);
  }
  if (error instanceof EmptySaleError || error instanceof PaymentMismatchError) {
    return apiError("VALIDATION", error.message, 422);
  }
  if (error instanceof InvalidReturnQuantityError) {
    return apiError("VALIDATION", error.message, 422);
  }
  if (error instanceof SaleNotHeldError) {
    return apiError("SALE_NOT_HELD", error.message, 409);
  }
  if (error instanceof InvoiceAlreadyExistsError) {
    return apiError("INVOICE_ALREADY_EXISTS", error.message, 409);
  }
  if (error instanceof SaleNotFoundError) {
    return apiError("NOT_FOUND", error.message, 404);
  }
  if (error instanceof InvalidPoStatusTransitionError || error instanceof MissingUnitPriceError) {
    return apiError("VALIDATION", error.message, 422);
  }
  if (error instanceof InvalidDeliveryQuantityError) {
    return apiError("VALIDATION", error.message, 422);
  }
  if (
    error instanceof InvalidTransferStatusTransitionError ||
    error instanceof InvalidTransferQuantityError ||
    error instanceof InvalidCountStatusTransitionError
  ) {
    return apiError("VALIDATION", error.message, 422);
  }
  if (error instanceof InvoiceOverpaymentError) {
    return apiError("VALIDATION", error.message, 422);
  }
  if (error instanceof InvalidExpenseCategoryParentError) {
    return apiError("INVALID_REFERENCE", error.message, 422);
  }
  if (error instanceof InsufficientLoyaltyPointsError) {
    return apiError("VALIDATION", error.message, 422);
  }
  if (error instanceof DebtOverpaymentError) {
    return apiError("VALIDATION", error.message, 422);
  }
  if (error instanceof CreditLimitExceededError) {
    return apiError("CREDIT_LIMIT_EXCEEDED", error.message, 422);
  }
  if (error instanceof PeriodAlreadyClosedError) {
    return apiError("PERIOD_ALREADY_CLOSED", error.message, 409);
  }
  if (error instanceof AlreadyClockedInError) {
    return apiError("ALREADY_CLOCKED_IN", error.message, 409);
  }
  if (error instanceof NoActiveScopeError) {
    return apiError("NO_ACTIVE_SCOPE", error.message, 422);
  }
  if ((error as { code?: string })?.code === "P2025") {
    return apiError("NOT_FOUND", "Resource not found.", 404);
  }

  console.error(error);
  return apiError("INTERNAL_ERROR", "Une erreur interne est survenue.", 500);
}
