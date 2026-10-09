import test from 'node:test';
import assert from 'node:assert/strict';
import { PuzzleSession, validatePuzzle } from '../src/puzzle-session.js';
const puzzle = {
  id: '00008',
  fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
  moves: 'f2g3 e6e7 b2b1 b3c1 b1c1 h6c1'.split(' '),
  rating: 1800,
  themes: ['crushing'],
};
const move = (u) => ({
  from: u.slice(0, 2),
  to: u.slice(2, 4),
  ...(u[4] ? { promotion: u[4] } : {}),
});
test('primeiro lance é adversário; erro legal não altera a posição; réplicas e conclusão', () => {
  const s = new PuzzleSession(puzzle);
  assert.equal(s.playerColor, 'w');
  const fen = s.fen;
  assert.equal(s.play(move('e6e5')).correct, false);
  assert.equal(s.fen, fen);
  assert.equal(s.failed, true);
  assert.equal(s.play(move('e6e7')).reply.san, 'Qb1+');
  assert.equal(s.play(move('b3c1')).reply.san, 'Qxc1+');
  assert.equal(s.play(move('h6c1')).complete, true);
  assert.equal(s.status, 'solved');
  assert.equal(s.outcome, 'failed');
  s.review(-1);
  assert.equal(s.cursor, 0);
  s.review(99);
  assert.equal(s.cursor, s.frames.length - 1);
});
test('dica e revelar tornam a tentativa assistida; retry não apaga essa informação', () => {
  const s = new PuzzleSession(puzzle);
  assert.equal(s.hint(), 'e6');
  assert.equal(s.assisted, true);
  s.reveal();
  assert.equal(s.status, 'revealed');
  s.retry();
  assert.equal(s.status, 'playing');
  assert.equal(s.assisted, true);
  assert.equal(s.outcome, 'assisted');
});
test('promoção, roque e en passant são lances reais e solução ilegal é rejeitada', () => {
  for (const [fen, moves] of [
    ['4k3/P7/8/8/8/8/8/4K3 b - - 0 1', ['e8e7', 'a7a8q']],
    ['r3k2r/8/8/8/8/8/P7/4K3 w kq - 0 1', ['a2a3', 'e8g8']],
    ['4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1', ['d7d5', 'e5d6']],
  ]) {
    const p = { ...puzzle, fen, moves };
    assert.equal(validatePuzzle(p).valid, true);
    const s = new PuzzleSession(p);
    assert.equal(s.play(move(moves[1])).complete, true);
  }
  assert.equal(validatePuzzle({ ...puzzle, moves: ['a1a8', 'h6c1'] }).valid, false);
  assert.equal(validatePuzzle({ ...puzzle, moves: puzzle.moves.slice(0, 3) }).valid, false);
});
test('mate em um aceita alternativa legal fora da linha gravada', () => {
  const s = new PuzzleSession({
    ...puzzle,
    fen: '7k/p7/6K1/8/1Q6/8/8/8 b - - 0 1',
    moves: ['a7a6', 'b4b8'],
    themes: ['mateIn1'],
  });
  assert.equal(s.play(move('b4f8')).complete, true);
  assert.equal(s.chess.isCheckmate(), true);
});
