import type { Db } from "@/lib/db/client";
import { AppError } from "@/lib/http/errors";
import { hashPassword, validatePasswordStrength } from "./password";

/**
 * Create the single owner account. CareerOS has no public registration; this is
 * only reachable from the command-line script.
 */
export async function createOwner(db: Db, email: string, password: string) {
  const problem = validatePasswordStrength(password);
  if (problem) throw new AppError("VALIDATION_ERROR", problem);
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new AppError("VALIDATION_ERROR", "A valid email is required");
  }
  if ((await db.user.count()) > 0) {
    throw new AppError("CONFLICT", "An owner account already exists");
  }
  const passwordHash = await hashPassword(password);
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: normalized, passwordHash } });
    await tx.careerProfile.create({ data: { ownerId: user.id } });
    await tx.auditLog.create({
      data: { ownerId: user.id, actorType: "system", action: "owner.created", entityType: "user", entityId: user.id },
    });
    return user;
  });
}

export async function resetOwnerPassword(db: Db, email: string, password: string) {
  const problem = validatePasswordStrength(password);
  if (problem) throw new AppError("VALIDATION_ERROR", problem);
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new AppError("NOT_FOUND", "No owner with that email");
  const passwordHash = await hashPassword(password);
  const now = new Date();
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: now, failedLoginCount: 0, lockedUntil: null },
    }),
    // Revoke every existing session.
    db.session.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: now } }),
    db.auditLog.create({
      data: {
        ownerId: user.id,
        actorType: "system",
        action: "owner.password_reset",
        entityType: "user",
        entityId: user.id,
      },
    }),
  ]);
}
