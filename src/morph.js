// Binäre Morphologie & Flood Fill
export function thresholdImageFloat(gray, width, height, thr){
  const mask = new Uint8Array(width*height);
  for (let i=0;i<gray.length;i++) mask[i] = gray[i] >= thr ? 1 : 0;
  return {mask, width, height};
}

export function maskFromClustersIdxMap(idxMap, width, height, selectedIndices=[], centroids=null, toleranceDE=0){
  const mask = new Uint8Array(width*height);
  if (!selectedIndices.length){ return {mask, width, height}; }
  // Wenn Toleranz > 0: erweitere Auswahl um Centroids mit ΔE <= toleranceDE
  let allowed = new Set(selectedIndices);
  if (centroids && toleranceDE>0){
    const dE = (a,b)=> Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
    const targets = selectedIndices.map(i=>centroids[i]);
    centroids.forEach((c,idx)=>{
      for (const t of targets){ if (dE(c,t) <= toleranceDE){ allowed.add(idx); break; } }
    });
  }
  for (let i=0;i<idxMap.length;i++){ mask[i] = allowed.has(idxMap[i]) ? 1 : 0; }
  return {mask, width, height};
}

export function dilate(bin, width, height){
  const out = new Uint8Array(width*height);
  const get=(x,y)=> (x<0||y<0||x>=width||y>=height)?0:bin[y*width+x];
  for (let y=0;y<height;y++){
    for (let x=0;x<width;x++){
      let v=0;
      for (let j=-1;j<=1;j++) for (let i=-1;i<=1;i++) v = v || get(x+i,y+j);
      out[y*width+x] = v?1:0;
    }
  }
  return out;
}
export function erode(bin, width, height){
  const out = new Uint8Array(width*height);
  const get=(x,y)=> (x<0||y<0||x>=width||y>=height)?0:bin[y*width+x];
  for (let y=0;y<height;y++){
    for (let x=0;x<width;x++){
      let v=1;
      for (let j=-1;j<=1;j++) for (let i=-1;i<=1;i++) v = v && get(x+i,y+j);
      out[y*width+x] = v?1:0;
    }
  }
  return out;
}

export function closing(bin, width, height){
  return erode(dilate(bin, width, height), width, height);
}
export function opening(bin, width, height){
  return dilate(erode(bin, width, height), width, height);
}

export function fillHoles(bin, width, height){
  // flood fill vom Rand im invertierten Bild
  const inv = new Uint8Array(width*height);
  for (let i=0;i<inv.length;i++) inv[i] = bin[i] ? 0 : 1;
  const visited = new Uint8Array(width*height);
  const q = [];
  const push=(x,y)=>{ if (x<0||y<0||x>=width||y>=height) return; const idx=y*width+x; if (!inv[idx]||visited[idx]) return; visited[idx]=1; q.push([x,y]); };
  for (let x=0;x<width;x++){ push(x,0); push(x,height-1); }
  for (let y=0;y<height;y++){ push(0,y); push(width-1,y); }
  while (q.length){
    const [x,y]=q.shift();
    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=> push(x+dx,y+dy));
  }
  // Löcher sind inv==1 && visited==0
  const out = bin.slice(0);
  for (let i=0;i<out.length;i++){
    if (inv[i] && !visited[i]) out[i]=1;
  }
  return out;
}

export function edgeRefine(bin, width, height){
  // einfache Verfeinerung: dünne Randpixel entfernen (1 Erosion)
  return erode(bin, width, height);
}
