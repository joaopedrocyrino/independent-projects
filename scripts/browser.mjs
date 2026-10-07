import { chromium } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const base = process.env.BASE_URL || "http://127.0.0.1:" + env.API_PORT;
const browser = await chromium.launch({ headless: true });
mkdirSync("output", { recursive: true });
try {
  const context = await browser.newContext({
    ignoreHTTPSErrors: process.env.TEST_LOCAL_TLS === "true",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(base + "/admin");
  await page.getByLabel("Email", { exact: true }).fill(env.ADMIN_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("heading", { name: "Your projects" }).waitFor();
  await page.getByRole("link", { name: "New project" }).click();
  await page
    .getByLabel("Project title", { exact: true })
    .fill("Browser test " + Date.now());
  const title = await page
    .getByLabel("Project title", { exact: true })
    .inputValue();
  await page
    .getByLabel("Short description")
    .fill("A test project created from the real mobile admin UI.");
  await page
    .getByLabel("Full description")
    .fill("Created through React and saved by .NET.");
  await page.getByLabel("Full stack web", { exact: true }).check();
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page
    .getByRole("heading", { name: "Edit project", exact: true })
    .waitFor();
  const id = page.url().split("/").at(-1);
  await page.getByLabel("Visibility").selectOption("Published");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await page.getByText("Project saved.", { exact: true }).waitFor();
  await page.goto(base);
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "output/gallery-mobile.png", fullPage: true });
  await page
    .getByRole("link", { name: `Explore ${title}`, exact: true })
    .click();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.goto(base + "/admin/projects/" + id);
  await page
    .getByRole("heading", { name: "Edit project", exact: true })
    .waitFor();
  await page.screenshot({ path: "output/admin-mobile.png", fullPage: true });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Your projects", exact: true })
    .waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({ path: "output/gallery-desktop.png", fullPage: true });
  await context.close();
  console.log(
    "Browser passed: mobile login/create/publish/detail/delete and responsive desktop gallery.",
  );
} finally {
  await browser.close();
}
