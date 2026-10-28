import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { authed } from "@/lib/http/handler";
import { ok } from "@/lib/http/respond";
import { getStorage } from "@/lib/storage";
import { parseOrThrow } from "@/lib/validation";
import { deleteDocument, readDocument } from "@/modules/documents/service";

const params = z.object({ id: z.uuid() });

// Streams the original file to the authenticated owner. Always served as an
// attachment so uploaded content is never rendered in the application origin.
export const GET = authed<{ id: string }>(async ({ params: raw, auth, requestId }) => {
  const { id } = parseOrThrow(params, raw);
  const { document, bytes } = await readDocument(getDb(), getStorage(), auth, id);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": document.mimeType,
      "content-length": String(bytes.byteLength),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-request-id": requestId,
    },
  });
});

// DELETE /api/v1/documents/:id?confirm=true
export const DELETE = authed<{ id: string }>(async ({ request, params: raw, requestId, auth }) => {
  const { id } = parseOrThrow(params, raw);
  const confirm = request.nextUrl.searchParams.get("confirm") === "true";
  await deleteDocument(getDb(), getStorage(), auth, id, confirm);
  return ok({ deleted: true }, requestId);
});
