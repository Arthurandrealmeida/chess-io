import {readFile,readdir,stat} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
async function directoryBytes(path) {
  let total = 0; for (const item of await readdir(path,{withFileTypes:true})) total += item.isDirectory() ? await directoryBytes(join(path,item.name)) : (await stat(join(path,item.name))).size; return total;
}
export async function checkPuzzleData(path,{siteDir}={}) {
  const compressed = await readFile(join(path,'manifest.json.gz'));
  if (compressed.length > 1048576) throw Error('Manifesto acima do orçamento');
  const raw = gunzipSync(compressed,{maxOutputLength:8388608}), manifest = JSON.parse(raw);
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.shards) || !Array.isArray(manifest.themes)) throw Error('Manifesto inválido');
  let total = 0, bytes = compressed.length; const paths = new Set();
  for (const shard of manifest.shards) {
    if (!/^[a-z0-9-]+\.json\.gz$/.test(shard.path) || paths.has(shard.path)) throw Error('Caminho inválido ou repetido'); paths.add(shard.path);
    const packed = await readFile(join(path,shard.path)); if (packed.length > 262144 || packed.length !== shard.gzipBytes) throw Error('Pacote acima do orçamento ou peso incorreto');
    const decoded = gunzipSync(packed,{maxOutputLength:1048576}); if (decoded.length !== shard.jsonBytes) throw Error('Peso descompactado incorreto');
    if (createHash('sha256').update(decoded).digest('hex') !== shard.sha256) throw Error('Hash do pacote incorreto');
    const records = JSON.parse(decoded); if (!Array.isArray(records) || records.length !== shard.count || records.length > 2000 || !records.length) throw Error('Contagem do pacote incorreta');
    const ids = new Set(), themes = new Map(); let min = Infinity, max = -Infinity;
    for (const r of records) {
      if (!Array.isArray(r) || r.length !== 5 || !/^[a-zA-Z0-9]{1,12}$/.test(r[0]) || ids.has(r[0]) || typeof r[1] !== 'string' || typeof r[2] !== 'string' || !Number.isInteger(r[3]) || !Array.isArray(r[4]) || new Set(r[4]).size !== r[4].length) throw Error('Registro inválido');
      ids.add(r[0]); min = Math.min(min,r[3]); max = Math.max(max,r[3]);
      for (const id of r[4]) { if (!Number.isInteger(id) || id < 0 || id >= manifest.themes.length) throw Error('Tema inválido'); themes.set(id,(themes.get(id) || 0) + 1); }
    }
    if (min !== shard.ratingMin || max !== shard.ratingMax) throw Error('Faixa de rating inconsistente');
    const counts = [...themes].sort((a,b) => a[0]-b[0]); if (JSON.stringify(counts) !== JSON.stringify(shard.themeCounts)) throw Error('Tema: contagens inconsistentes');
    total += records.length; bytes += packed.length;
  }
  if (total !== manifest.total) throw Error('Contagem total inconsistente');
  const allBytes = await directoryBytes(siteDir || path); if (allBytes > 750000000) throw Error('Site acima do orçamento de 750 MB');
  return {total,shards:manifest.shards.length,puzzleBytes:bytes,siteBytes:allBytes};
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await checkPuzzleData(resolve(process.argv[2] || 'data/puzzles'),{siteDir:process.argv[3] ? resolve(process.argv[3]) : undefined}),null,2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
