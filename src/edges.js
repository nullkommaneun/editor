export function sobel(imageData){
  const {data, width, height} = imageData;
  const out = new Float32Array(width*height);
  const get = (x,y)=>{
    x = Math.max(0, Math.min(width-1, x));
    y = Math.max(0, Math.min(height-1, y));
    const i=(y*width+x)*4;
    const r=data[i], g=data[i+1], b=data[i+2];
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  for (let y=0;y<height;y++){
    for (let x=0;x<width;x++){
      const gx = -get(x-1,y-1)-2*get(x-1,y)-get(x-1,y+1)
                 + get(x+1,y-1)+2*get(x+1,y)+get(x+1,y+1);
      const gy = -get(x-1,y-1)-2*get(x,y-1)-get(x+1,y-1)
                 + get(x-1,y+1)+2*get(x,y+1)+get(x+1,y+1);
      out[y*width+x] = Math.hypot(gx, gy);
    }
  }
  return out;
}

export function otsuThreshold(gray, width, height){
  let min=Infinity, max=-Infinity;
  for (let i=0;i<gray.length;i++){ const v=gray[i]; if (v<min) min=v; if (v>max) max=v; }
  const hist = new Uint32Array(256);
  const scale = (max>min)? 255/(max-min) : 0;
  for (let i=0;i<gray.length;i++){ const v = Math.max(0, Math.min(255, Math.round((gray[i]-min)*scale))); hist[v]++; }
  const total = gray.length;
  let sum=0; for (let t=0;t<256;t++) sum+=t*hist[t];
  let sumB=0, wB=0, varMax=0, thresh=0;
  for (let t=0;t<256;t++){
    wB += hist[t]; if (wB===0) continue;
    const wF = total - wB; if (wF===0) break;
    sumB += t*hist[t];
    const mB = sumB/wB;
    const mF = (sum - sumB)/wF;
    const v = wB*wF*(mB-mF)*(mB-mF);
    if (v>varMax){ varMax=v; thresh=t; }
  }
  const thr = min + (thresh/255)*(max-min);
  return thr;
}
