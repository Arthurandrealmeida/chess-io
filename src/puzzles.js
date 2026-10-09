import { BoardView } from './board.js';
import { PuzzleLoader } from './puzzle-loader.js';
import { PuzzleSession } from './puzzle-session.js';
import { readPuzzleProgress, recordPuzzleAttempt, createPuzzleStorage } from './puzzle-progress.js';
export const THEME_NAMES = {
  advancedPawn: 'Peão avançado',
  advantage: 'Vantagem',
  anastasiaMate: 'Mate de Anastasia',
  arabianMate: 'Mate árabe',
  attackingF2F7: 'Ataque a f2/f7',
  attraction: 'Atração',
  backRankMate: 'Mate na última fileira',
  balestraMate: 'Mate de Balestra',
  bishopEndgame: 'Final de bispos',
  blindSwineMate: 'Mate dos porcos cegos',
  bodenMate: 'Mate de Boden',
  capturingDefender: 'Eliminar o defensor',
  castling: 'Roque',
  check: 'Xeque',
  clearance: 'Desobstrução',
  collinearMove: 'Lance na mesma linha',
  cornerMate: 'Mate no canto',
  crushing: 'Vantagem decisiva',
  defensiveMove: 'Defesa',
  deflection: 'Desvio',
  discoveredAttack: 'Ataque descoberto',
  discoveredCheck: 'Xeque descoberto',
  doubleAttack: 'Ataque duplo',
  doubleBishopMate: 'Mate de dois bispos',
  doubleCheck: 'Xeque duplo',
  dovetailMate: 'Mate de cauda de pombo',
  drawing: 'Empate',
  enPassant: 'En passant',
  endgame: 'Final',
  epauletteMate: 'Mate de dragona',
  equality: 'Igualdade',
  exposedKing: 'Rei exposto',
  fork: 'Garfo',
  hangingPiece: 'Peça indefesa',
  hookMate: 'Mate de gancho',
  initiative: 'Iniciativa',
  interference: 'Interferência',
  intermezzo: 'Lance intermediário',
  killBoxMate: 'Mate em caixa',
  kingsideAttack: 'Ataque na ala do rei',
  knightEndgame: 'Final de cavalos',
  lichess: 'Lichess',
  long: 'Sequência longa',
  master: 'Partidas de mestres',
  masterVsMaster: 'Mestres contra mestres',
  mate: 'Xeque-mate',
  mateIn1: 'Mate em 1',
  mateIn2: 'Mate em 2',
  mateIn3: 'Mate em 3',
  mateIn4: 'Mate em 4',
  mateIn5: 'Mate em 5',
  middlegame: 'Meio-jogo',
  morphysMate: 'Mate de Morphy',
  notSure: 'Outros temas',
  oneMove: 'Um lance',
  opening: 'Abertura',
  operaMate: 'Mate da Ópera',
  outpost: 'Posto avançado',
  pawnEndgame: 'Final de peões',
  perpetualCheck: 'Xeque perpétuo',
  pieceEndgame: 'Final de peças',
  pillsburysMate: 'Mate de Pillsbury',
  pin: 'Cravada',
  promotion: 'Promoção',
  queenEndgame: 'Final de damas',
  queenRookEndgame: 'Final de dama e torre',
  queensideAttack: 'Ataque na ala da dama',
  quietMove: 'Lance tranquilo',
  rookEndgame: 'Final de torres',
  royalFork: 'Garfo de rei e dama',
  sacrifice: 'Sacrifício',
  short: 'Sequência curta',
  skewer: 'Espeto',
  smotheredMate: 'Mate sufocado',
  stalemate: 'Afogamento',
  strategicMove: 'Estratégia',
  suffocationMate: 'Mate de sufocação',
  superGM: 'Grandes mestres de elite',
  swallowstailMate: 'Mate de cauda de andorinha',
  threefoldRepetition: 'Repetição',
  trappedKing: 'Rei encurralado',
  trappedPiece: 'Peça presa',
  triangleMate: 'Mate em triângulo',
  twoRooksEndgame: 'Final de duas torres',
  underPromotion: 'Subpromoção',
  veryLong: 'Sequência muito longa',
  vukovicMate: 'Mate de Vuković',
  weakSquare: 'Casa fraca',
  xRayAttack: 'Ataque de raio X',
  zugzwang: 'Zugzwang',
};
const themeName = (t) => THEME_NAMES[t] || t.replace(/([a-z])([A-Z])/g, '$1 $2');
const AUTO_NEXT_KEY = 'chess.io.puzzle-auto-next.v1';
export class PuzzleView {
  constructor({
    loader = new PuzzleLoader(),
    storage,
    root = globalThis.document,
    Board = BoardView,
    promotion = async () => 'q',
    preferences = () => ({}),
  } = {}) {
    this.loader = loader;
    this.storage = createPuzzleStorage(storage);
    this.root = root;
    this.$ = (id) => root.getElementById(id);
    this.promotion = promotion;
    this.preferences = preferences;
    this.generation = 0;
    this.active = false;
    this.loading = false;
    this.session = null;
    this.feedbackCorrect = false;
    this.progress = readPuzzleProgress(this.storage);
    this.autoNext = this.storage.getItem(AUTO_NEXT_KEY) === 'true';
    const autoToggle = this.$('puzzle-auto-next');
    autoToggle.checked = this.autoNext;
    autoToggle.addEventListener('change', () => {
      this.autoNext = autoToggle.checked;
      this.storage.setItem(AUTO_NEXT_KEY, String(this.autoNext));
      this.scheduleAutoNext();
    });
    this.board = new Board(this.$('puzzle-board'), {
      onSquare: (s) => this.select(s),
      onMove: (from, to) => this.move(from, to),
      canDrag: (s) =>
        this.canPlay() && this.session.chess.get(s)?.color === this.session.playerColor,
    });
    for (const id of ['puzzle-difficulty', 'puzzle-theme'])
      this.$(id).addEventListener('change', () => this.next());
    this.$('puzzle-next').addEventListener('click', () => this.next());
    this.$('puzzle-reload').addEventListener('click', () => this.next());
    this.$('puzzle-hint').addEventListener('click', () => {
      const from = this.session?.hint();
      if (!from) return;
      this.selected = from;
      this.message = `Procure um lance com a peça em ${from}. A tentativa será assistida.`;
      this.render();
    });
    this.$('puzzle-reveal').addEventListener('click', () => {
      if (!this.canPlay()) return;
      this.session.reveal();
      this.finish();
      this.selected = null;
      this.message = 'Solução revelada. Avance pelos lances para entender a ideia.';
      this.render();
    });
    this.$('puzzle-retry').addEventListener('click', () => {
      if (!this.session || this.loading) return;
      this.cancelAutoNext();
      this.hideSuccess();
      this.finish();
      this.session.retry();
      this.selected = null;
      this.feedbackCorrect = false;
      this.message = 'Tente a mesma posição novamente. Esta revisão é assistida.';
      this.render();
    });
    this.$('puzzle-back').addEventListener('click', () => this.stepReview(-1));
    this.$('puzzle-forward').addEventListener('click', () => this.stepReview(1));
  }
  canPlay() {
    return this.active && !this.loading && this.session?.status === 'playing';
  }
  async open() {
    this.active = true;
    await this.next();
  }
  close() {
    this.cancelAutoNext();
    this.hideSuccess();
    this.finish(true);
    this.active = false;
    this.generation++;
    this.controller?.abort();
    this.loading = false;
  }
  cancelAutoNext() {
    clearTimeout(this.autoNextTimer);
    this.autoNextTimer = null;
  }
  scheduleAutoNext() {
    this.cancelAutoNext();
    if (!this.autoNext || !this.active || this.loading || this.session?.status !== 'solved') return;
    const session = this.session,
      generation = this.generation;
    this.autoNextTimer = setTimeout(() => {
      if (
        this.autoNext &&
        this.active &&
        !this.loading &&
        this.session === session &&
        this.generation === generation
      )
        this.next();
    }, 1800);
  }
  hideSuccess() {
    clearTimeout(this.successTimer);
    const badge = this.$('puzzle-success');
    if (badge) badge.hidden = true;
  }
  showSuccess() {
    this.hideSuccess();
    const badge = this.$('puzzle-success');
    if (!badge) return;
    badge.hidden = false;
    this.successTimer = setTimeout(() => this.hideSuccess(), 1600);
  }
  finish(leaving = false) {
    const s = this.session;
    if (!s || this.recorded || (s.status === 'playing' && (!leaving || (!s.failed && !s.assisted))))
      return;
    this.progress = recordPuzzleAttempt(this.storage, {
      id: s.puzzle.id,
      outcome: s.outcome,
      attemptId: this.attemptId,
    });
    this.recorded = true;
  }
  async next() {
    if (!this.active) return;
    this.cancelAutoNext();
    this.hideSuccess();
    this.finish(true);
    this.controller?.abort();
    const controller = (this.controller = new AbortController()),
      generation = ++this.generation;
    this.loading = true;
    this.selected = null;
    this.feedbackCorrect = false;
    this.message = 'Carregando um novo desafio…';
    this.$('puzzle-reload').hidden = true;
    this.render();
    try {
      const manifest = await this.loader.loadManifest({ signal: controller.signal });
      if (generation !== this.generation || !this.active) return;
      this.$('puzzle-count').textContent =
        `${manifest.total.toLocaleString('pt-BR')} puzzles para explorar · Lichess CC0`;
      if (!this.themesLoaded) {
        const select = this.$('puzzle-theme');
        const chosen = select.value;
        select.replaceChildren();
        for (const theme of ['', ...manifest.themes].sort((a, b) =>
          !a ? -1 : !b ? 1 : themeName(a).localeCompare(themeName(b), 'pt-BR'),
        )) {
          const option = this.root.createElement('option');
          option.value = theme;
          option.textContent = theme ? themeName(theme) : 'Misto · Surpreenda-me';
          select.append(option);
        }
        select.value = manifest.themes.includes(chosen) ? chosen : '';
        this.themesLoaded = true;
      }
      const [ratingMin, ratingMax] = this.$('puzzle-difficulty').value.split('-').map(Number);
      const puzzle = await this.loader.next({
        ratingMin,
        ratingMax,
        theme: this.$('puzzle-theme').value,
        recentIds: this.progress.recent,
        signal: controller.signal,
      });
      if (generation !== this.generation || !this.active) return;
      this.session = new PuzzleSession(puzzle);
      this.recorded = false;
      this.feedbackCorrect = false;
      this.attemptId = `${Date.now()}:${generation}:${puzzle.id}:${Math.random().toString(36).slice(2)}`;
      this.message =
        'Encontre a melhor sequência. Você joga de ' +
        (this.session.playerColor === 'w' ? 'brancas.' : 'pretas.');
    } catch (error) {
      if (generation !== this.generation || !this.active) return;
      this.session = null;
      this.message =
        error.name === 'AbortError'
          ? 'O carregamento demorou demais. Tente novamente.'
          : error.message;
      this.$('puzzle-reload').hidden = false;
    } finally {
      if (generation === this.generation && this.active) {
        this.loading = false;
        this.render();
      }
    }
  }
  select(square) {
    if (!this.canPlay()) return;
    if (this.selected && this.session.legalMoves(this.selected).some((m) => m.to === square)) {
      this.move(this.selected, square);
      return;
    }
    const piece = this.session.chess.get(square);
    this.selected =
      this.selected === square ? null : piece?.color === this.session.playerColor ? square : null;
    this.render();
  }
  async move(from, to) {
    if (!this.canPlay()) return;
    const s = this.session,
      generation = this.generation,
      candidates = s.legalMoves(from).filter((m) => m.to === to);
    if (!candidates.length) return;
    let promote;
    if (candidates.some((m) => m.promotion)) {
      promote = await this.promotion(s.playerColor);
      if (!promote) return;
    }
    if (generation !== this.generation || !this.canPlay() || this.session !== s) return;
    const result = s.play({ from, to, ...(promote ? { promotion: promote } : {}) });
    this.selected = null;
    this.feedbackCorrect = result.correct;
    this.message = result.correct
      ? result.complete
        ? s.outcome === 'solved'
          ? 'Certinho! Sequência resolvida.'
          : 'Certinho! Sequência concluída. Continue praticando!'
        : 'Certinho! Bom lance. Agora encontre a continuação.'
      : result.illegal
        ? 'Esse lance não é permitido.'
        : 'Esse lance não resolve a posição. Tente outra ideia.';
    if (result.complete) this.finish();
    this.render(result.reply || result.move, result.correct);
    if (result.correct && result.complete) {
      this.showSuccess();
      this.scheduleAutoNext();
    }
  }
  stepReview(delta) {
    if (!this.session || this.loading || this.session.status === 'playing') return;
    this.cancelAutoNext();
    this.hideSuccess();
    this.session.review(this.session.cursor + delta);
    this.render();
  }
  render(move = null, correctMove = false) {
    const s = this.session,
      status = this.$('puzzle-status');
    status.textContent = this.message || 'Escolha seu desafio.';
    status.classList.toggle('is-correct', !!this.feedbackCorrect);
    status.classList.remove('puzzle-pop');
    if (correctMove) {
      void status.offsetWidth;
      status.classList.add('puzzle-pop');
    }
    this.$('puzzle-workspace').hidden = !s;
    this.$('puzzle-loading').hidden = !!s;
    this.$('puzzle-loading').textContent = this.message || 'Seu próximo desafio está chegando.';
    this.$('puzzle-next').disabled = this.loading;
    this.$('puzzle-hint').disabled = !this.canPlay();
    this.$('puzzle-reveal').disabled = !this.canPlay();
    this.$('puzzle-retry').disabled = this.loading || !s || s.status === 'playing';
    this.$('puzzle-next').textContent =
      s?.status === 'playing' ? 'Pular puzzle →' : 'Próximo puzzle →';
    for (const key of ['solved', 'failed', 'assisted'])
      this.$(`puzzle-${key}`).textContent = this.progress[key].toLocaleString('pt-BR');
    if (!s) return;
    const reviewing = s.status !== 'playing';
    const prefs = this.preferences();
    this.board.render(s.fen, {
      orientation: s.playerColor,
      style: prefs.pieces || 'classic',
      selected: this.selected,
      legal: this.selected && this.canPlay() ? s.legalMoves(this.selected).map((m) => m.to) : [],
      lastMove: s.lastMove,
      move,
    });
    this.$('puzzle-player').textContent =
      s.playerColor === 'w' ? 'Você · Brancas' : 'Você · Pretas';
    this.$('puzzle-rating').textContent = `Dificuldade ${s.puzzle.rating} · Puzzle ${s.puzzle.id}`;
    this.$('puzzle-review').hidden = !reviewing;
    this.$('puzzle-back').disabled = s.cursor === 0 || this.loading;
    this.$('puzzle-forward').disabled = s.cursor === s.frames.length - 1 || this.loading;
    this.$('puzzle-source').hidden = !reviewing;
    this.$('puzzle-source').href =
      `https://lichess.org/training/${encodeURIComponent(s.puzzle.id)}`;
    this.$('puzzle-explanation').hidden = !reviewing;
    this.$('puzzle-tags').textContent = reviewing ? s.puzzle.themes.map(themeName).join(' · ') : '';
    this.$('puzzle-solution').textContent = reviewing
      ? s.moves
          .slice(1)
          .map((m, i) => `${i % 2 === 0 ? 'Você' : 'Adversário'}: ${m.san}`)
          .join(' · ')
      : '';
    this.$('puzzle-position').textContent = reviewing
      ? `Revisão ${s.cursor}/${s.frames.length - 1}`
      : 'Sua vez · Sem relógio';
  }
}
