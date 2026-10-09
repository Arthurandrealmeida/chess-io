const abort = signal => { if (signal?.aborted) throw new DOMException('Carregamento cancelado','AbortError'); };
const bounded = async (stream, limit) => {
  const reader = stream.getReader(); let size = 0; const chunks = [];
  try { while (true) { const {value,done} = await reader.read(); if (done) break; size += value.length; if (size > limit) throw Error('Pacote acima do limite'); chunks.push(value); } }
  catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const result = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { result.set(chunk,offset); offset += chunk.length; } return result;
};
export async function decodeGzip(bytes, limit = 8388608, native = globalThis.DecompressionStream) {
  if (bytes[0] !== 31 || bytes[1] !== 139) throw Error('Arquivo gzip inválido');
  if (bytes.length < 18) throw Error('Arquivo gzip incompleto');
  if (new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(bytes.length - 4,true) > limit) throw Error('Pacote acima do limite');
  if (native) return bounded(new Blob([bytes]).stream().pipeThrough(new native('gzip')),limit);
  const { gunzipSync } = await import('../vendor/gunzip.js'); const decoded = gunzipSync(bytes);
  if (decoded.length > limit) throw Error('Pacote acima do limite'); return decoded;
}
function manifestCheck(m) {
  if (!m || m.schemaVersion !== 1 || !Number.isInteger(m.total) || m.total < 1 || !Array.isArray(m.themes) || m.themes.some(t => typeof t !== 'string') || !Array.isArray(m.shards) || m.shards.length > 10000) throw Error('Índice de puzzles inválido');
  let total = 0; const paths = new Set();
  for (const s of m.shards) {
    if (!/^[a-z0-9-]+\.json\.gz$/.test(s.path) || paths.has(s.path) || !/^[a-f0-9]{64}$/.test(s.sha256) || !Number.isInteger(s.count) || s.count < 1 || s.count > 2000 || !Number.isInteger(s.gzipBytes) || s.gzipBytes < 1 || s.gzipBytes > 262144 || !Number.isInteger(s.jsonBytes) || s.jsonBytes < 1 || s.jsonBytes > 1048576 || !Number.isInteger(s.ratingMin) || !Number.isInteger(s.ratingMax) || s.ratingMin > s.ratingMax || !Array.isArray(s.themeCounts)) throw Error('Pacote inválido no índice');
    const seen = new Set(); for (const [id,count] of s.themeCounts) { if (!Number.isInteger(id) || id < 0 || id >= m.themes.length || seen.has(id) || !Number.isInteger(count) || count < 1 || count > s.count) throw Error('Temas inválidos no índice'); seen.add(id); }
    paths.add(s.path); total += s.count;
  }
  if (total !== m.total) throw Error('Contagem de puzzles inconsistente'); return m;
}
export class PuzzleLoader {
  constructor({baseUrl=new URL('../data/puzzles/',import.meta.url),fetchFn=globalThis.fetch.bind(globalThis),random=Math.random,decodeGzip:decode=decodeGzip}={}) {
    this.baseUrl = new URL(baseUrl); this.fetchFn = fetchFn; this.random = random; this.decode = decode; this.cache = new Map(); this.current = null; this.manifest = null;
  }
  clear() { this.cache.clear(); this.current = null; }
  async json(path,limit,signal) {
    abort(signal); const controller = new AbortController(); const cancel = () => controller.abort(); signal?.addEventListener('abort',cancel,{once:true});
    const timer = setTimeout(cancel,15000);
    try {
      const response = await this.fetchFn(new URL(path,this.baseUrl),{signal:controller.signal});
      if (!response.ok) throw Error('Não foi possível carregar os puzzles. Tente novamente.');
      const bytes = response.body ? await bounded(response.body,limit) : new Uint8Array(await response.arrayBuffer());
      const decoded = bytes[0] === 31 && bytes[1] === 139 ? await this.decode(bytes,limit) : bytes;
      if (decoded.length > limit) throw Error('Pacote acima do limite'); abort(signal); abort(controller.signal);
      return {data:JSON.parse(new TextDecoder().decode(decoded)),raw:decoded};
    } finally { clearTimeout(timer); signal?.removeEventListener('abort',cancel); }
  }
  async loadManifest({signal}={}) {
    abort(signal); if (!this.manifest) this.manifest = manifestCheck((await this.json('manifest.json.gz',8388608,signal)).data); return this.manifest;
  }
  async shard(descriptor,signal) {
    abort(signal);
    if (this.cache.has(descriptor.path)) { const value = this.cache.get(descriptor.path); this.cache.delete(descriptor.path); this.cache.set(descriptor.path,value); return value; }
    const {data,raw} = await this.json(descriptor.path,1048576,signal);
    if (globalThis.crypto?.subtle) {
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256',raw));
      if (Array.from(digest,b => b.toString(16).padStart(2,'0')).join('') !== descriptor.sha256) throw Error('Pacote corrompido. Tente novamente.');
    }
    if (!Array.isArray(data) || data.length !== descriptor.count || data.some(r => !Array.isArray(r) || r.length !== 5 || typeof r[0] !== 'string' || typeof r[1] !== 'string' || typeof r[2] !== 'string' || !Number.isInteger(r[3]) || !Array.isArray(r[4]) || r[4].some(t => !Number.isInteger(t) || !this.manifest.themes[t]))) throw Error('Conteúdo de puzzle inválido');
    abort(signal); this.cache.set(descriptor.path,data); if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value); return data;
  }
  async next({ratingMin=0,ratingMax=10000,theme='',recentIds=[],signal}={}) {
    const m = await this.loadManifest({signal}); const themeId = theme ? m.themes.indexOf(theme) : -1;
    if (theme && themeId < 0) throw Error('Nenhum puzzle neste tema. Escolha Misto.');
    const key = `${ratingMin}:${ratingMax}:${theme}`; const recent = new Set(recentIds);
    const eligible = r => r[3] >= ratingMin && r[3] <= ratingMax && (themeId < 0 || r[4].includes(themeId));
    const candidates = m.shards.map(s => ({s,weight:themeId < 0 ? s.count : s.themeCounts.find(([id]) => id === themeId)?.[1] || 0})).filter(({s,weight}) => weight && s.ratingMin <= ratingMax && s.ratingMax >= ratingMin);
    if (!candidates.length) throw Error('Nenhum puzzle nesta dificuldade e tema. Altere os filtros.');
    let records, selected, repeat;
    if (this.current?.key === key && this.current.used < 20 && this.cache.has(this.current.path)) {
      records = this.cache.get(this.current.path).filter(r => eligible(r) && !recent.has(r[0]) && !this.current.ids.has(r[0]));
      if (records.length) selected = records[Math.floor(this.random()*records.length)];
    }
    const remaining = [...candidates];
    while (!selected && remaining.length) {
      abort(signal); let value = this.random()*remaining.reduce((sum,c) => sum + c.weight,0); let index = 0;
      while (index < remaining.length - 1 && (value -= remaining[index].weight) >= 0) index++;
      const candidate = remaining[index], {s} = candidate, oldWeight = candidate.weight;
      const rows = (await this.shard(s,signal)).filter(eligible); const fresh = rows.filter(r => !recent.has(r[0]));
      if (!fresh.length && rows.length && !repeat) repeat = {rows,path:s.path};
      records = fresh;
      if (!records.length) { remaining.splice(index,1); continue; }
      // Counts in the manifest are an upper bound for a range cutting through a shard.
      // Accept proportionally, then keep its exact count for the next weighted draw.
      candidate.weight = records.length;
      if (this.random() < Math.min(1,records.length/oldWeight)) { selected = records[Math.floor(this.random()*records.length)]; this.current = {key,path:s.path,used:0,ids:new Set()}; }
    }
    if (!selected && repeat) { selected = repeat.rows[Math.floor(this.random()*repeat.rows.length)]; this.current = {key,path:repeat.path,used:0,ids:new Set()}; }
    if (!selected) throw Error('Nenhum puzzle disponível com esses filtros.');
    abort(signal); this.current.used++; this.current.ids.add(selected[0]);
    return {id:selected[0],fen:selected[1],moves:selected[2].split(' '),rating:selected[3],themes:selected[4].map(id => m.themes[id])};
  }
}
