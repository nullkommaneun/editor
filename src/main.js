import { UI } from './ui.js';
import { AppState } from './state.js';
import { runPipeline, suggestDoors } from './pipeline.js';
import { Grid } from './grid.js';
import { Exporter } from './export.js';
import { Quality } from './quality.js';

const state = new AppState();
const ui = new UI(state);

let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); installPrompt = e;
  document.querySelector('#btn-install')?.removeAttribute('hidden');
});

document.querySelector('#btn-install')?.addEventListener('click', async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
});

// Service Worker registrieren
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}

// Steps
document.querySelectorAll('.step').forEach(btn => {
  btn.addEventListener('click', () => ui.showStep(parseInt(btn.dataset.step, 10)));
});

// Step 1: Bild laden + Drehen
const fileInput = document.getElementById('file-input');
fileInput?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  await ui.loadImageFile(f);
  ui.toast('Bild geladen.');
  ui.enableStep(2);
});
document.getElementById('btn-apply-rotation')?.addEventListener('click', () => ui.applyRotation());

// Pipeline Parameter
const kval = document.getElementById('kval');
const kvalLabel = document.getElementById('kval-label');
kval?.addEventListener('input', (e)=> kvalLabel.textContent = e.target.value);
const tol = document.getElementById('tol');
const tolLabel = document.getElementById('tol-label');
tol?.addEventListener('input', (e)=> tolLabel.textContent = e.target.value);

// Cluster-Klick
document.getElementById('cluster-palette')?.addEventListener('click', (e) => {
  const sw = e.target.closest('.swatch');
  if (!sw) return;
  const idx = parseInt(sw.dataset.idx, 10);
  state.pipeline.selectedClusters = [idx];
  ui.highlightSwatch(idx);
});

// Run pipeline
document.getElementById('btn-run-pipeline')?.addEventListener('click', async () => {
  if (!state.imageData) { ui.toast('Bitte zuerst ein Bild laden.'); return; }
  const k = parseInt(kval.value, 10);
  const tolerance = parseInt(tol.value, 10);
  state.pipeline.k = k; state.pipeline.tolerance = tolerance;
  const useWorker = document.getElementById('chk-worker')?.checked;
  ui.setBusy(true, 'Erkenne Hallen & Sperrzonen…');
  try {
    let result;
    if (useWorker && window.Worker) {
      result = await ui.runInWorker('pipeline', {imageData: state.imageData, k, tolerance, selectedClusters: state.pipeline.selectedClusters});
    } else {
      result = await runPipeline(state.imageData, {k, tolerance, selectedClusters: state.pipeline.selectedClusters});
    }
    const { mask, clusterColors, clusterIndexMap } = result;
    state.pipeline.clusterColors = clusterColors;
    state.pipeline.clusterIndexMap = clusterIndexMap;
    ui.showClusterPalette(clusterColors);
    state.grid = Grid.fromMask(mask, 10 /* cell size */, 0.4 /* occupancy */);
    ui.drawAll();
    ui.enableStep(3);
    // Türvorschläge
    const doors = suggestDoors(mask, 10);
    state.doors = doors.map(d => ({...d, name: 'Tor', type:'gate'}));
    ui.listDoorSuggestions(state.doors);
  } catch (err) {
    console.error(err);
    ui.toast('Automatik fehlgeschlagen: ' + err.message);
  } finally {
    ui.setBusy(false);
  }
});

// Tools
document.querySelectorAll('.toolbar .tool').forEach(btn => {
  btn.addEventListener('click', () => ui.setTool(btn.dataset.tool));
});
document.getElementById('btn-undo')?.addEventListener('click', () => ui.undo());
document.getElementById('btn-redo')?.addEventListener('click', () => ui.redo());
document.getElementById('btn-clear-window')?.addEventListener('click', () => ui.clearWindowTool());

// Kalibrieren
document.getElementById('btn-calibrate')?.addEventListener('click', () => ui.calibrate());

// Standorte & Startpunkte
document.getElementById('btn-add-site')?.addEventListener('click', () => ui.addSite());
document.getElementById('btn-add-start')?.addEventListener('click', () => ui.addStart());

// Qualitätscheck + Export/Import
document.getElementById('btn-run-quality')?.addEventListener('click', () => {
  const report = Quality.check(state);
  document.getElementById('quality-report').innerHTML = report.html;
  report.alerts.forEach(a => ui.alert(a, a.level));
});
document.getElementById('btn-export')?.addEventListener('click', () => {
  const exp = new Exporter(state);
  const dataUrlOpt = document.getElementById('chk-embed-image')?.checked;
  const blob = exp.exportBundle({embedImage: dataUrlOpt});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bn-mapbundle.json';
  a.click();
});
document.getElementById('btn-import')?.addEventListener('click', () => document.getElementById('import-input').click());
document.getElementById('import-input')?.addEventListener('change', async (e) => {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const txt = await f.text();
    const obj = JSON.parse(txt);
    await ui.importBundle(obj);
    ui.toast('Bundle importiert.');
  } catch (err) {
    ui.toast('Import fehlgeschlagen: ' + err.message);
  }
});

// Preflight
document.getElementById('btn-preflight')?.addEventListener('click', () => ui.preflight());
if (new URLSearchParams(location.search).get('pf') === '1') { ui.preflight(); }

// Initial
ui.updateStatus('Bereit. Laden Sie eine Planskizze.');
