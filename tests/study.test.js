import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../vendor/chess.js';
import { HISTORICAL_GAMES } from '../data/games.js';
import { OPENINGS } from '../data/openings.js';
import { activeMoment, reviewArrow, recordedResult, OpeningSession, reviewMove, preserveSquareKeys } from '../src/study.js';
import { GameSession } from '../src/game.js';

const scores = {
  opera: [33, 'Rd8#', '1-0', true], imortal: [45, 'Be7#', '1-0', true],
  'sempre-viva': [47, 'Bxe7#', '1-0', true], 'seculo': [82, 'Rc2#', '0-1', true],
  'kasparov-topalov': [87, 'Qa7', '1-0', false], 'short-timman': [67, 'Kg5', '1-0', false],
  'rubinstein': [50, 'Rh3', '0-1', false], 'lasker-bauer': [75, 'Qxd3', '1-0', false],
  'marshall': [46, 'Qg3', '0-1', false],
};
test('puzzle preserva navegação de casas somente durante a tentativa e revisa depois',()=>{
 const event={key:'ArrowRight',target:{tagName:'BUTTON',closest:selector=>selector==='.board'?{}:null}};
 for(const status of ['solved','revealed'])assert.equal(reviewArrow(event,{preserveBoardKeys:preserveSquareKeys({page:'puzzle',puzzleStatus:status})}),1);
 assert.equal(reviewArrow(event,{preserveBoardKeys:preserveSquareKeys({page:'puzzle',puzzleStatus:'playing'})}),0);
 assert.equal(preserveSquareKeys({page:'play'}),true);assert.equal(preserveSquareKeys({page:'replay'}),false);
});
test('coleção contém os nove clássicos completos, com resultados e prévias válidos', () => {
  assert.deepEqual(new Set(HISTORICAL_GAMES.map(g => g.id)), new Set(Object.keys(scores)));
  for (const game of HISTORICAL_GAMES) {
    const chess = new Chess(); chess.loadPgn(game.pgn, { strict: true });
    const moves = chess.history({ verbose: true });
    const [count, last, result, mate] = scores[game.id];
    assert.equal(moves.length, count, game.id); assert.equal(moves.at(-1).san, last, game.id);
    assert.equal(chess.getHeaders().Result, result); assert.equal(chess.isCheckmate(), mate);
    assert.equal(recordedResult(chess), result === '1-0' ? '1–0 · Vitória das brancas' : '0–1 · Vitória das pretas');
    assert.equal(moves[game.previewPly - 1].after.split(' ')[0], game.previewFen);
    assert.ok(game.moments.length >= 3);
    for (const moment of game.moments) {
      assert.equal(moves[moment.ply - 1].san, moment.san, `${game.id}: comentário ${moment.ply}`);
    }
  }
});
test('cinco repertórios, três de brancas e dois de pretas, com variantes e posições legais', () => {
  assert.equal(OPENINGS.length, 5); assert.equal(OPENINGS.filter(o => o.side === 'w').length, 3);
  assert.equal(OPENINGS.filter(o => o.side === 'b').length, 2);
  assert.equal(new Set(OPENINGS.map(o => o.id)).size, 5);
  for (const opening of OPENINGS) {
    const base = new Chess(); base.loadPgn(opening.pgn, { strict: true });
    assert.equal(base.fen().split(' ')[0], opening.previewFen);
    assert.ok(opening.variations.length >= 3);
    assert.equal(new Set(opening.variations.map(v => v.id)).size, opening.variations.length);
    for (const variation of opening.variations) {
      const chess = new Chess(); chess.loadPgn(variation.pgn, { strict: true });
      assert.deepEqual(chess.history().slice(0, base.history().length), base.history());
      assert.ok(chess.history().length >= 12); assert.equal(chess.getHeaders().Result, '*');
      for (const note of variation.notes) assert.equal(chess.history()[note.ply - 1], note.san);
    }
  }
});
test('trocar variante reinicia revisão; setas respeitam os limites', () => {
  const lesson = new OpeningSession(); lesson.open(OPENINGS[0]);
  assert.equal(lesson.cursor, 0); lesson.step(-1); assert.equal(lesson.cursor, 0);
  lesson.step(1); assert.equal(lesson.cursor, 1);
  lesson.review(1000); assert.equal(lesson.cursor, lesson.moves.length);
  const variation = OPENINGS[0].variations[1]; lesson.open(OPENINGS[0], variation.id);
  assert.equal(lesson.variation.id, variation.id); assert.equal(lesson.cursor, 0);
  lesson.step(1); const fen = lesson.fen; lesson.open(OPENINGS[0], variation.id);
  assert.equal(lesson.fen, fen); assert.equal(lesson.cursor, 1);
  lesson.open(OPENINGS[0], 'inexistente'); assert.equal(lesson.variation.id, OPENINGS[0].variations[0].id);
});
test('comentário acompanha a posição revisada e desaparece ao voltar antes dele', () => {
  const notes = [{ ply: 3, title: 'Centro' }, { ply: 9, title: 'Ataque' }];
  assert.equal(activeMoment(notes, 0), null); assert.equal(activeMoment(notes, 3), notes[0]);
  assert.equal(activeMoment(notes, 8), notes[0]); assert.equal(activeMoment(notes, 9), notes[1]);
  assert.equal(activeMoment(notes, 2), null);
});
test('revisar além das extremidades não anima um lance inexistente nem altera a posição', () => {
  const game = new GameSession(); game.replay('1. e4 e5 *'); const initial = game.fen;
  assert.equal(reviewMove(game, -1), null); assert.equal(game.fen, initial); assert.equal(game.cursor, 0);
  assert.equal(reviewMove(game, 1).san, 'e4');
  const reverse = reviewMove(game, 0); assert.equal(reverse.from, 'e4'); assert.equal(reverse.to, 'e2');
  assert.equal(game.fen, initial); assert.equal(reviewMove(game, -1), null);
  reviewMove(game, 2); const final = game.fen;
  assert.equal(reviewMove(game, 3), null); assert.equal(game.fen, final); assert.equal(game.cursor, 2);
});
test('setas revisam lances sem interferir na edição de campos e nas peças da partida', () => {
  const key = { key: 'ArrowRight', target: { closest: () => null } };
  assert.equal(reviewArrow(key), 1); assert.equal(reviewArrow({ ...key, key: 'ArrowLeft' }), -1);
  for (const keyName of ['ArrowUp', 'ArrowDown', 'Enter']) assert.equal(reviewArrow({ ...key, key: keyName }), 0);
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'defaultPrevented', 'isComposing']) assert.equal(reviewArrow({ ...key, [modifier]: true }), 0);
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) assert.equal(reviewArrow({ ...key, target: { tagName: tag } }), 0);
  assert.equal(reviewArrow({ ...key, target: { isContentEditable: true } }), 0);
  const boardKey = { ...key, target: { closest: selector => selector === '.board' ? {} : null } };
  assert.equal(reviewArrow(boardKey, { preserveBoardKeys: true }), 0);
  assert.equal(reviewArrow(boardKey), 1);
});
