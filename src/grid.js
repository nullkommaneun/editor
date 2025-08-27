export class Grid{
  constructor(cell, cols, rows, width, height){
    this.cell = cell; this.cols = cols; this.rows = rows;
    this.width = width; this.height = height;
    this.walls = new Set();
    this.zones = new Set();
  }
  static fromMask(maskObj, cell=10, occupancy=0.4){
    const {mask, width, height} = maskObj;
    const cols = Math.ceil(width/cell), rows = Math.ceil(height/cell);
    const g = new Grid(cell, cols, rows, width, height);
    for (let r=0;r<rows;r++){
      for (let c=0;c<cols;c++){
        const x0=c*cell, y0=r*cell, x1=Math.min(x0+cell, width), y1=Math.min(y0+cell, height);
        let count=0, total=(x1-x0)*(y1-y0);
        for (let y=y0;y<y1;y++){
          for (let x=x0;x<x1;x++){
            if (mask[y*width+x]) count++;
          }
        }
        if (count/total >= occupancy){
          g.walls.add(`${c}_${r}`);
        }
      }
    }
    return g;
  }
  static fromBundle(gridObj, width, height){
    const g = new Grid(gridObj.cell, gridObj.cols, gridObj.rows, width, height);
    (gridObj.walls_cells||[]).forEach(k => g.walls.add(k));
    (gridObj.zones_cells||[]).forEach(k => g.zones.add(k));
    return g;
  }
  addWalls(keys){ keys.forEach(k=>this.walls.add(k)); }
  removeWalls(keys){ keys.forEach(k=>this.walls.delete(k)); }
  addZones(keys){ keys.forEach(k=>this.zones.add(k)); }
  removeZones(keys){ keys.forEach(k=>this.zones.delete(k)); }
  draw(ctx){
    const cs = this.cell;
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(80,120,120,0.8)';
    for (const k of this.walls){
      const [c,r] = k.split('_').map(Number);
      ctx.fillRect(c*cs, r*cs, cs, cs);
    }
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = 'rgba(255,80,80,0.7)';
    for (const k of this.zones){
      const [c,r] = k.split('_').map(Number);
      ctx.fillRect(c*cs, r*cs, cs, cs);
    }
    ctx.restore();
  }
  toBundle(){
    return {
      cell: this.cell, cols: this.cols, rows: this.rows,
      walls_cells: Array.from(this.walls),
      zones_cells: Array.from(this.zones),
    };
  }
}
