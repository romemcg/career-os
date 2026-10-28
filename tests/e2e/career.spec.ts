import { expect, type Page, test } from "@playwright/test";
import { E2E_OWNER } from "./owner";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_OWNER.email);
  await page.getByLabel("Password").fill(E2E_OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test("protected pages redirect to login", async ({ page }) => {
  await page.goto("/career");
  await expect(page).toHaveURL(/\/login$/);
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_OWNER.email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Invalid email or password" })).toBeVisible();
});

test("owner records a fact, attaches evidence, verifies it and sees history", async ({ page }) => {
  await signIn(page);

  // Add a document-backed source.
  await page.getByRole("link", { name: "Sources & Documents" }).first().click();
  await page.getByLabel("Title").fill("Employment letter 2021");
  await page.getByLabel("Upload file").setInputFiles({
    name: "employment-letter.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 letter confirming employment"),
  });
  await page.getByRole("button", { name: "Add source" }).click();
  await expect(page.getByText("Source added.")).toBeVisible();
  await expect(page.getByRole("link", { name: "employment-letter.pdf" }).first()).toBeVisible();

  // Create a fact without a source; it starts unverified and cannot be verified yet.
  await page.goto("/career/facts/new");
  await page.getByLabel("Organisation").fill("Example Utilities");
  await page.getByLabel("Job title").fill("Technical Product Owner");
  await page.getByLabel("Start date").fill("2021-03");
  await page.getByRole("button", { name: "Save as unverified" }).click();
  await expect(page.getByRole("heading", { name: "Technical Product Owner · Example Utilities" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify" })).toBeDisabled();
  await expect(page.getByText("Attach a source before verifying.")).toBeVisible();

  // Attach the source, then verify.
  await page.getByRole("link", { name: "Edit" }).click();
  await page.getByLabel("Source").selectOption({ label: "Employment letter 2021 (Document)" });
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("r3 · Verified")).toBeVisible();
  await expect(page.getByText("r2 · Edited")).toBeVisible();
  await expect(page.getByText("r1 · Created")).toBeVisible();

  // Reject an unsupported claim.
  await page.goto("/career/facts/new");
  await page.getByLabel("Fact type").selectOption("achievement");
  await page.getByLabel("Achievement statement").fill("Tripled company revenue single-handedly");
  await page.getByRole("button", { name: "Save as unverified" }).click();
  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByLabel("Reason for rejection").fill("No evidence supports this claim");
  await page.getByRole("button", { name: "Confirm rejection" }).click();
  await expect(page.getByText("Reason: No evidence supports this claim")).toBeVisible();

  // The knowledge base and dashboard reflect stored records.
  await page.goto("/career?status=verified");
  await expect(page.getByRole("link", { name: "Technical Product Owner · Example Utilities" })).toBeVisible();
  await expect(page.getByText("Tripled company revenue")).toHaveCount(0);
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Verified facts\s*1/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Rejected facts\s*1/ })).toBeVisible();
});

test("validation errors are shown inline", async ({ page }) => {
  await signIn(page);
  await page.goto("/career/facts/new");
  await page.getByLabel("Organisation").fill("Acme");
  await page.getByLabel("Job title").fill("Analyst");
  await page.getByLabel("Start date").fill("March 2020");
  await page.getByRole("button", { name: "Save as unverified" }).click();
  await expect(page.getByText("Use YYYY, YYYY-MM or YYYY-MM-DD")).toBeVisible();
});

test("profile can be edited and sign out ends the session", async ({ page }) => {
  await signIn(page);
  await page.goto("/career");
  await page.getByRole("button", { name: "Edit profile" }).click();
  await page.getByLabel("Headline").fill("Technical Product Owner, Smart Cities & IoT");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await expect(page.getByText("Technical Product Owner, Smart Cities & IoT")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
