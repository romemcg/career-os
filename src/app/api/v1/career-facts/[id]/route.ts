import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { authed, readJson } from "@/lib/http/handler";
import { ok } from "@/lib/http/respond";
import { parseOrThrow } from "@/lib/validation";
import { getFact, mutateFact } from "@/modules/career/service";

const params = z.object({ id: z.uuid() });

export const GET = authed<{ id: string }>(async ({ params: raw, requestId, auth }) => {
  const { id } = parseOrThrow(params, raw);
  return ok(await getFact(getDb(), auth, id), requestId);
});

// Body: { action: "edit" | "verify" | "reject" | "reopen", revision, ... }
export const PATCH = authed<{ id: string }>(async ({ request, params: raw, requestId, auth }) => {
  const { id } = parseOrThrow(params, raw);
  return ok(await mutateFact(getDb(), auth, id, await readJson(request)), requestId);
});
