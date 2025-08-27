export const Quality = {
  check(state, {pathMetrics=false}={}){
    const alerts = []; const add=(level,text)=>alerts.push({level,text});
    if (!state.calibration.px_per_meter || state.calibration.px_per_meter<=0){ add('warn','Keine Kalibrierung gesetzt (px/m).'); }
    if (!state.sites?.length){ add('warn','Keine Standorte gesetzt.'); }
    const report = [];
    if (state.grid){
      const cols=state.grid.cols, rows=state.grid.rows, cell=state.grid.cell, blocked=state.grid.walls;
      const inside=(c,r)=> c>=0&&r>=0&&c<cols&&r<rows;
      const walkable=(c,r)=> inside(c,r) && !blocked.has(`${c}_${r}`);
      // Flood für Erreichbarkeit
      let seed=null; outer: for (let r=0;r<rows;r++) for (let c=0;c<cols;c++){ if (walkable(c,r)){ seed={c,r}; break outer; } }
      const reach = new Set();
      if (seed){
        const q=[[seed.c,seed.r]]; reach.add(`${seed.c}_${seed.r}`);
        while(q.length){ const [c,r]=q.shift(); [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dc,dr])=>{ const nc=c+dc,nr=r+dr,k=`${nc}_${nr}`; if (walkable(nc,nr) && !reach.has(k)){ reach.add(k); q.push([nc,nr]); } }); }
      }
      const unreachableSites=(state.sites||[]).filter(s=>!reach.has(`${Math.floor(s.x/cell)}_${Math.floor(s.y/cell)}`));
      if (unreachableSites.length){ add('danger', `${unreachableSites.length} Standort(e) unzugänglich: ${unreachableSites.map(s=>`#${s.id} ${s.name}`).join(', ')}`); report.push(`<li><strong>Unzugängliche Standorte:</strong> ${unreachableSites.map(s=>`#${s.id} ${s.name}`).join(', ')}</li>`); }
      const total=cols*rows, blockedCount=blocked.size, ratio=blockedCount/total;
      if (ratio>0.85 || ratio<0.05) add('warn','Auffällige Abdeckung (zu hoch/zu niedrig) – bitte Plausibilität prüfen.');
      report.push(`<li>Abdeckung (blockiert): ${(ratio*100).toFixed(1)}%</li>`);
      // Optionale Pfadmetriken (A* auf 4‑Nachbarn)
      if (pathMetrics && state.startPoints?.length && state.sites?.length){
        const h=(c,r,tc,tr)=>Math.abs(tc-c)+Math.abs(tr-r);
        const key=(c,r)=>`${c}_${r}`;
        const astar=(sc,sr,tc,tr)=>{
          if (!walkable(sc,sr) || !walkable(tc,tr)) return {dist:Infinity};
          const open=new Map(); const g=new Map(); const f=new Map(); const came=new Map();
          const startK=key(sc,sr), goalK=key(tc,tr);
          open.set(startK,[sc,sr]); g.set(startK,0); f.set(startK,h(sc,sr,tc,tr));
          while(open.size){
            // min f
            let curK=null, cf=Infinity;
            for (const [k] of open){ const v=f.get(k)??Infinity; if (v<cf){ cf=v; curK=k; } }
            const [c,r]=open.get(curK);
            if (curK===goalK) return {dist:g.get(curK)};
            open.delete(curK);
            const neigh=[[1,0],[-1,0],[0,1],[0,-1]];
            for (const [dc,dr] of neigh){
              const nc=c+dc, nr=r+dr, nk=key(nc,nr);
              if (!walkable(nc,nr)) continue;
              const tentative = (g.get(curK)??Infinity)+1;
              if (tentative < (g.get(nk)??Infinity)){
                came.set(nk,curK); g.set(nk,tentative); f.set(nk, tentative + h(nc,nr,tc,tr));
                if (!open.has(nk)) open.set(nk,[nc,nr]);
              }
            }
          }
          return {dist:Infinity};
        };
        const ppm = state.calibration.px_per_meter||0;
        const metersPerCell = ppm ? (cell/ppm) : null;
        const rowsOut = [];
        let worst = {label:'', dist: -1};
        for (const sp of state.startPoints){
          const sc=Math.floor(sp.x/cell), sr=Math.floor(sp.y/cell);
          for (const site of state.sites){
            const tc=Math.floor(site.x/cell), tr=Math.floor(site.y/cell);
            const res=astar(sc,sr,tc,tr);
            const cells = res.dist;
            const meters = (metersPerCell!=null && isFinite(cells)) ? (cells*metersPerCell) : null;
            const label = `${sp.name} → #${site.id} ${site.name}`;
            if (!isFinite(cells)) rowsOut.push(`<li>Pfad fehlt: ${label}</li>`);
            else {
              rowsOut.push(`<li>${label}: ${cells} Zellen${meters!=null?` ≈ ${meters.toFixed(1)} m`:''}</li>`);
              if (cells>worst.dist) worst={label, dist:cells};
            }
          }
        }
        if (rowsOut.length) report.push(`<li><strong>Pfadmessungen (A*):</strong><ul>${rowsOut.join('')}</ul></li>`);
        if (worst.dist>=0) add('warn', `Längster Pfad: ${worst.label} (${worst.dist} Zellen)`);
      }
    }
    return {alerts, html:`<ul>${report.join('')}</ul>`};
  }
};
