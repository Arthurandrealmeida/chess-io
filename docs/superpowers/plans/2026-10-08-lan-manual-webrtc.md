# Convite manual LAN por WebRTC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir partidas entre dois aparelhos da mesma rede, abertas pelo GitHub Pages, sem instalação ou serviço de sinalização externo, usando uma troca manual de códigos WebRTC.

**Architecture:** Um módulo de navegador reúne negociação WebRTC, códigos validados, candidatos LAN-only e estado autoritativo de jogo no anfitrião. A UI LAN mantém o tabuleiro e controles existentes, acrescentando o fluxo anfitrião/convidado, copiar/colar, tutorial e avisos; o jogo usa um DataChannel direto.

**Tech Stack:** JavaScript ES modules, `RTCPeerConnection`, `RTCDataChannel`, `chess.js` local, `node:test`, HTML/CSS existentes. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-10-08-lan-manual-webrtc-design.md`

## Global Constraints

- Não adicionar dependências ou serviço de sinalização.
- Não configurar servidores STUN/TURN; iniciar WebRTC com `iceServers: []`.
- Compartilhar somente candidatos host privados/link-local ou nomes mDNS `.local`.
- O anfitrião joga de brancas e valida lances, relógios e resultado; o convidado joga de pretas.
- Códigos são texto para copiar/colar, não uma URL de sala curta.
- A interface deve explicar os quatro passos e avisar que a rede/permissão local pode impedir a conexão.
- Não implementar conexão entre redes diferentes nem recuperação de partida após recarregar a página.

## Review Focus

- Oferta/resposta truncada, de tipo trocado ou grande demais deve ser rejeitada antes de `setRemoteDescription`.
- Candidato IPv4/IPv6 público e candidato `srflx`/`relay` nunca deve ser compartilhado; candidatos locais `.local`, RFC1918, link-local e IPv6 ULA devem continuar disponíveis.
- Rede de convidados/firewall/permission denial deve terminar em mensagem compreensível em vez de espera infinita.
- Comportamento de turno, relógio, promoção, abandono, empate e resultado deve continuar coerente em host e convidado.
- Convite copiado deve apontar para a raiz correta também sob GitHub Pages em subdiretório, e falha de Clipboard API deve manter o texto selecionável.

---

### Task 1: Códigos manuais e filtro LAN-only

**Files:**
- Create: `src/peer-lan.js`
- Create: `tests/peer-lan.test.js`

**Interfaces:**
- Produces `encodeSignalCode({ type, sessionId, sdp, name?, clock? }) -> string` with versioned URL-safe Base64 over UTF-8 JSON.
- Produces `decodeSignalCode(code, expectedType) -> payload`; reject unknown version/type, malformed Base64/JSON, missing session/SDP fields, and codes over 24,000 characters.
- Produces `filterLanCandidates(sdp) -> string`; preserve non-candidate SDP lines and only retain `typ host` candidates whose address is private/link-local, IPv6 ULA/link-local, or ends in `.local`.

- [x] **Step 1: Write failing signal-code tests** for offer/answer round trip including Unicode names and multiline SDP; reject wrong role, malformed payload, unsupported version and oversized input.
- [x] **Step 2: Run `node --test tests/peer-lan.test.js` and verify expected failures** because exports do not exist.
- [x] **Step 3: Implement only the versioned code encoder/decoder** with UTF-8-safe Base64URL helpers and a 24,000-character input bound.
- [x] **Step 4: Run the focused tests and verify they pass.**
- [x] **Step 5: Add failing candidate-filter tests** for RFC1918 IPv4, `169.254/16`, IPv6 `fc00::/7`, `fe80::/10`, mDNS `.local`, public IPv4/IPv6, and non-host candidate types.
- [x] **Step 6: Run the focused tests and verify the candidate cases fail for the expected missing export/behavior.**
- [x] **Step 7: Implement `filterLanCandidates(sdp)`** using explicit IPv4/IPv6 local-address checks; preserve `a=end-of-candidates` and reject an SDP with no usable LAN candidate.
- [x] **Step 8: Run `node --test tests/peer-lan.test.js` and verify all code/filter tests pass.**

### Task 2: Peer connection and authoritative game state

**Files:**
- Modify: `src/peer-lan.js`
- Modify: `tests/peer-lan.test.js`

**Interfaces:**
- `new PeerLanClient({ RTCPeerConnectionImpl?, now? })` exposes `onState`, `onError`, `onConnection`, and `onLeave` callbacks plus `state`, `color`, `role`.
- `createHost({ name, clock }) -> Promise<{ sessionId, inviteCode, state }>` creates a paused `GameSession`, local-only ICE peer and ordered `chess-studio` DataChannel; the clock starts when the channel opens.
- `createGuest({ inviteCode, name }) -> Promise<{ answerCode, sessionId }>` validates/applies the offer, creates the answer and waits for local ICE gathering.
- `acceptGuestAnswer(answerCode) -> Promise<void>` validates/applies the answer and completes the host negotiation.
- `send({ type: 'move', from, to, promotion?, revision } | { type: 'resign' } | { type: 'leave' }) -> Promise<void>` applies host commands locally or sends guest commands to the host.
- `tick()`, `leave()`, and `dispose()` manage host clock expiry and peer cleanup.

- [x] **Step 1: Write failing `PeerLanClient` tests** with an injected fake `RTCPeerConnectionImpl` for host offer, guest answer, host completion, and ordered DataChannel open callbacks.
- [x] **Step 2: Run the focused test and verify it fails** because `PeerLanClient` is not implemented.
- [x] **Step 3: Implement negotiation** with `iceServers: []`, bounded ICE-gathering/connection timeouts, filtered local SDP, session ID/role validation and clear errors.
- [x] **Step 4: Run the focused tests and verify host/guest negotiation callbacks pass.**
- [x] **Step 5: Add failing protocol tests** proving a host accepts legal white/black turns, rejects stale/illegal guest moves, sends matching FEN/frames/clocks to both players, and handles resignation/timeout.
- [x] **Step 6: Run the protocol tests and verify they fail for the missing room protocol.**
- [x] **Step 7: Implement a host-authoritative `GameSession` protocol** with snapshots matching the current `renderLan()` state shape; guests render received snapshots and may only send commands.
- [x] **Step 8: Run focused tests and verify moves, clocks and results remain synchronized.**
- [x] **Step 9: Add failing cleanup/error tests** for malformed remote messages, channel close and `leave()`; verify no peer/timer remains active.
- [x] **Step 10: Implement protocol validation and idempotent cleanup; rerun focused tests.**

### Task 3: Manual lobby, tutorial and failure guidance

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `estiloXadrez.css`
- Modify: `tests/peer-lan.test.js` only if an uncovered client behavior needs a regression test

**Interfaces:**
- Host UI calls `createHost`, copies the site URL plus offer code, accepts pasted answer code, and displays connection state.
- Guest UI accepts pasted offer code, calls `createGuest`, copies the answer code, and displays connection state.
- Existing board handlers use `send()` and `onState`; review, promotion, clocks, resign/result, PGN and local Stockfish analysis remain integrated.

- [x] **Step 1: Update `index.html`** with accessible offer/answer textareas, copy/connect buttons, a four-step Portuguese tutorial, and a concise same-network/browser-permission failure notice; retain the current game board controls.
- [x] **Step 2: Add responsive styles** for the code fields, host/guest stages, tutorial and network warning.
- [x] **Step 3: Integrate `PeerLanClient` in `src/app.js`**; remove dependence on `detectRoomServer()` for the LAN page and route the current move/review/result handlers through the peer client.
- [x] **Step 4: Add the “Copiar convite” and “Copiar resposta” flows** with clipboard fallback that selects the corresponding textarea; construct the site base URL without stale search/hash and preserve a Pages subpath.
- [x] **Step 5: Add user-facing states and errors** for preparing, waiting, connecting, connected, unsupported WebRTC, malformed codes, timeout, remote close and rejected network access; explain that codes are session-only, should go only to the opponent, and a reload ends the current game.
- [x] **Step 6: Run `npm run check` and focused tests; verify source has no references that disable LAN on GitHub Pages.**

### Task 4: Documentation, build and browser verification

**Files:**
- Modify: `README.md`
- Generated by build: `dist/index.html`, `dist/src/app.js`, `dist/src/peer-lan.js`, `dist/estiloXadrez.css`

- [x] **Step 1: Rewrite the LAN README section** with the same four user steps, no-install/no-signaling explanation, same-network limitation, browser local-network permission and disconnect/reload behavior.
- [x] **Step 2: Run `npm test`**; all 75 tests pass after approved loopback access was granted.
- [x] **Step 3: Run `npm run check` and `npm run build`**; verify the generated static distribution includes the peer module and updated interface.
- [ ] **Step 4: Start the static app and use two browser contexts** to exchange offer and answer manually, connect the DataChannel, make one legal move for each color, and verify both boards/clocks update. Deferred: the in-app browser refused the current `file://` project tab and its security policy disallows working around that blocked URL; no two-browser result is claimed.
- [ ] **Step 5: Verify at least one failure path** in the browser. Failure and retry states are covered by client tests and source review, but interactive UI validation is deferred with Step 4.
- [x] **Step 6: Inspect the final diff/status** and report the two-browser validation separately from an unperformed test on two physical devices.
