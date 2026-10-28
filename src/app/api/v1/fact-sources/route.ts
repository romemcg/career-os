import { getDb } from "@/lib/db/client";
import { authed, readJson } from "@/lib/http/handler";
import { withIdempotency } from "@/lib/http/idempotency";
import { ok } from "@/lib/http/respond";
import { createSource, listSources } from "@/modules/career/service";

export const GET = authed(async ({ requestId, auth }) => ok(await listSources(getDb(), auth), requestId));

export const POST = authed(async ({ request, auth }) => {
  const body = await readJson(request);
  return withIdempotency(getDb(), request, auth, "fact_source.create", body, () => createSource(getDb(), auth, body));
});
