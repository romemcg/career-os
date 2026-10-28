"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/utils";
import { STATUS_LABELS, STATUS_TONES, type StatusName } from "@/modules/career/presentation";
import type { VerificationAction } from "@/modules/career/verification";

type Props = {
  factId: string;
  revision: number;
  status: StatusName;
  actions: VerificationAction[];
  hasSource: boolean;
  rejectionReason: string | null;
  verifiedAt: string | null;
};

export function VerificationPanel(props: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<VerificationAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  async function run(action: VerificationAction, extra: Record<string, unknown> = {}) {
    setPending(action);
    setError(null);
    try {
      await api(`/api/v1/career-facts/${props.factId}`, {
        method: "PATCH",
        body: { action, revision: props.revision, ...extra },
      });
      setRejecting(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the fact");
    } finally {
      setPending(null);
    }
  }

  function onReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    if (!reason) {
      setError("Give a reason for rejecting this fact");
      return;
    }
    void run("reject", { reason });
  }

  return (
    <Card>
      <CardHeader title="Verification" />
      <div className="space-y-3 p-5 text-sm">
        <div className="flex items-center gap-2">
          <Badge tone={STATUS_TONES[props.status]}>{STATUS_LABELS[props.status]}</Badge>
          {props.verifiedAt && <span className="text-xs text-fg-muted">since {formatDateTime(props.verifiedAt)}</span>}
        </div>
        {props.status === "rejected" && props.rejectionReason && (
          <p className="text-fg-muted">Reason: {props.rejectionReason}</p>
        )}
        {props.status === "superseded" && <p className="text-fg-muted">Replaced by a newer fact. Read-only.</p>}
        {props.status === "unverified" && (
          <p className="text-fg-muted">Verify only if the source supports this fact exactly as written.</p>
        )}
        {error && <Alert tone="danger">{error}</Alert>}

        {rejecting ? (
          <form onSubmit={onReject} className="space-y-3">
            <Field label="Reason for rejection" htmlFor="reason" required>
              <Textarea id="reason" name="reason" maxLength={500} className="min-h-16" />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" variant="danger" size="sm" disabled={pending !== null}>
                {pending === "reject" ? "Rejecting…" : "Confirm rejection"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            {props.actions.includes("verify") && (
              <Button
                size="sm"
                onClick={() => run("verify")}
                disabled={pending !== null || !props.hasSource}
                title={props.hasSource ? undefined : "Attach a source first"}
              >
                {pending === "verify" ? "Verifying…" : "Verify"}
              </Button>
            )}
            {props.actions.includes("reject") && (
              <Button size="sm" variant="secondary" onClick={() => setRejecting(true)} disabled={pending !== null}>
                Reject
              </Button>
            )}
            {props.actions.includes("reopen") && (
              <Button size="sm" variant="secondary" onClick={() => run("reopen")} disabled={pending !== null}>
                {pending === "reopen" ? "Reopening…" : props.status === "verified" ? "Withdraw verification" : "Reopen"}
              </Button>
            )}
          </div>
        )}
        {props.actions.includes("verify") && !props.hasSource && (
          <p className="text-xs text-warning">Attach a source before verifying.</p>
        )}
      </div>
    </Card>
  );
}
