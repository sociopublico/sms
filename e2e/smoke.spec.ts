import { test, expect } from "playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

const authFile = path.join(__dirname, ".auth/user.json");

test.describe("login público", () => {
  test("muestra CTA de Google", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Socio Management System" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Continuar con Google/i })).toBeVisible();
  });

  test("axe: login sin violaciones críticas", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});

test.describe("app autenticada", () => {
  test.use({ storageState: authFile });

  const routes = [
    "/timeline",
    "/proyectos",
    "/personas",
    "/carga",
    "/horas",
    "/horas/sync",
  ];

  for (const route of routes) {
    test(`navega ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.getByRole("banner")).toBeVisible();
    });
  }

  test("axe: timeline sin violaciones críticas", async ({ page }) => {
    await page.goto("/timeline");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("confirmación al ocultar persona", async ({ page }) => {
    await page.goto("/personas");
    const trigger = page.getByRole("button", { name: "Ocultar" }).first();
    if (await trigger.count()) {
      await trigger.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();
      await page.getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
  });
});
