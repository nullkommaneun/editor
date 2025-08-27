export class AppState{
  constructor(){
    this.image = null;
    this.imageData = null;
    this.pipeline = { k:6, tolerance:10, selectedClusters:[], clusterColors:[], centroids:null };
    this.grid = null;
    this.doors = [];     // {x,y,w,h,name,type, suggested?}
    this.sluices = [];   // {x,y,w,h,name,delay_s}
    this.sites = [];
    this.startPoints = [];
    this.calibration = { px_per_meter: 0 };
    this.mode = null;
  }
}
