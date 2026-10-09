import test from 'node:test';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {PuzzleLoader,decodeGzip} from '../src/puzzle-loader.js';
const row=(id,rating=1200,theme=0)=>[id,'4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1','d7d5 e5d6',rating,[theme]];
const bytes=rows=>new TextEncoder().encode(JSON.stringify(rows));const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const groups=[[row('aaa01')],[row('aaa02'),row('aaa03')],[row('aaa04',2000,1)],[row('aaa05',2200,1)]];
 const manifest={schemaVersion:1,total:5,source:{},themes:['endgame','fork'],shards:groups.map((rows,i)=>({path:`${i}.json.gz`,sha256:hash(bytes(rows)),gzipBytes:gzipSync(bytes(rows)).length,jsonBytes:bytes(rows).length,count:rows.length,ratingMin:rows[0][3],ratingMax:rows[0][3],themeCounts:[[rows[0][4][0],rows.length]]}))};
 const calls=[];const fetchFn=async url=>{calls.push(String(url));return new Response(gzipSync(bytes(String(url).endsWith('manifest.json.gz')?manifest:groups[Number(String(url).split('/').at(-1).split('.')[0])])))};
 return {manifest,groups,calls,fetchFn};
}
test('gzip real, caminhos com subpasta, seleção por tema/rating e reutilização do pacote',async()=>{
 const f=fixture();const loader=new PuzzleLoader({baseUrl:'https://user.github.io/chess/data/puzzles/',fetchFn:f.fetchFn,random:()=>.5});assert.equal(f.calls.length,0);
 const p=await loader.next({ratingMin:1000,ratingMax:1400,theme:'endgame',recentIds:[]});assert.equal(p.id,'aaa03');assert.equal(p.moves[0],'d7d5');assert.deepEqual(p.themes,['endgame']);
 assert.ok(f.calls.every(u=>u.startsWith('https://user.github.io/chess/data/puzzles/')));
 await loader.next({ratingMin:1000,ratingMax:1400,theme:'endgame',recentIds:['aaa03']});assert.equal(f.calls.length,2);
 await assert.rejects(loader.next({ratingMin:3000,ratingMax:3500,theme:'fork'}),/Nenhum/);
 assert.deepEqual(Array.from(await decodeGzip(gzipSync(bytes([1,2])))),Array.from(bytes([1,2])));
 assert.deepEqual(Array.from(await decodeGzip(gzipSync(bytes([1,2])),100,null)),Array.from(bytes([1,2])));
});
test('falha HTTP, arquivo corrompido, abort e cache limitado',async()=>{
 await assert.rejects(new PuzzleLoader({fetchFn:async()=>new Response('',{status:404})}).loadManifest(),/carregar/);
 await assert.rejects(decodeGzip(new Uint8Array([1,2,3])));
 const f=fixture();const loader=new PuzzleLoader({fetchFn:f.fetchFn,random:()=>0});for(const min of [1200,2000,2200])await loader.next({ratingMin:min,ratingMax:min});assert.ok(loader.cache.size<=3);
 const controller=new AbortController();controller.abort();await assert.rejects(loader.next({signal:controller.signal}),{name:'AbortError'});
});
test('prefere puzzles novos em outro pacote antes de repetir histórico recente',async()=>{
 const f=fixture();const loader=new PuzzleLoader({fetchFn:f.fetchFn,random:()=>0});
 const p=await loader.next({ratingMin:1000,ratingMax:1400,theme:'endgame',recentIds:['aaa01']});assert.equal(p.id,'aaa02');
});
test('faixa que corta um pacote usa contagem elegível, evitando supervalorizar o limite',async()=>{
 const f=fixture();f.groups[1][1][3]=1400;const raw=bytes(f.groups[1]),shard=f.manifest.shards[1];Object.assign(shard,{ratingMax:1400,jsonBytes:raw.length,gzipBytes:gzipSync(raw).length,sha256:hash(raw)});
 const draws=[.5,.9,0,.1,0];const loader=new PuzzleLoader({fetchFn:f.fetchFn,random:()=>draws.shift()??0});
 const p=await loader.next({ratingMin:1200,ratingMax:1200,theme:'endgame'});assert.equal(p.id,'aaa01');
});
