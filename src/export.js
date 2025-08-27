export class Exporter{
  constructor(state){ this.state = state; }
  exportBundle({embedImage=true}={}){
    const canvas = document.getElementById('plan-canvas');
    const bundle = {
      schema: 'bn-mapbundle-1.0',
      meta: { name: document.getElementById('meta-name').value || 'Werk/Halle', createdAt: new Date().toISOString().slice(0,10), notes: document.getElementById('meta-notes').value || '' },
      calibration: { px_per_meter: this.state.calibration.px_per_meter || 0 },
      canvas: { width: canvas.width, height: canvas.height },
      grid: this.state.grid?.toBundle() || {cell:10, cols:Math.ceil(canvas.width/10), rows:Math.ceil(canvas.height/10), walls_cells:[], zones_cells:[]},
      doors: this.state.doors || [],
      sluices: this.state.sluices || [],
      sites: this.state.sites || [],
      startPoints: this.state.startPoints || [],
      image: embedImage ? { dataUrl: canvas.toDataURL('image/png') } : undefined
    };
    const json = JSON.stringify(bundle, null, 2);
    return new Blob([json], {type:'application/json'});
  }
}
