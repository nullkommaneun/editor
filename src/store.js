export const Store = {
  _db: null,
  async _open(){
    if (this._db) return this._db;
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open('werksplan', 1);
      req.onupgradeneeded = (e)=>{
        const db = e.target.result;
        if (!db.objectStoreNames.contains('snapshots')){
          const st = db.createObjectStore('snapshots', {keyPath:'id', autoIncrement:true});
          st.createIndex('createdAt', 'meta.createdAt');
        }
      };
      req.onsuccess = ()=>{ this._db = req.result; resolve(this._db); };
      req.onerror = ()=> reject(req.error);
    });
  },
  async saveSnapshot(bundle){
    const db = await this._open();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction('snapshots','readwrite');
      tx.objectStore('snapshots').add(bundle).onsuccess = (e)=> resolve(e.target.result);
      tx.onerror = ()=> reject(tx.error);
    });
  },
  async listSnapshots(){
    const db = await this._open();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction('snapshots','readonly');
      const req = tx.objectStore('snapshots').getAll();
      req.onsuccess = ()=> resolve(req.result || []);
      req.onerror = ()=> reject(req.error);
    });
  },
  async loadLatest(){
    const list = await this.listSnapshots();
    if (!list.length) return null;
    list.sort((a,b)=> (a.meta?.createdAt||'') < (b.meta?.createdAt||'') ? 1 : -1);
    return list[0];
  },
  async loadSnapshot(id){
    const db = await this._open();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction('snapshots','readonly');
      const req = tx.objectStore('snapshots').get(id);
      req.onsuccess = ()=> resolve(req.result || null);
      req.onerror = ()=> reject(req.error);
    });
  },
  async deleteSnapshot(id){
    const db = await this._open();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction('snapshots','readwrite');
      tx.objectStore('snapshots').delete(id).onsuccess = ()=> resolve(true);
      tx.onerror = ()=> reject(tx.error);
    });
  }
};
