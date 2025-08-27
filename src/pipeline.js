import { kmeans, labelImageByCentroids } from './kmeans.js';
import { sobel, otsuThreshold } from './edges.js';
import { maskFromClusters, thresholdImageFloat, closing, opening, fillHoles, edgeRefine } from './morph.js';

export async function runPipeline(imageData, {k=6, tolerance=10, selectedClusters=[]}={}){
  // 1) Farb-Clusterung in Lab
  const {centroids, clusterColors} = kmeans(imageData, k);
  const clusterIndexMap = labelImageByCentroids(imageData, centroids);
  // Der Nutzer wählt Clusternummer(n). Wenn nichts gewählt, nehme das dunkelste Cluster als Halle.
  if (!selectedClusters || !selectedClusters.length){
    // dunkelstes Cluster via L-Wert aus centroid
    let idx=0, minL=Infinity;
    centroids.forEach((lab,i)=>{ if (lab[0]<minL){ minL=lab[0]; idx=i; } });
    selectedClusters = [idx];
  }
  // 2) Maske für "blockiert"
  const {mask, width, height} = maskFromClusters(clusterIndexMap, imageData.width, imageData.height, selectedClusters, tolerance);
  // Kanten (Sobel) + Otsu auf Kante zur Verstärkung
  const edge = sobel(imageData);
  const thr = otsuThreshold(edge, width, height);
  const edgeMask = thresholdImageFloat(edge, width, height, thr).mask;
  // Morphologisches Closing + Fill Holes
  let merged = new Uint8Array(width*height);
  for (let i=0;i<merged.length;i++) merged[i] = (mask[i] || edgeMask[i]) ? 1 : 0;
  merged = closing(merged, width, height);
  merged = fillHoles(merged, width, height);
  merged = edgeRefine(merged, width, height);
  // Opening leicht zur Glättung
  merged = opening(merged, width, height);
  return { mask: {mask: merged, width, height}, clusterColors, clusterIndexMap };
}

// 4) Türen/Öffnungen heuristisch
export function suggestDoors(maskObj, cell=10){
  const {mask, width, height} = maskObj;
  // Suche schmale helle Korridore zwischen zwei blockierten Bereichen
  // Heuristik: Scan entlang Rasterlinien; Öffnung wenn Sequenz von 0ern zwischen 1ern mit Breite <= 2 Zellen.
  const doors = [];
  const maxCells = 2;
  for (let y=0; y<height; y+=cell){
    for (let x=cell; x<width-cell; x+=cell){
      // Horizontaler Übergang
      const left = mask[y*width + x-1], right = mask[y*width + x];
      if (left && right) continue; // innerhalb Block
      // Finde Lücke
      let span=0;
      while (x+span<width && !mask[y*width + (x+span)]) span++;
      if (span>0 && span<=maxCells*cell){
        doors.push({x:x, y:Math.max(0,y-cell/2), w:span, h:cell, name:'Öffnung', type:'door'});
        x += span;
      }
    }
  }
  // vertikal
  for (let x=0; x<width; x+=cell){
    for (let y=cell; y<height-cell; y+=cell){
      let span=0;
      while (y+span<height && !mask[(y+span)*width + x]) span++;
      if (span>0 && span<=maxCells*cell){
        doors.push({x:Math.max(0,x-cell/2), y:y, w:cell, h:span, name:'Öffnung', type:'door'});
        y += span;
      }
    }
  }
  return doors;
}
