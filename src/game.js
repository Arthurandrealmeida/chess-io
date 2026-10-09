import { Chess } from '../vendor/chess.js';

export const TIME_CONTROLS = {
  bullet: { label: '1 min', milliseconds: 60_000, increment: 0 },
  blitz3: { label: '3 min', milliseconds: 180_000, increment: 0 },
  blitz5: { label: '5 min', milliseconds: 300_000, increment: 0 },
  rapid: { label: '10 min', milliseconds: 600_000, increment: 0 },
  blitz: { label: '3 + 2', milliseconds: 180_000, increment: 2_000 },
  unlimited: { label: 'Sem tempo', milliseconds: null, increment: 0 },
};
export const opposite = color => color === 'w' ? 'b' : 'w';
export const resultOutcome = (result, color) => result.winner === null ? 'draw' : result.winner === color ? 'victory' : 'defeat';

export function resultFor(chess) {
  if (chess.isCheckmate()) return { winner: opposite(chess.turn()), reason: 'Xeque-mate' };
  if (chess.isStalemate()) return { winner: null, reason: 'Empate por afogamento' };
  if (chess.isInsufficientMaterial()) return { winner: null, reason: 'Empate por material insuficiente' };
  if (chess.isThreefoldRepetition()) return { winner: null, reason: 'Empate por repetição' };
  if (chess.isDrawByFiftyMoves()) return { winner: null, reason: 'Empate pela regra dos 50 lances' };
  return null;
}

export class GameSession {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.start({ clock: 'rapid', side: 'w', level: 5 });
  }
  start(config = {}) {
    this.config = { clock: 'rapid', side: 'w', level: 5, ...config };
    this.config.clock = TIME_CONTROLS[this.config.clock] ? this.config.clock : 'rapid';
    this.humanColor = this.config.side === 'random' ? (Math.random() < .5 ? 'w' : 'b') : this.config.side;
    this.chess = new Chess();
    this.mode = 'computer';
    this.moves = [];
    this.frames = [this.chess.fen()];
    this.cursor = 0;
    this.result = null;
    this.active = true;
    this.running = true;
    const time = TIME_CONTROLS[this.config.clock].milliseconds;
    this.remaining = { w: time, b: time };
    this.clockFrames = [{ ...this.remaining }];
    this.lastTick = this.now();
    this.revision = (this.revision || 0) + 1;
  }
  replay(pgn, cursor = 0, mode = 'history') {
    const chess = new Chess();
    chess.loadPgn(pgn, { strict: true });
    this.chess = chess;
    this.mode = mode;
    this.moves = chess.history({ verbose: true });
    this.frames = [this.moves[0]?.before || chess.fen(), ...this.moves.map(m => m.after)];
    this.cursor = Math.max(0, Math.min(cursor, this.moves.length));
    this.active = false;
    this.running = false;
    this.result = resultFor(chess);
    this.remaining = { w: 600_000, b: 600_000 };
    this.revision++;
  }
  get live() { return this.cursor === this.moves.length; }
  get fen() { return this.frames[this.cursor]; }
  get position() { return new Chess(this.fen); }
  get lastMove() { return this.moves[this.cursor - 1] || null; }
  syncClock() {
    const time = this.now();
    if (this.active && this.running && !this.result && this.remaining[this.chess.turn()] !== null) {
      const color = this.chess.turn();
      this.remaining[color] = Math.max(0, this.remaining[color] - Math.max(0, time - this.lastTick));
      if (this.remaining[color] === 0) {
        const enemy = opposite(color);
        const canMate = this.chess.board().flat().some(p => p?.color === enemy && p.type !== 'k');
        this.result = { winner: canMate ? enemy : null, reason: canMate ? 'Tempo esgotado' : 'Empate: tempo e material insuficiente' };
        this.running = false;
        this.revision++;
      }
    }
    this.lastTick = time;
    return this.result;
  }
  pause() { this.syncClock(); this.running = false; }
  resume() { this.lastTick = this.now(); if (!this.result && this.active) this.running = true; }
  canPlay(color = this.humanColor) {
    return this.active && !this.result && this.live && this.chess.turn() === color;
  }
  legalMoves(square) { return this.chess.moves({ square, verbose: true }); }
  move(move, color = this.chess.turn()) {
    this.syncClock();
    if (!this.active || this.result) throw new Error('Esta partida já terminou.');
    if (this.chess.turn() !== color) throw new Error('Aguarde o seu turno.');
    const wasLive = this.live;
    let played;
    try { played = this.chess.move(move); } catch { throw new Error('Esse lance não é permitido.'); }
    if (this.remaining[color] !== null) this.remaining[color] += TIME_CONTROLS[this.config.clock].increment;
    this.moves.push(played);
    this.frames.push(this.chess.fen());
    this.clockFrames.push({ ...this.remaining });
    if (wasLive) this.cursor = this.moves.length;
    this.result = resultFor(this.chess);
    if (this.result) this.running = false;
    this.lastTick = this.now();
    this.revision++;
    return played;
  }
  review(cursor) { this.cursor = Math.max(0, Math.min(cursor, this.moves.length)); }
  undo() {
    if (this.mode !== 'computer' || !this.moves.some(m => m.color === this.humanColor)) return false;
    let removedHuman = false;
    do {
      const move = this.chess.undo();
      if (!move) break;
      if (move.color === this.humanColor) removedHuman = true;
      this.moves.pop(); this.frames.pop(); this.clockFrames.pop();
    } while (this.moves.length && (!removedHuman || this.chess.turn() !== this.humanColor));
    this.remaining = { ...this.clockFrames.at(-1) };
    this.cursor = this.moves.length;
    this.result = null;
    this.active = true;
    this.running = true;
    this.lastTick = this.now();
    this.revision++;
    return true;
  }
  resign(color = this.humanColor) {
    this.syncClock();
    if (!this.active || this.result) return false;
    this.result = { winner: opposite(color), reason: 'Partida abandonada' };
    this.running = false; this.revision++;
    return true;
  }
}

export function formatClock(ms) {
  if (ms === null) return '∞';
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
