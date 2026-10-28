import type { AuthContext } from "@/lib/auth/session";
import { getConfig } from "@/lib/config/env";
import type { Db } from "@/lib/db/client";
import { AppError, notFound } from "@/lib/http/errors";
import type { LocalFileStorage } from "@/lib/storage/local-storage";
import { sha256 } from "@/lib/storage/local-storage";
import { ALLOWED_TYPES, detectFileType, sanitizeFileName } from "@/lib/storage/file-types";
import { recordAudit } from "@/modules/audit/service";

export const documentSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  sha256: true,
  sizeBytes: true,
  createdAt: true,
} as const;

export type DocumentDto = {
  id: string;
  originalName: string;
  mimeType: string;
  sha256: string;
  sizeBytes: number;
  createdAt: Date;
};

export async function uploadDocument(
  db: Db,
  storage: LocalFileStorage,
  ctx: AuthContext,
  input: { fileName: string; bytes: Uint8Array },
): Promise<{ document: DocumentDto; duplicate: boolean }> {
  const { maxUploadBytes } = getConfig();
  if (input.bytes.byteLength === 0) throw new AppError("VALIDATION_ERROR", "File is empty");
  if (input.bytes.byteLength > maxUploadBytes) {
    throw new AppError("PAYLOAD_TOO_LARGE", `File exceeds ${Math.round(maxUploadBytes / 1024 / 1024)} MB limit`);
  }
  const originalName = sanitizeFileName(input.fileName);
  const type = detectFileType(input.bytes, originalName);
  if (!type) {
    throw new AppError(
      "UNSUPPORTED_MEDIA_TYPE",
      `Unsupported or mismatched file type. Allowed: ${ALLOWED_TYPES.map((t) => t.label).join(", ")}`,
    );
  }

  // Identical content already stored: reuse the original rather than duplicating it.
  const checksum = sha256(input.bytes);
  const existing = await db.document.findFirst({
    where: { ownerId: ctx.ownerId, sha256: checksum, deletedAt: null },
    select: documentSelect,
  });
  if (existing) return { document: existing, duplicate: true };

  const stored = await storage.put(input.bytes);
  try {
    const document = await db.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          ownerId: ctx.ownerId,
          storageKey: stored.storageKey,
          originalName,
          mimeType: type.mime,
          sha256: stored.sha256,
          sizeBytes: stored.sizeBytes,
        },
        select: documentSelect,
      });
      await recordAudit(tx, ctx, {
        action: "document.uploaded",
        entityType: "document",
        entityId: created.id,
        metadata: { mimeType: type.mime, sizeBytes: stored.sizeBytes },
      });
      return created;
    });
    return { document, duplicate: false };
  } catch (error) {
    await storage.delete(stored.storageKey);
    throw error;
  }
}

export async function listDocuments(db: Db, ctx: AuthContext) {
  return db.document.findMany({
    where: { ownerId: ctx.ownerId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: documentSelect,
    take: 200,
  });
}

/** Read a document's bytes and verify them against the stored checksum. */
export async function readDocument(db: Db, storage: LocalFileStorage, ctx: AuthContext, id: string) {
  const document = await db.document.findFirst({ where: { id, ownerId: ctx.ownerId, deletedAt: null } });
  if (!document) throw notFound("Document");
  const bytes = await storage.get(document.storageKey).catch(() => {
    throw new AppError("INTERNAL_ERROR", "Stored file is missing");
  });
  if (sha256(bytes) !== document.sha256) {
    throw new AppError("INTERNAL_ERROR", "Stored file failed its integrity check");
  }
  return { document, bytes };
}

/** Delete a document that no fact source references. Requires explicit confirmation. */
export async function deleteDocument(
  db: Db,
  storage: LocalFileStorage,
  ctx: AuthContext,
  id: string,
  confirm: boolean,
) {
  if (!confirm) throw new AppError("VALIDATION_ERROR", "Deletion must be confirmed");
  const document = await db.document.findFirst({
    where: { id, ownerId: ctx.ownerId, deletedAt: null },
    include: { _count: { select: { sources: true } } },
  });
  if (!document) throw notFound("Document");
  if (document._count.sources > 0) {
    throw new AppError("CONFLICT", "Document is cited by a fact source and cannot be deleted");
  }
  await db.$transaction(async (tx) => {
    await tx.document.update({ where: { id }, data: { deletedAt: new Date() } });
    await recordAudit(tx, ctx, {
      action: "document.deleted",
      entityType: "document",
      entityId: id,
      metadata: { sha256: document.sha256 },
    });
  });
  // Remove bytes after the record is marked deleted; the metadata row is retained for audit.
  await storage.delete(document.storageKey);
}
