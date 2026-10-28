"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api-client";
import { formatBytes, formatDateTime } from "@/lib/utils";

type Doc = { id: string; originalName: string; mimeType: string; sizeBytes: number; sha256: string; createdAt: string };

export function DocumentList({ documents }: { documents: Doc[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(doc: Doc) {
    if (!window.confirm(`Delete "${doc.originalName}"? The file will be removed from this machine.`)) return;
    setBusy(doc.id);
    setError(null);
    try {
      await api(`/api/v1/documents/${doc.id}?confirm=true`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the document");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader title="Documents" description="Original files with SHA-256 checksums" />
      {error && (
        <div className="px-5 pt-4">
          <Alert tone="danger">{error}</Alert>
        </div>
      )}
      {documents.length === 0 ? (
        <EmptyState title="No documents" description="Upload a file when adding a document source." />
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="min-w-0">
                <a href={`/api/v1/documents/${doc.id}`} className="font-medium text-accent hover:underline">
                  {doc.originalName}
                </a>
                <p className="mt-0.5 text-xs text-fg-muted">
                  {formatBytes(doc.sizeBytes)} · {formatDateTime(doc.createdAt)} ·{" "}
                  <span className="font-mono" title={doc.sha256}>
                    {doc.sha256.slice(0, 12)}…
                  </span>
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => remove(doc)} disabled={busy === doc.id}>
                {busy === doc.id ? "Deleting…" : "Delete"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
