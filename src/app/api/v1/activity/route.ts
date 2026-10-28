import { getDb } from "@/lib/db/client";
import { authed } from "@/lib/http/handler";
import { ok } from "@/lib/http/respond";
import { listRecentActivity } from "@/modules/audit/service";

export const GET = authed(async ({ request, requestId, auth }) => {
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 20) || 20;
  return ok(await listRecentActivity(getDb(), auth, limit), requestId);
});
