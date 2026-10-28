import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FactTable } from "@/components/features/career/fact-table";

describe("FactTable", () => {
  it("shows an onboarding empty state", () => {
    render(<FactTable facts={[]} filtered={false} />);
    expect(screen.getByText("No career facts yet")).toBeTruthy();
  });

  it("shows a filter empty state", () => {
    render(<FactTable facts={[]} filtered />);
    expect(screen.getByText("No matching facts")).toBeTruthy();
  });

  it("renders facts with status and missing-source warning", () => {
    render(
      <FactTable
        filtered={false}
        facts={[
          {
            id: "8a1d2f9e-2b44-4b9a-9d38-1c1f5e0e7a11",
            factType: "employment",
            content: { title: "Product Owner", organization: "Acme", startDate: "2020-01" },
            status: "unverified",
            sourceTitle: null,
            updatedAt: new Date().toISOString(),
          },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Product Owner · Acme" }).getAttribute("href")).toBe(
      "/career/facts/8a1d2f9e-2b44-4b9a-9d38-1c1f5e0e7a11",
    );
    expect(screen.getByText("Unverified")).toBeTruthy();
    expect(screen.getByText("No source")).toBeTruthy();
  });
});
