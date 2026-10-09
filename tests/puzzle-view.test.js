import test from 'node:test';
import assert from 'node:assert/strict';
import { PuzzleView } from '../src/puzzles.js';
class Element {
  constructor() {
    this.value = '';
    this.checked = false;
    this.hidden = false;
    this.disabled = false;
    this.dataset = {};
    this.children = [];
    this.handlers = {};
    const classes = new Set();
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
    };
  }
  addEventListener(n, fn) {
    this.handlers[n] = fn;
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
  append(node) {
    this.children.push(node);
  }
  setAttribute() {}
}
const environment = () => {
  const nodes = new Map();
  const root = {
    getElementById: (id) => {
      if (!nodes.has(id)) nodes.set(id, new Element());
      return nodes.get(id);
    },
    createElement: () => new Element(),
  };
  root.getElementById('puzzle-difficulty').value = '1000-1600';
  return { root, nodes };
};
const puzzle = {
  id: 'abc01',
  fen: '4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1',
  moves: ['d7d5', 'e5d6'],
  rating: 1200,
  themes: ['endgame'],
};
class Board {
  constructor(root, callbacks) {
    this.callbacks = callbacks;
  }
  render(fen, options) {
    this.fen = fen;
    this.options = options;
  }
}
test('tela carrega, esconde tema até concluir, registra solução e preserva revisão', async () => {
  const { root } = environment();
  let v = null;
  const storage = { getItem: () => v, setItem: (k, x) => (v = x) };
  const view = new PuzzleView({
    root,
    Board,
    storage,
    loader: {
      loadManifest: async () => ({ total: 10, themes: ['endgame'] }),
      next: async () => puzzle,
    },
  });
  await view.open();
  assert.equal(view.session.playerColor, 'w');
  assert.equal(root.getElementById('puzzle-source').hidden, true);
  await view.move('e5', 'd6');
  assert.equal(view.session.status, 'solved');
  assert.equal(root.getElementById('puzzle-source').hidden, false);
  assert.equal(JSON.parse(v).solved, 1);
  view.stepReview(-1);
  assert.equal(view.session.cursor, 0);
  view.stepReview(-1);
  assert.equal(view.session.cursor, 0);
});
test('carregamento atrasado não substitui filtro novo nem página fechada; erro pode ser repetido', async () => {
  const { root } = environment();
  const pending = [];
  const view = new PuzzleView({
    root,
    Board,
    loader: {
      loadManifest: async () => ({ total: 10, themes: [] }),
      next: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    },
  });
  const old = view.open();
  await new Promise((r) => setTimeout(r, 0));
  const newer = view.next();
  await new Promise((r) => setTimeout(r, 0));
  pending[1].resolve({ ...puzzle, id: 'new01' });
  await newer;
  pending[0].resolve(puzzle);
  await old;
  assert.equal(view.session.puzzle.id, 'new01');
  const closed = view.next();
  await new Promise((r) => setTimeout(r, 0));
  view.close();
  pending[2].resolve(puzzle);
  await closed;
  assert.equal(view.session.puzzle.id, 'new01');
  const opened = view.open();
  await new Promise((r) => setTimeout(r, 0));
  pending[3].reject(Error('Sem rede'));
  await opened;
  assert.equal(root.getElementById('puzzle-reload').hidden, false);
});
const autoKey = 'chess.io.puzzle-auto-next.v1';
const flush = () => new Promise((resolve) => setImmediate(resolve));
function autoEnvironment(saved = 'true', exercise = puzzle) {
  const { root } = environment(),
    values = new Map([[autoKey, saved]]);
  let loaded = 0;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const view = new PuzzleView({
    root,
    Board,
    storage,
    loader: {
      loadManifest: async () => ({ total: 10, themes: ['endgame'] }),
      next: async () => {
        loaded++;
        return exercise;
      },
    },
  });
  return { view, root, values, loaded: () => loaded };
}
test('avanço automático aguarda toda a sequência e deixa tempo para o acerto aparecer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const long = {
    id: '00008',
    fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
    moves: ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'],
    rating: 1800,
    themes: ['crushing'],
  };
  const { view, root, loaded } = autoEnvironment('true', long);
  t.after(() => view.close());
  assert.equal(root.getElementById('puzzle-auto-next').checked, true);
  await view.open();
  await view.move('e6', 'e7');
  t.mock.timers.tick(2000);
  await flush();
  assert.equal(loaded(), 1);
  await view.move('b3', 'c1');
  await view.move('h6', 'c1');
  t.mock.timers.tick(1500);
  await flush();
  assert.equal(loaded(), 1);
  assert.equal(root.getElementById('puzzle-success').hidden, false);
  t.mock.timers.tick(500);
  await flush();
  assert.equal(loaded(), 2);
  assert.equal(view.session.status, 'playing');
});
test('automático começa desligado e desligar cancela o próximo puzzle, salvando a escolha', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { view, root, values, loaded } = autoEnvironment(null);
  t.after(() => view.close());
  const toggle = root.getElementById('puzzle-auto-next');
  assert.equal(toggle.checked, false);
  await view.open();
  await view.move('e5', 'd6');
  t.mock.timers.tick(2000);
  await flush();
  assert.equal(loaded(), 1);
  toggle.checked = true;
  toggle.handlers.change();
  assert.equal(values.get(autoKey), 'true');
  toggle.checked = false;
  toggle.handlers.change();
  assert.equal(values.get(autoKey), 'false');
  t.mock.timers.tick(2000);
  await flush();
  assert.equal(loaded(), 1);
  assert.equal(view.session.status, 'solved');
});
for (const action of ['sair', 'pular', 'repetir', 'revisar', 'revelar'])
  test(`avanço pendente não interfere ao ${action}`, async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { view, root, loaded } = autoEnvironment();
    t.after(() => view.close());
    await view.open();
    if (action === 'revelar') root.getElementById('puzzle-reveal').handlers.click();
    else {
      await view.move('e5', 'd6');
      if (action === 'sair') view.close();
      if (action === 'pular') await view.next();
      if (action === 'repetir') root.getElementById('puzzle-retry').handlers.click();
      if (action === 'revisar') view.stepReview(-1);
    }
    t.mock.timers.tick(2000);
    await flush();
    assert.equal(loaded(), action === 'pular' ? 2 : 1);
  });
