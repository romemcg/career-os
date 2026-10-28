import { describe, expect, it } from "vitest";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { generateSessionToken, hashToken } from "@/lib/auth/tokens";

describe("password hashing", () => {
  it("verifies the correct password and rejects others", async () => {
    const hash = await hashPassword("a-very-long-password");
    expect(hash).toMatch(/^scrypt\$/);
    expect(hash).not.toContain("a-very-long-password");
    expect(await verifyPassword("a-very-long-password", hash)).toBe(true);
    expect(await verifyPassword("a-very-long-passwore", hash)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same-password-123")).not.toEqual(await hashPassword("same-password-123"));
  });

  it("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("anything", "md5$abc")).toBe(false);
  });

  it("enforces a minimum length", () => {
    expect(validatePasswordStrength("short")).toMatch(/at least 12/);
    expect(validatePasswordStrength("long-enough-password")).toBeNull();
  });
});

describe("session tokens", () => {
  it("are random and stored only as a hash", () => {
    const a = generateSessionToken();
    expect(a).not.toEqual(generateSessionToken());
    expect(a.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
  });
});
