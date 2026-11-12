import { test } from "playwright/test";
import path from "node:path";
import fs from "node:fs";

const authFile = path.join(__dirname, ".auth/user.json");
const outDir = path.join(__dirname, "..", "docs", "ux-audit", "screenshots", "after");

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

const routes = [
  { path: "/login", auth: false, slug: "login" },
  { path: "/timeline", auth: true, slug: "timeline" },
  { path: "/proyectos", auth: true, slug: "proyectos" },
  { path: "/personas", auth: true, slug: "personas" },
  { path: "/carga", auth: true, slug: "carga" },
  { path: "/horas", auth: true, slug: "horas" },
];

test.describe("screenshots", () => {
  test.beforeAll(() => {
    fs.mkdirSync(outDir, { recursive: true });
  });

  for (const route of routes) {
    for (const vp of viewports) {
      test(`${route.slug} ${vp.name}`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          storageState: route.auth ? authFile : undefined,
        });
        const page = await context.newPage();
        await page.goto(route.path, { waitUntil: "networkidle" });
        await page.screenshot({
          path: path.join(outDir, `${route.slug}-${vp.name}.png`),
          fullPage: true,
        });
        await context.close();
      });
    }
  }
});
