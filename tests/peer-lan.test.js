import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSignalCode, encodeSignalCode, filterLanCandidates, PeerLanClient } from '../src/peer-lan.js';

const basePayload = { type: 'offer', sessionId: 'ABC12345', name: 'Árthur ♟', clock: 'blitz3', sdp: 'v=0\r\na=first line\r\na=second line\r\n' };
const rawCode = value => Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');

test('código de oferta e resposta preserva texto UTF-8 e SDP multilinha', () => {
  for (const payload of [basePayload, { type: 'answer', sessionId: basePayload.sessionId, sdp: basePayload.sdp }]) {
    const code = encodeSignalCode(payload);
    assert.match(code, /^[A-Za-z0-9_-]+$/);
    assert.deepEqual(decodeSignalCode(code, payload.type), { version: 1, ...payload });
  }
});

test('decoder rejeita tipo de sinalização diferente do esperado', () => {
  const code = encodeSignalCode(basePayload);
  assert.throws(() => decodeSignalCode(code, 'answer'), /código|etapa/i);
});

test('decoder rejeita código truncado ou Base64URL inválida', () => {
  assert.throws(() => decodeSignalCode('%%%not-a-code%%%', 'offer'), /código|convite|inválido/i);
  const valid = encodeSignalCode(basePayload);
  assert.throws(() => decodeSignalCode(valid.slice(0, -2), 'offer'), /código|convite|inválido/i);
});

test('decoder rejeita versão e campos de sessão desconhecidos ou ausentes', () => {
  assert.throws(() => decodeSignalCode(rawCode({ ...basePayload, version: 2 }), 'offer'), /versão|versao|inválido/i);
  assert.throws(() => decodeSignalCode(rawCode({ version: 1, type: 'offer', sdp: 'v=0' }), 'offer'), /sessão|sessao|inválido/i);
  assert.throws(() => decodeSignalCode(rawCode({ version: 1, type: 'offer', sessionId: 'ABC12345' }), 'offer'), /SDP|inválido/i);
});

test('encoder e decoder rejeitam códigos acima de 24.000 caracteres', () => {
  assert.throws(() => encodeSignalCode({ ...basePayload, sdp: 'x'.repeat(24_001) }), /grande|limite|inválido/i);
  assert.throws(() => decodeSignalCode('A'.repeat(24_001), 'offer'), /grande|limite|inválido/i);
});

test('filtro mantém candidatos locais IPv4, IPv6 e mDNS, mas remove endereços públicos e tipos não host', () => {
  const sdp = [
    'v=0',
    'o=- 1 1 IN IP4 0.0.0.0',
    'a=candidate:1 1 UDP 2122260223 10.2.3.4 5000 typ host',
    'a=candidate:2 1 UDP 2122260222 172.20.1.9 5001 typ host',
    'a=candidate:3 1 UDP 2122260221 192.168.1.10 5002 typ host',
    'a=candidate:4 1 UDP 2122260220 169.254.10.2 5003 typ host',
    'a=candidate:5 1 UDP 2122260219 fd12:3456::10 5004 typ host',
    'a=candidate:6 1 UDP 2122260218 fe80::10 5005 typ host',
    'a=candidate:7 1 UDP 2122260217 abc123.local 5006 typ host',
    'a=candidate:8 1 UDP 2122260216 8.8.8.8 5007 typ host',
    'a=candidate:9 1 UDP 2122260215 2001:4860:4860::8888 5008 typ host',
    'a=candidate:10 1 UDP 2122260214 192.168.1.11 5009 typ srflx',
    'a=candidate:11 1 UDP 2122260213 192.168.1.12 5010 typ relay',
    'a=end-of-candidates',
    '',
  ].join('\r\n');

  const filtered = filterLanCandidates(sdp);
  assert.match(filtered, /10\.2\.3\.4/);
  assert.match(filtered, /172\.20\.1\.9/);
  assert.match(filtered, /192\.168\.1\.10/);
  assert.match(filtered, /169\.254\.10\.2/);
  assert.match(filtered, /fd12:3456::10/);
  assert.match(filtered, /fe80::10/);
  assert.match(filtered, /abc123\.local/);
  assert.match(filtered, /a=end-of-candidates/);
  assert.doesNotMatch(filtered, /8\.8\.8\.8|2001:4860|typ srflx|typ relay/);
  assert.match(filtered, /o=- 1 1 IN IP4 0\.0\.0\.0/);
});

test('filtro rejeita SDP sem candidato utilizável na rede local', () => {
  assert.throws(() => filterLanCandidates('v=0\r\na=candidate:1 1 UDP 1 203.0.113.2 5000 typ host\r\n'), /rede local|candidato|conexão/i);
});

const fakeSdp = 'v=0\r\na=candidate:1 1 UDP 2122260223 192.168.1.22 5000 typ host\r\na=candidate:2 1 UDP 2122260222 203.0.113.2 5001 typ host\r\na=end-of-candidates\r\n';
const fakeAnswerSdp = 'v=0\r\na=candidate:3 1 UDP 2122260221 192.168.1.23 6000 typ host\r\na=end-of-candidates\r\n';
const fakePeers = [];

class FakeDataChannel {
  constructor(label, options = {}) {
    this.label = label;
    this.ordered = options.ordered ?? true;
    this.readyState = 'connecting';
    this.pending = [];
  }
  send(data) {
    if (this.readyState !== 'open') throw new Error('DataChannel fechado');
    if (this.remote?.onmessage) this.remote.onmessage({ data });
    else this.remote?.pending.push(data);
  }
  open() {
    this.readyState = 'open';
    this.onopen?.();
    for (const data of this.pending.splice(0)) this.onmessage?.({ data });
  }
  close() { this.readyState = 'closed'; this.onclose?.(); }
}

class FakeRTCPeerConnection {
  constructor(configuration) {
    this.configuration = configuration;
    this.iceGatheringState = 'new';
    this.connectionState = 'new';
    fakePeers.push(this);
  }
  createDataChannel(label, options) { return this.dataChannel = new FakeDataChannel(label, options); }
  async createOffer() { return { type: 'offer', sdp: fakeSdp }; }
  async createAnswer() { return { type: 'answer', sdp: fakeAnswerSdp }; }
  async setLocalDescription(description) {
    this.localDescription = description;
    this.iceGatheringState = 'complete';
    this.onicegatheringstatechange?.();
  }
  async setRemoteDescription(description) { this.remoteDescription = description; }
  close() { this.connectionState = 'closed'; this.dataChannel?.close(); }
}

function pairFakeChannels(hostPeer, guestPeer) {
  const guestChannel = new FakeDataChannel('chess-studio');
  hostPeer.dataChannel.remote = guestChannel;
  guestChannel.remote = hostPeer.dataChannel;
  guestPeer.ondatachannel?.({ channel: guestChannel });
  return { host: hostPeer.dataChannel, guest: guestChannel };
}

test('anfitrião cria convite LAN-only; convidado devolve resposta e abre o canal em ordem', async () => {
  fakePeers.length = 0;
  const host = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const invitation = await host.createHost({ name: 'Arthur', clock: 'blitz3' });
  const offer = decodeSignalCode(invitation.inviteCode, 'offer');
  assert.equal(offer.name, 'Arthur');
  assert.equal(offer.clock, 'blitz3');
  assert.doesNotMatch(offer.sdp, /203\.0\.113\.2/);
  assert.deepEqual(fakePeers[0].configuration.iceServers, []);
  assert.equal(fakePeers[0].dataChannel.label, 'chess-studio');
  assert.equal(fakePeers[0].dataChannel.ordered, true);
  assert.equal(invitation.state.phase, 'waiting');

  const guest = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const answer = await guest.createGuest({ inviteCode: invitation.inviteCode, name: 'Amigo' });
  const answerPayload = decodeSignalCode(answer.answerCode, 'answer');
  assert.equal(answerPayload.sessionId, offer.sessionId);
  assert.equal(answerPayload.name, 'Amigo');
  assert.doesNotMatch(answerPayload.sdp, /203\.0\.113\.2/);
  assert.deepEqual(fakePeers[1].configuration.iceServers, []);
  assert.equal(guest.color, 'b');
});

test('anfitrião valida lances e ambos recebem o mesmo estado do DataChannel', async () => {
  fakePeers.length = 0;
  const host = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const invitation = await host.createHost({ name: 'Arthur', clock: 'blitz3' });
  const guest = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const answer = await guest.createGuest({ inviteCode: invitation.inviteCode, name: 'Amigo' });
  const guestErrors = [];
  guest.onError = message => guestErrors.push(message);
  await host.acceptGuestAnswer(answer.answerCode);
  const channels = pairFakeChannels(fakePeers[0], fakePeers[1]);
  channels.guest.open();
  channels.host.open();
  assert.equal(host.state.phase, 'playing');
  assert.equal(guest.state.phase, 'playing');
  assert.equal(host.state.players[1].name, 'Amigo');

  await host.send({ type: 'move', from: 'e2', to: 'e4', revision: host.state.revision });
  assert.equal(host.state.fen, guest.state.fen);
  assert.deepEqual(guest.state.moves.map(move => move.san), ['e4']);
  await guest.send({ type: 'move', from: 'e7', to: 'e5', revision: guest.state.revision });
  assert.equal(host.state.fen, guest.state.fen);
  assert.deepEqual(host.state.moves.map(move => move.san), ['e4', 'e5']);
  await guest.send({ type: 'move', from: 'e7', to: 'e6', revision: 1 });
  assert.match(guestErrors.at(-1), /posição|turno|revisão/i);
  assert.equal(host.state.moves.length, 2);
});

test('estouro do relógio no anfitrião é transmitido aos dois jogadores', async () => {
  fakePeers.length = 0;
  let now = 0;
  const host = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection, now: () => now });
  const invitation = await host.createHost({ name: 'Arthur', clock: 'bullet' });
  const guest = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const answer = await guest.createGuest({ inviteCode: invitation.inviteCode, name: 'Amigo' });
  await host.acceptGuestAnswer(answer.answerCode);
  const channels = pairFakeChannels(fakePeers[0], fakePeers[1]);
  channels.guest.open(); channels.host.open();

  now = 60_001;
  host.tick();
  assert.equal(host.state.result.reason, 'Tempo esgotado');
  assert.equal(host.state.result.winner, 'b');
  assert.deepEqual(guest.state.result, host.state.result);
});

test('lance recebido no instante do estouro não oculta o resultado do relógio', async () => {
  fakePeers.length = 0;
  let now = 0;
  const host = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection, now: () => now });
  const invitation = await host.createHost({ name: 'Arthur', clock: 'bullet' });
  const guest = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const answer = await guest.createGuest({ inviteCode: invitation.inviteCode, name: 'Amigo' });
  await host.acceptGuestAnswer(answer.answerCode);
  const channels = pairFakeChannels(fakePeers[0], fakePeers[1]);
  channels.guest.open(); channels.host.open();

  now = 60_001;
  await assert.rejects(host.send({ type: 'move', from: 'e2', to: 'e4', revision: host.state.revision }), /terminou|tempo/i);
  assert.equal(host.state.result.reason, 'Tempo esgotado');
  assert.deepEqual(guest.state.result, host.state.result);
});

test('desistência do convidado publica o resultado nos dois navegadores', async () => {
  fakePeers.length = 0;
  const host = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const invitation = await host.createHost({ name: 'Arthur', clock: 'blitz3' });
  const guest = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const answer = await guest.createGuest({ inviteCode: invitation.inviteCode, name: 'Amigo' });
  await host.acceptGuestAnswer(answer.answerCode);
  const channels = pairFakeChannels(fakePeers[0], fakePeers[1]);
  channels.guest.open(); channels.host.open();
  await guest.send({ type: 'resign' });
  assert.equal(host.state.result.winner, 'w');
  assert.deepEqual(guest.state.result, host.state.result);
  await host.leave();
  assert.equal(host.state, null);
  assert.equal(channels.host.readyState, 'closed');
});

test('desconexão pausa o relógio e mostra que a sala precisa ser refeita', async () => {
  fakePeers.length = 0;
  let now = 0;
  const host = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection, now: () => now });
  const invitation = await host.createHost({ name: 'Arthur', clock: 'blitz3' });
  const guest = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const answer = await guest.createGuest({ inviteCode: invitation.inviteCode, name: 'Amigo' });
  await host.acceptGuestAnswer(answer.answerCode);
  const channels = pairFakeChannels(fakePeers[0], fakePeers[1]);
  channels.guest.open(); channels.host.open();

  now = 5_000;
  channels.host.close();
  assert.equal(host.game.running, false);
  assert.equal(host.state.phase, 'reconnecting');
  const remaining = host.game.remaining.w;
  now = 50_000;
  host.tick();
  assert.equal(host.game.remaining.w, remaining);
});

test('falha do WebRTC durante a partida encerra a tentativa, pausa o relógio e fecha o peer', async () => {
  fakePeers.length = 0;
  let now = 0;
  const host = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection, now: () => now });
  const invitation = await host.createHost({ name: 'Arthur', clock: 'bullet' });
  const guest = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const answer = await guest.createGuest({ inviteCode: invitation.inviteCode, name: 'Amigo' });
  await host.acceptGuestAnswer(answer.answerCode);
  const channels = pairFakeChannels(fakePeers[0], fakePeers[1]);
  channels.guest.open(); channels.host.open();

  now = 5_000;
  fakePeers[0].connectionState = 'failed';
  fakePeers[0].onconnectionstatechange?.();
  assert.equal(host.ended, true);
  assert.equal(host.game.running, false);
  assert.equal(host.peer, null);
  const remaining = host.game.remaining.w;
  now = 70_000;
  host.tick();
  assert.equal(host.game.remaining.w, remaining);
  assert.equal(host.game.result, null);
});

test('falha antes de abrir o canal também limpa o peer e encerra a tentativa', async () => {
  fakePeers.length = 0;
  const host = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const invitation = await host.createHost({ name: 'Arthur', clock: 'blitz3' });
  const guest = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  await guest.createGuest({ inviteCode: invitation.inviteCode, name: 'Amigo' });

  fakePeers[1].connectionState = 'failed';
  fakePeers[1].onconnectionstatechange?.();
  assert.equal(guest.ended, true);
  assert.equal(guest.peer, null);
});

test('mensagens inválidas do convidado não alteram a partida e são informadas aos dois lados', async () => {
  fakePeers.length = 0;
  const host = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const invitation = await host.createHost({ name: 'Arthur', clock: 'blitz3' });
  const guest = new PeerLanClient({ RTCPeerConnectionImpl: FakeRTCPeerConnection });
  const answer = await guest.createGuest({ inviteCode: invitation.inviteCode, name: 'Amigo' });
  await host.acceptGuestAnswer(answer.answerCode);
  const channels = pairFakeChannels(fakePeers[0], fakePeers[1]);
  channels.guest.open(); channels.host.open();
  const errors = [];
  host.onError = message => errors.push(message);
  guest.onError = message => errors.push(message);

  channels.guest.send('{malformed');
  channels.guest.send(JSON.stringify({ type: 'move', from: 'e7', to: 'e5', revision: 999 }));
  assert.equal(host.state.moves.length, 0);
  assert.equal(guest.state.moves.length, 0);
  assert.equal(errors.length, 2);
  assert.match(errors.join(' '), /válida|mudou|posição/i);
  await host.leave();
  guest.dispose();
  assert.equal(host.peer, null);
  assert.equal(guest.peer, null);
});
