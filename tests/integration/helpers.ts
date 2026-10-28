import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import type { AuthContext } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { createSource } from "@/modules/career/service";

export const PASSWORD = "integration-password-1";

export async function resetDatabase() {
  await getDb().$executeRawUnsafe(
    `TRUNCATE TABLE idempotency_keys, audit_logs, career_fact_revisions, career_facts, fact_sources, documents, career_profiles, sessions, users CASCADE`,
  );
}

let cachedHash: string | undefined;

/** Insert an owner directly (the public API refuses a second owner). */
export async function makeOwner(email = `owner-${randomUUID()}@example.com`): Promise<AuthContext & { email: string }> {
  cachedHash ??= await hashPassword(PASSWORD);
  const user = await getDb().user.create({ data: { email, passwordHash: cachedHash, profile: { create: {} } } });
  return { ownerId: user.id, sessionId: randomUUID(), email };
}

export function makeSource(ctx: AuthContext, title = "Master CV") {
  return createSource(getDb(), ctx, { sourceType: "reference", title, reference: "CV v3, page 1" });
}

export const employment = {
  organization: "Example Utilities",
  title: "Technical Product Owner",
  startDate: "2021-03",
};
