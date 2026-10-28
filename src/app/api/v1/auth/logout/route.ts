import { clearSessionCookie } from "@/lib/auth/cookie";
import { logout } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { authed } from "@/lib/http/handler";
import { ok } from "@/lib/http/respond";

export const POST = authed(async ({ request, requestId, auth }) => {
  await logout(getDb(), auth);
  const response = ok({ authenticated: false }, requestId);
  clearSessionCookie(response, request);
  return response;
});
