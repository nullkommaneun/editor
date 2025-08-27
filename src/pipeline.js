import { kmeans, labelImageByCentroids } from './kmeans.js';
import { sobel, otsuThreshold } from './edges.js';
import { maskFromClustersIdxMap, thresholdImageFloat, closing, opening, fillHoles, edgeRefine } from './morph.js';

export async function runPipeline(imageData, {k=6, tolerance=10, selectedClusters=[]}={}){
  // 1) Farb-Clusterung in Lab
  const {centroids, clusterColors} = kmeans(imageData, k);
  const clusterIndexMap = labelImageByCentroids(imageData, centroids);
  // Falls nichts gewählt: dunkelstes Cluster (niedrigstes L) als Halle
  if (!selectedClusters || !selectedClusters.length){
    let idx=0, minL=Infinity;
    centroids.forEach((lab,i)=>{ if (lab[0]<minL){ minL=lab[0]; idx=i; } });
    selectedClusters = [idx];
  }
  // 2) Maske für "blockiert" (ΔE‑Toleranz auf Centroids)
  let {mask, width, height} = maskFromClustersIdxMap(clusterIndexMap, imageData.width, imageData.height, selectedClusters, centroids, tolerance);
  // Kanten (Sobel) + Otsu auf Kante zur Verstärkung
  const edge = sobel(imageData);
  const thr = otsuThreshold(edge, width, height);
  const edgeMask = thresholdImageFloat(edge, width, height, thr).mask;
  // Morphologisches Closing + Fill Holes + leichte Verfeinerung
  let merged = new Uint8Array(width*height);
  for (let i=0;i<merged.length;i++) merged[i] = (mask[i] || edgeMask[i]) ? 1 : 0;
  merged = closing(merged, width, height);
  merged = fillHoles(merged, width, height);
  merged = edgeRefine(merged, width, height);
  merged = opening(merged, width, height);
  return { mask: {mask: merged, width, height}, clusterColors, centroids };
}

// 4) Türen/Öffnungen heuristisch
export function suggestDoors(maskObj, cell=10){
  const {mask, width, height} = maskObj;
  const doors = [];
  const maxCells = 2;
  // Horizontal
  for (let y=0; y<height; y+=cell){
    let x=cell;
    while (x<width-cell){
      if (mask[y*width + x-1] && !mask[y*width + x]){
        let span=0;
        while (x+span<width && !mask[y*width + (x+span)]) span++;
        if (span>0 && span<=maxCells*cell){
          doors.push({x:x, y:Math.max(0,y-cell/2), w:span, h:cell, name:'Öffnung', type:'door'});
          x += span; continue;
        }
      }
      x+=cell;
    }
  }
  // Vertikal
  for (let x=0; x<width; x+=cell){
    let y=cell;
    while (y<height-cell){
      if (mask[(y-1)*width + x] && !mask[y*width + x]){
        let span=0;
        while (y+span<height && !mask[(y+span)*width + x]) span++;
        if (span>0 && span<=maxCells*cell){
          doors.push({x:Math.max(0,x-cell/2), y:y, w:cell, h:span, name:'Öffnung', type:'door'});
          y += span; continue;
        }
      }
      y+=cell;
    }
  }
  return doors;
}
