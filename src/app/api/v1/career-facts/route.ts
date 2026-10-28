import { getDb } from "@/lib/db/client";
import { authed, readJson } from "@/lib/http/handler";
import { withIdempotency } from "@/lib/http/idempotency";
import { ok } from "@/lib/http/respond";
import { createFact, listFacts } from "@/modules/career/service";

export const GET = authed(async ({ request, requestId, auth }) => {
  const query = Object.fromEntries(request.nextUrl.searchParams);
  const result = await listFacts(getDb(), auth, query);
  return ok(result.items, requestId, { meta: { nextCursor: result.nextCursor } });
});

export const POST = authed(async ({ request, auth }) => {
  const body = await readJson(request);
  return withIdempotency(getDb(), request, auth, "career_fact.create", body, () => createFact(getDb(), auth, body));
});
