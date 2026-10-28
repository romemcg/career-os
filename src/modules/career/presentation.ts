// Client-safe display helpers and form descriptors for career facts.
import type { FactTypeName } from "./schemas";

export const FACT_TYPE_LABELS: Record<FactTypeName, string> = {
  employment: "Employment",
  education: "Education",
  certification: "Certification",
  skill: "Skill",
  achievement: "Achievement",
  project: "Project",
};

export const STATUS_LABELS = {
  unverified: "Unverified",
  verified: "Verified",
  rejected: "Rejected",
  superseded: "Superseded",
} as const;

export type StatusName = keyof typeof STATUS_LABELS;

export const STATUS_TONES = {
  unverified: "warning",
  verified: "success",
  rejected: "danger",
  superseded: "neutral",
} as const;

export const SOURCE_TYPE_LABELS = {
  document: "Document",
  url: "Web link",
  reference: "Reference",
  owner_attestation: "Owner attestation",
} as const;

export type FieldDescriptor = {
  name: string; // dot path, e.g. "metric.value"
  label: string;
  kind: "text" | "textarea" | "date" | "select" | "number" | "list";
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
};

const dateHint = "YYYY, YYYY-MM or YYYY-MM-DD";

export const FACT_FIELDS: Record<FactTypeName, FieldDescriptor[]> = {
  employment: [
    { name: "organization", label: "Organisation", kind: "text", required: true },
    { name: "title", label: "Job title", kind: "text", required: true },
    { name: "location", label: "Location", kind: "text" },
    {
      name: "employmentType",
      label: "Employment type",
      kind: "select",
      options: [
        { value: "full_time", label: "Full time" },
        { value: "part_time", label: "Part time" },
        { value: "contract", label: "Contract" },
        { value: "internship", label: "Internship" },
        { value: "freelance", label: "Freelance" },
      ],
    },
    { name: "startDate", label: "Start date", kind: "date", required: true, hint: dateHint },
    { name: "endDate", label: "End date", kind: "date", hint: "Leave empty for a current role" },
    { name: "description", label: "Description", kind: "textarea" },
  ],
  education: [
    { name: "institution", label: "Institution", kind: "text", required: true },
    { name: "qualification", label: "Qualification", kind: "text", required: true },
    { name: "fieldOfStudy", label: "Field of study", kind: "text" },
    { name: "startDate", label: "Start date", kind: "date", hint: dateHint },
    { name: "endDate", label: "End date", kind: "date", hint: dateHint },
    { name: "grade", label: "Grade", kind: "text" },
  ],
  certification: [
    { name: "name", label: "Certification", kind: "text", required: true },
    { name: "issuer", label: "Issuer", kind: "text", required: true },
    { name: "issuedDate", label: "Issued", kind: "date", hint: dateHint },
    { name: "expiryDate", label: "Expires", kind: "date", hint: dateHint },
    { name: "credentialId", label: "Credential ID", kind: "text" },
  ],
  skill: [
    { name: "name", label: "Skill", kind: "text", required: true },
    { name: "category", label: "Category", kind: "text" },
    {
      name: "proficiency",
      label: "Proficiency",
      kind: "select",
      options: [
        { value: "basic", label: "Basic" },
        { value: "working", label: "Working" },
        { value: "advanced", label: "Advanced" },
        { value: "expert", label: "Expert" },
      ],
    },
    { name: "yearsOfExperience", label: "Years of experience", kind: "number" },
  ],
  achievement: [
    { name: "statement", label: "Achievement statement", kind: "textarea", required: true },
    { name: "organization", label: "Organisation", kind: "text" },
    { name: "context", label: "Context", kind: "textarea" },
    { name: "metric.value", label: "Metric value", kind: "text", hint: "Exactly as evidenced, e.g. 35" },
    { name: "metric.unit", label: "Metric unit", kind: "text", hint: "e.g. %, AED, devices" },
    { name: "metric.description", label: "Metric description", kind: "text" },
    { name: "date", label: "Date", kind: "date", hint: dateHint },
  ],
  project: [
    { name: "name", label: "Project", kind: "text", required: true },
    { name: "organization", label: "Organisation", kind: "text" },
    { name: "role", label: "Your role", kind: "text" },
    { name: "description", label: "Description", kind: "textarea", required: true },
    { name: "startDate", label: "Start date", kind: "date", hint: dateHint },
    { name: "endDate", label: "End date", kind: "date", hint: dateHint },
    { name: "technologies", label: "Technologies", kind: "list", hint: "Comma separated" },
  ],
};

type Content = Record<string, unknown>;
const str = (value: unknown) => (typeof value === "string" ? value : "");

export function factTitle(type: FactTypeName, content: Content): string {
  switch (type) {
    case "employment":
      return `${str(content.title)} · ${str(content.organization)}`;
    case "education":
      return `${str(content.qualification)} · ${str(content.institution)}`;
    case "certification":
      return `${str(content.name)} · ${str(content.issuer)}`;
    case "skill":
      return str(content.name);
    case "achievement":
      return str(content.statement);
    case "project":
      return str(content.name);
  }
}

export function factPeriod(content: Content): string | null {
  const start = str(content.startDate) || str(content.issuedDate) || str(content.date);
  if (!start) return null;
  if ("endDate" in content || "startDate" in content) {
    return `${start} – ${str(content.endDate) || "present"}`;
  }
  return start;
}

/** Flatten nested content into dot-path form values. */
export function contentToFormValues(content: Content): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(content)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) values[key] = value.join(", ");
    else if (typeof value === "object") {
      for (const [inner, innerValue] of Object.entries(value as Content)) {
        if (innerValue !== undefined && innerValue !== null) values[`${key}.${inner}`] = String(innerValue);
      }
    } else values[key] = String(value);
  }
  return values;
}

/** Build content from form values, omitting empty optional fields. */
export function formValuesToContent(type: FactTypeName, values: Record<string, string>): Content {
  const content: Content = {};
  for (const field of FACT_FIELDS[type]) {
    const raw = (values[field.name] ?? "").trim();
    if (!raw) continue;
    let value: unknown = raw;
    if (field.kind === "number") value = Number(raw);
    if (field.kind === "list")
      value = raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    const [head, tail] = field.name.split(".");
    if (tail) content[head] = { ...((content[head] as Content) ?? {}), [tail]: value };
    else content[head] = value;
  }
  return content;
}
