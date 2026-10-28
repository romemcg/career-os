import { z } from "zod";

// Partial dates: "2021", "2021-04" or "2021-04-15". Career facts often lack day precision.
export const partialDate = z
  .string()
  .regex(/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/, "Use YYYY, YYYY-MM or YYYY-MM-DD");

const text = (max: number) => z.string().trim().min(1, "Required").max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

const dateRange = <T extends { startDate?: string; endDate?: string | null }>(schema: z.ZodType<T>) =>
  schema.refine((value) => !value.startDate || !value.endDate || value.endDate.localeCompare(value.startDate) >= 0, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const employmentContent = dateRange(
  z.object({
    organization: text(200),
    title: text(200),
    location: optionalText(200),
    startDate: partialDate,
    // null or absent means current role.
    endDate: partialDate.nullable().optional(),
    employmentType: z.enum(["full_time", "part_time", "contract", "internship", "freelance"]).optional(),
    description: optionalText(4000),
  }),
);

export const educationContent = dateRange(
  z.object({
    institution: text(200),
    qualification: text(200),
    fieldOfStudy: optionalText(200),
    startDate: partialDate.optional(),
    endDate: partialDate.nullable().optional(),
    grade: optionalText(100),
  }),
);

export const certificationContent = z
  .object({
    name: text(200),
    issuer: text(200),
    issuedDate: partialDate.optional(),
    expiryDate: partialDate.optional(),
    credentialId: optionalText(200),
  })
  .refine((v) => !v.issuedDate || !v.expiryDate || v.expiryDate.localeCompare(v.issuedDate) >= 0, {
    message: "Expiry date must not be before issue date",
    path: ["expiryDate"],
  });

export const skillContent = z.object({
  name: text(120),
  category: optionalText(120),
  proficiency: z.enum(["basic", "working", "advanced", "expert"]).optional(),
  yearsOfExperience: z.number().int().min(0).max(60).optional(),
});

export const achievementContent = z.object({
  statement: text(1000),
  context: optionalText(2000),
  organization: optionalText(200),
  // Metrics are stored exactly as evidenced, as text, to avoid rounding or reinterpretation.
  metric: z
    .object({
      value: text(100),
      unit: optionalText(50),
      description: optionalText(300),
    })
    .optional(),
  date: partialDate.optional(),
});

export const projectContent = dateRange(
  z.object({
    name: text(200),
    organization: optionalText(200),
    role: optionalText(200),
    description: text(4000),
    startDate: partialDate.optional(),
    endDate: partialDate.nullable().optional(),
    technologies: z.array(text(80)).max(50).optional(),
  }),
);

export const FACT_TYPES = ["employment", "education", "certification", "skill", "achievement", "project"] as const;
export type FactTypeName = (typeof FACT_TYPES)[number];

export const contentSchemas = {
  employment: employmentContent,
  education: educationContent,
  certification: certificationContent,
  skill: skillContent,
  achievement: achievementContent,
  project: projectContent,
} satisfies Record<FactTypeName, z.ZodType>;

export const CONTENT_SCHEMA_VERSION = 1;

export const createFactInput = z.object({
  factType: z.enum(FACT_TYPES),
  content: z.record(z.string(), z.unknown()),
  sourceId: z.uuid().nullable().optional(),
  supersedesFactId: z.uuid().nullable().optional(),
});

export const factMutationInput = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("edit"),
    revision: z.number().int().positive(),
    content: z.record(z.string(), z.unknown()).optional(),
    sourceId: z.uuid().nullable().optional(),
    note: optionalText(500),
  }),
  z.object({ action: z.literal("verify"), revision: z.number().int().positive(), note: optionalText(500) }),
  z.object({ action: z.literal("reject"), revision: z.number().int().positive(), reason: text(500) }),
  z.object({ action: z.literal("reopen"), revision: z.number().int().positive(), note: optionalText(500) }),
]);
export type FactMutationInput = z.infer<typeof factMutationInput>;

export const listFactsQuery = z.object({
  status: z.enum(["unverified", "verified", "rejected", "superseded"]).optional(),
  type: z.enum(FACT_TYPES).optional(),
  q: z.string().trim().max(200).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createSourceInput = z
  .object({
    sourceType: z.enum(["document", "url", "reference", "owner_attestation"]),
    title: text(200),
    documentId: z.uuid().nullable().optional(),
    reference: z.string().trim().max(2000).default(""),
    notes: z.string().trim().max(2000).default(""),
  })
  .superRefine((value, issue) => {
    if (value.sourceType === "document" && !value.documentId) {
      issue.addIssue({ code: "custom", path: ["documentId"], message: "A document is required" });
    }
    if (value.sourceType !== "document" && value.documentId) {
      issue.addIssue({ code: "custom", path: ["documentId"], message: "Only document sources reference a document" });
    }
    if (value.sourceType === "url") {
      const parsed = z.url({ protocol: /^https?$/ }).safeParse(value.reference);
      if (!parsed.success) {
        issue.addIssue({ code: "custom", path: ["reference"], message: "A valid http(s) URL is required" });
      }
    }
  });

export const updateProfileInput = z.object({
  revision: z.number().int().positive(),
  headline: z.string().trim().max(200).optional(),
  summary: z.string().trim().max(4000).optional(),
  location: z.string().trim().max(200).optional(),
});
