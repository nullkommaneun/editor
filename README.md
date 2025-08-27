# Werksplan‑Editor (PWA)

**Ziel:** Offline‑fähiger Werksplan‑Editor (Vanilla JS, ES‑Module, GitHub‑Pages‑ready) zur Erzeugung eines `bn-mapbundle.json` für die Behälter‑Navigator‑App.

## Features (gemäß Randbedingungen)

- ✅ **Kein Build‑Tooling** – nur HTML/CSS/JS (ES‑Module).
- ✅ **PWA & Offline‑first** – Manifest + Service Worker; offline nach dem zweiten Aufruf.
- ✅ **Mobile‑first** – getestet auf Touch‑Events; große Buttons; Snap‑to‑Grid (10 px).
- ✅ **Automatik‑Pipeline (on‑device)** – k‑means (Lab), Sobel+Otsu, Morphologie (Closing/Opening, Fill Holes, einfache Kantenverfeinerung).
- ✅ **Werkzeuge** – Rechteck‑Tools: **Wand**, **Sperrzone**, **Öffnung**; **Undo/Redo** (Command‑Stack).
- ✅ **Kalibrierung** – 2 Punkte + Meter → `px_per_meter`.
- ✅ **Standorte & Startpunkte** – Snap‑to‑Grid; Listenansicht.
- ✅ **Qualitätscheck** – Erreichbarkeit, Abdeckung, Kürzeste‑Wege‑Lücken (Warnungen).
- ✅ **Export/Import** – `bn-mapbundle.json` (Schema v1.0), optional mit eingebettetem Bild.
- ✅ **Deutsch als UI‑Sprache**.
- ✅ **Keine Server/Cloud** – alles im Browser (optional WebWorker).

## Bedienfluss (Wizard)

1. **Bild laden** → Vorschau → optional drehen.
2. **Automatik** → Cluster wählen (grau), **Toleranz** justieren → Vorschau **Maske**.
3. **Nacharbeit** → Rechtecke: **Wand/Sperrzone/Öffnung**, **Undo/Redo**.
4. **Kalibrieren** → 2 Punkte + Meter.
5. **Standorte/Startpunkte** setzen.
6. **Qualität** prüfen → **Export**.

## Preflight

`?pf=1` an die URL anhängen oder **Preflight** im Header anklicken. Zeigt SW‑Status, Storage, Canvas, Worker.

## Schema

Das Export‑Bundle folgt exakt dem gewünschten Schema (siehe UI/Exportcode):

```json
{
  "schema": "bn-mapbundle-1.0",
  "meta": { "name": "Werk/Halle", "createdAt": "2025-08-27", "notes": "" },
  "calibration": { "px_per_meter": 10.2 },
  "canvas": { "width": 1000, "height": 700 },
  "grid": {
    "cell": 10, "cols": 100, "rows": 70,
    "walls_cells": ["12_18","13_18"],
    "zones_cells": ["40_50","40_51"]
  },
  "doors": [{ "x": 460, "y": 300, "w": 20, "h": 10, "name": "Tor 3A", "type": "gate" }],
  "sluices": [{ "x": 300, "y": 420, "w": 30, "h": 30, "name": "Schleuse 1", "delay_s": 8 }],
  "sites": [{ "id": 11, "x": 860, "y": 500, "name": "Rampe", "tags": ["innen"] }],
  "startPoints": [{ "name": "Nordtor", "x": 140, "y": 650 }],
  "image": { "dataUrl": "data:image/png;base64,..." }
}
```

## Hinweise zur Auto‑Erkennung (ehrlich)

- In der Praxis robust bei typischen Plänen (Hallen grau, Wege heller).
- Grenzen: Druckartefakte, Schatten, starke Kompression → Randfehler. Halbautomatik gleicht aus.
- Für große Bilder empfiehlt sich **WebWorker** (Schalter in Schritt 1).

## Deployment auf GitHub Pages

1. Repo anlegen, Inhalt dieses Ordners ins Repo kopieren.
2. **Settings → Pages**: Branch `main`, Ordner `/ (root)` → **Save**.
3. Nach dem ersten Aufruf **nochmal laden** → offline.

---

© 2025-08-27 – Werksplan‑Editor, bereit für die BN‑Pipeline.
