import { z } from "zod";
import { setSessionCookie } from "@/lib/auth/cookie";
import { login } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { publicRoute, readJson } from "@/lib/http/handler";
import { ok } from "@/lib/http/respond";
import { parseOrThrow } from "@/lib/validation";

const loginInput = z.object({ email: z.string().max(320), password: z.string().min(1).max(256) });

export const POST = publicRoute(async ({ request, requestId }) => {
  const input = parseOrThrow(loginInput, await readJson(request));
  const session = await login(getDb(), { ...input, userAgent: request.headers.get("user-agent"), requestId });
  const response = ok({ authenticated: true, expiresAt: session.expiresAt }, requestId);
  setSessionCookie(response, request, session.token, session.expiresAt);
  return response;
});
