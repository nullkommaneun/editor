import { UI } from './ui.js';
import { AppState } from './state.js';
import { runPipeline, suggestDoorsC } from './pipeline.js';
import { Grid } from './grid.js';
import { Exporter } from './export.js';
import { Quality } from './quality.js';
import { Store } from './store.js';

const state = new AppState();
const ui = new UI(state);

window.addEventListener('error', (e) => ui.alert('Fehler: ' + (e.message||e.error), 'danger'));
window.addEventListener('unhandledrejection', (e) => ui.alert('Unhandled: ' + (e.reason?.message||e.reason), 'danger'));

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); installPrompt = e;
  const el = document.querySelector('#btn-install'); if (el) el.hidden = false;
});
document.querySelector('#btn-install')?.addEventListener('click', async () => { if (!installPrompt) return; await installPrompt.prompt(); });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => ui.alert('SW Fehler: '+err.message, 'danger'));
  });
}

document.querySelectorAll('.step').forEach(btn => { btn.addEventListener('click', () => ui.showStep(parseInt(btn.dataset.step, 10))); });

// Upload / Kamera: ein Button – OS‑Sheet entscheidet
const fileInput = document.getElementById('file-input');
fileInput?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  await ui.loadImageFile(f);
  ui.toast('Bild geladen.');
  ui.enableStep(2);
});
document.getElementById('btn-apply-rotation')?.addEventListener('click', () => ui.applyRotation());

const kval = document.getElementById('kval'), kvalLabel = document.getElementById('kval-label');
kval?.addEventListener('input', (e)=> kvalLabel.textContent = e.target.value);
const tol = document.getElementById('tol'), tolLabel = document.getElementById('tol-label');
tol?.addEventListener('input', (e)=> tolLabel.textContent = e.target.value);
const occ = document.getElementById('occ'), occLabel = document.getElementById('occ-label');
occ?.addEventListener('input', (e)=> occLabel.textContent = e.target.value + '%');

document.getElementById('cluster-palette')?.addEventListener('click', (e) => {
  const sw = e.target.closest('.swatch'); if (!sw) return;
  const idx = parseInt(sw.dataset.idx, 10);
  const sel = new Set(state.pipeline.selectedClusters);
  if (sel.has(idx)) sel.delete(idx); else sel.add(idx);
  state.pipeline.selectedClusters = Array.from(sel);
  document.querySelectorAll('#cluster-palette .swatch').forEach(el => el.classList.toggle('selected', state.pipeline.selectedClusters.includes(parseInt(el.dataset.idx,10))));
});

document.getElementById('btn-run-pipeline')?.addEventListener('click', async () => {
  if (!state.imageData) { ui.toast('Bitte zuerst ein Bild laden.'); return; }
  const k = parseInt(kval.value, 10);
  const tolerance = parseInt(tol.value, 10);
  const occupancy = parseInt(occ.value, 10) / 100;
  state.pipeline.k = k; state.pipeline.tolerance = tolerance;
  const useWorker = document.getElementById('chk-worker')?.checked;
  ui.setBusy(true, 'Erzeuge Erstmaske…');
  try {
    let t0 = performance.now();
    let result;
    if (useWorker && window.Worker) {
      result = await ui.runInWorker('pipeline', {imageData: state.imageData, k, tolerance, selectedClusters: state.pipeline.selectedClusters});
    } else {
      result = await runPipeline(state.imageData, {k, tolerance, selectedClusters: state.pipeline.selectedClusters});
    }
    const t1 = performance.now();
    const { mask, clusterColors, centroids, timings } = result;
    state.pipeline.clusterColors = clusterColors; state.pipeline.centroids = centroids;
    ui.showClusterPalette(clusterColors, state.pipeline.selectedClusters);
    state.grid = Grid.fromMask(mask, 10, occupancy);
    // Option C: Türen 2.0 → Vorschläge werden als Objekte überlagert (removable X)
    const doors = suggestDoorsC(mask, 10);
    state.doors = doors.map(d => ({...d, name: 'Tor', type:'gate', suggested:true}));
    ui.drawAll();
    ui.enableStep(3);
    const perf = Object.assign({total_ms: (t1 - t0).toFixed(1)}, timings||{});
    ui.showPerf(perf);
  } catch (err) {
    console.error(err);
    ui.alert('Automatik fehlgeschlagen: ' + (err.message||err), 'danger');
  } finally {
    ui.setBusy(false);
  }
});

document.querySelectorAll('.toolbar .tool').forEach(btn => { btn.addEventListener('click', () => ui.setTool(btn.dataset.tool)); });
document.getElementById('btn-undo')?.addEventListener('click', () => ui.undo());
document.getElementById('btn-redo')?.addEventListener('click', () => ui.redo());
document.getElementById('btn-clear-window')?.addEventListener('click', () => ui.clearWindowTool());

document.getElementById('btn-calibrate')?.addEventListener('click', () => ui.calibrate());
document.getElementById('btn-add-site')?.addEventListener('click', () => ui.addSite());
document.getElementById('btn-add-start')?.addEventListener('click', () => ui.addStart());

document.getElementById('btn-run-quality')?.addEventListener('click', () => {
  const report = Quality.check(state, {pathMetrics:true});
  document.getElementById('quality-report').innerHTML = report.html;
  report.alerts.forEach(a => ui.alert(a.text, a.level));
});

document.getElementById('btn-export')?.addEventListener('click', () => {
  const exp = new Exporter(state);
  const dataUrlOpt = document.getElementById('chk-embed-image')?.checked;
  const blob = exp.exportBundle({embedImage: dataUrlOpt});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bn-mapbundle.json'; a.click();
});
document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('import-input').click());
document.getElementById('import-input')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  try { const txt = await f.text(); const obj = JSON.parse(txt); await ui.importBundle(obj); ui.toast('Bundle importiert.'); }
  catch (err) { ui.alert('Import fehlgeschlagen: ' + (err.message||err), 'danger'); }
});

// Snapshots (IndexedDB)
document.getElementById('btn-save-snap')?.addEventListener('click', async () => {
  const exp = new Exporter(state);
  const blob = exp.exportBundle({embedImage:true});
  const text = await blob.text();
  const id = await Store.saveSnapshot(JSON.parse(text));
  ui.toast('Snapshot gespeichert #' + id);
});
document.getElementById('btn-load-last')?.addEventListener('click', async () => {
  const obj = await Store.loadLatest(); if (!obj){ ui.toast('Kein Snapshot vorhanden.'); return; }
  await ui.importBundle(obj); ui.toast('Letzten Snapshot geladen.');
});
document.getElementById('btn-list-snaps')?.addEventListener('click', async () => {
  const list = await Store.listSnapshots();
  if (!list.length){ alert('Keine Snapshots.'); return; }
  const pick = prompt('Snapshot-ID laden oder "-ID" zum Löschen:\n' + list.map(s => `#${s.id} ${s.meta?.name||''} ${s.meta?.createdAt||''}`).join('\n'));
  if (!pick) return;
  if (pick.startsWith('-')){ const id = parseInt(pick.slice(1),10); await Store.deleteSnapshot(id); ui.toast('Snapshot gelöscht #' + id); return; }
  const id = parseInt(pick,10); const obj = await Store.loadSnapshot(id); if (obj){ await ui.importBundle(obj); ui.toast('Snapshot geladen #' + id); }
});

document.getElementById('btn-preflight')?.addEventListener('click', () => ui.preflight());
if (new URLSearchParams(location.search).get('pf') === '1') { ui.preflight(); }

ui.updateStatus('Bereit. Laden Sie eine Planskizze.');
