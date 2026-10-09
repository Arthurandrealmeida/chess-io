import { Chess } from '../vendor/chess.js';
export const uciMove = u => ({ from:u.slice(0,2), to:u.slice(2,4), ...(u[4] ? { promotion:u[4] } : {}) });
const toUci = m => m.from + m.to + (m.promotion || '');
export function validatePuzzle(puzzle) {
  try {
    if (!puzzle || !/^[a-zA-Z0-9]{1,12}$/.test(puzzle.id) || !Number.isInteger(puzzle.rating) || puzzle.rating < 0 || puzzle.rating > 10000) throw Error('Metadados inválidos');
    if (!Array.isArray(puzzle.moves) || puzzle.moves.length < 2 || puzzle.moves.length % 2 || puzzle.moves.length > 100) throw Error('Solução incompleta');
    const chess = new Chess(puzzle.fen);
    for (const u of puzzle.moves) { if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(u)) throw Error('UCI inválido'); chess.move(uciMove(u)); }
    return { valid:true };
  } catch (error) { return { valid:false, error:error.message }; }
}
export class PuzzleSession {
  constructor(puzzle) {
    const result = validatePuzzle(puzzle); if (!result.valid) throw Error('Puzzle inválido: ' + result.error);
    this.puzzle = puzzle; this.assisted = false; this.failed = false; this.reset();
  }
  reset() {
    this.chess = new Chess(this.puzzle.fen); this.moves = [this.chess.move(uciMove(this.puzzle.moves[0]))];
    this.frames = [this.chess.fen()]; this.cursor = 0; this.index = 1; this.status = 'playing'; this.playerColor = this.chess.turn();
  }
  get fen() { return this.frames[this.cursor]; }
  get lastMove() { return this.moves[this.cursor] || null; }
  get outcome() { return this.assisted ? 'assisted' : this.failed ? 'failed' : 'solved'; }
  legalMoves(square) { return this.status === 'playing' ? this.chess.moves({ square, verbose:true }) : []; }
  play(move) {
    if (this.status !== 'playing') return { correct:false, complete:false, illegal:true };
    let played; try { played = this.chess.move(move); } catch { return { correct:false, complete:false, illegal:true }; }
    const alternateMate = this.puzzle.moves.length === 2 && this.chess.isCheckmate();
    if (toUci(played) !== this.puzzle.moves[this.index] && !alternateMate) {
      this.chess.undo(); this.failed = true; return { correct:false, complete:false };
    }
    this.moves.push(played); this.frames.push(this.chess.fen()); this.index++;
    let reply;
    if (this.index < this.puzzle.moves.length && !alternateMate) {
      reply = this.chess.move(uciMove(this.puzzle.moves[this.index++])); this.moves.push(reply); this.frames.push(this.chess.fen());
    }
    this.cursor = this.frames.length - 1;
    const complete = alternateMate || this.index >= this.puzzle.moves.length;
    if (complete) this.status = 'solved';
    return { correct:true, complete, move:played, reply };
  }
  hint() { if (this.status !== 'playing') return null; this.assisted = true; return this.puzzle.moves[this.index].slice(0,2); }
  reveal() {
    if (this.status !== 'playing') return;
    this.assisted = true;
    while (this.index < this.puzzle.moves.length) { const move = this.chess.move(uciMove(this.puzzle.moves[this.index++])); this.moves.push(move); this.frames.push(this.chess.fen()); }
    this.status = 'revealed'; this.cursor = 0;
  }
  retry() { this.assisted = true; this.reset(); }
  review(ply) { if (this.status !== 'playing') this.cursor = Math.max(0, Math.min(this.frames.length - 1, ply)); }
}
