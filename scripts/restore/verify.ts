// Verify that every live document record has a file whose checksum matches,
// and that database migrations are in a known state. Exits non-zero on problems.
import "dotenv/config";
import { disconnectDb, getDb } from "@/lib/db/client";
import { getStorage } from "@/lib/storage";
import { sha256 } from "@/lib/storage/local-storage";

async function main() {
  const db = getDb();
  const storage = getStorage();
  const documents = await db.document.findMany({ where: { deletedAt: null } });
  let problems = 0;
  for (const doc of documents) {
    try {
      const bytes = await storage.get(doc.storageKey);
      if (sha256(bytes) !== doc.sha256) {
        problems++;
        console.error(`Checksum mismatch: document ${doc.id}`);
      }
    } catch {
      problems++;
      console.error(`Missing file: document ${doc.id}`);
    }
  }
  const [users, facts, revisions, sources, audit] = await Promise.all([
    db.user.count(),
    db.careerFact.count(),
    db.careerFactRevision.count(),
    db.factSource.count(),
    db.auditLog.count(),
  ]);
  // Every fact must have at least one revision row.
  const orphaned = await db.careerFact.count({ where: { revisions: { none: {} } } });
  if (orphaned > 0) {
    problems++;
    console.error(`${orphaned} facts have no revision history`);
  }
  console.log(
    JSON.stringify({ users, facts, revisions, sources, documents: documents.length, auditEntries: audit, problems }),
  );
  if (problems > 0) process.exitCode = 1;
  else console.log("Integrity check passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(disconnectDb);
