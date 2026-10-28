import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

export type StoredObject = { storageKey: string; sha256: string; sizeBytes: number };

/**
 * Private filesystem storage. Storage keys are generated server-side and never
 * derived from user input, so original filenames cannot influence paths.
 */
export class LocalFileStorage {
  constructor(private readonly root: string) {}

  private resolve(storageKey: string): string {
    if (!/^[0-9]{4}\/[0-9]{2}\/[0-9a-f-]{36}$/.test(storageKey)) {
      throw new Error("Invalid storage key");
    }
    const full = path.resolve(this.root, storageKey);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(bytes: Uint8Array, now = new Date()): Promise<StoredObject> {
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const storageKey = `${yyyy}/${mm}/${randomUUID()}`;
    const target = this.resolve(storageKey);
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    const temp = `${target}.partial`;
    // Write to a temp file then rename, so a crash never leaves a half-written object.
    await fs.writeFile(temp, bytes, { mode: 0o600, flag: "wx" });
    await fs.rename(temp, target);
    return { storageKey, sha256: sha256(bytes), sizeBytes: bytes.byteLength };
  }

  async get(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.resolve(storageKey));
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(storageKey), constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async delete(storageKey: string): Promise<void> {
    await fs.rm(this.resolve(storageKey), { force: true });
  }
}

export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
