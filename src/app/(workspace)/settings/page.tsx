import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { formatBytes } from "@/lib/utils";
import { getAccountSummary } from "@/modules/settings/service";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const auth = await requireOwner();
  const summary = await getAccountSummary(getDb(), auth);

  return (
    <>
      <PageHeader title="Settings" description="Account, storage and data location" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" />
          <dl className="space-y-3 p-5 text-sm">
            <div>
              <dt className="text-fg-muted">Owner email</dt>
              <dd className="mt-0.5 font-medium">{summary.email}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Active sessions</dt>
              <dd className="mt-0.5">{summary.activeSessions}</dd>
            </div>
            <p className="text-xs text-fg-muted">
              Change the password from the terminal with <code>pnpm owner:reset-password</code>. This signs out every
              session.
            </p>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Storage" />
          <dl className="space-y-3 p-5 text-sm">
            <div>
              <dt className="text-fg-muted">Data directory</dt>
              <dd className="mt-0.5 break-all font-mono text-xs">{summary.dataDir}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Documents</dt>
              <dd className="mt-0.5">
                {summary.documentCount} files · {formatBytes(summary.documentBytes)}
              </dd>
            </div>
            <p className="text-xs text-fg-muted">
              Back up with <code>pnpm backup</code>; see docs/runbooks/backup-and-restore.md.
            </p>
          </dl>
        </Card>
      </div>
    </>
  );
}
