import type { CareerFact, Prisma } from "@/generated/prisma/client";
import type { AuthContext } from "@/lib/auth/session";
import type { Db, Tx } from "@/lib/db/client";
import { AppError, notFound } from "@/lib/http/errors";
import { parseOrThrow } from "@/lib/validation";
import { recordAudit } from "@/modules/audit/service";
import {
  CONTENT_SCHEMA_VERSION,
  contentSchemas,
  createFactInput,
  createSourceInput,
  type FactMutationInput,
  factMutationInput,
  type FactTypeName,
  listFactsQuery,
  updateProfileInput,
} from "./schemas";
import { nextVerificationStatus, statusAfterEdit } from "./verification";

// ---------------------------------------------------------------- profile

export async function getProfile(db: Db, ctx: AuthContext) {
  const profile = await db.careerProfile.findUnique({ where: { ownerId: ctx.ownerId } });
  if (profile) return profile;
  // The profile is created with the owner; recreate defensively if missing.
  return db.careerProfile.create({ data: { ownerId: ctx.ownerId } });
}

export async function updateProfile(db: Db, ctx: AuthContext, rawInput: unknown) {
  const input = parseOrThrow(updateProfileInput, rawInput);
  const { revision, ...changes } = input;
  return db.$transaction(async (tx) => {
    // Optimistic concurrency: only update if the client saw the latest revision.
    const result = await tx.careerProfile.updateMany({
      where: { ownerId: ctx.ownerId, revision },
      data: { ...changes, revision: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new AppError("REVISION_CONFLICT", "Profile was changed elsewhere. Reload and try again.");
    }
    const profile = await tx.careerProfile.findUniqueOrThrow({ where: { ownerId: ctx.ownerId } });
    await recordAudit(tx, ctx, {
      action: "profile.updated",
      entityType: "career_profile",
      entityId: profile.id,
      metadata: { fields: Object.keys(changes), revision: profile.revision },
    });
    return profile;
  });
}

// ---------------------------------------------------------------- sources

const sourceSelect = {
  id: true,
  sourceType: true,
  title: true,
  reference: true,
  notes: true,
  createdAt: true,
  document: { select: { id: true, originalName: true, mimeType: true, sha256: true, sizeBytes: true } },
  _count: { select: { facts: true } },
} as const;

export async function listSources(db: Db, ctx: AuthContext) {
  return db.factSource.findMany({
    where: { ownerId: ctx.ownerId },
    orderBy: { createdAt: "desc" },
    select: sourceSelect,
    take: 500,
  });
}

export async function createSource(db: Db, ctx: AuthContext, rawInput: unknown) {
  const input = parseOrThrow(createSourceInput, rawInput);
  return db.$transaction(async (tx) => {
    if (input.documentId) {
      const document = await tx.document.findFirst({
        where: { id: input.documentId, ownerId: ctx.ownerId, deletedAt: null },
        select: { id: true },
      });
      if (!document) throw notFound("Document");
    }
    const source = await tx.factSource.create({
      data: {
        ownerId: ctx.ownerId,
        sourceType: input.sourceType,
        title: input.title,
        documentId: input.documentId ?? null,
        reference: input.reference,
        notes: input.notes,
      },
      select: sourceSelect,
    });
    await recordAudit(tx, ctx, {
      action: "fact_source.created",
      entityType: "fact_source",
      entityId: source.id,
      metadata: { sourceType: input.sourceType },
    });
    return source;
  });
}

async function assertOwnSource(tx: Tx, ctx: AuthContext, sourceId: string | null | undefined) {
  if (!sourceId) return;
  const source = await tx.factSource.findFirst({ where: { id: sourceId, ownerId: ctx.ownerId }, select: { id: true } });
  if (!source) throw notFound("Source");
}

// ---------------------------------------------------------------- facts

export function validateContent(factType: FactTypeName, content: unknown) {
  return parseOrThrow(contentSchemas[factType], content) as Prisma.InputJsonObject;
}

const factInclude = {
  source: { select: sourceSelect },
  supersedes: { select: { id: true, factType: true, contentJson: true, verificationStatus: true } },
  supersededBy: { select: { id: true, verificationStatus: true } },
} as const;

export type FactWithRelations = Prisma.CareerFactGetPayload<{ include: typeof factInclude }>;

function writeRevision(tx: Tx, ctx: AuthContext, fact: CareerFact, changeType: string, note?: string | null) {
  return tx.careerFactRevision.create({
    data: {
      factId: fact.id,
      ownerId: ctx.ownerId,
      revision: fact.revision,
      changeType,
      contentJson: fact.contentJson as Prisma.InputJsonValue,
      verificationStatus: fact.verificationStatus,
      sourceId: fact.sourceId,
      note: note ?? null,
      actorType: "owner",
    },
  });
}

export async function createFact(db: Db, ctx: AuthContext, rawInput: unknown) {
  const input = parseOrThrow(createFactInput, rawInput);
  const content = validateContent(input.factType, input.content);
  return db.$transaction(async (tx) => {
    await assertOwnSource(tx, ctx, input.sourceId);
    if (input.supersedesFactId) {
      const target = await tx.careerFact.findFirst({
        where: { id: input.supersedesFactId, ownerId: ctx.ownerId },
        select: { verificationStatus: true, factType: true },
      });
      if (!target) throw notFound("Fact to supersede");
      if (target.verificationStatus !== "verified") {
        throw new AppError("INVALID_TRANSITION", "Only verified facts can be superseded");
      }
      if (target.factType !== input.factType) {
        throw new AppError("VALIDATION_ERROR", "A replacement fact must have the same type");
      }
    }
    // Every new fact starts unverified, whatever the client sends.
    const fact = await tx.careerFact.create({
      data: {
        ownerId: ctx.ownerId,
        factType: input.factType,
        contentJson: content,
        contentSchemaVersion: CONTENT_SCHEMA_VERSION,
        verificationStatus: "unverified",
        sourceId: input.sourceId ?? null,
        supersedesFactId: input.supersedesFactId ?? null,
      },
    });
    await writeRevision(tx, ctx, fact, "created");
    await recordAudit(tx, ctx, {
      action: "career_fact.created",
      entityType: "career_fact",
      entityId: fact.id,
      metadata: { factType: fact.factType, supersedesFactId: fact.supersedesFactId },
    });
    return tx.careerFact.findUniqueOrThrow({ where: { id: fact.id }, include: factInclude });
  });
}

export async function getFact(db: Db, ctx: AuthContext, id: string) {
  const fact = await db.careerFact.findFirst({ where: { id, ownerId: ctx.ownerId }, include: factInclude });
  if (!fact) throw notFound("Fact");
  return fact;
}

export async function listFacts(db: Db, ctx: AuthContext, rawQuery: unknown) {
  const query = parseOrThrow(listFactsQuery, rawQuery);
  const where: Prisma.CareerFactWhereInput = {
    ownerId: ctx.ownerId,
    ...(query.status ? { verificationStatus: query.status } : {}),
    ...(query.type ? { factType: query.type } : {}),
  };
  if (query.q) {
    // Search JSON content as text. Adequate for a single owner's fact library.
    const ids = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM career_facts
      WHERE owner_id = ${ctx.ownerId}::uuid AND content_json::text ILIKE ${`%${query.q.replace(/[\\%_]/g, "\\$&")}%`}`;
    where.id = { in: ids.map((row) => row.id) };
  }
  // Cursor pagination with a stable order (created_at desc, id desc).
  const items = await db.careerFact.findMany({
    where,
    include: factInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > query.limit;
  const page = hasMore ? items.slice(0, query.limit) : items;
  return { items: page, nextCursor: hasMore ? page[page.length - 1].id : null };
}

export async function countFactsByStatus(db: Db, ctx: AuthContext) {
  const groups = await db.careerFact.groupBy({
    by: ["verificationStatus"],
    where: { ownerId: ctx.ownerId },
    _count: { _all: true },
  });
  const counts = { unverified: 0, verified: 0, rejected: 0, superseded: 0 };
  for (const group of groups) counts[group.verificationStatus] = group._count._all;
  return counts;
}

export async function listFactRevisions(db: Db, ctx: AuthContext, factId: string) {
  const fact = await db.careerFact.findFirst({ where: { id: factId, ownerId: ctx.ownerId }, select: { id: true } });
  if (!fact) throw notFound("Fact");
  return db.careerFactRevision.findMany({
    where: { factId, ownerId: ctx.ownerId },
    orderBy: { revision: "desc" },
    include: { source: { select: { id: true, title: true, sourceType: true } } },
  });
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function mutateFact(db: Db, ctx: AuthContext, factId: string, rawInput: unknown) {
  const input: FactMutationInput = parseOrThrow(factMutationInput, rawInput);
  return db.$transaction(async (tx) => {
    // Lock the row so concurrent mutations serialise on the revision check.
    await tx.$queryRaw`SELECT id FROM career_facts WHERE id = ${factId}::uuid AND owner_id = ${ctx.ownerId}::uuid FOR UPDATE`;
    const fact = await tx.careerFact.findFirst({ where: { id: factId, ownerId: ctx.ownerId } });
    if (!fact) throw notFound("Fact");
    if (fact.revision !== input.revision) {
      throw new AppError("REVISION_CONFLICT", "Fact was changed elsewhere. Reload and try again.");
    }

    let data: Prisma.CareerFactUpdateInput;
    let changeType: string;
    let note: string | undefined;

    switch (input.action) {
      case "edit": {
        const content = input.content ? validateContent(fact.factType, input.content) : undefined;
        const contentChanged = content !== undefined && !sameJson(content, fact.contentJson);
        const sourceChanged = input.sourceId !== undefined && input.sourceId !== fact.sourceId;
        if (!contentChanged && !sourceChanged) {
          throw new AppError("VALIDATION_ERROR", "No changes to save");
        }
        if (sourceChanged) await assertOwnSource(tx, ctx, input.sourceId);
        const status = statusAfterEdit(fact.verificationStatus, contentChanged, sourceChanged);
        data = {
          ...(contentChanged ? { contentJson: content } : {}),
          ...(sourceChanged
            ? { source: input.sourceId ? { connect: { id: input.sourceId } } : { disconnect: true } }
            : {}),
          verificationStatus: status,
          ...(status !== fact.verificationStatus ? { verifiedAt: null } : {}),
        };
        changeType = status !== fact.verificationStatus ? "edited_unverified" : "edited";
        note = input.note;
        break;
      }
      case "verify": {
        nextVerificationStatus(fact.verificationStatus, "verify", { hasSource: Boolean(fact.sourceId) });
        data = { verificationStatus: "verified", verifiedAt: new Date(), rejectionReason: null };
        changeType = "verified";
        note = input.note;
        break;
      }
      case "reject": {
        nextVerificationStatus(fact.verificationStatus, "reject", { hasSource: Boolean(fact.sourceId) });
        data = { verificationStatus: "rejected", rejectionReason: input.reason, verifiedAt: null };
        changeType = "rejected";
        note = input.reason;
        break;
      }
      case "reopen": {
        nextVerificationStatus(fact.verificationStatus, "reopen", { hasSource: Boolean(fact.sourceId) });
        data = { verificationStatus: "unverified", rejectionReason: null, verifiedAt: null };
        changeType = "reopened";
        note = input.note;
        break;
      }
    }

    const updated = await tx.careerFact.update({
      where: { id: fact.id },
      data: { ...data, revision: { increment: 1 } },
    });
    await writeRevision(tx, ctx, updated, changeType, note);

    // Verifying a replacement supersedes the fact it replaces.
    if (input.action === "verify" && updated.supersedesFactId) {
      const previous = await tx.careerFact.findFirst({
        where: { id: updated.supersedesFactId, ownerId: ctx.ownerId, verificationStatus: "verified" },
      });
      if (previous) {
        const superseded = await tx.careerFact.update({
          where: { id: previous.id },
          data: { verificationStatus: "superseded", revision: { increment: 1 } },
        });
        await writeRevision(tx, ctx, superseded, "superseded", `Replaced by ${updated.id}`);
        await recordAudit(tx, ctx, {
          action: "career_fact.superseded",
          entityType: "career_fact",
          entityId: previous.id,
          metadata: { replacedBy: updated.id },
        });
      }
    }

    await recordAudit(tx, ctx, {
      action: `career_fact.${changeType}`,
      entityType: "career_fact",
      entityId: fact.id,
      metadata: { from: fact.verificationStatus, to: updated.verificationStatus, revision: updated.revision },
    });
    return tx.careerFact.findUniqueOrThrow({ where: { id: fact.id }, include: factInclude });
  });
}

/** Facts that downstream generation may treat as established. Only verified facts qualify. */
export async function listVerifiedFacts(db: Db, ctx: AuthContext) {
  return db.careerFact.findMany({
    where: { ownerId: ctx.ownerId, verificationStatus: "verified" },
    orderBy: [{ factType: "asc" }, { createdAt: "asc" }],
  });
}
