import os from "node:os";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CAREEROS_DATA_DIR: z.string().optional(),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(24 * 30)
    .default(12),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(200).default(20),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppConfig = {
  databaseUrl: string;
  dataDir: string;
  documentsDir: string;
  sessionTtlMs: number;
  maxUploadBytes: number;
  isProduction: boolean;
};

export function defaultDataDir(platform = process.platform, home = os.homedir()): string {
  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "CareerOS");
  }
  return path.join(home, ".local", "share", "careeros");
}

let cached: AppConfig | undefined;

export function getConfig(): AppConfig {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Report variable names only; values may be secrets.
    const names = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid configuration: ${names}`);
  }
  const env = parsed.data;
  // The data directory lives outside the project; exclude it from build tracing.
  const dataDir = path.resolve(/*turbopackIgnore: true*/ env.CAREEROS_DATA_DIR || defaultDataDir());
  cached = {
    databaseUrl: env.DATABASE_URL,
    dataDir,
    documentsDir: path.join(dataDir, "documents"),
    sessionTtlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
    isProduction: env.NODE_ENV === "production",
  };
  return cached;
}

/** Test helper: forget cached configuration after changing process.env. */
export function resetConfigCache(): void {
  cached = undefined;
}
