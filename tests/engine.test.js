import test from 'node:test';
import assert from 'node:assert/strict';
import { EngineClient } from '../src/engine.js';
const flush = () => new Promise(resolve=>setImmediate(resolve));
class FakeWorker {
  constructor(){this.messages=[];this.terminated=false;}
  postMessage(message){this.messages.push(message);if(message==='uci')queueMicrotask(()=>this.emit('uciok'));if(message==='isready')queueMicrotask(()=>this.emit('readyok'));}
  emit(data){this.onmessage?.({data});}
  terminate(){this.terminated=true;}
}
test('motor aguarda readyok e recebe FEN completo e dificuldade real',async()=>{
  const worker=new FakeWorker(),engine=new EngineClient({workerFactory:()=>worker});const fen='8/8/8/8/8/8/P6k/K7 w - - 12 30';
  const search=engine.search(fen,5);await flush();assert(worker.messages.includes('isready'));assert(worker.messages.includes('position fen '+fen));assert(worker.messages.includes('setoption name Skill Level value 4'));
  worker.emit('bestmove a2a4');assert.equal(await search,'a2a4');assert.equal(engine.status,'ready');engine.dispose();
});
test('resposta de promoção preserva o quinto caractere',async()=>{
  const worker=new FakeWorker(),engine=new EngineClient({workerFactory:()=>worker});const search=engine.search('fen',20);await flush();worker.emit('bestmove e7e8n');assert.equal(await search,'e7e8n');engine.dispose();
});
test('cancelar termina o Worker e ignora uma resposta antiga',async()=>{
  const workers=[];const engine=new EngineClient({workerFactory:()=>{const w=new FakeWorker();workers.push(w);return w;}});
  const old=engine.search('old');await flush();engine.cancel();assert.equal(await old,null);assert.equal(workers[0].terminated,true);
  const current=engine.search('new');await flush();workers[0].emit('bestmove a2a3');assert.equal(engine.status,'thinking');workers[1].emit('bestmove b2b4');assert.equal(await current,'b2b4');engine.dispose();
});
test('falha do Worker é informada e permite uma nova tentativa',async()=>{
  const workers=[];const engine=new EngineClient({workerFactory:()=>{const w=new FakeWorker();workers.push(w);return w;}});
  const failed=engine.search('fen');await flush();workers[0].onerror();await assert.rejects(failed,/carregar/);assert.equal(engine.status,'error');
  const retry=engine.search('fen');await flush();workers[1].emit('bestmove e2e4');assert.equal(await retry,'e2e4');engine.dispose();
});
test('tempo limite de inicialização evita ficar pensando indefinidamente',async()=>{
  const worker={postMessage(){},terminate(){}};const engine=new EngineClient({workerFactory:()=>worker,timeout:10});
  await assert.rejects(engine.search('fen'),/demorou/);assert.equal(engine.status,'error');engine.dispose();
});
test('falha ao criar o Worker permite uma nova tentativa',async()=>{
  const worker=new FakeWorker();let attempts=0;
  const engine=new EngineClient({workerFactory:()=>{if(!attempts++)throw new Error('Worker indisponível');return worker;}});
  await assert.rejects(engine.search('fen'),/iniciar/);
  const retry=engine.search('fen');await flush();worker.emit('bestmove e2e4');assert.equal(await retry,'e2e4');engine.dispose();
});
