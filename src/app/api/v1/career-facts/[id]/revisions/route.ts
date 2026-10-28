import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { authed } from "@/lib/http/handler";
import { ok } from "@/lib/http/respond";
import { parseOrThrow } from "@/lib/validation";
import { listFactRevisions } from "@/modules/career/service";

const params = z.object({ id: z.uuid() });

export const GET = authed<{ id: string }>(async ({ params: raw, requestId, auth }) => {
  const { id } = parseOrThrow(params, raw);
  return ok(await listFactRevisions(getDb(), auth, id), requestId);
});
