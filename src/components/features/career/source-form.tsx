"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";
import { SOURCE_TYPE_LABELS } from "@/modules/career/presentation";

type SourceType = keyof typeof SOURCE_TYPE_LABELS;

const ACCEPT = ".pdf,.docx,.txt,.md,.png,.jpg,.jpeg";

export function SourceForm({ documents }: { documents: { id: string; originalName: string }[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [sourceType, setSourceType] = useState<SourceType>("document");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "danger" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      let documentId: string | null = null;
      if (sourceType === "document") {
        const file = form.get("file");
        const existing = String(form.get("existingDocumentId") ?? "");
        if (file instanceof File && file.size > 0) {
          const upload = new FormData();
          upload.set("file", file);
          const doc = await api<{ id: string }>("/api/v1/documents/upload", { method: "POST", body: upload });
          documentId = doc.id;
        } else if (existing) {
          documentId = existing;
        } else {
          setErrors({ documentId: "Choose a file to upload or an existing document" });
          setPending(false);
          return;
        }
      }
      await api("/api/v1/fact-sources", {
        method: "POST",
        body: {
          sourceType,
          title: form.get("title"),
          documentId,
          reference: form.get("reference") ?? "",
          notes: form.get("notes") ?? "",
        },
      });
      formRef.current?.reset();
      setMessage({ tone: "success", text: "Source added." });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors());
        setMessage({
          tone: "danger",
          text: err.message === "Invalid request" ? "Please correct the highlighted fields." : err.message,
        });
      } else {
        setMessage({ tone: "danger", text: "Could not save the source." });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Field label="Type" htmlFor="sourceType" required>
        <Select id="sourceType" value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
          {Object.entries(SOURCE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Title" htmlFor="title" required error={errors.title} hint="e.g. Master CV 2026, Employment letter">
        <Input id="title" name="title" maxLength={200} aria-invalid={errors.title ? true : undefined} />
      </Field>

      {sourceType === "document" && (
        <>
          <Field
            label="Upload file"
            htmlFor="file"
            hint="PDF, DOCX, TXT, PNG or JPEG. Stored privately."
            error={errors.documentId}
          >
            <Input id="file" name="file" type="file" accept={ACCEPT} className="h-auto py-1.5" />
          </Field>
          {documents.length > 0 && (
            <Field label="Or use an existing document" htmlFor="existingDocumentId">
              <Select id="existingDocumentId" name="existingDocumentId" defaultValue="">
                <option value="">None</option>
                {documents.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.originalName}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </>
      )}

      {sourceType !== "document" && (
        <Field
          label={sourceType === "url" ? "URL" : "Reference"}
          htmlFor="reference"
          required={sourceType === "url"}
          error={errors.reference}
          hint={sourceType === "owner_attestation" ? "Your own statement; weaker evidence than a document." : undefined}
        >
          <Input id="reference" name="reference" maxLength={2000} type={sourceType === "url" ? "url" : "text"} />
        </Field>
      )}

      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" maxLength={2000} className="min-h-16" />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add source"}
      </Button>
    </form>
  );
}
