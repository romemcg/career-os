import { describe, expect, it } from "vitest";
import { contentToFormValues, factPeriod, factTitle, formValuesToContent } from "@/modules/career/presentation";
import { contentSchemas } from "@/modules/career/schemas";

describe("fact form mapping", () => {
  it("round-trips nested and list fields", () => {
    const content = { statement: "Cut onboarding time", metric: { value: "30", unit: "%" } };
    const values = contentToFormValues(content);
    expect(values).toEqual({ statement: "Cut onboarding time", "metric.value": "30", "metric.unit": "%" });
    expect(formValuesToContent("achievement", values)).toEqual(content);

    const project = formValuesToContent("project", {
      name: "Smart meters",
      description: "Pilot",
      technologies: "LoRaWAN, MQTT ,",
    });
    expect(project.technologies).toEqual(["LoRaWAN", "MQTT"]);
    expect(contentSchemas.project.safeParse(project).success).toBe(true);
  });

  it("omits empty optional fields so they validate", () => {
    const content = formValuesToContent("employment", {
      organization: "A",
      title: "B",
      startDate: "2020",
      endDate: "",
    });
    expect(content).toEqual({ organization: "A", title: "B", startDate: "2020" });
  });

  it("formats titles and periods", () => {
    expect(factTitle("employment", { title: "PO", organization: "Acme" })).toBe("PO · Acme");
    expect(factPeriod({ startDate: "2020-01" })).toBe("2020-01 – present");
    expect(factPeriod({ issuedDate: "2019" })).toBe("2019");
  });
});
