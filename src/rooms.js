import { randomBytes, randomInt } from 'node:crypto';
import { GameSession, TIME_CONTROLS, opposite } from './game.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const sanitizeName = (name, fallback) => typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : fallback;
export class RoomManager {
  constructor({ now = () => Date.now(), maxRooms = 200, reconnectGrace = 120_000 } = {}) {
    this.now = now; this.maxRooms = maxRooms; this.reconnectGrace = reconnectGrace; this.rooms = new Map();
  }
  client(send) { return { send, room: null, color: null, token: null }; }
  error(client, message) { client.send({ type: 'error', message }); }
  handle(client, message) {
    try {
      switch (message.type) {
        case 'create': this.create(client, message); break;
        case 'join': this.join(client, message); break;
        case 'resume': this.resume(client, message); break;
        case 'move': this.move(client, message); break;
        case 'resign': this.resign(client); break;
        case 'leave': this.leave(client); break;
        default: throw new Error('Pedido desconhecido.');
      }
    } catch (error) { this.error(client, error.message); }
  }
  code() {
    let code;
    do { code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''); } while (this.rooms.has(code));
    return code;
  }
  attach(client, room, color, name) {
    const seat = room.players[color];
    seat.name = sanitizeName(name, color === 'w' ? 'Jogador 1' : 'Jogador 2');
    seat.client = client; seat.disconnectedAt = null;
    client.room = room; client.color = color; client.token = seat.token;
    client.send({ type: 'joined', code: room.code, color, token: seat.token });
  }
  create(client, { name, clock = 'rapid' }) {
    if (client.room) throw new Error('Saia da sala atual antes de criar outra.');
    if (this.rooms.size >= this.maxRooms) throw new Error('As salas estão ocupadas. Tente novamente em breve.');
    if (!TIME_CONTROLS[clock]) throw new Error('Tempo de partida inválido.');
    const session = new GameSession({ now: this.now }); session.start({ clock, side: 'w' }); session.mode = 'lan'; session.pause();
    const room = { code: this.code(), session, updatedAt: this.now(), players: { w: { token: randomBytes(24).toString('hex'), name: 'Jogador 1' }, b: { token: randomBytes(24).toString('hex'), name: 'Jogador 2' } }, started: false };
    this.rooms.set(room.code, room); this.attach(client, room, 'w', name); this.broadcast(room);
  }
  join(client, { code, name }) {
    if (client.room) throw new Error('Você já está em uma sala.');
    const room = this.rooms.get(String(code).toUpperCase());
    if (!room) throw new Error('Sala não encontrada. Confira o código.');
    if (room.started || room.players.b.client) throw new Error('Essa sala já tem dois jogadores.');
    if (!room.players.w.client) throw new Error('O anfitrião está desconectado. Aguarde o retorno.');
    this.attach(client, room, 'b', name); room.started = true; room.session.resume(); room.updatedAt = this.now(); this.broadcast(room);
  }
  resume(client, { code, token }) {
    if (client.room) throw new Error('Você já está conectado à sala.');
    const room = this.rooms.get(String(code).toUpperCase());
    const color = room && ['w', 'b'].find(color => room.players[color].token === token);
    if (!room || !color) throw new Error('Não foi possível recuperar sua sala.');
    const seat = room.players[color];
    if (seat.client) throw new Error('Esta vaga já está aberta em outra janela.');
    this.attach(client, room, color, seat.name);
    if (room.started && room.players.w.client && room.players.b.client) room.session.resume();
    room.updatedAt = this.now(); this.broadcast(room);
  }
  move(client, { from, to, promotion, revision }) {
    const room = client.room;
    if (!room || !room.started) throw new Error('Aguarde o outro jogador entrar.');
    if (!room.players.w.client || !room.players.b.client) throw new Error('A partida está pausada até seu amigo voltar.');
    if (room.session.revision !== revision) throw new Error('A posição mudou. Aguarde a atualização da sala.');
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to) || (promotion && !['q','r','b','n'].includes(promotion))) throw new Error('Lance inválido.');
    room.session.move({ from, to, ...(promotion ? { promotion } : {}) }, client.color);
    room.updatedAt = this.now(); this.broadcast(room);
  }
  resign(client) {
    if (!client.room || !client.room.started) throw new Error('A partida ainda não começou.');
    client.room.session.resign(client.color); client.room.updatedAt = this.now(); this.broadcast(client.room);
  }
  leave(client) {
    const room = client.room; if (!room) return;
    if (room.started && !room.session.result) room.session.resign(client.color);
    room.players[client.color].client = null; room.players[client.color].disconnectedAt = this.now();
    room.players[client.color].token = randomBytes(24).toString('hex');
    client.room = null; client.color = null; client.token = null;
    client.send({ type: 'left' });
    if (!room.started) this.rooms.delete(room.code);
    else this.broadcast(room);
  }
  disconnect(client) {
    const room = client.room; if (!room) return;
    room.session.pause(); room.players[client.color].client = null;
    room.players[client.color].disconnectedAt = this.now(); room.updatedAt = this.now();
    client.room = null; this.broadcast(room);
  }
  publicState(room) {
    const game = room.session; game.syncClock();
    const connected = room.players.w.client && room.players.b.client;
    return {
      type: 'state', code: room.code,
      phase: game.result ? 'finished' : !room.started ? 'waiting' : connected ? 'playing' : 'reconnecting',
      players: ['w', 'b'].map(color => ({ color, name: room.players[color].name, connected: !!room.players[color].client })),
      fen: game.chess.fen(), frames: game.frames, moves: game.moves.map(m => ({ from: m.from, to: m.to, color: m.color, piece: m.piece, san: m.san, promotion: m.promotion, before: m.before, after: m.after })),
      turn: game.chess.turn(), clocks: { ...game.remaining }, clock: game.config.clock,
      result: game.result, revision: game.revision, running: game.running,
    };
  }
  broadcast(room) {
    const state = this.publicState(room);
    for (const seat of Object.values(room.players)) seat.client?.send(state);
  }
  tick() {
    for (const room of this.rooms.values()) {
      const game = room.session;
      if (room.started && !game.result) {
        for (const [color, seat] of Object.entries(room.players)) if (!seat.client && seat.disconnectedAt !== null && this.now() - seat.disconnectedAt > this.reconnectGrace) {
          game.result = { winner: opposite(color), reason: 'Adversário desconectado' }; game.running = false; game.revision++; room.updatedAt = this.now(); break;
        }
        this.broadcast(room);
      }
      if (this.now() - room.updatedAt > 30 * 60_000 && (!room.started || game.result)) {
        for (const seat of Object.values(room.players)) if (seat.client) { this.error(seat.client, 'Esta sala expirou. Crie uma nova partida.'); seat.client.room = null; }
        this.rooms.delete(room.code);
      }
    }
  }
}
