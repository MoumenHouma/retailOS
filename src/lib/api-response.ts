import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export function apiSuccess<T>(
  data: T,
  meta?: Record<string, unknown>,
  status = 200,
): NextResponse {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: ApiErrorDetail[],
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function zodErrorToDetails(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export function apiValidationError(error: ZodError): NextResponse {
  return apiError(
    "VALIDATION_ERROR",
    "Les données fournies sont invalides.",
    422,
    zodErrorToDetails(error),
  );
}
