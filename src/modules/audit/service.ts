import type { ActorType, Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import type { Db, Tx } from "@/lib/db/client";

export type AuditEntry = {
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Prisma.InputJsonObject;
  actorType?: ActorType;
};

/** Record an owner action. Call inside the same transaction as the change. */
export function recordAudit(tx: Tx | Db, ctx: AuthContext, entry: AuditEntry) {
  return tx.auditLog.create({
    data: {
      ownerId: ctx.ownerId,
      actorType: entry.actorType ?? "owner",
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: entry.metadata ?? {},
      requestId: ctx.requestId,
    },
  });
}

export async function listRecentActivity(db: Db, ctx: AuthContext, limit = 20) {
  return db.auditLog.findMany({
    where: { ownerId: ctx.ownerId, action: { notIn: ["auth.login_failed"] } },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: { id: true, action: true, entityType: true, entityId: true, createdAt: true, actorType: true },
  });
}
