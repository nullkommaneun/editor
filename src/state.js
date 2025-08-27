export class AppState{
  constructor(){
    this.image = null;
    this.imageData = null;
    this.pipeline = { k:6, tolerance:10, selectedClusters:[], clusterColors:[], clusterIndexMap:null };
    this.grid = null;
    this.doors = [];
    this.sluices = [];
    this.sites = [];
    this.startPoints = [];
    this.calibration = { px_per_meter: 0 };
    this.mode = null;
  }
}
