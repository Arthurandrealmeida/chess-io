import { HISTORICAL_GAMES } from '../data/games.js';
import { HISTORICAL_PORTRAITS } from '../data/portraits.js';
import { GameSession } from './game.js';
import { BoardView, renderMiniBoard } from './board.js';
import { activeMoment, moveLabel, recordedResult, reviewMove } from './study.js';
import { downloadPGN, escapeHTML, renderMoves } from './ui.js';

export class HistoricalView {
  constructor(root = document) {
    this.$ = (id) => root.getElementById(id);
    this.session = new GameSession();
    this.board = new BoardView(this.$('replay-board'));
    this.game = null;
    this.autoplay = null;
    this.$('history-search').addEventListener('input', () => this.filter());
    this.$('replay-back').addEventListener('click', () => this.step(-1));
    this.$('replay-next').addEventListener('click', () => this.step(1));
    this.$('replay-reset').addEventListener('click', () => {
      this.stop();
      this.review(0);
    });
    this.$('replay-auto').addEventListener('click', () => this.toggleAutoplay());
    this.$('export-history').addEventListener('click', () =>
      downloadPGN(this.game.pgn, `${this.game.id}.pgn`),
    );
  }
  open(id) {
    const game = HISTORICAL_GAMES.find((game) => game.id === id);
    if (!game) return false;
    if (this.game?.id !== game.id) {
      this.stop();
      this.game = game;
      this.session.replay(game.pgn);
    }
    this.render();
    return true;
  }
  step(delta) {
    this.stop();
    this.review(this.session.cursor + delta);
  }
  toggleAutoplay() {
    if (this.autoplay) {
      this.stop();
      this.render();
      return;
    }
    this.$('replay-auto').textContent = 'Pausar';
    this.autoplay = setInterval(() => {
      this.review(this.session.cursor + 1);
      if (this.session.live) {
        this.stop();
        this.render();
      }
    }, 1000);
  }
  renderCollection() {
    renderMiniBoard(this.$('hero-board'), HISTORICAL_GAMES[0].previewFen, 'classic');
    this.$('history-cards').replaceChildren();
    for (const game of HISTORICAL_GAMES) {
      const article = document.createElement('article');
      article.className = 'history-card';
      article.dataset.id = game.id;
      article.innerHTML = `<div class="history-card-media"><div class="history-card-board" role="img" aria-label="Posição de ${escapeHTML(game.title)}"></div><span class="year-badge">${game.year}</span></div><div class="history-card-body"><p class="opening">${game.opening}</p><h3>${game.title}</h3><p class="historical-player">${game.white}</p><p class="historical-opponent${game.id === 'opera' ? ' long-name' : ''}">vs. ${game.black}</p><a class="card-link" href="#historicas/${game.id}">Ver e analisar <span aria-hidden="true">→</span><span class="sr-only"> ${game.title}</span></a></div>`;
      renderMiniBoard(article.querySelector('.history-card-board'), game.previewFen, 'classic');
      this.$('history-cards').append(article);
    }
    this.filter();
  }
  filter() {
    const normalize = (text) =>
      text
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
    const query = normalize(this.$('history-search').value.trim());
    let count = 0;
    for (const article of this.$('history-cards').children) {
      const game = HISTORICAL_GAMES.find((g) => g.id === article.dataset.id);
      const match = normalize(
        `${game.title} ${game.white} ${game.black} ${game.opening} ${game.year}`,
      ).includes(query);
      article.hidden = !match;
      if (match) count++;
    }
    this.$('history-empty').hidden = count !== 0;
  }
  stop() {
    clearInterval(this.autoplay);
    this.autoplay = null;
    this.$('replay-auto').textContent = 'Reproduzir';
  }
  render(move = null) {
    if (!this.game) return;
    this.board.render(this.session.fen, {
      style: 'classic',
      lastMove: this.session.lastMove,
      move,
    });
    this.$('replay-title').textContent = this.game.title;
    this.$('replay-subtitle').textContent = `${this.game.white} × ${this.game.black}`;
    this.$('historical-black').textContent = this.game.black;
    this.$('historical-white').textContent = this.game.white;
    for (const side of ['white', 'black']) {
      const portrait = HISTORICAL_PORTRAITS[this.game[side]],
        image = this.$(`historical-${side}-portrait`),
        link = this.$(`historical-${side}-portrait-link`);
      const path = portrait ? `../assets/portraits/${portrait.file}` : '../assets/pieces/wn.svg';
      const src = new URL(path, import.meta.url).href;
      if (image.src !== src) image.src = src;
      image.alt = portrait?.alt || 'Ícone de xadrez · retrato indisponível';
      link.href = portrait?.source || new URL('../CREDITS.md', import.meta.url).href;
      link.title = portrait
        ? 'Ver origem e crédito do retrato'
        : 'Retrato livre indisponível · Ver créditos';
      link.classList.toggle('portrait-fallback', !portrait);
    }
    this.$('historical-meta').textContent = `${this.game.year} · ${this.game.opening}`;
    this.$('historical-location').textContent = this.game.location;
    this.$('historical-description').textContent = this.game.description;
    this.$('historical-source').href = this.game.source;
    this.$('historical-note').textContent = this.game.note;
    this.$('replay-status').textContent = this.session.live
      ? `Fim · ${recordedResult(this.session.chess)} · ${this.session.chess.isCheckmate() ? 'Xeque-mate' : 'Abandono'}`
      : this.session.cursor
        ? `${this.session.cursor}/${this.session.moves.length} · ${moveLabel(this.session.cursor)} ${this.session.lastMove.san}`
        : 'Posição inicial';
    this.$('replay-back').disabled = this.session.cursor === 0;
    this.$('replay-next').disabled = this.session.live;
    this.$('replay-auto').disabled = this.session.live && !this.autoplay;
    renderMoves(this.$('replay-moves'), this.session.moves, this.session.cursor, (ply) => {
      this.stop();
      this.session.review(ply);
      this.render();
    });
    const moment = activeMoment(this.game.moments, this.session.cursor);
    this.$('historical-moment-label').textContent = moment
      ? `Ideia em ${moveLabel(moment.ply)} ${moment.san}`
      : 'Antes do primeiro lance';
    this.$('historical-moment-title').textContent = moment?.title || 'Acompanhe a história';
    this.$('historical-moment-text').textContent =
      moment?.text ||
      'Avance pelos lances ou escolha um dos momentos importantes abaixo para descobrir as ideias da partida.';
    const root = this.$('historical-moments');
    if (root.dataset.game !== this.game.id) {
      root.replaceChildren();
      root.dataset.game = this.game.id;
      for (const point of this.game.moments) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'moment-button';
        button.dataset.ply = point.ply;
        button.textContent = `${moveLabel(point.ply)} ${point.san} · ${point.title}`;
        button.addEventListener('click', () => {
          this.stop();
          this.review(point.ply);
        });
        root.append(button);
      }
    }
    for (const button of root.children)
      button.setAttribute('aria-pressed', String(Number(button.dataset.ply) === moment?.ply));
  }
  review(cursor) {
    const move = reviewMove(this.session, cursor);
    this.render(move);
  }
}
