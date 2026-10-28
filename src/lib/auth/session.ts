import type { Db } from "@/lib/db/client";
import { getConfig } from "@/lib/config/env";
import { AppError } from "@/lib/http/errors";
import { hashPassword, verifyPassword } from "./password";
import { generateSessionToken, hashToken } from "./tokens";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export type AuthContext = {
  ownerId: string;
  sessionId: string;
  requestId?: string;
};

// Used to keep login timing similar whether or not the email exists.
let dummyHash: Promise<string> | undefined;

export async function login(
  db: Db,
  input: { email: string; password: string; userAgent?: string | null; requestId?: string },
  now = new Date(),
): Promise<{ token: string; expiresAt: Date; ownerId: string }> {
  const email = input.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  if (!user) {
    dummyHash ??= hashPassword("careeros-timing-equaliser");
    await verifyPassword(input.password, await dummyHash);
    throw new AppError("UNAUTHENTICATED", "Invalid email or password");
  }

  if (user.lockedUntil && user.lockedUntil > now) {
    throw new AppError("RATE_LIMITED", "Too many failed attempts. Try again later.");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    const failures = user.failedLoginCount + 1;
    const locked = failures >= MAX_FAILED_LOGINS;
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: locked ? 0 : failures,
          lockedUntil: locked ? new Date(now.getTime() + LOCKOUT_MS) : user.lockedUntil,
        },
      }),
      db.auditLog.create({
        data: {
          ownerId: user.id,
          actorType: "owner",
          action: locked ? "auth.locked" : "auth.login_failed",
          entityType: "user",
          entityId: user.id,
          requestId: input.requestId,
        },
      }),
    ]);
    throw new AppError("UNAUTHENTICATED", "Invalid email or password");
  }

  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + getConfig().sessionTtlMs);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } }),
    db.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      },
    }),
    db.auditLog.create({
      data: {
        ownerId: user.id,
        actorType: "owner",
        action: "auth.login",
        entityType: "user",
        entityId: user.id,
        requestId: input.requestId,
      },
    }),
  ]);
  return { token, expiresAt, ownerId: user.id };
}

/** Resolve a raw session token to an auth context, or null if invalid. */
export async function validateSession(
  db: Db,
  token: string | undefined | null,
  now = new Date(),
): Promise<AuthContext | null> {
  if (!token || token.length > 200) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, passwordChangedAt: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt <= now) return null;
  // Sessions issued before a password change are invalid.
  if (session.createdAt < session.user.passwordChangedAt) return null;

  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  return { ownerId: session.user.id, sessionId: session.id };
}

export async function logout(db: Db, ctx: AuthContext): Promise<void> {
  await db.$transaction([
    db.session.update({ where: { id: ctx.sessionId }, data: { revokedAt: new Date() } }),
    db.auditLog.create({
      data: {
        ownerId: ctx.ownerId,
        actorType: "owner",
        action: "auth.logout",
        entityType: "session",
        entityId: ctx.sessionId,
        requestId: ctx.requestId,
      },
    }),
  ]);
}
