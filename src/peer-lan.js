import { GameSession, TIME_CONTROLS } from './game.js';

const MAX_SIGNAL_CODE_LENGTH = 24_000;
const SIGNAL_TYPES = new Set(['offer', 'answer']);
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function fail(message = 'Código de conexão inválido.') {
  throw new Error(message);
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail();
  if (payload.version !== 1) fail('Versão do código de conexão não reconhecida.');
  if (!SIGNAL_TYPES.has(payload.type)) fail();
  if (typeof payload.sessionId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(payload.sessionId)) fail();
  if (typeof payload.sdp !== 'string' || !payload.sdp.trim()) fail('Descrição SDP ausente ou inválida.');
  if (payload.sdp.length > MAX_SIGNAL_CODE_LENGTH) fail('A descrição SDP é muito grande (limite de 24.000 caracteres).');
  if (payload.name !== undefined && (typeof payload.name !== 'string' || payload.name.length > 40)) fail();
  if (payload.clock !== undefined && (typeof payload.clock !== 'string' || payload.clock.length > 32)) fail();
  return payload;
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(code) {
  if (typeof code !== 'string' || !code.length || code.length > MAX_SIGNAL_CODE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(code) || code.length % 4 === 1) {
    fail(code?.length > MAX_SIGNAL_CODE_LENGTH ? 'O código é muito grande (limite de 24.000 caracteres).' : undefined);
  }
  const base64 = code.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - code.length % 4) % 4);
  try {
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  } catch {
    fail();
  }
}

export function encodeSignalCode({ type, sessionId, sdp, name, clock } = {}) {
  const payload = validatePayload({ version: 1, type, sessionId, sdp, ...(name === undefined ? {} : { name }), ...(clock === undefined ? {} : { clock }) });
  const code = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  if (code.length > MAX_SIGNAL_CODE_LENGTH) fail('O código é muito grande (limite de 24.000 caracteres).');
  return code;
}

export function decodeSignalCode(code, expectedType) {
  if (!SIGNAL_TYPES.has(expectedType)) fail('Etapa de conexão inválida.');
  let payload;
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(code)));
  } catch (error) {
    if (error instanceof Error && /código|etapa|versão|descrição/i.test(error.message)) throw error;
    fail();
  }
  validatePayload(payload);
  if (payload.type !== expectedType) fail('Este código não corresponde a esta etapa da conexão.');
  return payload;
}

function isLocalIPv4(address) {
  const octets = address.split('.');
  if (octets.length !== 4 || octets.some(part => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [first, second] = octets.map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || (first === 169 && second === 254);
}

function isLocalIPv6(address) {
  let value = address.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  const mappedIPv4 = value.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedIPv4) return isLocalIPv4(mappedIPv4[1]);
  if (value.includes('.')) return false;
  if (!value.includes(':') || (value.match(/::/g) || []).length > 1) return false;
  const halves = value.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return false;
  const groups = [...left, ...Array(missing).fill('0'), ...right];
  if (groups.length !== 8 || groups.some(group => !/^[0-9a-f]{1,4}$/.test(group))) return false;
  const first = Number.parseInt(groups[0], 16);
  return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80;
}

function isLocalCandidateAddress(address) {
  const value = address.replace(/^\[|\]$/g, '').split('%')[0];
  if (/\.local\.?$/i.test(value)) return true;
  return value.includes(':') ? isLocalIPv6(value) : isLocalIPv4(value);
}

export function filterLanCandidates(sdp) {
  if (typeof sdp !== 'string' || !sdp.trim()) fail('Descrição SDP ausente ou inválida.');
  const lines = sdp.split(/\r?\n/);
  let retained = 0;
  const filtered = lines.filter(line => {
    if (!line.startsWith('a=candidate:')) return true;
    const fields = line.trim().split(/\s+/);
    const typeIndex = fields.findIndex(field => field === 'typ');
    const candidateType = fields[typeIndex + 1];
    const address = fields[4];
    const isLocalHost = candidateType === 'host' && isLocalCandidateAddress(address || '');
    if (isLocalHost) retained++;
    return isLocalHost;
  });
  if (!retained) fail('Não há candidato direto utilizável para a rede local.');
  return filtered.join('\r\n');
}

function createSessionId() {
  const bytes = new Uint8Array(10);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function cleanName(name, fallback) {
  return typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : fallback;
}

function waitForIceGathering(peer, timeoutMs = 15_000) {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error('A coleta de endereços da rede demorou demais. Tente criar um novo convite.')), timeoutMs);
    const previous = peer.onicegatheringstatechange;
    function finish(error) {
      clearTimeout(timeout);
      peer.removeEventListener?.('icegatheringstatechange', changed);
      if (peer.onicegatheringstatechange === changed) peer.onicegatheringstatechange = previous || null;
      if (error) reject(error); else resolve();
    }
    function changed(event) {
      previous?.call(peer, event);
      if (peer.iceGatheringState === 'complete') finish();
    }
    if (peer.addEventListener) peer.addEventListener('icegatheringstatechange', changed);
    else peer.onicegatheringstatechange = changed;
  });
}

function initialState({ sessionId, hostName, guestName, clock, phase = 'waiting', connected = false, game }) {
  const current = game || new GameSession();
  if (!game) { current.start({ clock, side: 'b' }); current.mode = 'lan'; current.pause(); }
  const config = TIME_CONTROLS[clock];
  return {
    type: 'state', code: sessionId, phase, players: [
      { color: 'w', name: hostName, connected },
      { color: 'b', name: guestName, connected },
    ], fen: current.chess.fen(), frames: [...current.frames],
    moves: current.moves.map(move => ({ from: move.from, to: move.to, color: move.color, piece: move.piece, san: move.san, promotion: move.promotion, before: move.before, after: move.after })),
    turn: current.chess.turn(), clocks: { ...current.remaining }, clock,
    result: current.result, revision: current.revision, running: current.running,
    initialTime: config.milliseconds,
  };
}

function validateRemoteState(state, sessionId) {
  return state && state.type === 'state' && state.code === sessionId &&
    ['waiting', 'playing', 'reconnecting', 'finished'].includes(state.phase) &&
    typeof state.fen === 'string' && Array.isArray(state.frames) && Array.isArray(state.moves) &&
    ['w', 'b'].includes(state.turn) && state.clocks && Number.isInteger(state.revision) &&
    state.players?.length === 2 && (state.result === null || typeof state.result === 'object');
}

export class PeerLanClient {
  constructor({ RTCPeerConnectionImpl = globalThis.RTCPeerConnection, now = () => Date.now() } = {}) {
    this.RTCPeerConnectionImpl = RTCPeerConnectionImpl;
    this.now = now;
    this.peer = null;
    this.channel = null;
    this.game = null;
    this.state = null;
    this.sessionId = null;
    this.hostName = '';
    this.guestName = '';
    this.clock = 'rapid';
    this.role = null;
    this.color = null;
    this.connection = 'disconnected';
    this.hasConnected = false;
    this.ended = false;
    this.connectionTimer = null;
    this.onState = () => {};
    this.onError = () => {};
    this.onConnection = () => {};
    this.onLeave = () => {};
  }

  _setConnection(status) {
    if (this.connection === status) return;
    this.connection = status;
    this.onConnection(status);
  }

  _resetSession() {
    this._cleanup();
    this.game = null; this.state = null; this.sessionId = null;
    this.hostName = ''; this.guestName = ''; this.clock = 'rapid';
    this.role = null; this.color = null; this.hasConnected = false; this.ended = false;
    this._setConnection('disconnected');
  }

  _makePeer() {
    if (typeof this.RTCPeerConnectionImpl !== 'function') throw new Error('Este navegador não oferece suporte ao WebRTC necessário para partidas diretas.');
    const peer = new this.RTCPeerConnectionImpl({ iceServers: [] });
    this.peer = peer;
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') this._failConnection('A rede bloqueou a conexão direta. Confiram se os dois aparelhos estão na mesma rede e se o navegador permitiu acesso à rede local.');
    };
    return peer;
  }

  _bindChannel(channel) {
    if (channel.label !== 'chess-studio') { channel.close(); this._failConnection('O convite não corresponde a uma partida chess.io.'); return; }
    this.channel = channel;
    channel.onopen = () => {
      clearTimeout(this.connectionTimer);
      this.hasConnected = true;
      this._setConnection('connected');
      if (this.role === 'host' && this.game && !this.game.result) this.game.resume();
      if (this.role === 'host') this._broadcastState();
    };
    channel.onmessage = event => this._receive(event.data);
    channel.onerror = () => this._failConnection('O canal direto da partida apresentou um erro.');
    channel.onclose = () => this._handleDisconnect();
  }

  async _localSdp(description) {
    await this.peer.setLocalDescription(description);
    await waitForIceGathering(this.peer);
    const local = this.peer.localDescription || description;
    return filterLanCandidates(local.sdp);
  }

  async createHost({ name, clock = 'rapid' } = {}) {
    this._resetSession();
    if (!TIME_CONTROLS[clock]) throw new Error('Tempo de partida inválido.');
    this.role = 'host'; this.color = 'w'; this.sessionId = createSessionId();
    this.hostName = cleanName(name, 'Jogador 1'); this.guestName = 'Jogador 2'; this.clock = clock;
    this.game = new GameSession({ now: this.now }); this.game.start({ clock, side: 'w' }); this.game.mode = 'lan'; this.game.pause();
    this.state = initialState({ sessionId: this.sessionId, hostName: this.hostName, guestName: this.guestName, clock, game: this.game });
    try {
      const peer = this._makePeer();
      this._bindChannel(peer.createDataChannel('chess-studio', { ordered: true }));
      const offer = await peer.createOffer();
      const sdp = await this._localSdp(offer);
      this.state = initialState({ sessionId: this.sessionId, hostName: this.hostName, guestName: this.guestName, clock, game: this.game });
      return { sessionId: this.sessionId, inviteCode: encodeSignalCode({ type: 'offer', sessionId: this.sessionId, sdp, name: this.hostName, clock }), state: this.state };
    } catch (error) {
      this._cleanup();
      throw this._friendlyError(error);
    }
  }

  async createGuest({ inviteCode, name } = {}) {
    this._resetSession();
    const offer = decodeSignalCode(inviteCode, 'offer');
    if (!TIME_CONTROLS[offer.clock]) throw new Error('O convite não informa um tempo de partida válido. Peça um novo convite.');
    this.role = 'guest'; this.color = 'b'; this.sessionId = offer.sessionId;
    this.hostName = cleanName(offer.name, 'Jogador 1'); this.guestName = cleanName(name, 'Jogador 2'); this.clock = offer.clock;
    this.state = initialState({ sessionId: this.sessionId, hostName: this.hostName, guestName: this.guestName, clock: this.clock });
    try {
      const peer = this._makePeer();
      peer.ondatachannel = event => this._bindChannel(event.channel);
      await peer.setRemoteDescription({ type: 'offer', sdp: filterLanCandidates(offer.sdp) });
      const answer = await peer.createAnswer();
      const sdp = await this._localSdp(answer);
      return { sessionId: this.sessionId, answerCode: encodeSignalCode({ type: 'answer', sessionId: this.sessionId, sdp, name: this.guestName }) };
    } catch (error) {
      this._cleanup();
      throw this._friendlyError(error);
    }
  }

  async acceptGuestAnswer(answerCode) {
    if (this.role !== 'host' || !this.peer || !this.sessionId) throw new Error('Crie um convite antes de conectar a resposta.');
    const answer = decodeSignalCode(answerCode, 'answer');
    if (answer.sessionId !== this.sessionId) throw new Error('Esta resposta pertence a outro convite. Crie uma nova partida e troque os códigos novamente.');
    this.guestName = cleanName(answer.name, 'Jogador 2');
    try {
      await this.peer.setRemoteDescription({ type: 'answer', sdp: filterLanCandidates(answer.sdp) });
      this._setConnection('connecting');
      clearTimeout(this.connectionTimer);
      this.connectionTimer = setTimeout(() => this._failConnection('Não foi possível conectar. Confiram a mesma rede Wi‑Fi, a permissão de rede local e tentem gerar códigos novos.'), 25_000);
    } catch (error) {
      throw this._friendlyError(error);
    }
  }

  _friendlyError(error) {
    if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') return new Error('O navegador não permitiu a conexão local. Autorize o acesso à rede local e tente novamente.');
    if (error?.name === 'OperationError' || error?.name === 'InvalidAccessError') return new Error('Este código não pôde ser usado. Confira se foi copiado inteiro e gere códigos novos.');
    return error instanceof Error ? error : new Error('Não foi possível preparar a conexão da partida.');
  }

  _snapshot() {
    if (!this.game) return this.state;
    this.game.syncClock();
    const connected = this.connection === 'connected';
    const state = initialState({ sessionId: this.sessionId, hostName: this.hostName, guestName: this.guestName, clock: this.clock, game: this.game, connected, phase: this.game.result ? 'finished' : connected ? 'playing' : this.hasConnected ? 'reconnecting' : 'waiting' });
    state.players[0].connected = connected;
    state.players[1].connected = connected;
    state.running = this.game.running;
    return state;
  }

  _broadcastState({ transmit = true } = {}) {
    if (this.role !== 'host') return;
    this.state = this._snapshot();
    this.onState(this.state);
    if (transmit && this.channel?.readyState === 'open') {
      try { this.channel.send(JSON.stringify({ type: 'state', state: this.state })); }
      catch { this._failConnection('A conexão direta foi interrompida. Encerre a tentativa e crie códigos novos.'); }
    }
  }

  _sendMessage(message) {
    if (this.channel?.readyState !== 'open') throw new Error('A conexão direta ainda não está pronta.');
    this.channel.send(JSON.stringify(message));
  }

  async send(command) {
    if (!command || !['move', 'resign', 'leave'].includes(command.type)) throw new Error('Ação de partida inválida.');
    if (this.role === 'host') return this._applyCommand(command, 'w');
    if (this.role !== 'guest') throw new Error('Crie ou entre em uma partida primeiro.');
    this._sendMessage(command);
  }

  _applyCommand(command, color) {
    if (!this.game || !this.game.active || this.game.result) throw new Error('Esta partida já terminou.');
    try {
      if (command.type === 'move') {
        if (!Number.isInteger(command.revision) || command.revision !== this.game.revision) throw new Error('A posição mudou. Aguarde a atualização da partida.');
        this.game.move({ from: command.from, to: command.to, ...(command.promotion ? { promotion: command.promotion } : {}) }, color);
      } else {
        this.game.resign(color);
      }
    } catch (error) {
      if (this.game.result) this._broadcastState();
      throw error;
    }
    this._broadcastState();
  }

  _receive(data) {
    if (typeof data !== 'string' || data.length > 65_536) { this.onError('A mensagem recebida não é válida.'); return; }
    let message;
    try { message = JSON.parse(data); } catch { this.onError('A mensagem recebida não é válida.'); return; }
    if (this.role === 'host') {
      try {
        if (!message || !['move', 'resign', 'leave'].includes(message.type)) throw new Error('Ação de partida não reconhecida.');
        this._applyCommand(message, 'b');
      } catch (error) {
        try { this._sendMessage({ type: 'error', message: this._friendlyError(error).message }); } catch {}
      }
      return;
    }
    if (message?.type === 'error' && typeof message.message === 'string') { this.onError(message.message.slice(0, 240)); return; }
    if (message?.type !== 'state' || !validateRemoteState(message.state, this.sessionId)) { this.onError('O anfitrião enviou um estado de partida inválido.'); return; }
    this.state = message.state;
    this.onState(this.state);
  }

  _handleDisconnect() {
    if (this.connection === 'disconnected' || !this.hasConnected) {
      if (this.peer || this.channel) this._failConnection('A conexão foi encerrada antes de começar. Gere códigos novos e tente novamente.');
      return;
    }
    clearTimeout(this.connectionTimer);
    const publishHostState = this.role === 'host' && this.game && !this.game.result;
    if (publishHostState) this.game.pause();
    this.ended = true;
    this._setConnection('disconnected');
    this._cleanup();
    if (publishHostState) this._broadcastState({ transmit: false });
    this.onError('A conexão foi encerrada. Essa partida não pode ser recuperada após fechar a aba; crie outra e troque códigos novos.');
  }

  _failConnection(message) {
    if (this.connection === 'disconnected' && !this.peer && !this.channel) { this.onError(message); return; }
    clearTimeout(this.connectionTimer);
    const publishHostState = this.role === 'host' && this.game && !this.game.result;
    if (publishHostState) this.game.pause();
    this.ended = true;
    this._setConnection('disconnected');
    this._cleanup();
    if (publishHostState) this._broadcastState({ transmit: false });
    this.onError(message);
  }

  tick() {
    if (this.role !== 'host' || !this.game || !this.game.running || this.game.result) return;
    const previous = this.game.result;
    this.game.syncClock();
    if (!previous && this.game.result) this._broadcastState();
  }

  _cleanup() {
    clearTimeout(this.connectionTimer); this.connectionTimer = null;
    const channel = this.channel; this.channel = null;
    if (channel) {
      channel.onopen = null; channel.onmessage = null; channel.onerror = null; channel.onclose = null;
      try { channel.close(); } catch {}
    }
    const peer = this.peer; this.peer = null;
    if (peer) {
      peer.ondatachannel = null; peer.onconnectionstatechange = null; peer.onicegatheringstatechange = null;
      try { peer.close(); } catch {}
    }
  }

  async leave() {
    if (this.channel?.readyState === 'open' && this.game && !this.game.result) {
      try {
        if (this.role === 'host') this._applyCommand({ type: 'resign' }, 'w');
        else this._sendMessage({ type: 'leave' });
      } catch {}
    }
    this._cleanup();
    this.game = null; this.state = null; this.sessionId = null; this.role = null; this.color = null; this.hasConnected = false; this.ended = false;
    this._setConnection('disconnected');
    this.onLeave();
  }

  dispose() { this._cleanup(); }
}
