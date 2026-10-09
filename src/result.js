import { EngineClient } from './engine.js';
import { BoardView } from './board.js';
import { analyzeGame, formatEvaluation } from './analysis.js';
import { resultOutcome } from './game.js';

const $ = (id) => document.getElementById(id);

export class ResultView {
  constructor({ onReview, onNewGame }) {
    this.engine = new EngineClient();
    this.generation = 0;
    this.snapshot = null;
    this.report = null;
    this.rows = [];
    this.board = new BoardView($('result-board'));
    this.onReview = onReview;
    this.onNewGame = onNewGame;
    $('result-close').addEventListener('click', () => $('result-dialog').close());
    $('result-dialog').addEventListener('close', () => this.cancel());
    $('analyze-game').addEventListener('click', () => this.analyze());
    $('cancel-analysis').addEventListener('click', () => this.cancel());
    $('result-new-game').addEventListener('click', () => {
      const snapshot = this.snapshot;
      $('result-dialog').close();
      onNewGame(snapshot);
    });
    $('result-review').addEventListener('click', () => {
      const snapshot = this.snapshot;
      $('result-dialog').close();
      onReview(snapshot, this.cursor);
    });
    $('result-back').addEventListener('click', () => this.select(this.cursor - 1));
    $('result-next').addEventListener('click', () => this.select(this.cursor + 1));
  }
  cancel() {
    this.generation++;
    this.engine.dispose();
    $('cancel-analysis').hidden = true;
    $('analyze-game').disabled = !this.snapshot?.moves.length || !!this.report;
    if (this.busy)
      $('analysis-status').textContent = 'Análise interrompida. Você pode tentar novamente.';
    this.busy = false;
  }
  show(snapshot) {
    if (!snapshot?.result) return;
    const key = snapshot.key;
    if (this.snapshot?.key !== key) {
      this.cancel();
      this.report = null;
      this.rows = [];
      this.snapshot = {
        ...snapshot,
        frames: [...snapshot.frames],
        moves: snapshot.moves.map((move) => ({ ...move })),
        result: { ...snapshot.result },
      };
      $('analysis-rows').replaceChildren();
      $('analysis-progress').hidden = true;
      $('analysis-status').textContent = snapshot.moves.length
        ? 'Descubra quais lances fizeram a diferença.'
        : 'A partida terminou antes do primeiro lance.';
      $('analysis-summary').textContent = '';
    }
    const outcome = resultOutcome(snapshot.result, snapshot.humanColor);
    $('result-dialog').dataset.outcome = outcome;
    $('result-icon').textContent = outcome === 'victory' ? '♔' : outcome === 'defeat' ? '♚' : '=';
    $('result-title').textContent =
      outcome === 'victory'
        ? 'Você venceu!'
        : outcome === 'defeat'
          ? 'Você perdeu esta partida.'
          : 'A partida terminou empatada.';
    $('result-message').textContent =
      outcome === 'victory'
        ? 'Boa partida. Agora descubra o que funcionou.'
        : outcome === 'defeat'
          ? 'Cada partida deixa uma ideia para a próxima.'
          : 'Um equilíbrio de forças. Vamos olhar os lances?';
    $('result-reason').textContent = snapshot.result.reason;
    $('result-opponent').textContent = snapshot.opponent;
    $('result-score').textContent =
      snapshot.result.winner === null
        ? '½ – ½'
        : snapshot.result.winner === snapshot.humanColor
          ? '1 – 0'
          : '0 – 1';
    $('result-move-count').textContent = `${snapshot.moves.length} lances`;
    $('analyze-game').disabled = !snapshot.moves.length || !!this.report;
    $('analyze-game').textContent = this.report ? 'Análise concluída' : 'Analisar lances';
    this.select(snapshot.moves.length);
    if (!$('result-dialog').open) {
      $('result-dialog').showModal();
      $('result-dialog').scrollTop = 0;
    }
  }
  select(ply) {
    if (!this.snapshot) return;
    this.cursor = Math.max(0, Math.min(ply, this.snapshot.moves.length));
    this.board.render(this.snapshot.frames[this.cursor], {
      orientation: this.snapshot.humanColor,
      lastMove: this.snapshot.moves[this.cursor - 1],
    });
    const row = this.rows[this.cursor - 1];
    $('result-position').textContent = this.cursor
      ? `${Math.ceil(this.cursor / 2)}${this.snapshot.moves[this.cursor - 1].color === 'w' ? '.' : '…'} ${this.snapshot.moves[this.cursor - 1].san} · ${this.cursor}/${this.snapshot.moves.length}`
      : 'Posição inicial';
    $('result-evaluation').textContent = row
      ? `${row.label} · ${formatEvaluation(row.score)}`
      : this.report && this.cursor === 0
        ? `Avaliação · ${formatEvaluation(this.report.evaluations[0])}`
        : 'Selecione um lance para revisar.';
    $('result-back').disabled = this.cursor === 0;
    $('result-next').disabled = this.cursor === this.snapshot.moves.length;
    $('analysis-rows')
      .querySelectorAll('button')
      .forEach((button) => {
        const active = Number(button.dataset.ply) === this.cursor;
        if (active) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
  }
  renderRows(rows) {
    this.rows = rows;
    for (let index = $('analysis-rows').children.length; index < rows.length; index++) {
      const row = rows[index],
        button = document.createElement('button');
      button.type = 'button';
      button.className = 'analysis-row';
      button.dataset.ply = row.ply;
      const number = document.createElement('strong');
      number.textContent = `${Math.ceil(row.ply / 2)}${row.move.color === 'w' ? '.' : '…'} ${row.move.san}`;
      const quality = document.createElement('span');
      quality.className = `move-quality quality-${row.key}`;
      quality.textContent = row.label;
      const score = document.createElement('span');
      score.textContent = formatEvaluation(row.score);
      const best = document.createElement('span');
      best.textContent = row.best;
      button.append(number, quality, score, best);
      button.setAttribute(
        'aria-label',
        `${number.textContent}, ${row.label}, avaliação ${score.textContent}, melhor opção ${row.best}`,
      );
      button.addEventListener('click', () => this.select(row.ply));
      $('analysis-rows').append(button);
    }
    const own = rows.filter((row) => row.move.color === this.snapshot.humanColor);
    const positive = own.filter((row) => ['best', 'excellent', 'good'].includes(row.key)).length;
    $('analysis-summary').textContent = own.length
      ? `Seus lances: ${positive} bons ou melhores · ${own.length - positive} para revisar`
      : '';
    this.select(this.cursor);
  }
  async analyze() {
    if (this.busy || this.report || !this.snapshot?.moves.length) return;
    // A retry starts fresh so partial rows never mix evaluations from two runs.
    $('analysis-rows').replaceChildren();
    this.rows = [];
    this.busy = true;
    const generation = ++this.generation;
    $('analyze-game').disabled = true;
    $('cancel-analysis').hidden = false;
    $('analysis-progress').hidden = false;
    $('analysis-progress').value = 0;
    $('analysis-status').textContent = 'Carregando o Stockfish para analisar…';
    try {
      const report = await analyzeGame(this.snapshot, this.engine, {
        cancelled: () => generation !== this.generation,
        onProgress: (progress) => {
          if (generation !== this.generation) return;
          $('analysis-progress').max = progress.total;
          $('analysis-progress').value = progress.completed;
          $('analysis-status').textContent =
            `Analisando posições · ${progress.completed}/${progress.total}`;
          this.renderRows(progress.rows);
        },
      });
      if (!report || generation !== this.generation) return;
      this.report = report;
      $('analysis-status').textContent =
        'Análise concluída. Clique em um lance para ver a posição.';
      $('analyze-game').textContent = 'Análise concluída';
      this.select(this.cursor);
    } catch (error) {
      if (generation === this.generation) $('analysis-status').textContent = error.message;
    } finally {
      if (generation === this.generation) {
        this.busy = false;
        $('cancel-analysis').hidden = true;
        $('analyze-game').disabled = !!this.report;
        this.engine.dispose();
      }
    }
  }
}
