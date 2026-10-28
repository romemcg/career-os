import type { Metadata } from "next";
import { DocumentList } from "@/components/features/career/document-list";
import { SourceForm } from "@/components/features/career/source-form";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { formatDateTime } from "@/lib/utils";
import { SOURCE_TYPE_LABELS } from "@/modules/career/presentation";
import { listSources } from "@/modules/career/service";
import { listDocuments } from "@/modules/documents/service";

export const metadata: Metadata = { title: "Sources & Documents" };

export default async function SourcesPage() {
  const auth = await requireOwner();
  const db = getDb();
  const [sources, documents] = await Promise.all([listSources(db, auth), listDocuments(db, auth)]);

  return (
    <>
      <PageHeader
        title="Sources & Documents"
        description="Evidence behind your career facts. Original files are stored privately on this machine."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Sources" description="Each source can support many facts" />
            {sources.length === 0 ? (
              <EmptyState
                title="No sources yet"
                description="Add a document such as your CV or a certificate, a web link, or a written reference."
              />
            ) : (
              <ul className="divide-y divide-border">
                {sources.map((source) => (
                  <li key={source.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{source.title}</p>
                      {source.reference && <p className="mt-0.5 break-words text-fg-muted">{source.reference}</p>}
                      {source.document && (
                        <a
                          href={`/api/v1/documents/${source.document.id}`}
                          className="mt-0.5 inline-block text-accent underline-offset-2 hover:underline"
                        >
                          {source.document.originalName}
                        </a>
                      )}
                      <p className="mt-0.5 text-xs text-fg-muted">
                        Added {formatDateTime(source.createdAt)} · supports {source._count.facts} fact
                        {source._count.facts === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge>{SOURCE_TYPE_LABELS[source.sourceType]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <DocumentList
            documents={documents.map((d) => ({
              id: d.id,
              originalName: d.originalName,
              mimeType: d.mimeType,
              sizeBytes: d.sizeBytes,
              sha256: d.sha256,
              createdAt: d.createdAt.toISOString(),
            }))}
          />
        </div>
        <Card className="h-fit">
          <CardHeader title="Add source" />
          <div className="p-5">
            <SourceForm documents={documents.map((d) => ({ id: d.id, originalName: d.originalName }))} />
          </div>
        </Card>
      </div>
    </>
  );
}
