import { kmeans, labelImageByCentroids } from './kmeans.js';
import { sobel, otsuThreshold } from './edges.js';
import { maskFromClustersIdxMap, thresholdImageFloat, closing, opening, fillHoles, edgeRefine } from './morph.js';

export async function runPipeline(imageData, {k=6, tolerance=10, selectedClusters=[]}={}){
  const timings = {};
  const t = (name, fn) => { const t0=performance.now(); const r=fn(); timings[name]=performance.now()-t0; return r; };

  const {centroids, clusterColors} = t('kmeans', ()=>kmeans(imageData, k));
  const clusterIndexMap = t('label', ()=>labelImageByCentroids(imageData, centroids));

  if (!selectedClusters || !selectedClusters.length){
    let idx=0, minL=Infinity; centroids.forEach((lab,i)=>{ if (lab[0]<minL){ minL=lab[0]; idx=i; } }); selectedClusters = [idx];
  }

  let {mask, width, height} = t('mask', ()=>maskFromClustersIdxMap(clusterIndexMap, imageData.width, imageData.height, selectedClusters, centroids, tolerance));
  const edge = t('sobel', ()=>sobel(imageData));
  const thr = otsuThreshold(edge, width, height);
  const edgeMask = thresholdImageFloat(edge, width, height, thr).mask;

  let merged = new Uint8Array(width*height);
  for (let i=0;i<merged.length;i++) merged[i] = (mask[i] || edgeMask[i]) ? 1 : 0;
  merged = t('closing', ()=>closing(merged, width, height));
  merged = t('fillholes', ()=>fillHoles(merged, width, height));
  merged = t('edgeRefine', ()=>edgeRefine(merged, width, height));
  merged = t('opening', ()=>opening(merged, width, height));
  timings.total = Object.values(timings).reduce((a,b)=>a+b,0);
  return { mask: {mask: merged, width, height}, clusterColors, centroids, timings };
}

/**
 * Türen 2.0 (Option C): Narrow‑Pass auf Raster + Skeleton‑Filter (Zhang‑Suen auf Freiraum)
 * Ergebnis: Türvorschläge als Rechtecke in Weltkoordinaten (Pixel), Breite ≤ 2 Zellen.
 */
export function suggestDoorsC(maskObj, cell=10){
  const {mask, width, height} = maskObj;
  const cols = Math.ceil(width/cell), rows = Math.ceil(height/cell);
  // blocked grid via majority vote
  const blocked = new Uint8Array(cols*rows);
  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      const x0=c*cell, y0=r*cell, x1=Math.min(x0+cell,width), y1=Math.min(y0+cell,height);
      let count=0, total=(x1-x0)*(y1-y0);
      for (let y=y0;y<y1;y++){ for (let x=x0;x<x1;x++){ if (mask[y*width+x]) count++; } }
      if (count/total >= 0.4) blocked[r*cols+c]=1;
    }
  }
  // free grid (1=free)
  const free = new Uint8Array(cols*rows);
  for (let i=0;i<free.length;i++) free[i] = blocked[i]?0:1;

  // Zhang‑Suen Thinning (auf free==1)
  const skel = zhangSuen(free, cols, rows);

  const doors = [];
  const maxCells = 2;

  // Check narrow horizontal gaps around skeleton pixels
  for (let r=1;r<rows-1;r++){
    for (let c=1;c<cols-1;c++){
      const i=r*cols+c;
      if (!skel[i]) continue;
      // Horizontal pass: block | free-run | block
      if (blocked[i-1] && !blocked[i] && blocked[i+1]){
        let left=0; while (c-left-1>=0 && !blocked[r*cols + (c-left-1)]) left++;
        let right=0; while (c+right+1<cols && !blocked[r*cols + (c+right+1)]) right++;
        const span = left+right+1;
        if (span>0 && span<=maxCells){
          const x = (c-left)*cell, y = r*cell, w = span*cell, h = cell;
          doors.push({x, y: Math.max(0,y - cell/2), w, h});
        }
      }
      // Vertical pass
      if (blocked[i-cols] && !blocked[i] && blocked[i+cols]){
        let up=0; while (r-up-1>=0 && !blocked[(r-up-1)*cols + c]) up++;
        let down=0; while (r+down+1<rows && !blocked[(r+down+1)*cols + c]) down++;
        const span = up+down+1;
        if (span>0 && span<=maxCells){
          const x = c*cell, y = (r-up)*cell, w = cell, h = span*cell;
          doors.push({x: Math.max(0,x - cell/2), y, w, h});
        }
      }
    }
  }
  // Merge near-duplicates
  return mergeNearbyRects(doors, cell/2);
}

// Thinning (Zhang‑Suen) auf binärem Raster (1=free/foreground)
function zhangSuen(bin, cols, rows){
  const out = bin.slice(0);
  let changed=true;
  const idx=(c,r)=> r*cols+c;
  const N = (c,r)=>{
    const p = [
      out[idx(c,r-1)], out[idx(c+1,r-1)], out[idx(c+1,r)],
      out[idx(c+1,r+1)], out[idx(c,r+1)], out[idx(c-1,r+1)],
      out[idx(c-1,r)], out[idx(c-1,r-1)]
    ];
    return p;
  };
  const sum = (p)=> p[0]+p[1]+p[2]+p[3]+p[4]+p[5]+p[6]+p[7];
  const trans = (p)=> { let t=0; for (let i=0;i<8;i++){ if (p[i]===0 && p[(i+1)%8]===1) t++; } return t; };
  // pad border as 0
  const get=(c,r)=> (c<=0||r<=0||c>=cols-1||r>=rows-1)?0:out[idx(c,r)];
  while(changed){
    changed=false;
    const rem=[];
    for (let r=1;r<rows-1;r++) for (let c=1;c<cols-1;c++){
      const P = get(c,r); if (!P) continue;
      const p = [
        get(c, r-1), get(c+1, r-1), get(c+1, r),
        get(c+1, r+1), get(c, r+1), get(c-1, r+1),
        get(c-1, r), get(c-1, r-1)
      ];
      const S = sum(p);
      const T = trans(p);
      if (S>=2 && S<=6 && T===1 && (p[0]*p[2]*p[4]===0) && (p[2]*p[4]*p[6]===0)) rem.push(idx(c,r));
    }
    if (rem.length){ changed=true; rem.forEach(i=> out[i]=0); }
    const rem2=[];
    for (let r=1;r<rows-1;r++) for (let c=1;c<cols-1;c++){
      const P = get(c,r); if (!P) continue;
      const p = [
        get(c, r-1), get(c+1, r-1), get(c+1, r),
        get(c+1, r+1), get(c, r+1), get(c-1, r+1),
        get(c-1, r), get(c-1, r-1)
      ];
      const S = sum(p);
      const T = trans(p);
      if (S>=2 && S<=6 && T===1 && (p[0]*p[2]*p[6]===0) && (p[0]*p[4]*p[6]===0)) rem2.push(idx(c,r));
    }
    if (rem2.length){ changed=true; rem2.forEach(i=> out[i]=0); }
  }
  return out;
}

function mergeNearbyRects(rects, tol){
  const res=[];
  for (const r of rects){
    let merged=false;
    for (const q of res){
      if (Math.abs(r.x-q.x)<=tol && Math.abs(r.y-q.y)<=tol && Math.abs(r.w-q.w)<=tol && Math.abs(r.h-q.h)<=tol){
        // merge by expanding bounds
        const nx = Math.min(r.x,q.x), ny=Math.min(r.y,q.y);
        const nx2 = Math.max(r.x+r.w, q.x+q.w), ny2 = Math.max(r.y+r.h, q.y+q.h);
        q.x=nx; q.y=ny; q.w=nx2-nx; q.h=ny2-ny; merged=true; break;
      }
    }
    if (!merged) res.push({...r});
  }
  return res;
}
