export const Quality = {
  check(state){
    const alerts = [];
    // Kalibrierung
    if (!state.calibration.px_per_meter || state.calibration.px_per_meter<=0){
      alerts.push({level:'warn', text:'Keine Kalibrierung gesetzt (px/m).'});
    }
    // Standorte
    if (!state.sites?.length){ alerts.push({level:'warn', text:'Keine Standorte gesetzt.'}); }
    // Erreichbarkeit
    const report = [];
    if (state.grid){
      const cols = state.grid.cols, rows=state.grid.rows, cell=state.grid.cell;
      const blocked = state.grid.walls;
      const inside = (c,r)=> c>=0&&r>=0&&c<cols&&r<rows;
      const walkable = (c,r)=> inside(c,r) && !blocked.has(`${c}_${r}`);
      const flood = (start)=>{
        const seen = new Set();
        const q = [start]; seen.add(start);
        while(q.length){
          const [c,r] = q.shift();
          [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dc,dr])=>{
            const nc=c+dc, nr=r+dr, k=`${nc}_${nr}`;
            if (walkable(nc,nr) && !seen.has(k)){ seen.add(k); q.push([nc,nr]); }
          });
        }
        return seen;
      };
      // Pick a seed: first non-blocked cell
      let seed=null;
      outer: for (let r=0;r<rows;r++) for (let c=0;c<cols;c++){
        if (walkable(c,r)){ seed=`${c}_${r}`; break outer; }
      }
      let reach = new Set();
      if (seed){
        const [sc,sr] = seed.split('_').map(Number);
        reach = flood([sc,sr]);
      }
      const unreachableSites = (state.sites||[]).filter(s => {
        const c = Math.floor(s.x/cell), r=Math.floor(s.y/cell);
        return !reach.has(`${c}_${r}`);
      });
      if (unreachableSites.length){
        alerts.push({level:'danger', text:`${unreachableSites.length} Standort(e) unzugänglich.`});
        report.push(`<li><strong>Unzugängliche Standorte:</strong> ${unreachableSites.map(s=>`#${s.id} ${s.name}`).join(', ')}</li>`);
      }
      // Abdeckung
      const total = cols*rows;
      const blockedCount = blocked.size;
      const ratio = blockedCount/total;
      if (ratio>0.85 || ratio<0.05){
        alerts.push({level:'warn', text:'Auffällige Abdeckung (zu hoch/zu niedrig) – bitte Plausibilität prüfen.'});
      }
      report.push(`<li>Abdeckung (blockiert): ${(ratio*100).toFixed(1)}%</li>`);
      // Kürzeste-Wege-Lücken
      const starts = state.startPoints||[];
      if (starts.length && state.sites.length){
        const gaps = [];
        for (const sp of starts){
          const sc = Math.floor(sp.x/cell), sr=Math.floor(sp.y/cell);
          if (!walkable(sc,sr)) { gaps.push(`${sp.name} auf blockierter Zelle`); continue; }
          for (const site of state.sites){
            const tc = Math.floor(site.x/cell), tr=Math.floor(site.y/cell);
            if (!walkable(tc,tr) || !reach.has(`${tc}_${tr}`)){ gaps.push(`${sp.name} ⇄ #${site.id} ${site.name}`); }
          }
        }
        if (gaps.length){ alerts.push({level:'warn', text:`Kürzeste‑Wege‑Lücken: ${gaps.length}`}); report.push(`<li>Fehlende Verbindungen: ${gaps.join('; ')}</li>`); }
      }
    }
    const html = `<ul>${report.join('')}</ul>`;
    return {alerts: alerts.map(a=>a.text), html};
  }
};
