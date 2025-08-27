import { Grid } from './grid.js';
import { CommandStack } from './undo.js';

export class UI {
  constructor(state){
    this.state = state;
    this.canvas = document.getElementById('plan-canvas');
    this.overlay = document.getElementById('overlay-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.octx = this.overlay.getContext('2d');
    this.view = {zoom:1, panX:0, panY:0};
    this.windowRect = null;
    this.tool = 'hand';
    this.commandStack = new CommandStack(state);
    this.dragStart = null;
    this.calibPoints = [];
    this._bindCanvasEvents();
  }

  showPerf(perfObj){
    const pre = document.getElementById('perf-report');
    const lines = Object.entries(perfObj||{}).map(([k,v])=>`${k}: ${typeof v==='number'?Number(v).toFixed(1):v} ms`);
    pre.textContent = lines.join('\n') || '–';
  }

  _applyView(ctx){ ctx.setTransform(this.view.zoom,0,0,this.view.zoom,this.view.panX,this.view.panY); }
  _resetView(ctx){ ctx.setTransform(1,0,0,1,0,0); }
  toWorld(clientX, clientY){
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left, y = clientY - rect.top;
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const cx = x * scaleX, cy = y * scaleY;
    const invZ = 1/this.view.zoom;
    return { x: Math.round((cx - this.view.panX) * invZ), y: Math.round((cy - this.view.panY) * invZ) };
  }

  _bindCanvasEvents(){
    const activePointers = new Map();
    let lastDist = 0;
    const start = (ev) => {
      ev.preventDefault();
      if (ev.pointerId!=null){ activePointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY}); }
      const p = this.toWorld(ev.clientX, ev.clientY);
      // Entfernen via "X" auf Vorschlagsobjekten (immer aktiv)
      if (this._tryRemoveSuggestedObject(ev.clientX, ev.clientY)) return;
      if (this.state.mode === 'calibrate'){ this._addCalibPoint(p); return; }
      if (this.tool === 'hand'){ this.dragStart = {x:ev.clientX, y:ev.clientY, panX:this.view.panX, panY:this.view.panY}; return; }
      this.dragStart = p; this.windowRect = {x:p.x, y:p.y, w:0, h:0}; this._drawOverlay();
    };
    const move = (ev) => {
      if (!this.dragStart) return;
      if (this.tool === 'hand'){
        if (activePointers.size >= 2){
          const pts = Array.from(activePointers.values());
          const dx = pts[1].x - pts[0].x, dy = pts[1].y - pts[0].y;
          const dist = Math.hypot(dx, dy);
          if (lastDist===0) lastDist = dist;
          const factor = dist / lastDist; lastDist = dist;
          const mx=(pts[0].x+pts[1].x)/2, my=(pts[0].y+pts[1].y)/2;
          const before = this.toWorld(mx,my);
          this.view.zoom = Math.max(0.2, Math.min(8, this.view.zoom * factor));
          const after = this.toWorld(mx,my);
          this.view.panX += (after.x - before.x) * this.view.zoom;
          this.view.panY += (after.y - before.y) * this.view.zoom;
          this.drawAll();
        } else {
          const dx = ev.clientX - this.dragStart.x, dy = ev.clientY - this.dragStart.y;
          this.view.panX = this.dragStart.panX + dx; this.view.panY = this.dragStart.panY + dy; this.drawAll();
        }
        return;
      }
      const p = this.toWorld(ev.clientX, ev.clientY);
      const snap = v=>Math.round(v/10)*10;
      this.windowRect = { x: snap(Math.min(this.dragStart.x, p.x)), y: snap(Math.min(this.dragStart.y, p.y)), w: snap(Math.abs(p.x - this.dragStart.x)), h: snap(Math.abs(p.y - this.dragStart.y)) };
      this._drawOverlay();
    };
    const end = (ev) => {
      activePointers.delete(ev.pointerId);
      if (activePointers.size < 2) lastDist = 0;
      if (!this.dragStart) return;
      if (this.tool === 'hand'){ this.dragStart=null; return; }
      const rect = this.windowRect; this.dragStart = null;
      if (!rect || rect.w<10 || rect.h<10){ this.windowRect=null; this._drawOverlay(); return; }
      const cell = 10, cells=[];
      for (let y=rect.y; y<rect.y+rect.h; y+=cell){ for (let x=rect.x; x<rect.x+rect.w; x+=cell){ cells.push(`${Math.floor(x/cell)}_${Math.floor(y/cell)}`); } }
      if (this.tool === 'hall' || this.tool === 'wall'){ this.commandStack.exec({do:()=>this.state.grid.addWalls(cells), undo:()=>this.state.grid.removeWalls(cells)}); }
      else if (this.tool === 'zone'){ this.commandStack.exec({do:()=>this.state.grid.addZones(cells), undo:()=>this.state.grid.removeZones(cells)}); }
      else if (this.tool === 'door'){ const d={x:rect.x,y:rect.y,w:rect.w,h:rect.h,name:'Tor',type:'gate'}; this.commandStack.exec({do:()=>this.state.doors.push(d), undo:()=>this.state.doors.pop()}); }
      else if (this.tool === 'sluice'){ const s={x:rect.x,y:rect.y,w:rect.w,h:rect.h,name:'Schleuse',delay_s:8}; this.commandStack.exec({do:()=>this.state.sluices.push(s), undo:()=>this.state.sluices.pop()}); }
      this.windowRect = null; this.drawAll();
    };
    this.canvas.addEventListener('pointerdown', start);
    this.canvas.addEventListener('pointermove', (ev)=>{ if (ev.pointerId!=null && activePointers.has(ev.pointerId)){ activePointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY}); } move(ev); });
    window.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.canvas.addEventListener('wheel', (ev)=>{ ev.preventDefault(); const factor = Math.sign(ev.deltaY)>0 ? 0.9 : 1.1; const mx=ev.clientX,my=ev.clientY; const before=this.toWorld(mx,my); this.view.zoom = Math.max(0.2, Math.min(8, this.view.zoom*factor)); const after=this.toWorld(mx,my); this.view.panX += (after.x-before.x)*this.view.zoom; this.view.panY += (after.y-before.y)*this.view.zoom; this.drawAll(); }, {passive:false});
  }

  // Entfernen per "X" auf Vorschlägen (Tür/Schleuse)
  _tryRemoveSuggestedObject(clientX, clientY){
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const sizeWorld = (18 * scaleX) / this.view.zoom; // ~18 CSS px
    const inHandle = (obj)=>{
      const hx0 = obj.x + obj.w - sizeWorld, hy0 = obj.y;
      const hx1 = obj.x + obj.w, hy1 = obj.y + sizeWorld;
      const wx = (clientX - rect.left) * scaleX, wy = (clientY - rect.top) * scaleY;
      const tx = wx - this.view.panX, ty = wy - this.view.panY;
      return (tx>=hx0 && tx<=hx1 && ty>=hy0 && ty<=hy1);
    };
    // Doors (nur Vorschläge)
    for (let i=this.state.doors.length-1; i>=0; i--){
      const d = this.state.doors[i];
      if (d.suggested && inHandle(d)){ this.state.doors.splice(i,1); this.drawAll(); this.toast('Vorschlag entfernt.'); return true; }
    }
    // Schleusen‑Vorschläge (falls wir welche hätten) – hier optional
    return false;
  }

  setBusy(b,msg=''){
    const sp = document.querySelector('.spinner'); if (sp) sp.hidden = !b;
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
    this._resetView(ctx); ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(img,0,0);
    this.state.image = img;
    this.state.imageData = ctx.getImageData(0,0,c.width,c.height);
    this.drawAll();
  }

  applyRotation(){
    const deg = parseInt(document.getElementById('rotate').value,10);
    if (!this.state.image) return this.toast('Kein Bild geladen.');
    const img = this.state.image;
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    if (deg===90 || deg===270){ c.width = img.height; c.height = img.width; } else { c.width = img.width; c.height = img.height; }
    ctx.translate(c.width/2, c.height/2); ctx.rotate(deg*Math.PI/180); ctx.drawImage(img, -img.width/2, -img.height/2);
    this.canvas.width = c.width; this.canvas.height = c.height; this.overlay.width = c.width; this.overlay.height = c.height;
    this.ctx.drawImage(c,0,0);
    this.state.imageData = this.ctx.getImageData(0,0,this.canvas.width,this.canvas.height);
    this.view = {zoom:1, panX:0, panY:0};
    this.drawAll();
  }

  showClusterPalette(colors, selected=[]){
    const pal = document.getElementById('cluster-palette'); pal.innerHTML='';
    colors.forEach((rgb, idx)=>{
      const el = document.createElement('div');
      el.className = 'swatch'; el.style.background = `rgb(${rgb.join(',')})`; el.title = `Cluster ${idx}`; el.dataset.idx = idx;
      if (selected.includes(idx)) el.classList.add('selected');
      pal.appendChild(el);
    });
  }

  drawGridOverlay(){
    const o = this.octx, w = this.overlay.width, h = this.overlay.height;
    this._resetView(o); o.clearRect(0,0,w,h); this._applyView(o);
    o.strokeStyle = 'rgba(0,255,80,0.15)'; o.lineWidth = 1/this.view.zoom; o.beginPath();
    for (let x=0; x<w; x+=10){ o.moveTo(x+0.5,0); o.lineTo(x+0.5,h); }
    for (let y=0; y<h; y+=10){ o.moveTo(0,y+0.5); o.lineTo(w,y+0.5); }
    o.stroke();
  }

  _drawOverlay(){
    const o = this.octx;
    this.drawGridOverlay();
    this._applyView(o);
    if (this.windowRect){
      o.fillStyle = 'rgba(0, 187, 85, 0.15)';
      o.strokeStyle = 'rgba(0, 187, 85, 0.9)';
      o.lineWidth = 2/this.view.zoom;
      o.fillRect(this.windowRect.x, this.windowRect.y, this.windowRect.w, this.windowRect.h);
      o.strokeRect(this.windowRect.x+0.5, this.windowRect.y+0.5, this.windowRect.w, this.windowRect.h);
    }
    // Türen (weiß), Vorschläge (cyan)
    (this.state.doors||[]).forEach(d => {
      if (d.suggested){
        o.fillStyle = 'rgba(59,215,255,0.25)';
        o.strokeStyle = 'rgba(59,215,255,0.95)';
      } else {
        o.fillStyle = 'rgba(255,255,255,0.22)';
        o.strokeStyle = 'rgba(255,255,255,0.9)';
      }
      o.lineWidth = 2/this.view.zoom;
      o.fillRect(d.x, d.y, d.w, d.h);
      o.strokeRect(d.x+0.5, d.y+0.5, d.w, d.h);
      if (d.suggested){
        // Close-Handle (X) oben rechts
        const sz = 18/this.view.zoom;
        const hx = d.x + d.w - sz, hy = d.y;
        o.fillStyle = 'rgba(0,0,0,0.8)';
        o.fillRect(hx, hy, sz, sz);
        o.strokeStyle = 'rgba(255,255,255,0.9)';
        o.beginPath(); o.moveTo(hx+3/this.view.zoom, hy+3/this.view.zoom); o.lineTo(hx+sz-3/this.view.zoom, hy+sz-3/this.view.zoom);
        o.moveTo(hx+sz-3/this.view.zoom, hy+3/this.view.zoom); o.lineTo(hx+3/this.view.zoom, hy+sz-3/this.view.zoom); o.stroke();
      }
    });
    // Schleusen (grün)
    o.fillStyle = 'rgba(0,212,106,0.25)'; o.strokeStyle = 'rgba(0,212,106,0.95)'; o.lineWidth = 2/this.view.zoom;
    (this.state.sluices||[]).forEach(s => { o.fillRect(s.x, s.y, s.w, s.h); o.strokeRect(s.x+0.5, s.y+0.5, s.w, s.h); });
    // Sites & Starts
    o.fillStyle = 'rgba(0,200,255,0.8)'; o.font = `${12/this.view.zoom}px system-ui`;
    (this.state.sites||[]).forEach(s => { o.beginPath(); o.arc(s.x, s.y, 6/this.view.zoom, 0, Math.PI*2); o.fill(); o.fillText(`#${s.id} ${s.name||''}`, s.x+8/this.view.zoom, s.y-8/this.view.zoom); });
    o.fillStyle = 'rgba(255,220,0,0.9)';
    (this.state.startPoints||[]).forEach(s => { o.beginPath(); o.moveTo(s.x, s.y-8/this.view.zoom); o.lineTo(s.x-7/this.view.zoom, s.y+8/this.view.zoom); o.lineTo(s.x+7/this.view.zoom, s.y+8/this.view.zoom); o.closePath(); o.fill(); o.fillText(s.name||'Start', s.x+8/this.view.zoom, s.y-8/this.view.zoom); });
    this._resetView(o);
  }

  drawAll(){
    const c = this.canvas, ctx = this.ctx;
    this._resetView(ctx); ctx.clearRect(0,0,c.width,c.height); this._applyView(ctx);
    if (this.state.imageData){ if (this.view.zoom===1 && this.view.panX===0 && this.view.panY===0){ ctx.putImageData(this.state.imageData,0,0); } else if (this.state.image){ ctx.drawImage(this.state.image,0,0); } }
    this.state.grid?.draw(ctx, this.view.zoom);
    this._resetView(ctx);
    this._drawOverlay();
  }

  setTool(t){ this.tool = t; document.querySelectorAll('.toolbar .tool').forEach(b => b.classList.toggle('active', b.dataset.tool===t)); if (t==='hand') this.toast('Hand/Zoom: Ziehen & Pinch‑Zoom.'); }
  clearWindowTool(){ this.windowRect=null; this._drawOverlay(); }
  undo(){ this.commandStack.undo(); this.drawAll(); }
  redo(){ this.commandStack.redo(); this.drawAll(); }

  toast(msg){ const div=document.createElement('div'); div.className='alert'; div.textContent=msg; document.getElementById('alerts').appendChild(div); setTimeout(()=>div.remove(), 3500); }
  alert(msg, level='warn'){ const div=document.createElement('div'); div.className='alert'+(level==='danger'?' error':''); div.textContent=msg; document.getElementById('alerts').appendChild(div); setTimeout(()=>div.remove(), 6000); }

  setCalibration(pxPerMeter){ this.state.calibration.px_per_meter = pxPerMeter; document.getElementById('calib-indicator').textContent = `px/m: ${pxPerMeter.toFixed(2)}`; document.getElementById('calib-status').textContent = `Kalibriert: ${pxPerMeter.toFixed(2)} px/m`; }

  _addCalibPoint(p){ const snap=v=>Math.round(v/10)*10; const q={x:snap(p.x), y:snap(p.y)}; this.calibPoints.push(q); this.octx.save(); this._applyView(this.octx); this.octx.fillStyle='rgba(0,180,255,0.9)'; this.octx.beginPath(); this.octx.arc(q.x,q.y,5/this.view.zoom,0,Math.PI*2); this.octx.fill(); this.octx.restore(); if (this.calibPoints.length===2){ this.state.mode=null; this.toast('Zwei Punkte gesetzt. Bitte Meter eingeben und "px/m berechnen".'); } }

  calibrate(){ if (this.calibPoints.length!==2){ this.state.mode='calibrate'; this.toast('Tippen Sie zwei Punkte auf dem Plan an.'); return; } const a=this.calibPoints[0], b=this.calibPoints[1]; const distPx=Math.hypot(b.x-a.x,b.y-a.y); const meters=parseFloat(document.getElementById('calib-meters').value); if (!meters || meters<=0){ this.toast('Bitte gültige Meterzahl eingeben.'); return; } const ppm=distPx/meters; this.setCalibration(ppm); this.calibPoints=[]; }

  addSite(){ const id = prompt('Standort‑ID (1–999):'); if (!id) return; const n = prompt('Name (z. B. Rampe):') || ''; const p = this._centerPointWorld(); const snap=v=>Math.round(v/10)*10; const s={id:Math.max(1,Math.min(999,parseInt(id,10)||1)), name:n, x:snap(p.x), y:snap(p.y), tags:['innen']}; this.state.sites.push(s); this.drawAll(); this._updateLists(); }
  addStart(){ const n = prompt('Startpunkt‑Name (z. B. Nordtor):') || 'Start'; const p = this._centerPointWorld(); const snap=v=>Math.round(v/10)*10; const s={name:n,x:snap(p.x),y:snap(p.y)}; this.state.startPoints.push(s); this.drawAll(); this._updateLists(); }
  _centerPointWorld(){ const rect=this.canvas.getBoundingClientRect(); const x=rect.left+rect.width/2, y=rect.top+rect.height/2; return this.toWorld(x,y); }
  _updateLists(){ const ulS=document.getElementById('list-sites'); ulS.innerHTML=''; this.state.sites.forEach(s=>{ const li=document.createElement('li'); li.innerHTML=`<strong>#${s.id}</strong> ${s.name||''} @ (${s.x},${s.y})`; ulS.appendChild(li); }); const ulP=document.getElementById('list-starts'); ulP.innerHTML=''; this.state.startPoints.forEach(s=>{ const li=document.createElement('li'); li.innerHTML=`<strong>${s.name||'Start'}</strong> @ (${s.x},${s.y})`; ulP.appendChild(li); }); }

  async importBundle(obj){
    const w = obj.canvas?.width || this.canvas.width; const h = obj.canvas?.height || this.canvas.height;
    this.canvas.width=w; this.canvas.height=h; this.overlay.width=w; this.overlay.height=h;
    if (obj.image?.dataUrl){ const img=new Image(); img.src=obj.image.dataUrl; await img.decode(); this.ctx.drawImage(img,0,0); this.state.image=img; this.state.imageData=this.ctx.getImageData(0,0,w,h); }
    this.state.calibration.px_per_meter = obj.calibration?.px_per_meter || 0;
    this.state.grid = Grid.fromBundle(obj.grid, w, h);
    this.state.doors = (obj.doors||[]).map(d=>({...d})); // no suggested flag in bundle
    this.state.sluices = obj.sluices||[]; this.state.sites = obj.sites||[]; this.state.startPoints = obj.startPoints||[];
    document.getElementById('meta-name').value = obj.meta?.name || ''; document.getElementById('meta-notes').value = obj.meta?.notes || '';
    this.drawAll(); this._updateLists(); if (this.state.calibration.px_per_meter) this.setCalibration(this.state.calibration.px_per_meter);
  }

  async runInWorker(fn, payload){
    return await new Promise((resolve,reject)=>{ const w = new Worker('./src/worker.js', {type:'module'}); w.onmessage = (e)=>{ w.terminate(); if (e.data?.error) reject(new Error(e.data.error)); else resolve(e.data); }; w.onerror = (e)=>{ w.terminate(); reject(e.message || e.error); }; w.postMessage({fn, payload}); });
  }

  preflight(){
    const items = [];
    items.push(('serviceWorker' in navigator) ? 'SW: verfügbar' : 'SW: nicht unterstützt');
    items.push(navigator.serviceWorker?.controller ? 'SW: aktiv' : 'SW: noch nicht aktiv (2x laden)');
    try{ localStorage.setItem('pf','1'); localStorage.removeItem('pf'); items.push('Storage: ok'); } catch(e){ items.push('Storage: blockiert'); }
    const c = document.createElement('canvas'); c.width=64; c.height=64; items.push(c.getContext('2d')? 'Canvas: ok':'Canvas: fehlt');
    items.push(typeof WebAssembly !== 'undefined' ? 'WASM: ok' : 'WASM: fehlt');
    items.push(('Worker' in window)? 'WebWorker: ok':'WebWorker: fehlt');
    items.push('DPR: ' + (window.devicePixelRatio||1));
    alert('Preflight\n' + items.join('\n'));
  }
}
