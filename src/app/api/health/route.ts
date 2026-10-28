import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config/env";
import { getDb } from "@/lib/db/client";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Readiness probe. Reports component status only; never configuration values.
export async function GET() {
  const checks: Record<string, "ok" | "error"> = { config: "ok", database: "ok", storage: "ok" };
  try {
    getConfig();
  } catch {
    checks.config = "error";
  }
  try {
    await getDb().$queryRaw`SELECT 1`;
  } catch {
    checks.database = "error";
  }
  try {
    const fs = await import("node:fs/promises");
    await fs.mkdir(getConfig().documentsDir, { recursive: true, mode: 0o700 });
    await fs.access(getConfig().documentsDir, (await import("node:fs")).constants.W_OK);
    void getStorage();
  } catch {
    checks.storage = "error";
  }
  const healthy = Object.values(checks).every((value) => value === "ok");
  return NextResponse.json({ status: healthy ? "ok" : "degraded", checks }, { status: healthy ? 200 : 503 });
}
