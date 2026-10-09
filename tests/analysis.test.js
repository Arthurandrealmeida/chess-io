import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../vendor/chess.js';
import { analyzeGame, bestSAN, classifyMove, formatEvaluation } from '../src/analysis.js';
import { parseEvaluation, EngineClient } from '../src/engine.js';

const cp = (value) => ({ kind: 'cp', value });
test('avaliação UCI usa sempre a perspectiva das brancas e ignora limites', () => {
  assert.deepEqual(parseEvaluation('info depth 15 score cp 45 pv e2e4', 'fen w - - 0 1'), {
    kind: 'cp',
    value: 45,
    depth: 15,
  });
  assert.equal(parseEvaluation('info depth 8 score cp 120', 'fen b - - 0 1').value, -120);
  assert.equal(parseEvaluation('info depth 8 score mate -3', 'fen b - - 0 1').value, 3);
  assert.equal(parseEvaluation('info score cp 100 lowerbound', 'fen w'), null);
  assert.equal(parseEvaluation('info score cp 100 upperbound', 'fen w'), null);
  assert.equal(parseEvaluation('info multipv 2 score cp 100', 'fen w'), null);
});
test('classifica perda de vantagem para ambas as cores e reconhece o melhor lance', () => {
  const white = { from: 'e2', to: 'e4', color: 'w', san: 'e4' },
    black = { from: 'e7', to: 'e5', color: 'b', san: 'e5' };
  assert.equal(classifyMove(white, cp(100), cp(-200)).key, 'blunder');
  assert.equal(classifyMove(black, cp(-100), cp(200)).key, 'blunder');
  assert.equal(classifyMove(white, cp(100), cp(90)).key, 'excellent');
  assert.equal(classifyMove(white, cp(100), cp(60)).key, 'good');
  assert.equal(classifyMove(white, cp(100), cp(20)).key, 'inaccuracy');
  assert.equal(classifyMove(white, cp(100), cp(-100)).key, 'mistake');
  assert.equal(classifyMove(white, { ...cp(100), bestmove: 'e2e4' }, cp(-200)).key, 'best');
});
test('perder mate forçado é erro grave e dar mate é melhor lance', () => {
  const move = { from: 'e2', to: 'e4', color: 'w', san: 'e4' };
  assert.equal(classifyMove(move, { kind: 'mate', value: 3 }, cp(100)).key, 'blunder');
  assert.equal(
    classifyMove({ ...move, san: 'Qh4#', color: 'b' }, cp(0), { kind: 'mate', value: -1 }).key,
    'best',
  );
});
test('melhor alternativa usa notação legal incluindo subpromoção', () => {
  assert.equal(bestSAN(new Chess().fen(), 'e2e4'), 'e4');
  assert.equal(bestSAN('7k/P7/8/8/8/8/8/7K w - - 0 1', 'a7a8n'), 'a8=N');
  assert.equal(bestSAN(new Chess().fen(), 'e2e5'), '—');
  assert.equal(formatEvaluation(cp(-125)), '-1.25');
  assert.equal(formatEvaluation({ kind: 'mate', value: -3 }), 'M3 · pretas');
});
test('análise reutiliza cada posição e preserva o histórico de uma partida terminada', async () => {
  const chess = new Chess(),
    moves = ['e4', 'e5'].map((san) => chess.move(san));
  const frames = [moves[0].before, ...moves.map((move) => move.after)],
    calls = [];
  const report = await analyzeGame(
    { frames, moves },
    {
      async evaluate(fen) {
        calls.push(fen);
        return { ...cp(30), bestmove: 'e2e4' };
      },
    },
  );
  assert.equal(calls.length, 3);
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0].key, 'best');
  assert.equal(report.rows[0].best, 'e4');
  assert.equal(chess.history().join(' '), 'e4 e5');
});
test('mate terminal não exige cálculo e cancelamento não publica resposta tardia', async () => {
  const chess = new Chess(),
    moves = ['f3', 'e5', 'g4', 'Qh4#'].map((san) => chess.move(san));
  const frames = [moves[0].before, ...moves.map((move) => move.after)],
    calls = [];
  const report = await analyzeGame(
    { frames, moves },
    {
      async evaluate(fen) {
        calls.push(fen);
        return cp(0);
      },
    },
  );
  assert.equal(calls.length, 4);
  assert.equal(report.rows.at(-1).key, 'best');
  assert.equal(report.rows.at(-1).score.value, -1);
  assert.equal(formatEvaluation(report.rows.at(-1).score), 'Mate · pretas');
  let stopped = false,
    progress = 0;
  assert.equal(
    await analyzeGame(
      { frames, moves },
      {
        async evaluate() {
          stopped = true;
          return cp(0);
        },
      },
      { cancelled: () => stopped, onProgress: () => progress++ },
    ),
    null,
  );
  assert.equal(progress, 0);
});
test('empate por repetição na última posição tem avaliação zero sem nova busca', async () => {
  const chess = new Chess(),
    moves = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8'].map((san) => chess.move(san));
  const frames = [moves[0].before, ...moves.map((move) => move.after)];
  let calls = 0;
  const report = await analyzeGame(
    { frames, moves, result: { winner: null } },
    {
      async evaluate() {
        calls++;
        return cp(80);
      },
    },
  );
  assert.equal(calls, moves.length);
  assert.equal(report.evaluations.at(-1).value, 0);
  assert.equal(chess.isThreefoldRepetition(), true);
});
test('motor de análise usa força máxima e entrega a última avaliação com bestmove', async () => {
  const messages = [];
  const worker = {
    postMessage(message) {
      messages.push(message);
      if (message === 'uci') queueMicrotask(() => this.onmessage({ data: 'uciok' }));
      if (message === 'isready') queueMicrotask(() => this.onmessage({ data: 'readyok' }));
    },
    terminate() {},
  };
  const engine = new EngineClient({ workerFactory: () => worker });
  const report = engine.evaluate(new Chess().fen());
  await new Promise((resolve) => setImmediate(resolve));
  assert(messages.includes('setoption name Skill Level value 20'));
  assert(messages.includes('go movetime 250'));
  worker.onmessage({ data: 'info depth 8 score cp 10\ninfo depth 12 score cp 35\nbestmove e2e4' });
  assert.deepEqual(await report, { kind: 'cp', value: 35, depth: 12, bestmove: 'e2e4' });
  engine.dispose();
});
