import { test, expect } from "@playwright/test";
test("sign in, create template, run real data transform, and inspect history", async ({
  page,
}) => {
  const errors = [];
  page.on("dialog", (dialog) => dialog.accept());
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.locator("input[type=password]").fill("browser-test-password");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await expect(
    page.getByRole("button", { name: "Run workflow", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/editor.png", fullPage: true });
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByRole("button", { name: "Use template" }).nth(1).click();
  await page.getByRole("button", { name: "Run workflow", exact: true }).click();
  await expect(
    page.getByText("Execution completed", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.getByText("Transform", { exact: true }).last().click();
  await expect(
    page.getByText("Hello Candri", { exact: false }).first(),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/execution.png", fullPage: true });
  await page
    .getByRole("button", { name: "Add node", exact: false })
    .first()
    .click();
  await page.getByPlaceholder("Search nodes…").fill("filter");
  await page.getByRole("button", { name: /Filter Keep matching/ }).click();
  await expect(page.locator("input#path")).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Workflow saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Executions", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Executions", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
