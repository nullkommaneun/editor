import { runPipeline } from './pipeline.js';

self.onmessage = async (e)=>{
  const {fn, payload} = e.data;
  try {
    if (fn==='pipeline'){
      const res = await runPipeline(payload.imageData, payload);
      postMessage(res);
    } else {
      postMessage({error: 'Unbekannte Worker-Funktion: ' + fn});
    }
  } catch (err){
    postMessage({error: err.message || String(err)});
  }
};
