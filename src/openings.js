import { OPENINGS } from '../data/openings.js';
import { OpeningSession, moveLabel, reviewMove } from './study.js';
import { BoardView, renderMiniBoard } from './board.js';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export class OpeningView {
  constructor({ renderMoves, downloadPGN }) {
    this.session = new OpeningSession(); this.renderMoves = renderMoves;
    this.board = new BoardView($('opening-board'), { canDrag: () => false });
    $('opening-back').addEventListener('click', () => this.step(-1));
    $('opening-next').addEventListener('click', () => this.step(1));
    $('opening-reset').addEventListener('click', () => this.review(0));
    $('opening-variation').addEventListener('change', event => {
      location.hash = `aberturas/${this.session.opening.id}/${event.target.value}`;
    });
    $('export-opening').addEventListener('click', () => {
      const { opening, variation } = this.session;
      downloadPGN(variation.pgn, `${opening.id}-${variation.id}.pgn`);
    });
    this.renderCollection();
  }
  renderCollection() {
    for (const side of ['w', 'b']) {
      const root = $(side === 'w' ? 'white-openings' : 'black-openings'); root.replaceChildren();
      for (const opening of OPENINGS.filter(o => o.side === side)) {
        const card = document.createElement('article'); card.className = 'history-card opening-card';
        card.innerHTML = `<div class="history-card-media"><div class="history-card-board" role="img" aria-label="Posição inicial de ${escape(opening.title)}"></div><span class="year-badge">${side === 'w' ? 'Brancas' : 'Pretas'}</span></div><div class="history-card-body"><p class="opening">${opening.eco} · ${opening.variations.length} variantes</p><h3>${escape(opening.title)}</h3><p class="opening-description">${escape(opening.description)}</p><a class="card-link" href="#aberturas/${opening.id}">Estudar abertura <span aria-hidden="true">→</span><span class="sr-only"> ${escape(opening.title)}</span></a></div>`;
        renderMiniBoard(card.querySelector('.history-card-board'), opening.previewFen);
        root.append(card);
      }
    }
  }
  open(id, variationId) {
    const opening = OPENINGS.find(o => o.id === id); if (!opening) return false;
    this.session.open(opening, variationId);
    $('opening-variation').replaceChildren();
    for (const variation of opening.variations) {
      const option = document.createElement('option'); option.value = variation.id; option.textContent = variation.title;
      $('opening-variation').append(option);
    }
    this.render(); return true;
  }
  step(delta) { this.review(this.session.cursor + delta); }
  review(ply) {
    const move = reviewMove(this.session, ply);
    this.render(move);
  }
  render(move = null) {
    const { session } = this, { opening, variation } = session; if (!opening) return;
    this.board.render(session.fen, { orientation: opening.side, lastMove: session.lastMove, move });
    $('opening-title').textContent = opening.title;
    $('opening-subtitle').textContent = `Repertório de ${opening.side === 'w' ? 'brancas' : 'pretas'} · ${opening.eco}`;
    $('opening-variation').value = variation.id;
    $('opening-description').textContent = variation.description;
    $('opening-plan').textContent = opening.plan;
    $('opening-source').href = opening.source;
    $('opening-status').textContent = session.cursor ? session.live ? 'Fim da linha · Explore outra variante' : `${session.cursor}/${session.moves.length} · ${moveLabel(session.cursor)} ${session.lastMove.san}` : 'Posição inicial';
    $('opening-back').disabled = session.cursor === 0; $('opening-next').disabled = session.live;
    const note = session.note;
    $('opening-note-label').textContent = note ? `Ideia em ${moveLabel(note.ply)} ${note.san}` : 'Antes do primeiro lance';
    $('opening-note-title').textContent = note?.title || 'Entenda o plano';
    $('opening-note-text').textContent = note?.text || opening.description;
    this.renderMoves($('opening-moves'), session.moves, session.cursor, ply => this.review(ply));
    // Keep the focused move button alive while only updating its selected state.
    const root = $('opening-moments');
    if (root.dataset.line !== `${opening.id}/${variation.id}`) {
      root.replaceChildren(); root.dataset.line = `${opening.id}/${variation.id}`;
      for (const moment of variation.notes) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'moment-button'; button.dataset.ply = moment.ply;
        button.textContent = `${moveLabel(moment.ply)} ${moment.san} · ${moment.title}`;
        button.addEventListener('click', () => this.review(moment.ply)); root.append(button);
      }
    }
    for (const button of root.children) button.setAttribute('aria-pressed', String(Number(button.dataset.ply) === note?.ply));
  }
}
