import { getDb } from "@/lib/db/client";
import { authed } from "@/lib/http/handler";
import { ok } from "@/lib/http/respond";
import { listDocuments } from "@/modules/documents/service";

export const GET = authed(async ({ requestId, auth }) => ok(await listDocuments(getDb(), auth), requestId));
