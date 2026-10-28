import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FactForm } from "@/components/features/career/fact-form";
import { VerificationPanel } from "@/components/features/career/verification-panel";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { AppError } from "@/lib/http/errors";
import { formatBytes, formatDateTime } from "@/lib/utils";
import {
  FACT_FIELDS,
  FACT_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  contentToFormValues,
  factTitle,
} from "@/modules/career/presentation";
import { getFact, listFactRevisions, listSources } from "@/modules/career/service";
import { allowedActions } from "@/modules/career/verification";

export const metadata: Metadata = { title: "Fact" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CHANGE_LABELS: Record<string, string> = {
  created: "Created",
  edited: "Edited",
  edited_unverified: "Edited, verification withdrawn",
  verified: "Verified",
  rejected: "Rejected",
  reopened: "Reopened",
  superseded: "Superseded",
};

export default async function FactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const auth = await requireOwner();
  const { id } = await params;
  const { edit } = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = getDb();

  let fact;
  try {
    fact = await getFact(db, auth, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  const [revisions, sources] = await Promise.all([listFactRevisions(db, auth, id), listSources(db, auth)]);
  const content = fact.contentJson as Record<string, unknown>;
  const values = contentToFormValues(content);
  const editing = edit === "1" && fact.verificationStatus !== "superseded";

  return (
    <>
      <div className="mb-2 text-sm">
        <Link href="/career" className="text-fg-muted hover:text-fg">
          ← Career Profile
        </Link>
      </div>
      <PageHeader
        title={factTitle(fact.factType, content)}
        description={`${FACT_TYPE_LABELS[fact.factType]} · revision ${fact.revision}`}
        actions={
          !editing && (
            <>
              {fact.verificationStatus !== "superseded" && (
                <Link href={`/career/facts/${fact.id}?edit=1`} className={buttonClasses("secondary")}>
                  Edit
                </Link>
              )}
              {fact.verificationStatus === "verified" && fact.supersededBy.length === 0 && (
                <Link href={`/career/facts/new?supersedes=${fact.id}`} className={buttonClasses("secondary")}>
                  Replace with updated fact
                </Link>
              )}
            </>
          )
        }
      />

      {editing ? (
        <Card className="p-5">
          <FactForm
            mode="edit"
            sources={sources.map((s) => ({ id: s.id, title: s.title, sourceType: s.sourceType }))}
            fact={{
              id: fact.id,
              factType: fact.factType,
              content,
              sourceId: fact.sourceId,
              revision: fact.revision,
              status: fact.verificationStatus,
            }}
          />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Details" />
              <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
                {FACT_FIELDS[fact.factType]
                  .filter((field) => values[field.name])
                  .map((field) => (
                    <div key={field.name} className={field.kind === "textarea" ? "sm:col-span-2" : undefined}>
                      <dt className="text-fg-muted">{field.label}</dt>
                      <dd className="mt-0.5 whitespace-pre-line">{values[field.name]}</dd>
                    </div>
                  ))}
              </dl>
            </Card>

            <Card>
              <CardHeader title="Revision history" description="Immutable record of every change" />
              <ol className="divide-y divide-border">
                {revisions.map((revision) => (
                  <li key={revision.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        r{revision.revision} · {CHANGE_LABELS[revision.changeType] ?? revision.changeType}
                      </p>
                      {revision.note && <p className="mt-0.5 text-fg-muted">{revision.note}</p>}
                      <p className="mt-0.5 text-xs text-fg-muted">Source: {revision.source?.title ?? "none"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={STATUS_TONES[revision.verificationStatus]}>
                        {STATUS_LABELS[revision.verificationStatus]}
                      </Badge>
                      <time className="text-xs text-fg-muted" dateTime={revision.createdAt.toISOString()}>
                        {formatDateTime(revision.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <div className="space-y-6">
            <VerificationPanel
              factId={fact.id}
              revision={fact.revision}
              status={fact.verificationStatus}
              actions={allowedActions(fact.verificationStatus)}
              hasSource={Boolean(fact.sourceId)}
              rejectionReason={fact.rejectionReason}
              verifiedAt={fact.verifiedAt?.toISOString() ?? null}
            />

            <Card>
              <CardHeader title="Source" />
              <div className="space-y-2 p-5 text-sm">
                {fact.source ? (
                  <>
                    <p className="font-medium">{fact.source.title}</p>
                    <p className="text-fg-muted">{SOURCE_TYPE_LABELS[fact.source.sourceType]}</p>
                    {fact.source.reference && <p className="break-words">{fact.source.reference}</p>}
                    {fact.source.document && (
                      <a
                        href={`/api/v1/documents/${fact.source.document.id}`}
                        className="inline-block text-accent underline-offset-2 hover:underline"
                      >
                        Download {fact.source.document.originalName} ({formatBytes(fact.source.document.sizeBytes)})
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-warning">No source attached. Edit the fact to attach one.</p>
                )}
              </div>
            </Card>

            {(fact.supersedes || fact.supersededBy.length > 0) && (
              <Card>
                <CardHeader title="Lineage" />
                <div className="space-y-2 p-5 text-sm">
                  {fact.supersedes && (
                    <p>
                      Replaces{" "}
                      <Link href={`/career/facts/${fact.supersedes.id}`} className="text-accent hover:underline">
                        an earlier fact
                      </Link>
                    </p>
                  )}
                  {fact.supersededBy.map((next) => (
                    <p key={next.id}>
                      Replacement:{" "}
                      <Link href={`/career/facts/${next.id}`} className="text-accent hover:underline">
                        {STATUS_LABELS[next.verificationStatus].toLowerCase()} fact
                      </Link>
                    </p>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
