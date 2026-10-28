// Usage: pnpm owner:reset-password  (revokes all existing sessions)
import "dotenv/config";
import { resetOwnerPassword } from "@/lib/auth/owner";
import { disconnectDb, getDb } from "@/lib/db/client";
import { AppError } from "@/lib/http/errors";
import { ask } from "./prompt";

async function main() {
  const email = await ask("Owner email: ", { env: "CAREEROS_OWNER_EMAIL" });
  const password = await ask("New password (min 12 characters): ", { env: "CAREEROS_OWNER_PASSWORD", secret: true });
  if (!process.env.CAREEROS_OWNER_PASSWORD) {
    const confirm = await ask("Confirm password: ", { secret: true });
    if (confirm !== password) throw new AppError("VALIDATION_ERROR", "Passwords do not match");
  }
  await resetOwnerPassword(getDb(), email, password);
  console.log("Password updated. All sessions have been signed out.");
}

main()
  .catch((error) => {
    console.error(error instanceof AppError ? `Error: ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
