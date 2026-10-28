"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";

type Profile = { headline: string; summary: string; location: string; revision: number };

export function ProfileEditor({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await api("/api/v1/profile", {
        method: "PATCH",
        body: {
          revision: profile.revision,
          headline: form.get("headline"),
          location: form.get("location"),
          summary: form.get("summary"),
        },
      });
      setEditing(false);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the profile");
    } finally {
      setPending(false);
    }
  }

  const empty = !profile.headline && !profile.summary && !profile.location;

  return (
    <Card>
      <CardHeader
        title="Profile"
        description="Headline and summary shown on generated documents in later milestones"
        actions={
          !editing && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(true);
                setSaved(false);
              }}
            >
              Edit profile
            </Button>
          )
        }
      />
      <div className="p-5">
        {saved && !editing && (
          <div className="mb-3">
            <Alert tone="success">Profile saved.</Alert>
          </div>
        )}
        {editing ? (
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            {error && (
              <div className="md:col-span-2">
                <Alert tone="danger">{error}</Alert>
              </div>
            )}
            <Field label="Headline" htmlFor="headline">
              <Input id="headline" name="headline" maxLength={200} defaultValue={profile.headline} />
            </Field>
            <Field label="Location" htmlFor="location">
              <Input id="location" name="location" maxLength={200} defaultValue={profile.location} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Summary" htmlFor="summary">
                <Textarea id="summary" name="summary" maxLength={4000} defaultValue={profile.summary} />
              </Field>
            </div>
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save profile"}
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </form>
        ) : empty ? (
          <p className="text-sm text-fg-muted">No profile details yet.</p>
        ) : (
          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-fg-muted">Headline</dt>
              <dd className="mt-0.5 font-medium">{profile.headline || "—"}</dd>
            </div>
            <div>
              <dt className="text-fg-muted">Location</dt>
              <dd className="mt-0.5">{profile.location || "—"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-fg-muted">Summary</dt>
              <dd className="mt-0.5 whitespace-pre-line">{profile.summary || "—"}</dd>
            </div>
          </dl>
        )}
      </div>
    </Card>
  );
}
