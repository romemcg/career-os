export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "REVISION_CONFLICT"
  | "INVALID_TRANSITION"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "INTERNAL_ERROR";

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  REVISION_CONFLICT: 409,
  INVALID_TRANSITION: 422,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  IDEMPOTENCY_KEY_REUSED: 422,
  INTERNAL_ERROR: 500,
};

export type ErrorDetail = { path?: string; message: string };

/** An error that is safe to show to the client. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: ErrorDetail[];

  constructor(code: ErrorCode, message: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = statusByCode[code];
    this.details = details;
  }
}

export const notFound = (entity: string) => new AppError("NOT_FOUND", `${entity} not found`);
