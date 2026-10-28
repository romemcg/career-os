import { NextResponse } from "next/server";
import { AppError, type ErrorDetail } from "./errors";

export function ok<T>(data: T, requestId: string, init?: { status?: number; meta?: Record<string, unknown> }) {
  return NextResponse.json(
    { data, meta: { requestId, ...init?.meta } },
    { status: init?.status ?? 200, headers: { "x-request-id": requestId } },
  );
}

export function fail(error: AppError, requestId: string) {
  const body: { error: { code: string; message: string; details: ErrorDetail[] } } = {
    error: { code: error.code, message: error.message, details: error.details },
  };
  return NextResponse.json(body, { status: error.status, headers: { "x-request-id": requestId } });
}
