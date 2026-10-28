import { execFileSync } from "node:child_process";
import "dotenv/config";
import { E2E_OWNER } from "./owner";

// Fresh test database with a single owner, created through the real CLI script.
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL };
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "pipe" });
  execFileSync(
    "psql",
    [
      env.DATABASE_URL as string,
      "-c",
      "TRUNCATE TABLE idempotency_keys, audit_logs, career_fact_revisions, career_facts, fact_sources, documents, career_profiles, sessions, users CASCADE",
    ],
    { stdio: "pipe" },
  );
  execFileSync("npx", ["tsx", "scripts/owner/create-owner.ts"], {
    env: { ...env, CAREEROS_OWNER_EMAIL: E2E_OWNER.email, CAREEROS_OWNER_PASSWORD: E2E_OWNER.password },
    stdio: "pipe",
  });
}
