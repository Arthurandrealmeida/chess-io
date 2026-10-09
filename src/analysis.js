import { Chess } from '../vendor/chess.js';

export const moveUCI = move => move.from + move.to + (move.promotion || '');
const numericScore = score => score.kind === 'mate' ? Math.sign(score.value) * 100_000 : score.value;

export function classifyMove(move, before, after) {
  if (!before || !after) return { key: 'unknown', label: 'Sem avaliação', loss: null };
  const loss = Math.max(0, (numericScore(before) - numericScore(after)) * (move.color === 'w' ? 1 : -1));
  if (moveUCI(move) === before.bestmove || move.san.endsWith('#')) return { key: 'best', label: 'Melhor lance', loss: 0 };
  const [key, label] = loss < 20 ? ['excellent', 'Excelente'] : loss < 60 ? ['good', 'Bom lance'] : loss < 120 ? ['inaccuracy', 'Imprecisão'] : loss < 250 ? ['mistake', 'Erro'] : ['blunder', 'Erro grave'];
  return { key, label, loss };
}

export function formatEvaluation(score) {
  if (!score) return '—';
  if (score.kind === 'mate') return `${score.terminal ? 'Mate' : `M${Math.abs(score.value)}`} · ${score.value >= 0 ? 'brancas' : 'pretas'}`;
  return `${score.value > 0 ? '+' : ''}${(score.value / 100).toFixed(2)}`;
}

export function bestSAN(fen, uci) {
  if (!uci || uci === '(none)' || uci === '0000') return '—';
  try { return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci.length === 5 ? { promotion: uci[4] } : {}) }).san; }
  catch { return '—'; }
}

// Reuse each evaluated position for the moves immediately before and after it.
// Work runs sequentially in a separate Worker; closing the result cancels it.
export async function analyzeGame(snapshot, engine, { onProgress = () => {}, cancelled = () => false } = {}) {
  const { frames, moves } = snapshot;
  if (frames.length !== moves.length + 1) throw new Error('O histórico da partida está incompleto.');
  const evaluations = [], rows = [];
  for (let index = 0; index < frames.length; index++) {
    if (cancelled()) return null;
    const chess = new Chess(frames[index]);
    let score;
    if (chess.isCheckmate()) score = { kind: 'mate', value: chess.turn() === 'w' ? -1 : 1, terminal: true, bestmove: '(none)' };
    else if (chess.isDraw() || index === moves.length && snapshot.result?.winner === null) score = { kind: 'cp', value: 0, bestmove: '(none)' };
    else score = await engine.evaluate(frames[index]);
    if (!score || cancelled()) return null;
    evaluations.push(score);
    if (index > 0) {
      const move = moves[index - 1], before = evaluations[index - 1];
      rows.push({ ply: index, move, score, best: bestSAN(frames[index - 1], before.bestmove), ...classifyMove(move, before, score) });
    }
    onProgress({ completed: index + 1, total: frames.length, rows: [...rows], evaluations: [...evaluations] });
  }
  return { rows, evaluations };
}
