// K-Means Clusterung in CIELAB
import { rgbToLab } from './color.js';

export function kmeans(imageData, k=6, maxIter=12){
  const {data, width, height} = imageData;
  const n = width*height;
  // Sample für Performance
  const step = Math.max(1, Math.floor(n / (200*1000))); // bis zu ~200k Pixel
  const points = [];
  for (let i=0;i<n;i+=step){
    const r = data[i*4], g=data[i*4+1], b=data[i*4+2];
    const lab = rgbToLab(r,g,b);
    points.push(lab);
  }
  // init centroids zufällig
  const centroids = [];
  for (let i=0;i<k;i++){
    centroids.push(points[Math.floor(Math.random()*points.length)].slice());
  }
  const assign = new Array(points.length).fill(0);
  for (let it=0;it<maxIter;it++){
    // assignment
    for (let i=0;i<points.length;i++){
      let best=0, bestd=Infinity;
      for (let c=0;c<k;c++){
        const d = dist(points[i], centroids[c]);
        if (d<bestd){ bestd=d; best=c; }
      }
      assign[i]=best;
    }
    // recompute
    const sum = Array.from({length:k}, ()=>[0,0,0]);
    const cnt = new Array(k).fill(0);
    for (let i=0;i<points.length;i++){
      const a=assign[i]; const p=points[i];
      sum[a][0]+=p[0]; sum[a][1]+=p[1]; sum[a][2]+=p[2]; cnt[a]++;
    }
    for (let c=0;c<k;c++){
      if (cnt[c]===0) continue;
      centroids[c][0]=sum[c][0]/cnt[c];
      centroids[c][1]=sum[c][1]/cnt[c];
      centroids[c][2]=sum[c][2]/cnt[c];
    }
  }
  // Palette-Farben aus Centroids
  const clusterColors = centroids.map(([L,a,b]) => labToRgbApprox(L,a,b));
  return {centroids, clusterColors};
}

export function labelImageByCentroids(imageData, centroids){
  const {data, width, height} = imageData;
  const n = width*height;
  const idxMap = new Uint8Array(n);
  for (let i=0;i<n;i++){
    const r = data[i*4], g = data[i*4+1], b=data[i*4+2];
    const lab = rgbToLab(r,g,b);
    let best=0, bestd=Infinity;
    for (let c=0;c<centroids.length;c++){
      const d = dist(lab, centroids[c]);
      if (d<bestd){ bestd=d; best=c; }
    }
    idxMap[i]=best;
  }
  return idxMap;
}

function dist(a,b){ const d0=a[0]-b[0], d1=a[1]-b[1], d2=a[2]-b[2]; return d0*d0+d1*d1+d2*d2; }

// Lab->RGB approximiert für Palette (nicht farbmetrisch exakt, aber stabil)
function labToRgbApprox(L,a,b){
  // XYZ referenzweiß D65
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const xr = fx**3 > 0.008856 ? fx**3 : (fx - 16/116)/7.787;
  const yr = fy**3 > 0.008856 ? fy**3 : (fy - 16/116)/7.787;
  const zr = fz**3 > 0.008856 ? fz**3 : (fz - 16/116)/7.787;
  const X = xr * 95.047, Y = yr * 100.0, Z = zr * 108.883;
  let R = X* 0.032406 + Y*(-0.015372) + Z*(-0.004986);
  let G = X*(-0.009689) + Y* 0.018758 + Z* 0.000415;
  let B = X* 0.000557 + Y*(-0.002040) + Z* 0.010570;
  const toSRGB = (u)=>{ u/=100; return u<=0.0031308 ? 12.92*u : 1.055*(u**(1/2.4)) - 0.055; };
  R = Math.max(0, Math.min(255, Math.round(toSRGB(R)*255)));
  G = Math.max(0, Math.min(255, Math.round(toSRGB(G)*255)));
  B = Math.max(0, Math.min(255, Math.round(toSRGB(B)*255)));
  return [R,G,B];
}
