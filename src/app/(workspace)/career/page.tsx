import type { Metadata } from "next";
import Link from "next/link";
import { FactFilters } from "@/components/features/career/fact-filters";
import { FactTable } from "@/components/features/career/fact-table";
import { ProfileEditor } from "@/components/features/career/profile-editor";
import { PageHeader } from "@/components/layout/page-header";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { getProfile, listFacts } from "@/modules/career/service";
import { listFactsQuery } from "@/modules/career/schemas";

export const metadata: Metadata = { title: "Career Profile" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CareerPage({ searchParams }: { searchParams: SearchParams }) {
  const auth = await requireOwner();
  const raw = await searchParams;
  const parsed = listFactsQuery.safeParse({
    status: raw.status || undefined,
    type: raw.type || undefined,
    q: raw.q || undefined,
    cursor: raw.cursor || undefined,
    limit: 50,
  });
  const query = parsed.success ? parsed.data : { limit: 50 };
  const db = getDb();
  const [profile, facts] = await Promise.all([getProfile(db, auth), listFacts(db, auth, query)]);
  const filtered = Boolean(raw.status || raw.type || raw.q);

  return (
    <>
      <PageHeader
        title="Career Profile"
        description="Your verified career knowledge base. Only verified facts can be used as established claims."
        actions={
          <Link href="/career/facts/new" className={buttonClasses()}>
            Add fact
          </Link>
        }
      />
      <div className="space-y-6">
        <ProfileEditor
          profile={{
            headline: profile.headline,
            summary: profile.summary,
            location: profile.location,
            revision: profile.revision,
          }}
        />
        <Card>
          <CardHeader
            title="Career facts"
            description="Employment, education, certifications, skills, achievements and projects"
          />
          <FactFilters />
          <FactTable
            facts={facts.items.map((fact) => ({
              id: fact.id,
              factType: fact.factType,
              content: fact.contentJson as Record<string, unknown>,
              status: fact.verificationStatus,
              sourceTitle: fact.source?.title ?? null,
              updatedAt: fact.updatedAt.toISOString(),
            }))}
            filtered={filtered}
          />
          {facts.nextCursor && (
            <div className="border-t border-border px-5 py-3 text-right">
              <Link
                href={{ pathname: "/career", query: { ...raw, cursor: facts.nextCursor } }}
                className={buttonClasses("secondary", "sm")}
              >
                Next page
              </Link>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
