import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {checkPuzzleData} from '../scripts/check-puzzle-data.js';
test('verificação rejeita hashes, contagens, temas e orçamentos inconsistentes',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'chess-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const raw=Buffer.from(JSON.stringify([['abc01','4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1','d7d5 e5d6',1200,[0]]]));const packed=gzipSync(raw);
 const shard={path:'r06-00000.json.gz',sha256:createHash('sha256').update(raw).digest('hex'),count:1,ratingMin:1200,ratingMax:1200,gzipBytes:packed.length,jsonBytes:raw.length,themeCounts:[[0,1]]};
 const m={schemaVersion:1,total:1,source:{},themes:['endgame'],shards:[shard]};const save=()=>writeFile(join(dir,'manifest.json.gz'),gzipSync(JSON.stringify(m)));
 await writeFile(join(dir,shard.path),packed);await save();assert.equal((await checkPuzzleData(dir)).total,1);
 m.total=2;await save();await assert.rejects(checkPuzzleData(dir),/Contagem/);m.total=1;
 shard.sha256='0'.repeat(64);await save();await assert.rejects(checkPuzzleData(dir),/Hash/);
 shard.sha256=createHash('sha256').update(raw).digest('hex');shard.themeCounts=[[0,2]];await save();await assert.rejects(checkPuzzleData(dir),/Tema/);
});
