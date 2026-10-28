// Usage: pnpm owner:create
// Non-interactive: CAREEROS_OWNER_EMAIL=... CAREEROS_OWNER_PASSWORD=... pnpm owner:create
import "dotenv/config";
import { createOwner } from "@/lib/auth/owner";
import { disconnectDb, getDb } from "@/lib/db/client";
import { AppError } from "@/lib/http/errors";
import { ask } from "./prompt";

async function main() {
  const email = await ask("Owner email: ", { env: "CAREEROS_OWNER_EMAIL" });
  const password = await ask("Password (min 12 characters): ", { env: "CAREEROS_OWNER_PASSWORD", secret: true });
  if (!process.env.CAREEROS_OWNER_PASSWORD) {
    const confirm = await ask("Confirm password: ", { secret: true });
    if (confirm !== password) throw new AppError("VALIDATION_ERROR", "Passwords do not match");
  }
  const user = await createOwner(getDb(), email, password);
  console.log(`Owner account created for ${user.email}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof AppError ? `Error: ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
