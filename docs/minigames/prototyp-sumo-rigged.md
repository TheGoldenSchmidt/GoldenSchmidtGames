# Prototyp: Sumo Smash mit animierten Figuren

Stand: Nov. 2026 · Status: **umgesetzt als Prototyp**, Gerätetest offen.
Ziel: prüfen, ob echte Figuren mit Skelett und Animationen in der bestehenden
Web-Technik das gewünschte „Profi-Niveau“ erreichen (Alternative zu Unity,
siehe Aufwandsschätzung im Chat vom Nov. 2026).

## Assets

| Datei | Inhalt | Lizenz |
| --- | --- | --- |
| `assets/ual2/Mannequin_F.fbx` | Figur, 14 600 Dreiecke, 65 Knochen | CC0 (Quaternius) |
| `assets/ual2/UAL2_Standard.fbx` | Universal Animation Library 2, 43 Animationen, gleiches Skelett | CC0 (Quaternius) |
| `assets/ual2/License.txt` | Lizenztext | – |
| `public/models/mannequin.glb` | Web-Figur, ≈ 800 KB, im PWA-Cache | abgeleitet, CC0 |

Die Root-Motion-Fassung (`UAL2_Standard_RM.fbx`) liegt nicht im Repo: Die
Positionen bestimmt die Raumautorität, nicht die Animation.

**Neu erzeugen:** `node scripts/assets/build-mannequin.mjs`. Das Skript nimmt
die Figur und nur die benötigten Animationen, entfernt Finger-, Blatt- und
Skalierungsspuren, dünnt Schlüsselbilder auf etwa 20 je Sekunde aus und fasst
doppelte Eckpunkte zusammen (25 MB → 0,8 MB).

| Spielzustand | Animation aus UAL 2 |
| --- | --- |
| Stehen | `Idle_FoldArms_Loop` |
| Gehen / Schieben | `Walk_Carry_Loop` (Arme nach vorn) |
| Stoß | `Shield_Dash` |
| Getroffen | `Hit_Knockback` |
| Ring-Out (Fallen) | `NinjaJump_Idle_Loop` |
| Rückkehr | `NinjaJump_Land` |
| Sieg | `Yes` |

**Lücke:** UAL 2 ist das Erweiterungspaket und enthält kein Laufen/Rennen und
kein neutrales Stehen. Diese stecken in der „Universal Animation Library“ (1),
ebenfalls CC0. Mit ihr würden `Jog`/`Sprint` und ein ruhiges Stehen ersetzt.

## Umsetzung

- `src/three/riggedFigure.ts`: lädt die GLB einmal, klont je Spieler Skelett und
  Material (Spielerfarbe), `AnimationMixer` mit weichen Übergängen zwischen
  Dauerzuständen (Stehen, Gehen, Fallen) und Einmal-Aktionen (Stoß, Treffer,
  Landen, Jubel). Größe wird an den gehäuteten Eckpunkten gemessen (FBX mischt
  Einheiten zwischen Netz und Knochen). Figur blickt entlang +Z.
- `src/three/sumoWorld.ts`: schwebender Dohyo über Wolken, Seilring und helle
  Kampffläche schrumpfen mit den Regeln, Staub und Wackeln bei harten Treffern,
  Sterne bei Kontrollverlust, Ring-Out-Flug vom Podest, Rückkehr von oben,
  Schildkuppel, Lebenspunkte, gelber Ring und Pfeil an der eigenen Figur.
- **Kamera wie in Kampfspielen:** rahmt alle Kämpfer im Ring mit Rand
  (mindestens ±3,4, höchstens der ganze Ring), gleitet weich (bei reduzierter
  Bewegung sofort). Alle Kämpfer bleiben immer sichtbar.
- Regeln, Sicht, Eingaben und Kollisionen bleiben unverändert (Kreise auf einer
  Kreisfläche sind mit der bestehenden Rechnung exakt). Eine Physik-Engine wie
  Rapier lohnt sich erst bei komplexen Formen, z. B. einem Hindernislauf.
- Die Canvas-Fassung bleibt Rückfall ohne WebGL.

## Prüfungen

- Playwright `phone`: Figuren geladen, Laufen, Stoß in beiden
  Bewegungseinstellungen, sechs Kämpfer (75 Zeichenaufrufe, ≈ 197 000 Dreiecke),
  Rückfall ohne WebGL; Produktionsprüfung: GLB im PWA-Cache und ausgeliefert.
- Sichtprüfung im Chromium-Handyprofil; Blickrichtung über die Zehenknochen
  geprüft.

## Offen

- Gerätetest: Bildrate mit sechs gehäuteten Figuren, Ladezeit der GLB.
- Laufen/Stehen aus UAL 1 ergänzen.
- Entscheidung: Mannequins (eingefärbt) statt der 13 freigegebenen Figuren nur
  in diesem Prototyp; für weitere Spiele erst nach Freigabe, siehe
  [Figurenfreigabe](../approved-character-design.md).
