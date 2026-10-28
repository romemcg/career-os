import { getConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { AppError } from "@/lib/http/errors";
import { authed } from "@/lib/http/handler";
import { ok } from "@/lib/http/respond";
import { getStorage } from "@/lib/storage";
import { uploadDocument } from "@/modules/documents/service";

export const POST = authed(async ({ request, requestId, auth }) => {
  // Reject oversized bodies before buffering them (allow for multipart overhead).
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > getConfig().maxUploadBytes + 64 * 1024) {
    throw new AppError("PAYLOAD_TOO_LARGE", "File exceeds the upload limit");
  }
  const form = await request.formData().catch(() => {
    throw new AppError("VALIDATION_ERROR", "Expected multipart/form-data with a 'file' field");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "A 'file' field is required");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await uploadDocument(getDb(), getStorage(), auth, { fileName: file.name, bytes });
  return ok(result.document, requestId, {
    status: result.duplicate ? 200 : 201,
    meta: { duplicate: result.duplicate },
  });
});
