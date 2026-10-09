import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createChessServer } from '../server.js';

async function launch(t) {
  const { server, wss } = createChessServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const ws of wss.clients) ws.terminate();
    await new Promise((resolve) => server.close(resolve));
  });
  const port = server.address().port;
  return { base: `http://127.0.0.1:${port}`, socket: `ws://127.0.0.1:${port}/ws` };
}
function client(url) {
  const socket = new WebSocket(url),
    messages = [],
    waiters = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(raw);
    messages.push(message);
    for (const waiter of [...waiters])
      if (waiter.match(message)) {
        clearTimeout(waiter.timer);
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
  });
  const wait = (match) => {
    const found = messages.find(match);
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const waiter = {
        match,
        resolve,
        timer: setTimeout(() => reject(Error('Resposta WebSocket ausente')), 3000),
      };
      waiters.push(waiter);
    });
  };
  return { socket, wait, send: (value) => socket.send(JSON.stringify(value)) };
}
test('servidor entrega a aplicação e WASM com MIME correto e bloqueia arquivos internos', async (t) => {
  const { base } = await launch(t);
  const html = await fetch(base);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /chess\.io/);
  const style = await fetch(base + '/styles/board.css');
  assert.equal(style.status, 200);
  assert.match(style.headers.get('content-type'), /text\/css/);
  assert.match(await style.text(), /\.board/);
  const wasm = await fetch(base + '/vendor/stockfish/stockfish-19-lite-single.wasm', {
    method: 'HEAD',
  });
  assert.equal(wasm.status, 200);
  assert.equal(wasm.headers.get('content-type'), 'application/wasm');
  const portrait = await fetch(base + '/assets/portraits/adolf-anderssen.jpg', { method: 'HEAD' });
  assert.equal(portrait.status, 200);
  assert.equal(portrait.headers.get('content-type'), 'image/jpeg');
  for (const path of [
    '/.git/config',
    '/package.json',
    '/node_modules/ws/package.json',
    '/src/%2e%2e/%2e%2e/etc/passwd',
  ])
    assert.equal((await fetch(base + path)).status, 404);
});
test('duas conexões WebSocket jogam e recebem a mesma posição real', async (t) => {
  const { socket: url } = await launch(t);
  const white = client(url),
    black = client(url);
  t.after(() => {
    white.socket.terminate();
    black.socket.terminate();
  });
  await Promise.all([once(white.socket, 'open'), once(black.socket, 'open')]);
  white.send({ type: 'create', name: 'Arthur', clock: 'unlimited' });
  const joined = await white.wait((m) => m.type === 'joined');
  black.send({ type: 'join', code: joined.code, name: 'Amigo' });
  const state = await white.wait((m) => m.type === 'state' && m.phase === 'playing');
  white.send({ type: 'move', from: 'e2', to: 'e4', revision: state.revision });
  const blackTurn = await black.wait((m) => m.type === 'state' && m.moves.length === 1);
  black.send({ type: 'move', from: 'e7', to: 'e5', revision: blackTurn.revision });
  const [a, b] = await Promise.all([
    white.wait((m) => m.type === 'state' && m.moves.length === 2),
    black.wait((m) => m.type === 'state' && m.moves.length === 2),
  ]);
  assert.equal(a.fen, b.fen);
  assert.deepEqual(
    a.moves.map((m) => m.san),
    ['e4', 'e5'],
  );
  black.send({ type: 'resign' });
  assert.equal((await white.wait((m) => m.type === 'state' && m.result)).result.winner, 'w');
});
test('WebSocket rejeita origem de outro site', async (t) => {
  const { socket: url } = await launch(t);
  const socket = new WebSocket(url, { origin: 'https://outro-site.example' });
  socket.on('error', () => {});
  const [error] = await once(socket, 'error');
  assert.match(error.message, /403/);
});
