import { expect, test } from "@playwright/test";
import { E2E_OWNER } from "./owner";

test("mobile navigation is reachable without horizontal scroll", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_OWNER.email);
  await page.getByLabel("Password").fill(E2E_OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  const toggle = page.getByRole("button", { name: "Open navigation" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await page.locator("#mobile-nav").getByRole("link", { name: "Career Profile" }).click();
  await expect(page.getByRole("heading", { name: "Career Profile" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
