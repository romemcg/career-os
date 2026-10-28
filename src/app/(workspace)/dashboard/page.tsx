import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { formatDateTime } from "@/lib/utils";
import { listRecentActivity } from "@/modules/audit/service";
import { STATUS_LABELS, type StatusName } from "@/modules/career/presentation";
import { countFactsByStatus } from "@/modules/career/service";

export const metadata: Metadata = { title: "Dashboard" };

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.locked": "Sign-in locked after failed attempts",
  "owner.created": "Owner account created",
  "owner.password_reset": "Password reset",
  "profile.updated": "Profile updated",
  "document.uploaded": "Document uploaded",
  "document.deleted": "Document deleted",
  "fact_source.created": "Source added",
  "career_fact.created": "Fact added",
  "career_fact.edited": "Fact edited",
  "career_fact.edited_unverified": "Fact edited (verification withdrawn)",
  "career_fact.verified": "Fact verified",
  "career_fact.rejected": "Fact rejected",
  "career_fact.reopened": "Fact reopened",
  "career_fact.superseded": "Fact superseded",
};

export default async function DashboardPage() {
  const auth = await requireOwner();
  const db = getDb();
  const [counts, activity] = await Promise.all([countFactsByStatus(db, auth), listRecentActivity(db, auth, 12)]);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Career knowledge base status and recent activity"
        actions={
          <Link href="/career/facts/new" className={buttonClasses()}>
            Add fact
          </Link>
        }
      />

      <section aria-label="Fact verification summary" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(Object.keys(STATUS_LABELS) as StatusName[]).map((status) => (
          <Link
            key={status}
            href={`/career?status=${status}`}
            className="rounded-card border border-border bg-surface p-4 hover:border-accent"
          >
            <p className="text-sm text-fg-muted">{STATUS_LABELS[status]} facts</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{counts[status]}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Needs review" description="Unverified facts cannot be used as established claims." />
          <div className="p-5">
            {total === 0 ? (
              <EmptyState
                title="Your knowledge base is empty"
                description="Start by adding a source (a CV, certificate or reference), then record facts that it supports."
                action={
                  <Link href="/career/sources" className={buttonClasses("secondary")}>
                    Add a source
                  </Link>
                }
              />
            ) : counts.unverified > 0 ? (
              <p className="text-sm">
                <span className="font-semibold">{counts.unverified}</span> fact{counts.unverified === 1 ? "" : "s"}{" "}
                awaiting verification.{" "}
                <Link href="/career?status=unverified" className="text-accent underline-offset-2 hover:underline">
                  Review now
                </Link>
              </p>
            ) : (
              <p className="text-sm text-fg-muted">Nothing awaiting verification.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" />
          {activity.length === 0 ? (
            <EmptyState title="No activity yet" description="Changes you make will be listed here." />
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-2.5 text-sm">
                  <span>{ACTION_LABELS[entry.action] ?? entry.action}</span>
                  <time className="shrink-0 text-xs text-fg-muted" dateTime={entry.createdAt.toISOString()}>
                    {formatDateTime(entry.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
