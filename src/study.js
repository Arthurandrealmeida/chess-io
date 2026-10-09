import { GameSession } from './game.js';

export function activeMoment(moments, cursor) {
  return moments.findLast((moment) => moment.ply <= cursor) || null;
}
export function moveLabel(ply) {
  return `${Math.ceil(ply / 2)}${ply % 2 ? '.' : '...'}`;
}
export function reviewMove(session, requestedPly) {
  const previous = session.cursor;
  session.review(requestedPly);
  if (session.cursor === previous + 1) return session.lastMove;
  if (session.cursor === previous - 1) {
    const move = session.moves[previous - 1];
    return { ...move, from: move.to, to: move.from };
  }
  return null;
}
export function recordedResult(chess) {
  return (
    {
      '1-0': '1–0 · Vitória das brancas',
      '0-1': '0–1 · Vitória das pretas',
      '1/2-1/2': '½–½ · Empate',
    }[chess.getHeaders().Result] || 'Linha concluída'
  );
}
export function reviewArrow(event, { preserveBoardKeys = false } = {}) {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  )
    return 0;
  const target = event.target;
  if (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) ||
    target?.isContentEditable ||
    target?.closest?.('[contenteditable="true"], [role="textbox"], [role="slider"]')
  )
    return 0;
  if (preserveBoardKeys && target?.closest?.('.board')) return 0;
  return event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
}
export function preserveSquareKeys({ page, resultOpen = false, puzzleStatus } = {}) {
  return (
    !resultOpen &&
    !['replay', 'opening'].includes(page) &&
    (page !== 'puzzle' || puzzleStatus === 'playing')
  );
}
export class OpeningSession extends GameSession {
  open(opening, variationId = opening.variations[0].id) {
    const variation = opening.variations.find((v) => v.id === variationId) || opening.variations[0];
    if (this.opening?.id === opening.id && this.variation?.id === variation.id) return;
    this.opening = opening;
    this.variation = variation;
    this.replay(variation.pgn, 0, 'opening');
  }
  step(delta) {
    this.review(this.cursor + delta);
  }
  get note() {
    return activeMoment(this.variation.notes, this.cursor);
  }
}
