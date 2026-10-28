import type { Metadata } from "next";
import { FactForm } from "@/components/features/career/fact-form";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { AppError } from "@/lib/http/errors";
import { getFact, listSources } from "@/modules/career/service";

export const metadata: Metadata = { title: "Add fact" };

export default async function NewFactPage({ searchParams }: { searchParams: Promise<{ supersedes?: string }> }) {
  const auth = await requireOwner();
  const { supersedes } = await searchParams;
  const db = getDb();
  const sources = await listSources(db, auth);
  let previous: Awaited<ReturnType<typeof getFact>> | null = null;
  if (supersedes) {
    previous = await getFact(db, auth, supersedes).catch((error) => {
      if (error instanceof AppError) return null;
      throw error;
    });
  }

  return (
    <>
      <PageHeader
        title={previous ? "Replace fact" : "Add fact"}
        description="New facts are saved as unverified. Verify them once a source supports them."
      />
      <Card className="p-5">
        {previous && (
          <div className="mb-5">
            <Alert>
              This fact will replace an existing verified fact. The original is kept and marked superseded once the
              replacement is verified.
            </Alert>
          </div>
        )}
        <FactForm
          mode="create"
          sources={sources.map((s) => ({ id: s.id, title: s.title, sourceType: s.sourceType }))}
          supersedes={
            previous && previous.verificationStatus === "verified"
              ? {
                  id: previous.id,
                  factType: previous.factType,
                  content: previous.contentJson as Record<string, unknown>,
                }
              : undefined
          }
        />
      </Card>
    </>
  );
}
