// UCI scores belong to the side to move. Store every score from White's view.
export function parseEvaluation(line, fen) {
  if (!line.startsWith('info ') || /\b(?:lowerbound|upperbound)\b/.test(line)) return null;
  const multipv = line.match(/\bmultipv (\d+)/);
  if (multipv && multipv[1] !== '1') return null;
  const score = line.match(/\bscore (cp|mate) (-?\d+)/);
  if (!score) return null;
  const sign = fen.split(' ')[1] === 'b' ? -1 : 1;
  return { kind: score[1], value: Number(score[2]) * sign, depth: Number(line.match(/\bdepth (\d+)/)?.[1] || 0) };
}

export class EngineClient {
  constructor({ workerFactory = url => new Worker(url, { name: 'chess.io · Stockfish' }), timeout = 20_000 } = {}) {
    this.workerFactory = workerFactory;
    this.timeout = timeout;
    this.worker = null;
    this.readyPromise = null;
    this.pending = null;
    this.generation = 0;
    this.status = 'idle';
    this.onStatus = () => {};
  }
  setStatus(status) { this.status = status; this.onStatus(status); }
  ready() {
    if (this.readyPromise) return this.readyPromise;
    this.setStatus('loading');
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyReject = reject;
      const fail = message => {
        if (this.worker) this.worker.terminate();
        this.worker = null; clearTimeout(this.loadTimer);
        this.readyPromise = null; this.readyReject = null; this.setStatus('error');
        clearTimeout(this.pending?.timer);
        this.pending?.reject(new Error(message)); this.pending = null;
        reject(new Error(message));
      };
      try {
        const worker = this.worker = this.workerFactory(new URL('../vendor/stockfish/stockfish-19-lite-single.js', import.meta.url));
        worker.onerror = () => fail('Não foi possível carregar o Stockfish. Tente novamente.');
        worker.onmessage = event => {
          for (const line of String(event.data).split('\n')) {
            if (worker !== this.worker) return;
            if (line === 'uciok') {
              worker.postMessage('setoption name Hash value 32');
              worker.postMessage('isready');
            } else if (line === 'readyok') {
              clearTimeout(this.loadTimer); this.readyReject = null; this.setStatus('ready'); resolve();
            } else if (line.startsWith('info ') && this.pending?.analysis) {
              const score = parseEvaluation(line, this.pending.fen);
              if (score) this.pending.score = score;
            } else if (line.startsWith('bestmove ') && this.pending) {
              const pending = this.pending; this.pending = null;
              clearTimeout(pending.timer); this.setStatus('ready');
              const bestmove = line.split(/\s+/)[1];
              if (!pending.analysis) pending.resolve(bestmove);
              else if (pending.score) pending.resolve({ ...pending.score, bestmove });
              else pending.reject(new Error('O Stockfish não informou a avaliação. Tente novamente.'));
            }
          }
        };
        this.loadTimer = setTimeout(() => fail('O Stockfish demorou a carregar. Tente novamente.'), this.timeout);
        worker.postMessage('uci');
      } catch { queueMicrotask(() => fail('Seu navegador não conseguiu iniciar o motor.')); }
    });
    return this.readyPromise;
  }
  async search(fen, level = 5) {
    return this.calculate(fen, { level, milliseconds: Math.round(150 + level * 45) });
  }
  async evaluate(fen, milliseconds = 250) {
    return this.calculate(fen, { level: 20, milliseconds, analysis: true });
  }
  async calculate(fen, { level, milliseconds, analysis = false }) {
    const generation = this.generation;
    await this.ready();
    if (generation !== this.generation) return null;
    if (this.pending) throw new Error('O motor já está calculando uma jogada.');
    const skill = Math.round((Math.max(1, Math.min(20, level)) - 1) * 20 / 19);
    this.worker.postMessage(`setoption name Skill Level value ${skill}`);
    this.worker.postMessage(`position fen ${fen}`);
    this.setStatus('thinking');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error('O motor não respondeu. Tente novamente.');
        this.pending = null;
        this.worker?.terminate(); this.worker = null; this.readyPromise = null; this.generation++;
        this.setStatus('error'); reject(error);
      }, milliseconds + 10_000);
      this.pending = { resolve, reject, timer, analysis, fen, score: null };
      this.worker.postMessage(`go movetime ${milliseconds}`);
    });
  }
  cancel() {
    this.generation++;
    if (this.pending || this.status === 'loading') {
      const pending = this.pending; this.pending = null;
      clearTimeout(pending?.timer); pending?.resolve(null);
      clearTimeout(this.loadTimer); this.readyReject?.(new Error('Cálculo cancelado.'));
      this.readyReject = null;
      this.worker?.terminate(); this.worker = null; this.readyPromise = null;
      this.setStatus('idle');
    }
  }
  dispose() { this.cancel(); this.worker?.terminate(); this.worker = null; this.readyPromise = null; }
}
