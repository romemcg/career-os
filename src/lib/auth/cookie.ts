import type { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "./constants";

/**
 * Secure is set whenever the request arrived over HTTPS, or when forced by
 * SESSION_COOKIE_SECURE=true. Plain-HTTP access is only possible on 127.0.0.1
 * because the server binds to loopback (see docs/decisions/0002).
 */
function isSecure(request: NextRequest): boolean {
  const forced = process.env.SESSION_COOKIE_SECURE;
  if (forced === "true") return true;
  if (forced === "false") return false;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return proto === "https";
}

export function setSessionCookie(response: NextResponse, request: NextRequest, token: string, expiresAt: Date) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(request),
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isSecure(request),
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
