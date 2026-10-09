import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/rooms.js';
function fixture(options = {}) {
  let now = 0;
  const manager = new RoomManager({ now: () => now, ...options });
  const make = () => {
    const messages = [];
    const client = manager.client((message) => messages.push(message));
    return { client, messages, last: () => messages.at(-1) };
  };
  const host = make(),
    guest = make();
  manager.handle(host.client, { type: 'create', name: 'Arthur', clock: 'blitz' });
  const code = host.client.room.code;
  return {
    manager,
    host,
    guest,
    code,
    make,
    time: (value) => {
      now = value;
    },
    join: () => manager.handle(guest.client, { type: 'join', code, name: 'Amigo' }),
  };
}
test('cria sala e dois jogadores recebem a mesma posição', () => {
  const f = fixture();
  assert.match(f.code, /^[A-Z2-9]{6}$/);
  assert.equal(f.host.last().phase, 'waiting');
  f.join();
  assert.equal(f.host.last().phase, 'playing');
  assert.equal(f.host.last().fen, f.guest.last().fen);
  assert.equal(f.guest.client.color, 'b');
});
test('servidor rejeita código inexistente, sala cheia e lance fora do turno', () => {
  const f = fixture();
  f.manager.handle(f.guest.client, { type: 'join', code: 'ZZZZZZ' });
  assert.equal(f.guest.last().type, 'error');
  f.join();
  const third = f.make();
  f.manager.handle(third.client, { type: 'join', code: f.code });
  assert.equal(third.last().type, 'error');
  f.manager.handle(f.guest.client, {
    type: 'move',
    from: 'e7',
    to: 'e5',
    revision: f.guest.last().revision,
  });
  assert.match(f.guest.last().message, /turno/);
});
test('lances ilegais e revisões antigas não modificam a sala', () => {
  const f = fixture();
  f.join();
  const revision = f.host.last().revision,
    fen = f.host.last().fen;
  f.manager.handle(f.host.client, { type: 'move', from: 'e2', to: 'e5', revision });
  assert.equal(f.host.last().type, 'error');
  assert.equal(f.host.client.room.session.chess.fen(), fen);
  f.manager.handle(f.host.client, { type: 'move', from: 'e2', to: 'e4', revision });
  const advanced = f.host.last().fen;
  assert.equal(f.guest.last().fen, advanced);
  assert.equal(f.host.last().moves.length, 1);
  f.manager.handle(f.guest.client, { type: 'move', from: 'e7', to: 'e5', revision });
  assert.match(f.guest.last().message, /posição mudou/);
  assert.equal(f.host.client.room.session.chess.fen(), advanced);
});
test('tokens de reconexão não aparecem no estado público', () => {
  const f = fixture();
  f.join();
  const publicState = JSON.stringify(f.host.last());
  assert.equal(publicState.includes(f.host.client.token), false);
  assert.equal(publicState.includes(f.guest.client.token), false);
});
test('desconexão pausa o relógio; token correto recupera a vaga', () => {
  const f = fixture();
  f.join();
  const token = f.host.client.token;
  f.time(5000);
  f.manager.disconnect(f.host.client);
  assert.equal(f.guest.last().phase, 'reconnecting');
  assert.equal(f.guest.last().clocks.w, 175000);
  f.time(50000);
  f.manager.tick();
  assert.equal(f.guest.last().clocks.w, 175000);
  const recovered = f.make();
  f.manager.handle(recovered.client, { type: 'resume', code: f.code, token });
  assert.equal(recovered.last().phase, 'playing');
  assert.equal(recovered.client.color, 'w');
});
test('token inválido não toma a vaga de outro jogador', () => {
  const f = fixture();
  f.join();
  f.manager.disconnect(f.host.client);
  const attacker = f.make();
  f.manager.handle(attacker.client, { type: 'resume', code: f.code, token: 'fake' });
  assert.equal(attacker.last().type, 'error');
});
test('expiração da reconexão encerra a partida', () => {
  const f = fixture({ reconnectGrace: 1000 });
  f.join();
  f.manager.disconnect(f.guest.client);
  f.time(1001);
  f.manager.tick();
  assert.equal(f.host.last().result.winner, 'w');
  assert.equal(f.host.last().phase, 'finished');
});
test('abandonar e sair publicam o vencedor', () => {
  const f = fixture();
  f.join();
  f.manager.handle(f.guest.client, { type: 'resign' });
  assert.equal(f.host.last().result.winner, 'w');
  const g = fixture();
  g.join();
  g.manager.handle(g.host.client, { type: 'leave' });
  assert.equal(g.guest.last().result.winner, 'b');
  assert.equal(g.host.last().type, 'left');
});
test('limite de salas e expiração da sala de espera', () => {
  const f = fixture({ maxRooms: 1 }),
    second = f.make();
  f.manager.handle(second.client, { type: 'create' });
  assert.equal(second.last().type, 'error');
  f.time(1800001);
  f.manager.tick();
  assert.equal(f.manager.rooms.size, 0);
});
