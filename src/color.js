// RGB -> CIELAB (D65) – stabiler bzgl. Helligkeit
function pivotRGB(u){ u/=255; return (u<=0.04045) ? u/12.92 : ((u+0.055)/1.055)**2.4; }
export function rgbToLab(r,g,b){
  const R=pivotRGB(r), G=pivotRGB(g), B=pivotRGB(b);
  // sRGB -> XYZ (D65)
  const X = (R*0.4124564 + G*0.3575761 + B*0.1804375) * 100;
  const Y = (R*0.2126729 + G*0.7151522 + B*0.0721750) * 100;
  const Z = (R*0.0193339 + G*0.1191920 + B*0.9503041) * 100;
  // XYZ -> Lab
  const ref=[95.047,100.000,108.883];
  const f=(t)=>{ const v=t/ref.shift(); return v>0.008856? Math.cbrt(v) : (7.787*v + 16/116); };
  const fx = ((X/95.047)>0.008856) ? Math.cbrt(X/95.047) : (7.787*(X/95.047) + 16/116);
  const fy = ((Y/100.000)>0.008856) ? Math.cbrt(Y/100.000) : (7.787*(Y/100.000) + 16/116);
  const fz = ((Z/108.883)>0.008856) ? Math.cbrt(Z/108.883) : (7.787*(Z/108.883) + 16/116);
  const L = (116*fy) - 16;
  const a = 500*(fx - fy);
  const b = 200*(fy - fz);
  return [L, a, b];
}
