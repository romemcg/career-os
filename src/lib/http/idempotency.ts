import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import type { Db } from "@/lib/db/client";
import { AppError } from "./errors";
import { ok } from "./respond";

const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/;

/**
 * Replays the stored response when a create request is retried with the same
 * Idempotency-Key. Without the header the operation simply runs.
 */
export async function withIdempotency<T>(
  db: Db,
  request: NextRequest,
  ctx: AuthContext,
  operation: string,
  body: unknown,
  run: () => Promise<T>,
  status = 201,
) {
  const requestId = ctx.requestId ?? "";
  const key = request.headers.get("idempotency-key");
  if (!key) return ok(await run(), requestId, { status });
  if (!KEY_PATTERN.test(key)) {
    throw new AppError("VALIDATION_ERROR", "Idempotency-Key must be 8-128 URL-safe characters");
  }
  const requestHash = createHash("sha256")
    .update(JSON.stringify(body ?? null))
    .digest("hex");
  const where = { ownerId_operation_key: { ownerId: ctx.ownerId, operation, key } };

  const existing = await db.idempotencyKey.findUnique({ where });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new AppError("IDEMPOTENCY_KEY_REUSED", "Idempotency-Key was used with a different request");
    }
    return ok(existing.responseBody, requestId, { status: existing.responseStatus, meta: { replayed: true } });
  }

  const data = await run();
  try {
    await db.idempotencyKey.create({
      data: {
        ownerId: ctx.ownerId,
        operation,
        key,
        requestHash,
        responseStatus: status,
        responseBody: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    // A concurrent retry stored its result first; report the conflict rather than duplicate silently.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("CONFLICT", "A concurrent request with this Idempotency-Key is in progress");
    }
    throw error;
  }
  return ok(data, requestId, { status });
}
