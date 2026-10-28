import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createOwner, resetOwnerPassword } from "@/lib/auth/owner";
import { LOCKOUT_MS, MAX_FAILED_LOGINS, login, logout, validateSession } from "@/lib/auth/session";
import { disconnectDb, getDb } from "@/lib/db/client";
import { AppError } from "@/lib/http/errors";
import { PASSWORD, makeOwner, resetDatabase } from "./helpers";

const db = () => getDb();

beforeEach(resetDatabase);
afterAll(disconnectDb);

describe("owner provisioning", () => {
  it("creates exactly one owner with a profile and refuses a second", async () => {
    const user = await createOwner(db(), "Me@Example.com ", "a-strong-password");
    expect(user.email).toBe("me@example.com");
    expect(await db().careerProfile.count({ where: { ownerId: user.id } })).toBe(1);
    await expect(createOwner(db(), "other@example.com", "a-strong-password")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("rejects weak passwords", async () => {
    await expect(createOwner(db(), "me@example.com", "short")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe("login and sessions", () => {
  it("issues a session that validates, and stores only its hash", async () => {
    const owner = await makeOwner();
    const result = await login(db(), { email: owner.email.toUpperCase(), password: PASSWORD });
    const auth = await validateSession(db(), result.token);
    expect(auth?.ownerId).toBe(owner.ownerId);
    const stored = await db().session.findFirstOrThrow({ where: { userId: owner.ownerId } });
    expect(stored.tokenHash).not.toBe(result.token);
  });

  it("gives the same error for unknown email and wrong password", async () => {
    const owner = await makeOwner();
    const unknown = await login(db(), { email: "nobody@example.com", password: PASSWORD }).catch((e) => e);
    const wrong = await login(db(), { email: owner.email, password: "wrong-password!!" }).catch((e) => e);
    expect(unknown).toBeInstanceOf(AppError);
    expect(unknown.message).toBe(wrong.message);
    expect(unknown.code).toBe("UNAUTHENTICATED");
  });

  it("locks the account after repeated failures, even for the correct password", async () => {
    const owner = await makeOwner();
    const now = new Date();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await login(db(), { email: owner.email, password: "wrong-password!!" }, now).catch(() => undefined);
    }
    await expect(login(db(), { email: owner.email, password: PASSWORD }, now)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    const later = new Date(now.getTime() + LOCKOUT_MS + 1000);
    await expect(login(db(), { email: owner.email, password: PASSWORD }, later)).resolves.toHaveProperty("token");
    expect(await db().auditLog.count({ where: { ownerId: owner.ownerId, action: "auth.locked" } })).toBe(1);
  });

  it("rejects missing, unknown, expired and revoked sessions", async () => {
    const owner = await makeOwner();
    expect(await validateSession(db(), undefined)).toBeNull();
    expect(await validateSession(db(), "not-a-real-token")).toBeNull();

    const { token, expiresAt } = await login(db(), { email: owner.email, password: PASSWORD });
    expect(await validateSession(db(), token, new Date(expiresAt.getTime() + 1))).toBeNull();

    const auth = await validateSession(db(), token);
    await logout(db(), auth!);
    expect(await validateSession(db(), token)).toBeNull();
  });

  it("revokes all sessions on password reset", async () => {
    const owner = await makeOwner();
    const { token } = await login(db(), { email: owner.email, password: PASSWORD });
    await resetOwnerPassword(db(), owner.email, "a-brand-new-password");
    expect(await validateSession(db(), token)).toBeNull();
    await expect(login(db(), { email: owner.email, password: PASSWORD })).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(login(db(), { email: owner.email, password: "a-brand-new-password" })).resolves.toHaveProperty(
      "token",
    );
  });
});
