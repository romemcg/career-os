import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { disconnectDb, getDb } from "@/lib/db/client";
import { getStorage } from "@/lib/storage";
import {
  createFact,
  createSource,
  getFact,
  listFactRevisions,
  listFacts,
  listSources,
  mutateFact,
} from "@/modules/career/service";
import { deleteDocument, listDocuments, readDocument, uploadDocument } from "@/modules/documents/service";
import { employment, makeOwner, makeSource, resetDatabase } from "./helpers";

const db = () => getDb();
const pdf = new TextEncoder().encode("%PDF-1.4 owner A private CV");

beforeEach(resetDatabase);
afterAll(disconnectDb);

// Ownership is enforced in the service layer; another owner's records behave as if they do not exist.
describe("cross-owner access", () => {
  it("hides another owner's facts, sources, revisions and documents", async () => {
    const alice = await makeOwner();
    const mallory = await makeOwner();
    const source = await makeSource(alice);
    const fact = await createFact(db(), alice, { factType: "employment", content: employment, sourceId: source.id });
    const { document } = await uploadDocument(db(), getStorage(), alice, { fileName: "cv.pdf", bytes: pdf });

    await expect(getFact(db(), mallory, fact.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(listFactRevisions(db(), mallory, fact.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(mutateFact(db(), mallory, fact.id, { action: "verify", revision: 1 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(readDocument(db(), getStorage(), mallory, document.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteDocument(db(), getStorage(), mallory, document.id, true)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    expect((await listFacts(db(), mallory, {})).items).toHaveLength(0);
    expect(await listSources(db(), mallory)).toHaveLength(0);
    expect(await listDocuments(db(), mallory)).toHaveLength(0);
    expect((await listFacts(db(), mallory, { q: "Example Utilities" })).items).toHaveLength(0);

    // Alice's fact is untouched.
    expect((await getFact(db(), alice, fact.id)).verificationStatus).toBe("unverified");
  });

  it("prevents linking another owner's source or document", async () => {
    const alice = await makeOwner();
    const mallory = await makeOwner();
    const aliceSource = await makeSource(alice);
    const { document } = await uploadDocument(db(), getStorage(), alice, { fileName: "cv.pdf", bytes: pdf });

    await expect(
      createFact(db(), mallory, { factType: "skill", content: { name: "SQL" }, sourceId: aliceSource.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createSource(db(), mallory, { sourceType: "document", title: "Stolen", documentId: document.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const malloryFact = await createFact(db(), mallory, { factType: "skill", content: { name: "SQL" } });
    await expect(
      mutateFact(db(), mallory, malloryFact.id, { action: "edit", revision: 1, sourceId: aliceSource.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cannot supersede another owner's fact", async () => {
    const alice = await makeOwner();
    const mallory = await makeOwner();
    const source = await makeSource(alice);
    const fact = await createFact(db(), alice, { factType: "skill", content: { name: "SQL" }, sourceId: source.id });
    await mutateFact(db(), alice, fact.id, { action: "verify", revision: 1 });
    await expect(
      createFact(db(), mallory, { factType: "skill", content: { name: "SQL" }, supersedesFactId: fact.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
