import { getDb } from "@/lib/db/client";
import { authed, readJson } from "@/lib/http/handler";
import { ok } from "@/lib/http/respond";
import { getProfile, updateProfile } from "@/modules/career/service";

export const GET = authed(async ({ requestId, auth }) => ok(await getProfile(getDb(), auth), requestId));

export const PATCH = authed(async ({ request, requestId, auth }) =>
  ok(await updateProfile(getDb(), auth, await readJson(request)), requestId),
);
