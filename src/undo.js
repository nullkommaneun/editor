export class CommandStack{
  constructor(state){ this.state = state; this.stack=[]; this.redoStack=[]; }
  exec(cmd){ try{ cmd.do(); this.stack.push(cmd); this.redoStack.length=0; }catch(e){ console.error(e); } }
  undo(){ const c=this.stack.pop(); if (!c) return; try{ c.undo(); this.redoStack.push(c); }catch(e){ console.error(e); } }
  redo(){ const c=this.redoStack.pop(); if (!c) return; try{ c.do(); this.stack.push(c); }catch(e){ console.error(e); } }
}
