function pivotRGB(u){ u/=255; return (u<=0.04045) ? u/12.92 : ((u+0.055)/1.055)**2.4; }
export function rgbToLab(r,g,b){
  const R=pivotRGB(r), G=pivotRGB(g), B=pivotRGB(b);
  const X = (R*0.4124564 + G*0.3575761 + B*0.1804375) * 100;
  const Y = (R*0.2126729 + G*0.7151522 + B*0.0721750) * 100;
  const Z = (R*0.0193339 + G*0.1191920 + B*0.9503041) * 100;
  const xr = X/95.047, yr = Y/100.000, zr = Z/108.883;
  const fx = xr > 0.008856 ? Math.cbrt(xr) : (7.787*xr + 16/116);
  const fy = yr > 0.008856 ? Math.cbrt(yr) : (7.787*yr + 16/116);
  const fz = zr > 0.008856 ? Math.cbrt(zr) : (7.787*zr + 16/116);
  const L = (116*fy) - 16;
  const a = 500*(fx - fy);
  const b2 = 200*(fy - fz);
  return [L, a, b2];
}
