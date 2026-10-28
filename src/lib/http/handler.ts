import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import { validateSession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getDb } from "@/lib/db/client";
import { logger } from "@/lib/logger";
import { isSameOriginRequest } from "@/lib/security/origin";
import { AppError } from "./errors";
import { fail } from "./respond";

type RouteParams = Record<string, string | string[] | undefined>;

export type HandlerContext<P extends RouteParams> = {
  request: NextRequest;
  requestId: string;
  params: P;
};

type Handler<P extends RouteParams, A> = (ctx: HandlerContext<P> & { auth: A }) => Promise<NextResponse> | NextResponse;

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return new AppError("CONFLICT", "A record with these values already exists");
    if (error.code === "P2025") return new AppError("NOT_FOUND", "Record not found");
    if (error.code === "P2003") return new AppError("CONFLICT", "Referenced record is missing or still in use");
  }
  if (error instanceof SyntaxError) return new AppError("VALIDATION_ERROR", "Malformed JSON body");
  return new AppError("INTERNAL_ERROR", "An unexpected error occurred");
}

function wrap<P extends RouteParams, A>(requireAuth: boolean, handler: Handler<P, A>) {
  return async (request: NextRequest, segment: { params: Promise<P> }) => {
    const requestId = randomUUID();
    try {
      if (!isSameOriginRequest(request)) {
        throw new AppError("FORBIDDEN", "Cross-origin request rejected");
      }
      let auth: AuthContext | null = null;
      if (requireAuth) {
        auth = await validateSession(getDb(), request.cookies.get(SESSION_COOKIE)?.value);
        if (!auth) throw new AppError("UNAUTHENTICATED", "Authentication required");
        auth.requestId = requestId;
      }
      const params = segment?.params ? await segment.params : ({} as P);
      return await handler({ request, requestId, params, auth: auth as A });
    } catch (error) {
      const appError = toAppError(error);
      if (appError.status >= 500) {
        logger.error("request failed", { requestId, path: request.nextUrl.pathname, error });
      }
      return fail(appError, requestId);
    }
  };
}

/** Route handler requiring an authenticated owner session. */
export const authed = <P extends RouteParams = RouteParams>(handler: Handler<P, AuthContext>) =>
  wrap<P, AuthContext>(true, handler);

/** Route handler that does not require a session (login, health). */
export const publicRoute = <P extends RouteParams = RouteParams>(handler: Handler<P, null>) =>
  wrap<P, null>(false, handler);

export async function readJson(request: Request): Promise<unknown> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE", "Expected application/json");
  }
  return request.json();
}
