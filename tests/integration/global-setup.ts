import { execFileSync } from "node:child_process";
import { testDatabaseUrl } from "./test-env";

// Apply migrations to the test database once per run.
export default function setup() {
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
  });
}
