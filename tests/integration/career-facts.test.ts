import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { disconnectDb, getDb } from "@/lib/db/client";
import {
  countFactsByStatus,
  createFact,
  getProfile,
  listFactRevisions,
  listFacts,
  listVerifiedFacts,
  mutateFact,
  updateProfile,
} from "@/modules/career/service";
import { employment, makeOwner, makeSource, resetDatabase } from "./helpers";

const db = () => getDb();

beforeEach(resetDatabase);
afterAll(disconnectDb);

describe("career profile", () => {
  it("updates with optimistic concurrency", async () => {
    const owner = await makeOwner();
    const profile = await getProfile(db(), owner);
    const updated = await updateProfile(db(), owner, {
      revision: profile.revision,
      headline: "Technical Product Owner",
    });
    expect(updated.revision).toBe(2);
    await expect(updateProfile(db(), owner, { revision: 1, headline: "Stale" })).rejects.toMatchObject({
      code: "REVISION_CONFLICT",
    });
  });
});

describe("career fact lifecycle", () => {
  it("always creates facts as unverified, ignoring client-supplied status", async () => {
    const owner = await makeOwner();
    const fact = await createFact(db(), owner, {
      factType: "employment",
      content: employment,
      verificationStatus: "verified",
    });
    expect(fact.verificationStatus).toBe("unverified");
    expect(await listVerifiedFacts(db(), owner)).toHaveLength(0);
  });

  it("validates content per fact type", async () => {
    const owner = await makeOwner();
    await expect(
      createFact(db(), owner, { factType: "employment", content: { organization: "X" } }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("requires a source to verify, then records the full history", async () => {
    const owner = await makeOwner();
    const fact = await createFact(db(), owner, { factType: "employment", content: employment });
    await expect(mutateFact(db(), owner, fact.id, { action: "verify", revision: 1 })).rejects.toMatchObject({
      code: "INVALID_TRANSITION",
    });

    const source = await makeSource(owner);
    const withSource = await mutateFact(db(), owner, fact.id, { action: "edit", revision: 1, sourceId: source.id });
    const verified = await mutateFact(db(), owner, fact.id, { action: "verify", revision: withSource.revision });
    expect(verified.verificationStatus).toBe("verified");
    expect(verified.verifiedAt).not.toBeNull();
    expect(await listVerifiedFacts(db(), owner)).toHaveLength(1);

    const revisions = await listFactRevisions(db(), owner, fact.id);
    expect(revisions.map((r) => r.changeType)).toEqual(["verified", "edited", "created"]);
    expect(revisions[0].sourceId).toBe(source.id);

    const audit = await db().auditLog.findMany({ where: { entityId: fact.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["career_fact.created", "career_fact.edited", "career_fact.verified"]);
  });

  it("withdraws verification when a verified fact is edited", async () => {
    const owner = await makeOwner();
    const source = await makeSource(owner);
    const fact = await createFact(db(), owner, { factType: "skill", content: { name: "IoT" }, sourceId: source.id });
    await mutateFact(db(), owner, fact.id, { action: "verify", revision: 1 });
    const edited = await mutateFact(db(), owner, fact.id, {
      action: "edit",
      revision: 2,
      content: { name: "IoT platforms" },
      note: "Clarified wording",
    });
    expect(edited.verificationStatus).toBe("unverified");
    expect(edited.verifiedAt).toBeNull();
    const [latest] = await listFactRevisions(db(), owner, fact.id);
    expect(latest.changeType).toBe("edited_unverified");
    expect(latest.note).toBe("Clarified wording");
  });

  it("rejects with a reason and can reopen", async () => {
    const owner = await makeOwner();
    const fact = await createFact(db(), owner, {
      factType: "achievement",
      content: { statement: "Increased revenue by 400%" },
    });
    const rejected = await mutateFact(db(), owner, fact.id, {
      action: "reject",
      revision: 1,
      reason: "Not supported by any document",
    });
    expect(rejected.verificationStatus).toBe("rejected");
    expect(rejected.rejectionReason).toBe("Not supported by any document");
    expect(await listVerifiedFacts(db(), owner)).toHaveLength(0);

    const reopened = await mutateFact(db(), owner, fact.id, { action: "reopen", revision: 2 });
    expect(reopened.verificationStatus).toBe("unverified");
    expect(reopened.rejectionReason).toBeNull();
  });

  it("returns 409 for stale revisions", async () => {
    const owner = await makeOwner();
    const fact = await createFact(db(), owner, { factType: "skill", content: { name: "SQL" } });
    await mutateFact(db(), owner, fact.id, { action: "edit", revision: 1, content: { name: "PostgreSQL" } });
    await expect(
      mutateFact(db(), owner, fact.id, { action: "edit", revision: 1, content: { name: "MySQL" } }),
    ).rejects.toMatchObject({ code: "REVISION_CONFLICT", status: 409 });
  });

  it("serialises concurrent mutations so only one wins", async () => {
    const owner = await makeOwner();
    const fact = await createFact(db(), owner, { factType: "skill", content: { name: "SQL" } });
    const results = await Promise.allSettled([
      mutateFact(db(), owner, fact.id, { action: "edit", revision: 1, content: { name: "A" } }),
      mutateFact(db(), owner, fact.id, { action: "edit", revision: 1, content: { name: "B" } }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await listFactRevisions(db(), owner, fact.id)).length).toBe(2);
  });

  it("supersedes a verified fact when its replacement is verified", async () => {
    const owner = await makeOwner();
    const source = await makeSource(owner);
    const original = await createFact(db(), owner, {
      factType: "employment",
      content: employment,
      sourceId: source.id,
    });
    await mutateFact(db(), owner, original.id, { action: "verify", revision: 1 });

    const replacement = await createFact(db(), owner, {
      factType: "employment",
      content: { ...employment, endDate: "2025-06" },
      sourceId: source.id,
      supersedesFactId: original.id,
    });
    // Until the replacement is verified, the original stays verified.
    expect((await listVerifiedFacts(db(), owner)).map((f) => f.id)).toEqual([original.id]);

    await mutateFact(db(), owner, replacement.id, { action: "verify", revision: 1 });
    expect((await listVerifiedFacts(db(), owner)).map((f) => f.id)).toEqual([replacement.id]);
    const counts = await countFactsByStatus(db(), owner);
    expect(counts).toMatchObject({ verified: 1, superseded: 1 });

    // Superseded facts are read-only.
    await expect(
      mutateFact(db(), owner, original.id, { action: "edit", revision: 3, content: employment }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("refuses to supersede an unverified fact", async () => {
    const owner = await makeOwner();
    const fact = await createFact(db(), owner, { factType: "skill", content: { name: "SQL" } });
    await expect(
      createFact(db(), owner, { factType: "skill", content: { name: "SQL" }, supersedesFactId: fact.id }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("lists with filters, search and stable cursor pagination", async () => {
    const owner = await makeOwner();
    for (let i = 0; i < 5; i++) {
      await createFact(db(), owner, { factType: "skill", content: { name: `Skill ${i}` } });
    }
    await createFact(db(), owner, { factType: "certification", content: { name: "PMP", issuer: "PMI" } });

    const first = await listFacts(db(), owner, { limit: "4" });
    expect(first.items).toHaveLength(4);
    const second = await listFacts(db(), owner, { limit: "4", cursor: first.nextCursor });
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.items, ...second.items].map((f) => f.id);
    expect(new Set(ids).size).toBe(6);

    expect((await listFacts(db(), owner, { type: "certification" })).items).toHaveLength(1);
    expect((await listFacts(db(), owner, { q: "pmi" })).items).toHaveLength(1);
    expect((await listFacts(db(), owner, { q: "100%_" })).items).toHaveLength(0);
    expect((await listFacts(db(), owner, { status: "verified" })).items).toHaveLength(0);
  });
});

describe("database integrity", () => {
  it("keeps revision history append-only", async () => {
    const owner = await makeOwner();
    const fact = await createFact(db(), owner, { factType: "skill", content: { name: "SQL" } });
    await expect(
      db().careerFactRevision.updateMany({ where: { factId: fact.id }, data: { note: "tampered" } }),
    ).rejects.toThrow();
    await expect(db().careerFactRevision.deleteMany({ where: { factId: fact.id } })).rejects.toThrow();
    await expect(db().auditLog.deleteMany({ where: { ownerId: owner.ownerId } })).rejects.toThrow();
  });

  it("enforces verified-requires-source at the database level", async () => {
    const owner = await makeOwner();
    const fact = await createFact(db(), owner, { factType: "skill", content: { name: "SQL" } });
    await expect(
      db().careerFact.update({ where: { id: fact.id }, data: { verificationStatus: "verified" } }),
    ).rejects.toThrow();
  });
});
