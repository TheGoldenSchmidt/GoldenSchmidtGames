import { test, expect } from "@playwright/test";

const universe = /Rich’s Universe/;

test("Rich’s Universe öffnet sich unter den Spielmodi und lädt Experimente einzeln", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const entry = page.getByRole("button", { name: universe });
  await expect(entry).toBeInViewport();
  // Directly below "Online spielen", as a stone slab (no third gold or amethyst slab).
  const online = (await page.getByRole("button", { name: /Online spielen/ }).boundingBox())!;
  const box = (await entry.boundingBox())!;
  expect(box.y).toBeGreaterThan(online.y + online.height - 1);
  expect(box.height).toBeGreaterThanOrEqual(52);
  await expect(entry).toHaveClass(/iw-slab--stone/);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: info.outputPath("start.png") });

  // The experiment's code is loaded only when it is opened.
  const loaded: string[] = [];
  page.on("request", request => { if (/HalloUniversum/.test(request.url())) loaded.push(request.url()); });
  await entry.click();
  await expect(page.getByRole("heading", { name: "Rich’s Universe", exact: true })).toBeVisible();
  expect(loaded).toEqual([]);
  await page.screenshot({ path: info.outputPath("menu.png") });

  await page.getByRole("button", { name: /Hallo Universum/ }).click();
  await expect(page.getByRole("heading", { name: "Hallo Universum", exact: true })).toBeVisible();
  expect(loaded.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Antippen" }).click();
  await expect(page.getByText("1 Mal angetippt")).toBeVisible();
  await page.screenshot({ path: info.outputPath("experiment.png") });

  await page.getByRole("button", { name: "Zurück", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rich’s Universe", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Zurück", exact: true }).click();
  await expect(page.getByRole("button", { name: /Lokal spielen/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Startbildschirm mit Rich’s Universe passt auch auf kleine Handys", async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: universe })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight)).toBe(true);
  await page.screenshot({ path: info.outputPath("start-small.png") });
});
