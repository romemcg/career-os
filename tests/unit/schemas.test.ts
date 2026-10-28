import { describe, expect, it } from "vitest";
import { contentSchemas, createSourceInput, factMutationInput, partialDate } from "@/modules/career/schemas";

describe("career fact content schemas", () => {
  it("accepts partial dates and rejects malformed ones", () => {
    for (const value of ["2021", "2021-04", "2021-04-30"]) expect(partialDate.safeParse(value).success).toBe(true);
    for (const value of ["21", "2021-13", "2021-4", "April 2021", "2021-04-32"]) {
      expect(partialDate.safeParse(value).success).toBe(false);
    }
  });

  it("requires core employment fields and a coherent date range", () => {
    expect(contentSchemas.employment.safeParse({ organization: "A", title: "B", startDate: "2020" }).success).toBe(
      true,
    );
    expect(contentSchemas.employment.safeParse({ organization: "A", startDate: "2020" }).success).toBe(false);
    const backwards = contentSchemas.employment.safeParse({
      organization: "A",
      title: "B",
      startDate: "2022-01",
      endDate: "2021-12",
    });
    expect(backwards.success).toBe(false);
    expect(backwards.error?.issues[0].path).toEqual(["endDate"]);
  });

  it("strips unknown keys so arbitrary data cannot be stored", () => {
    const parsed = contentSchemas.skill.parse({ name: "Product discovery", verifiedByAI: true });
    expect(parsed).toEqual({ name: "Product discovery" });
  });

  it("keeps achievement metrics as text exactly as evidenced", () => {
    const parsed = contentSchemas.achievement.parse({
      statement: "Reduced cost",
      metric: { value: "12.5", unit: "%" },
    });
    expect(parsed.metric?.value).toBe("12.5");
  });

  it("validates fact mutations by action", () => {
    expect(factMutationInput.safeParse({ action: "reject", revision: 1 }).success).toBe(false);
    expect(factMutationInput.safeParse({ action: "reject", revision: 1, reason: "Not supported" }).success).toBe(true);
    expect(factMutationInput.safeParse({ action: "approve", revision: 1 }).success).toBe(false);
  });
});

describe("source input", () => {
  it("requires a document for document sources and a URL for url sources", () => {
    expect(createSourceInput.safeParse({ sourceType: "document", title: "CV" }).success).toBe(false);
    expect(
      createSourceInput.safeParse({ sourceType: "url", title: "Profile", reference: "javascript:alert(1)" }).success,
    ).toBe(false);
    expect(
      createSourceInput.safeParse({ sourceType: "url", title: "Profile", reference: "https://example.com" }).success,
    ).toBe(true);
  });
});
