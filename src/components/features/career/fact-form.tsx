"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { api, ApiError } from "@/lib/api-client";
import {
  FACT_FIELDS,
  FACT_TYPE_LABELS,
  SOURCE_TYPE_LABELS,
  contentToFormValues,
  formValuesToContent,
} from "@/modules/career/presentation";
import { FACT_TYPES, type FactTypeName } from "@/modules/career/schemas";

export type SourceOption = { id: string; title: string; sourceType: keyof typeof SOURCE_TYPE_LABELS };

type Props =
  | {
      mode: "create";
      sources: SourceOption[];
      supersedes?: { id: string; factType: FactTypeName; content: Record<string, unknown> };
    }
  | {
      mode: "edit";
      sources: SourceOption[];
      fact: {
        id: string;
        factType: FactTypeName;
        content: Record<string, unknown>;
        sourceId: string | null;
        revision: number;
        status: string;
      };
    };

export function FactForm(props: Props) {
  const router = useRouter();
  const initialType: FactTypeName =
    props.mode === "edit" ? props.fact.factType : (props.supersedes?.factType ?? "employment");
  const initialValues = useMemo(() => {
    if (props.mode === "edit") return contentToFormValues(props.fact.content);
    if (props.supersedes) return contentToFormValues(props.supersedes.content);
    return {};
  }, [props]);

  const [factType, setFactType] = useState<FactTypeName>(initialType);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // One key per form instance so a retried create cannot produce duplicates.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const typeLocked = props.mode === "edit" || Boolean(props.mode === "create" && props.supersedes);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, string> = {};
    for (const field of FACT_FIELDS[factType]) values[field.name] = String(form.get(field.name) ?? "");
    const content = formValuesToContent(factType, values);
    const sourceId = String(form.get("sourceId") ?? "") || null;

    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      if (props.mode === "create") {
        const created = await api<{ id: string }>("/api/v1/career-facts", {
          method: "POST",
          headers: { "idempotency-key": idempotencyKey },
          body: { factType, content, sourceId, supersedesFactId: props.supersedes?.id ?? null },
        });
        router.push(`/career/facts/${created.id}`);
      } else {
        await api(`/api/v1/career-facts/${props.fact.id}`, {
          method: "PATCH",
          body: {
            action: "edit",
            revision: props.fact.revision,
            content,
            sourceId,
            note: String(form.get("note") ?? "") || undefined,
          },
        });
        router.push(`/career/facts/${props.fact.id}`);
      }
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = Object.fromEntries(
          Object.entries(err.fieldErrors()).map(([path, message]) => [path.replace(/^content\./, ""), message]),
        );
        setErrors(fieldErrors);
        setFormError(err.message === "Invalid request" ? "Please correct the highlighted fields." : err.message);
      } else {
        setFormError("Could not save. Check that CareerOS is running.");
      }
      setPending(false);
    }
  }

  const currentSourceId = props.mode === "edit" ? (props.fact.sourceId ?? "") : "";

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {formError && <Alert tone="danger">{formError}</Alert>}
      {props.mode === "edit" && props.fact.status === "verified" && (
        <Alert>
          Changing the content or source of a verified fact returns it to unverified until you verify it again.
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Fact type" htmlFor="factType" required>
          <Select
            id="factType"
            value={factType}
            disabled={typeLocked}
            onChange={(event) => setFactType(event.target.value as FactTypeName)}
          >
            {FACT_TYPES.map((type) => (
              <option key={type} value={type}>
                {FACT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Source"
          htmlFor="sourceId"
          hint="Evidence for this fact. Required before the fact can be verified."
          error={errors.sourceId}
        >
          <Select id="sourceId" name="sourceId" defaultValue={currentSourceId}>
            <option value="">No source yet</option>
            {props.sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.title} ({SOURCE_TYPE_LABELS[source.sourceType]})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <fieldset key={factType} className="grid gap-4 md:grid-cols-2">
        <legend className="sr-only">{FACT_TYPE_LABELS[factType]} details</legend>
        {FACT_FIELDS[factType].map((field) => {
          const id = `field-${field.name}`;
          const common = {
            id,
            name: field.name,
            defaultValue: initialValues[field.name] ?? "",
            "aria-invalid": errors[field.name] ? true : undefined,
            required: field.required,
          };
          const wide = field.kind === "textarea";
          return (
            <div key={field.name} className={wide ? "md:col-span-2" : undefined}>
              <Field
                label={field.label}
                htmlFor={id}
                hint={field.hint}
                error={errors[field.name]}
                required={field.required}
              >
                {field.kind === "textarea" ? (
                  <Textarea {...common} />
                ) : field.kind === "select" ? (
                  <Select {...common}>
                    <option value="">Not specified</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    {...common}
                    type={field.kind === "number" ? "number" : "text"}
                    inputMode={field.kind === "number" ? "numeric" : undefined}
                    placeholder={field.kind === "date" ? "YYYY-MM" : undefined}
                  />
                )}
              </Field>
            </div>
          );
        })}
      </fieldset>

      {props.mode === "edit" && (
        <Field label="Change note" htmlFor="note" hint="Optional. Stored in the revision history.">
          <Input id="note" name="note" maxLength={500} />
        </Field>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : props.mode === "create" ? "Save as unverified" : "Save changes"}
        </Button>
        <Link
          href={props.mode === "edit" ? `/career/facts/${props.fact.id}` : "/career"}
          className={buttonClasses("ghost")}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
