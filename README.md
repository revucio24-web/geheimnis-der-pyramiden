# Geheimnis der Pyramiden

3D-Abenteuerspiel (React + Three.js): Erforsche die Stufenpyramide des vergessenen Pharaos Chnum-Re,
löse drei Hieroglyphen-Rätsel, entdecke zwei Geheimkammern, berge acht Schätze und überlebe
Speerfallen, Pendelklingen und die erwachten Mumien — samt Wächter-Pharao Imhotep.

## Lokal starten

Voraussetzung: [Bun](https://bun.sh) oder Node.js ≥ 20.11.

```bash
bun install
bun run dev      # http://localhost:3000
```

Alternativ mit npm: `npm install && npm run dev`.

## Build & Checks

```bash
bun run build    # Production-Build nach dist/
bun run preview  # Production-Build lokal ausliefern
bun run lint     # TypeScript-Check (tsc --noEmit, strict)
bun run clean    # dist/ entfernen (plattformunabhängig)
```

## Steuerung

| Taste | Aktion |
| --- | --- |
| WASD / Pfeile | Bewegen |
| Maus / Ziehen | Umsehen (Klick ins 3D-Fenster fängt die Maus) |
| Shift | Sprinten (z. B. durch Pendel-Fallen) |
| Leertaste | Springen (weicht Schockwellen aus) |
| E | Interagieren: Säulen, Bodenplatten, Spiegel, Tafeln, Schätze |
| Klick / F | Fackelschlag (Mumien, Tonkrüge, rissige Mauern) |
| Q | Sonnenblitz (blendet nahe Mumien) |
| M / J / K | Karte · Tagebuch · Steuerung & Einstellungen |
| T / H | Ton stumm · Steuerleiste ein-/ausblenden |
| Esc | Pause / Modal schließen |

Auf Touch-Geräten wird automatisch ein Steuerkreuz-Pad eingeblendet.

## Technik

- **Keine externen Assets oder API-Keys nötig** — Texturen, Modelle und Audio werden
  vollständig prozedural im Browser erzeugt.
- WebGL2 erforderlich; auf Software-Renderern (z. B. SwiftShader) wird automatisch ein
  reduzierter Renderpfad ohne Schatten aktiviert.
- Die Rekordbeute wird lokal im Browser gespeichert (`localStorage`).
- Ohne Pointer-Lock (z. B. in eingebetteten iFrames) funktioniert das Umsehen per Drag-Look.
