import { Grid } from './grid.js';
import { CommandStack } from './undo.js';
import { Exporter } from './export.js';

export class UI {
  constructor(state){
    this.state = state;
    this.canvas = document.getElementById('plan-canvas');
    this.overlay = document.getElementById('overlay-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.octx = this.overlay.getContext('2d');
    this.windowRect = null; // for drawing selection rectangle
    this.tool = 'hand';
    this.commandStack = new CommandStack(state);
    this.dragStart = null;
    this.calibPoints = [];
    this._bindCanvasEvents();
  }

  _bindCanvasEvents(){
    const getXY = (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (ev.touches? ev.touches[0].clientX : ev.clientX) - rect.left;
      const y = (ev.touches? ev.touches[0].clientY : ev.clientY) - rect.top;
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return { x: Math.round(x * scaleX), y: Math.round(y * scaleY) };
    };
    const start = (ev) => {
      ev.preventDefault();
      const p = getXY(ev);
      if (this.state.mode === 'calibrate'){
        this._addCalibPoint(p);
        return;
      }
      this.dragStart = p;
      if (this.tool !== 'hand'){
        this.windowRect = {x:p.x, y:p.y, w:0, h:0};
        this._drawOverlay();
      }
    };
    const move = (ev) => {
      if (!this.dragStart) return;
      const p = getXY(ev);
      if (this.tool === 'hand') return;
      // snap to grid 10px
      const snap = (v) => Math.round(v/10)*10;
      this.windowRect = {
        x: snap(Math.min(this.dragStart.x, p.x)),
        y: snap(Math.min(this.dragStart.y, p.y)),
        w: snap(Math.abs(p.x - this.dragStart.x)),
        h: snap(Math.abs(p.y - this.dragStart.y)),
      };
      this._drawOverlay();
    };
    const end = (ev) => {
      if (!this.dragStart){ return; }
      const rect = this.windowRect;
      this.dragStart = null;
      if (!rect || rect.w<10 || rect.h<10){ this.windowRect=null; this._drawOverlay(); return; }
      const cell = 10;
      const cells = [];
      for (let y=rect.y; y<rect.y+rect.h; y+=cell){
        for (let x=rect.x; x<rect.x+rect.w; x+=cell){
          const c = Math.floor(x/cell), r = Math.floor(y/cell);
          cells.push(`${c}_${r}`);
        }
      }
      if (this.tool === 'wall'){
        this.commandStack.exec({do:()=>this.state.grid.addWalls(cells), undo:()=>this.state.grid.removeWalls(cells), label:'Wand'});
      } else if (this.tool === 'zone'){
        this.commandStack.exec({do:()=>this.state.grid.addZones(cells), undo:()=>this.state.grid.removeZones(cells), label:'Zone'});
      } else if (this.tool === 'door'){
        const door = {x: rect.x, y: rect.y, w: rect.w, h: rect.h, name: 'Öffnung', type:'door'};
        this.commandStack.exec({do:()=>this.state.doors.push(door), undo:()=>this.state.doors.pop(), label:'Tür'});
      }
      this.windowRect = null;
      this.drawAll();
    };
    // Pointer events
    this.canvas.addEventListener('pointerdown', start);
    this.canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    // Touch fallback
    this.canvas.addEventListener('touchstart', start, {passive:false});
    this.canvas.addEventListener('touchmove', move, {passive:false});
    window.addEventListener('touchend', end);
  }

  setBusy(b, msg=''){
    document.body.style.cursor = b? 'progress' : 'default';
    this.updateStatus(b? msg : 'Bereit.');
  }

  updateStatus(msg){ document.getElementById('status').textContent = msg; }
  enableStep(step){
    document.querySelectorAll('.step').forEach(btn => btn.classList.toggle('active', parseInt(btn.dataset.step,10)===step));
    document.querySelectorAll('.panel-section').forEach((sec,i)=>{ sec.classList.toggle('visible', i===step-1); });
  }
  showStep(step){ this.enableStep(step); }

  async loadImageFile(file){
    const img = new Image();
    img.decoding = 'async';
    img.src = URL.createObjectURL(file);
    await img.decode();
    const c = this.canvas, ctx = this.ctx;
    c.width = img.width; c.height = img.height;
    this.overlay.width = c.width; this.overlay.height = c.height;
    ctx.drawImage(img,0,0);
    this.state.image = img;
    this.state.imageData = ctx.getImageData(0,0,c.width,c.height);
    this.drawGridOverlay();
  }

  applyRotation(){
    const deg = parseInt(document.getElementById('rotate').value,10);
    if (!this.state.image) return this.toast('Kein Bild geladen.');
    const img = this.state.image;
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    if (deg===90 || deg===270){ c.width = img.height; c.height = img.width; } else { c.width = img.width; c.height = img.height; }
    ctx.translate(c.width/2, c.height/2);
    ctx.rotate(deg*Math.PI/180);
    ctx.drawImage(img, -img.width/2, -img.height/2);
    this.canvas.width = c.width; this.canvas.height = c.height;
    this.overlay.width = c.width; this.overlay.height = c.height;
    this.ctx.drawImage(c,0,0);
    this.state.imageData = this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height);
    this.drawGridOverlay();
  }

  showClusterPalette(colors){
    const pal = document.getElementById('cluster-palette');
    pal.innerHTML = '';
    colors.forEach((rgb, idx)=>{
      const el = document.createElement('div');
      el.className = 'swatch'; el.style.background = `rgb(${rgb.join(',')})`; el.title = `Cluster ${idx}`; el.dataset.idx = idx;
      pal.appendChild(el);
    });
  }
  highlightSwatch(idx){
    document.querySelectorAll('#cluster-palette .swatch').forEach(el => el.style.outline = '');
    const el = document.querySelector(`#cluster-palette .swatch[data-idx="${idx}"]`);
    if (el) el.style.outline = '3px solid var(--accent)';
  }

  drawGridOverlay(){
    const o = this.octx, w = this.overlay.width, h = this.overlay.height;
    o.clearRect(0,0,w,h);
    o.strokeStyle = 'rgba(0,255,80,0.15)';
    o.lineWidth = 1;
    o.beginPath();
    for (let x=0; x<w; x+=10){ o.moveTo(x+0.5,0); o.lineTo(x+0.5,h); }
    for (let y=0; y<h; y+=10){ o.moveTo(0,y+0.5); o.lineTo(w,y+0.5); }
    o.stroke();
    this._drawOverlay(); // draw selection if any
  }

  _drawOverlay(){
    const o = this.octx;
    this.drawGridOverlay();
    if (this.windowRect){
      o.fillStyle = 'rgba(0, 187, 85, 0.15)';
      o.strokeStyle = 'rgba(0, 187, 85, 0.9)';
      o.lineWidth = 2;
      o.fillRect(this.windowRect.x, this.windowRect.y, this.windowRect.w, this.windowRect.h);
      o.strokeRect(this.windowRect.x+0.5, this.windowRect.y+0.5, this.windowRect.w, this.windowRect.h);
    }
    // draw doors
    o.strokeStyle = 'rgba(255,255,255,0.85)';
    o.fillStyle = 'rgba(255,255,255,0.2)';
    (this.state.doors||[]).forEach(d => {
      o.fillRect(d.x, d.y, d.w, d.h);
      o.strokeRect(d.x+0.5, d.y+0.5, d.w, d.h);
    });
    // sites & starts
    o.fillStyle = 'rgba(0,200,255,0.8)';
    (this.state.sites||[]).forEach(s => {
      o.beginPath(); o.arc(s.x, s.y, 6, 0, Math.PI*2); o.fill();
      o.fillText(`#${s.id} ${s.name||''}`, s.x+8, s.y-8);
    });
    o.fillStyle = 'rgba(255,220,0,0.9)';
    (this.state.startPoints||[]).forEach(s => {
      o.beginPath(); o.moveTo(s.x, s.y-8); o.lineTo(s.x-7, s.y+8); o.lineTo(s.x+7, s.y+8); o.closePath(); o.fill();
      o.fillText(s.name||'Start', s.x+8, s.y-8);
    });
  }

  drawAll(){
    // draw base image
    if (this.state.imageData) this.ctx.putImageData(this.state.imageData, 0, 0);
    // draw blocked cells
    this.state.grid?.draw(this.ctx);
    // overlay
    this._drawOverlay();
  }

  setTool(t){ 
    this.tool = t; 
    document.querySelectorAll('.toolbar .tool').forEach(b => b.classList.toggle('active', b.dataset.tool===t));
    if (t==='hand') this.toast('Hand-Modus: ziehen, zoomen (Pinch) Ihres Geräts.');
  }
  clearWindowTool(){ this.windowRect=null; this._drawOverlay(); }
  undo(){ this.commandStack.undo(); this.drawAll(); }
  redo(){ this.commandStack.redo(); this.drawAll(); }

  toast(msg){
    const div = document.createElement('div');
    div.className = 'alert';
    div.textContent = msg;
    document.getElementById('alerts').appendChild(div);
    setTimeout(()=>div.remove(), 3500);
  }
  alert(msg, level='warn'){
    const div = document.createElement('div');
    div.className = 'alert';
    div.style.borderLeftColor = (level==='danger'?'var(--danger)':'var(--warn)');
    div.textContent = msg;
    document.getElementById('alerts').appendChild(div);
    setTimeout(()=>div.remove(), 6000);
  }

  setCalibration(pxPerMeter){
    this.state.calibration.px_per_meter = pxPerMeter;
    document.getElementById('calib-indicator').textContent = `px/m: ${pxPerMeter.toFixed(2)}`;
    document.getElementById('calib-status').textContent = `Kalibriert: ${pxPerMeter.toFixed(2)} px/m`;
  }

  _addCalibPoint(p){
    const snap = (v)=>Math.round(v/10)*10;
    const q = {x:snap(p.x), y:snap(p.y)};
    this.calibPoints.push(q);
    this.octx.fillStyle = 'rgba(0,180,255,0.9)';
    this.octx.beginPath(); this.octx.arc(q.x, q.y, 5, 0, Math.PI*2); this.octx.fill();
    if (this.calibPoints.length===2){
      this.state.mode = null;
      this.toast('Zwei Punkte gesetzt. Bitte Meter eingeben und "px/m berechnen".');
    }
  }

  calibrate(){
    if (this.calibPoints.length!==2){ this.state.mode='calibrate'; this.toast('Tippen Sie zwei Punkte auf dem Plan an.'); return; }
    const a = this.calibPoints[0], b = this.calibPoints[1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const distPx = Math.hypot(dx, dy);
    const meters = parseFloat(document.getElementById('calib-meters').value);
    if (!meters || meters<=0){ this.toast('Bitte gültige Meterzahl eingeben.'); return; }
    const ppm = distPx / meters;
    this.setCalibration(ppm);
    this.calibPoints = [];
  }

  addSite(){
    const id = prompt('Standort‑ID (1–999):'); if (!id) return;
    const n = prompt('Name (z. B. Rampe):') || '';
    const p = this._centerPoint();
    const snap = (v)=>Math.round(v/10)*10;
    const s = {id: Math.max(1, Math.min(999, parseInt(id,10)||1)), name:n, x:snap(p.x), y:snap(p.y), tags:['innen']};
    this.state.sites.push(s);
    this.drawAll();
    this._updateLists();
  }
  addStart(){
    const n = prompt('Startpunkt‑Name (z. B. Nordtor):') || 'Start';
    const p = this._centerPoint();
    const snap = (v)=>Math.round(v/10)*10;
    const s = {name:n, x:snap(p.x), y:snap(p.y)};
    this.state.startPoints.push(s);
    this.drawAll();
    this._updateLists();
  }
  _centerPoint(){
    const rect = this.canvas.getBoundingClientRect();
    const x = rect.width/2, y = rect.height/2;
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {x: Math.round(x*scaleX), y: Math.round(y*scaleY)};
  }
  _updateLists(){
    const ulS = document.getElementById('list-sites'); ulS.innerHTML = '';
    this.state.sites.forEach((s,i)=>{
      const li = document.createElement('li');
      li.innerHTML = `<strong>#${s.id}</strong> ${s.name||''} @ (${s.x},${s.y})`;
      ulS.appendChild(li);
    });
    const ulP = document.getElementById('list-starts'); ulP.innerHTML = '';
    this.state.startPoints.forEach((s,i)=>{
      const li = document.createElement('li');
      li.innerHTML = `<strong>${s.name||'Start'}</strong> @ (${s.x},${s.y})`;
      ulP.appendChild(li);
    });
  }

  async importBundle(obj){
    const w = obj.canvas?.width || this.canvas.width;
    const h = obj.canvas?.height || this.canvas.height;
    this.canvas.width = w; this.canvas.height = h;
    this.overlay.width = w; this.overlay.height = h;
    // image
    if (obj.image?.dataUrl){
      const img = new Image(); img.src = obj.image.dataUrl; await img.decode();
      this.ctx.drawImage(img,0,0);
      this.state.imageData = this.ctx.getImageData(0,0,w,h);
    }
    this.state.calibration.px_per_meter = obj.calibration?.px_per_meter || 0;
    this.state.grid = Grid.fromBundle(obj.grid, w, h);
    this.state.doors = obj.doors||[];
    this.state.sites = obj.sites||[];
    this.state.startPoints = obj.startPoints||[];
    document.getElementById('meta-name').value = obj.meta?.name || '';
    document.getElementById('meta-notes').value = obj.meta?.notes || '';
    this.drawAll();
    this._updateLists();
    this.setCalibration(this.state.calibration.px_per_meter||0);
  }

  async runInWorker(fn, payload){
    return await new Promise((resolve,reject)=>{
      const w = new Worker('./src/worker.js', {type:'module'});
      w.onmessage = (e)=>{ w.terminate(); resolve(e.data); };
      w.onerror = (e)=>{ w.terminate(); reject(e.message || e.error); };
      w.postMessage({fn, payload});
    });
  }

  listDoorSuggestions(doors){
    const c = document.getElementById('door-suggestions');
    if (!doors?.length){ c.textContent='Keine automatischen Vorschläge.'; return; }
    c.innerHTML='';
    doors.slice(0,30).forEach((d,i)=>{
      const div = document.createElement('div');
      div.innerHTML = `🔓 Öffnung vorgeschlagen bei (${d.x},${d.y}) Größe ${d.w}×${d.h} <button data-i="${i}">Übernehmen</button>`;
      c.appendChild(div);
    });
    c.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e)=>{
        const i = parseInt(btn.dataset.i,10);
        this.state.doors.push(doors[i]); this.drawAll();
      });
    });
  }

  preflight(){
    const items = [];
    // SW status
    items.push(('serviceWorker' in navigator) ? 'SW: verfügbar' : 'SW: nicht unterstützt');
    if (navigator.serviceWorker?.controller) items.push('SW: aktiv');
    else items.push('SW: noch nicht aktiv (2x laden)');
    // Storage
    try{ localStorage.setItem('pf','1'); localStorage.removeItem('pf'); items.push('Storage: ok'); } catch(e){ items.push('Storage: blockiert'); }
    // Canvas
    const c = document.createElement('canvas'); c.width=64; c.height=64; items.push(c.getContext('2d')? 'Canvas: ok':'Canvas: fehlt');
    // Worker
    items.push(('Worker' in window)? 'WebWorker: ok':'WebWorker: fehlt');
    // Report
    alert('Preflight\n' + items.join('\n'));
  }
}
