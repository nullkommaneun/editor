# Werksplan‑Editor PRO (PWA) v3

**Wesentliche Änderung (Ihr Wunsch):** Der Button *„Bild auswählen / Kamera“* nutzt `<input type="file" accept="image/*">` **ohne** `capture`. Dadurch zeigt das **OS‑Sheet** auf Mobilgeräten **beide Optionen** (Foto aufnehmen **oder** Bild aus Dateien/Mediathek). Ein Button, keine doppelte UI.

**Pro‑Upgrades:** Pipeline‑Timings, ΔE‑Toleranz, Zell‑Schwellwert, Pinch‑Zoom, A*‑Pfadmetriken im Qualitätscheck, robuste Fehler‑Overlays, PWA offline.

**Deployment:** wie gehabt (Root, GitHub Pages). Nach dem ersten Aufruf einmal neu laden → offline.
