import { expect, test } from "@playwright/test";
import { onlineSession, request } from "./party-session";

test("Nach Spielende bleiben alle in derselben Lobby", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const session = await onlineSession(page, false, undefined, false);
  try {
    const code = (await session.state()).code;
    await expect(page.getByText(`Raum ${code}`)).toBeVisible();

    // Host beendet die Partie für alle; das Gerät der Seite ist der Host.
    await session.action({ type: "abort" }, session.ids[0]);
    await expect(page.getByRole("heading", { name: "Partie beendet" })).toBeVisible();

    await page.getByRole("button", { name: "Zurück zur Lobby", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Lobby" })).toBeVisible();
    await expect(page.getByText(code, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zum Startmenü" })).toHaveCount(0);

    // Der Raum besteht weiter: beide Personen sind noch da, niemand ist bereit.
    const room = await request(session.sockets[1], "room:lobby");
    expect(room.phase).toBe("lobby");
    expect(room.code).toBe(code);
    expect(room.players).toHaveLength(2);
    expect(room.players.every(player => !player.ready)).toBe(true);

    // Eine neue Runde lässt sich im selben Raum starten.
    await page.getByRole("button", { name: /bereit/i }).first().click();
    await request(session.sockets[1], "room:ready");
    await expect(page.getByText(`Raum ${code}`)).toBeVisible();
    expect((await session.state()).phase).toBe("playing");
  } finally {
    session.close();
  }
});
