# Werksplan‑Editor (PWA) – v2

**Fixes & Upgrades** (relevant zu Ihren Beobachtungen und Zielen für eine Vorführung bei der VW‑GF):

### Kritische Bugfixes
- **Bild‑Upload → keine Reaktion**: behoben. Ursache war eine **rekursive Zeichnungsfunktion** (`drawGridOverlay` ↔ `_drawOverlay`) → Endlosschleife; jetzt strikt getrennt.
- **Preflight‑Button ohne Wirkung**: Eventbindung lief, aber Einfrieren durch obigen Fehler verhinderte Ausführung. Preflight jetzt **robuster** (mehr Checks, sofortige Alerts).
- **Cluster‑Palette NaN**: `kmeans` lieferte fehlerhafte `clusterColors` (Funktionssignatur). Korrigiert.
- **Erreichbarkeit**: BFS mischte Typen (Array/String); **konsistente Keys** eingeführt.

### Technische Verbesserungen
- **Pinch‑Zoom & Pan (Hand/Zoom‑Tool)** – performante View‑Matrix (bis 8× Zoom), Mouse‑Wheel support.
- **ΔE‑Toleranz in Lab** – erweitert die Cluster‑Auswahl nach Farbabstand (realistische „grau‑nah“ Auswahl).
- **Zell‑Schwellwert** (10–90 %) – steuert, ab welchem Flächenanteil Zellen blockiert werden.
- **Stabilere Pipeline** – Morphologie in korrekter Reihenfolge; Tür‑Heuristik säuberlich.
- **Fehler‑Overlay** – `window.onerror`/`unhandledrejection` → sichtbare **rote Alerts**.
- **Preflight+** – SW‑Status, Storage, Canvas, Worker, WASM, DPR.
- **Viewport‑sicheres Rendering** – Grid/Overlays skalieren, Textgrößen passen sich an.
- **Kamera‑Capture** – Datei‑Dialog erlaubt Kamerascan am Handy.

### Unverändert (wie gefordert)
- Vanilla ES‑Module, **keine Build‑Kette**.
- **PWA offline** (App‑Shell, Cache‑First).
- Rechteck‑Werkzeuge, Undo/Redo, Kalibrierung (2 Punkte → px/m).
- Export **`bn-mapbundle.json`** exakt zum Schema; Import verlustfrei.
