import { getConfig } from "@/lib/config/env";
import { LocalFileStorage } from "./local-storage";

let storage: LocalFileStorage | undefined;

export function getStorage(): LocalFileStorage {
  storage ??= new LocalFileStorage(getConfig().documentsDir);
  return storage;
}
