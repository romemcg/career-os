import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getConfig } from "@/lib/config/env";
import { disconnectDb, getDb } from "@/lib/db/client";
import { getStorage } from "@/lib/storage";
import { sha256 } from "@/lib/storage/local-storage";
import { createSource } from "@/modules/career/service";
import { deleteDocument, readDocument, uploadDocument } from "@/modules/documents/service";
import { makeOwner, resetDatabase } from "./helpers";

const db = () => getDb();
const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.4 ${text}`);

beforeEach(resetDatabase);
afterAll(disconnectDb);

describe("private document storage", () => {
  it("stores, retrieves and checksums the original bytes privately", async () => {
    const owner = await makeOwner();
    const bytes = pdf("master cv");
    const { document, duplicate } = await uploadDocument(db(), getStorage(), owner, {
      fileName: "../../Master CV.pdf",
      bytes,
    });
    expect(duplicate).toBe(false);
    expect(document.originalName).toBe("Master CV.pdf");
    expect(document.sha256).toBe(sha256(bytes));

    const read = await readDocument(db(), getStorage(), owner, document.id);
    expect(Buffer.compare(read.bytes, Buffer.from(bytes))).toBe(0);

    const stored = await db().document.findUniqueOrThrow({ where: { id: document.id } });
    expect(stored.storageKey).not.toContain("Master");
    const stat = await fs.stat(path.join(getConfig().documentsDir, stored.storageKey));
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("reuses an identical upload instead of duplicating it", async () => {
    const owner = await makeOwner();
    const first = await uploadDocument(db(), getStorage(), owner, { fileName: "a.pdf", bytes: pdf("same") });
    const second = await uploadDocument(db(), getStorage(), owner, { fileName: "b.pdf", bytes: pdf("same") });
    expect(second.duplicate).toBe(true);
    expect(second.document.id).toBe(first.document.id);
  });

  it("enforces size and type limits", async () => {
    const owner = await makeOwner();
    const big = new Uint8Array(getConfig().maxUploadBytes + 1);
    big.set(pdf("x"));
    await expect(uploadDocument(db(), getStorage(), owner, { fileName: "big.pdf", bytes: big })).rejects.toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
    });
    await expect(
      uploadDocument(db(), getStorage(), owner, { fileName: "cv.pdf", bytes: new TextEncoder().encode("<script>") }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });
    await expect(
      uploadDocument(db(), getStorage(), owner, { fileName: "empty.pdf", bytes: new Uint8Array() }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await db().document.count()).toBe(0);
  });

  it("detects tampering with stored files", async () => {
    const owner = await makeOwner();
    const { document } = await uploadDocument(db(), getStorage(), owner, { fileName: "cv.pdf", bytes: pdf("orig") });
    const stored = await db().document.findUniqueOrThrow({ where: { id: document.id } });
    await fs.writeFile(path.join(getConfig().documentsDir, stored.storageKey), pdf("edited"));
    await expect(readDocument(db(), getStorage(), owner, document.id)).rejects.toThrow(/integrity/);
  });

  it("deletes only with confirmation and only when no source cites it", async () => {
    const owner = await makeOwner();
    const { document } = await uploadDocument(db(), getStorage(), owner, { fileName: "cv.pdf", bytes: pdf("del") });
    const stored = await db().document.findUniqueOrThrow({ where: { id: document.id } });

    await expect(deleteDocument(db(), getStorage(), owner, document.id, false)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    await createSource(db(), owner, { sourceType: "document", title: "CV", documentId: document.id });
    await expect(deleteDocument(db(), getStorage(), owner, document.id, true)).rejects.toMatchObject({
      code: "CONFLICT",
    });

    const { document: loose } = await uploadDocument(db(), getStorage(), owner, { fileName: "x.pdf", bytes: pdf("x") });
    const looseStored = await db().document.findUniqueOrThrow({ where: { id: loose.id } });
    await deleteDocument(db(), getStorage(), owner, loose.id, true);
    expect(await getStorage().exists(looseStored.storageKey)).toBe(false);
    expect((await db().document.findUniqueOrThrow({ where: { id: loose.id } })).deletedAt).not.toBeNull();
    await expect(readDocument(db(), getStorage(), owner, loose.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await getStorage().exists(stored.storageKey)).toBe(true);
  });
});
