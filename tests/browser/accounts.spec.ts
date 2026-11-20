import { test, expect } from "@playwright/test";
import { loginTestOwner, TEST_OWNER } from "./account-session";

test("Einladung, Login, Einstellungen auf zwei Handys und Rechteentzug", async ({ page, browser }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const owner = await loginTestOwner(page.request);
  await page.goto("/");
  await page.getByRole("button", { name: /^Konto:/ }).tap();
  await page.getByText("Einladungen & Rechte", { exact: true }).tap();
  await page.getByLabel("Rolle für die Einladung").selectOption("developer");
  await page.getByRole("button", { name: "Einladung erstellen" }).tap();
  const invitation = await page.getByRole("textbox", { name: /Einmaliger Code/ }).inputValue();
  const context = await browser.newContext({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const otherContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  try {
    const phone = await context.newPage();
    await phone.goto("/");
    await phone.getByRole("button", { name: /^Gastprofil:/ }).tap();
    await phone.getByRole("button", { name: "Ich habe eine Einladung" }).tap();
    const username = `Dev_${Date.now()}`;
    const password = "a good browser test password";
    await phone.getByLabel("Nutzername", { exact: true }).fill(username);
    await phone.getByLabel("Passwort", { exact: true }).fill(password);
    await phone.getByLabel("Einladungscode").fill(invitation);
    await phone.screenshot({ path: info.outputPath("einladung-320.png") });
    await phone.getByRole("button", { name: "Konto erstellen", exact: true }).tap();
    await expect(phone.getByRole("button", { name: /^Konto:/ })).toBeVisible();
    await phone.getByRole("button", { name: /^Konto:/ }).tap();
    await expect(phone.getByText("Entwickler", { exact: true })).toBeVisible();
    await expect(phone.getByText("Einladungen & Rechte", { exact: true })).toHaveCount(0);
    await phone.getByLabel("Anzeigename", { exact: true }).fill("Die wilde Spielerunde");
    await phone.getByRole("checkbox", { name: "Spieltöne" }).uncheck();
    await phone.getByRole("button", { name: "Einstellungen speichern" }).tap();
    await expect(phone.getByRole("dialog").getByRole("status")).toHaveText("Einstellungen gespeichert.");
    await phone.getByText("Deine Statistiken", { exact: true }).tap();
    await expect(phone.getByText("Noch keine Online-Partie abgeschlossen.")).toBeVisible();
    expect(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await phone.screenshot({ path: info.outputPath("konto-320.png") });
    await phone.getByRole("button", { name: "Profil schließen" }).tap();
    await phone.getByRole("button", { name: /Lokal spielen/ }).tap();
    await expect(phone.getByRole("button", { name: /Proberaum Eine Insel/ })).toBeVisible();

    const secondPhone = await otherContext.newPage();
    await secondPhone.goto("/");
    await secondPhone.getByRole("button", { name: /^Gastprofil:/ }).tap();
    await secondPhone.getByLabel("Nutzername", { exact: true }).fill(username);
    await secondPhone.getByLabel("Passwort", { exact: true }).fill("wrong password");
    await secondPhone.getByRole("button", { name: "Anmelden", exact: true }).tap();
    await expect(secondPhone.getByRole("alert")).toContainText("Nutzername oder Passwort");
    await secondPhone.getByLabel("Passwort", { exact: true }).fill(password);
    await secondPhone.getByRole("button", { name: "Anmelden", exact: true }).tap();
    await expect(secondPhone.getByRole("button", { name: "Konto: Die wilde Spielerunde" })).toBeVisible();
    await expect(secondPhone.getByRole("button", { name: "Spieltöne" })).toHaveAttribute("aria-pressed", "false");
    const me = await secondPhone.request.get("/api/account/me");
    const id = (await me.json()).account.id;
    const revoke = await page.request.put(`/api/account/users/${id}/role`, { data: { role: "player" } });
    expect(revoke.ok()).toBe(true);
    await phone.getByRole("button", { name: /Proberaum Eine Insel/ }).tap();
    await expect(phone.getByRole("alert")).toContainText("nur für Entwickler");
    await secondPhone.reload();
    await expect(secondPhone.getByRole("button", { name: /^Konto:/ })).toBeVisible();
    await secondPhone.getByRole("button", { name: /Lokal spielen/ }).tap();
    await expect(secondPhone.getByRole("button", { name: /Proberaum Eine Insel/ })).toHaveCount(0);
    await secondPhone.getByRole("button", { name: "Zurück", exact: true }).tap();
    await secondPhone.getByRole("button", { name: /^Konto:/ }).tap();
    await secondPhone.getByRole("button", { name: "Abmelden" }).tap();
    await expect(secondPhone.getByRole("button", { name: /^Gastprofil:/ })).toBeVisible();
    await expect.poll(async () => (await (await secondPhone.request.get("/api/account/me")).json()).account).toBeNull();
    expect(owner.role).toBe("admin");
  } finally { await context.close(); await otherContext.close(); }
});

test("Gast bleibt offline spielbar und sieht keinen Proberaum", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /Lokal spielen/ }).tap();
  await expect(page.getByRole("button", { name: /Proberaum Eine Insel/ })).toHaveCount(0);
  await page.context().setOffline(true);
  await expect(page.getByRole("button", { name: /^Qwixx / })).toBeEnabled();
  await page.getByRole("button", { name: /^Qwixx / }).tap();
  await expect(page.getByRole("heading", { name: "Qwixx", exact: true })).toBeVisible();
});

test("Eine verspätete Gastabfrage hebt eine neue Anmeldung nicht auf", async ({ page, request }) => {
  await loginTestOwner(request);
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/account/me", async route => {
    await pending;
    await route.fulfill({ json: { account: null } });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /^Gastprofil:/ }).tap();
  await page.getByLabel("Nutzername", { exact: true }).fill(TEST_OWNER.username);
  await page.getByLabel("Passwort", { exact: true }).fill(TEST_OWNER.password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).tap();
  await expect(page.getByRole("button", { name: /^Konto:/ })).toBeVisible();
  const stale = page.waitForResponse("**/api/account/me");
  release();
  await (await stale).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole("button", { name: /^Konto:/ })).toBeVisible();
});
