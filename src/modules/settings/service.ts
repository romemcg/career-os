import type { AuthContext } from "@/lib/auth/session";
import { getConfig } from "@/lib/config/env";
import type { Db } from "@/lib/db/client";

export async function getAccountSummary(db: Db, ctx: AuthContext) {
  const [user, activeSessions, documents] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: ctx.ownerId }, select: { email: true } }),
    db.session.count({ where: { userId: ctx.ownerId, revokedAt: null, expiresAt: { gt: new Date() } } }),
    db.document.aggregate({
      where: { ownerId: ctx.ownerId, deletedAt: null },
      _count: { _all: true },
      _sum: { sizeBytes: true },
    }),
  ]);
  return {
    email: user.email,
    activeSessions,
    documentCount: documents._count._all,
    documentBytes: documents._sum.sizeBytes ?? 0,
    dataDir: getConfig().dataDir,
  };
}
