import { Chess } from '../vendor/chess.js';
import { GameSession, TIME_CONTROLS, formatClock, opposite } from './game.js';
import { BoardView, renderMiniBoard, pieceAsset, PIECE_NAMES } from './board.js';
import { EngineClient } from './engine.js';
import { readPreferences, savePreferences } from './preferences.js';
import { PeerLanClient } from './peer-lan.js';
import { ResultView } from './result.js';
import { HISTORICAL_GAMES, DEMO_PGN } from '../data/games.js';
import { OpeningView } from './openings.js';
import { activeMoment, moveLabel, recordedResult, reviewArrow, reviewMove, preserveSquareKeys } from './study.js';
import { PuzzleView } from './puzzles.js';
import { HISTORICAL_PORTRAITS } from '../data/portraits.js';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const prefs = readPreferences();
const local = new GameSession();
local.config = { level: prefs.level, clock: prefs.clock, side: prefs.side };
local.humanColor = prefs.side === 'b' ? 'b' : 'w';
local.replay(DEMO_PGN, 6, 'demo');
const replay = new GameSession();
const moveLists = new WeakMap();
const engine = new EngineClient();
const lan = new PeerLanClient();
let selected = null, lanSelected = null, thinking = false, thinkingGeneration = 0, engineError = '';
let historicalGame = null, autoplay = null, toastTimer = null, lanState = null, lanCursor = 0, lanReceivedAt = 0, lanConnection = 'disconnected', lanBusy = false, lanRequestTimer = null, lanInviteCode = '', lanAnswerCode = '';
let setupVisible = true, localGameId = 0, handledLocalResult = null, handledLanResult = '';
let currentPage = 'play';
const openingView = new OpeningView({ renderMoves, downloadPGN });
let puzzleStorage; try { puzzleStorage = localStorage; } catch { /* Private storage may be unavailable. */ }
const puzzleView = new PuzzleView({ storage:puzzleStorage, promotion, preferences:() => prefs });
const resultView = new ResultView({
  onReview: (snapshot, ply) => {
    if (snapshot.mode === 'lan') { lanCursor = ply; location.hash = 'lan'; renderLan(); }
    else { location.hash = 'jogar'; reviewLocal(ply); }
  },
  onNewGame: snapshot => {
    if (snapshot.mode === 'lan') { lan.leave(); location.hash = 'lan'; }
    else showSetup(true);
  },
});
function localSnapshot() {
  return { key: `local:${localGameId}:${local.revision}`, mode: 'computer', frames: local.frames, moves: local.moves, result: local.result, humanColor: local.humanColor, opponent: `Stockfish · nível ${local.config.level}` };
}
function lanSnapshot() {
  return { key: `lan:${lanState.code}:${lanState.revision}`, mode: 'lan', frames: lanState.frames, moves: lanState.moves, result: lanState.result, humanColor: lan.color, opponent: lanState.players.find(player => player.color !== lan.color)?.name || 'Seu amigo' };
}
function showSetup(force = false) {
  setupVisible = force === true ? true : !setupVisible; renderPlay();
  if (!setupVisible) return;
  document.querySelector('.new-game').scrollIntoView({ behavior: 'auto', block: 'center' });
  $('difficulty').focus({ preventScroll: true });
}

function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}
function dialog(title, body, actions = [{ value:'cancel', text:'Cancelar' }, { value:'confirm', text:'Confirmar', primary:true }], initialize = () => {}) {
  $('dialog-title').textContent = title; $('dialog-body').innerHTML = body;
  $('dialog-actions').replaceChildren();
  for (const action of actions) {
    const button = document.createElement('button'); button.type = 'submit'; button.value = action.value; button.textContent = action.text;
    if (action.primary) button.className = 'primary'; $('dialog-actions').append(button);
  }
  $('app-dialog').returnValue = '';
  initialize();
  return new Promise(resolve => { $('app-dialog').onclose = () => resolve($('app-dialog').returnValue); $('app-dialog').showModal(); });
}
async function promotion(color) {
  const body = '<p>Escolha a peça para promover seu peão.</p><div class="promotion-options">' + ['q','r','b','n'].map(type => `<button type="submit" value="${type}"><img src="${pieceAsset(color,type)}" alt=""><span>${{q:'Dama',r:'Torre',b:'Bispo',n:'Cavalo'}[type]}</span></button>`).join('') + '</div>';
  const value = await dialog('Promover peão', body, [{ value:'cancel',text:'Cancelar' }]);
  return ['q','r','b','n'].includes(value) ? value : null;
}
function downloadPGN(pgn, filename) {
  const blob = new Blob([pgn + '\n'], { type:'application/x-chess-pgn;charset=utf-8' }), url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const levelDescription = level => level <= 3 ? 'Primeiros passos' : level <= 6 ? 'Desafio casual' : level <= 10 ? 'Partida estratégica' : level <= 15 ? 'Desafio avançado' : 'Força máxima';
function updateSetup() {
  $('difficulty').value = prefs.level;
  $('difficulty').style.setProperty('--progress', `${(prefs.level-1)/19*100}%`);
  $('difficulty-value').textContent = `Nível ${prefs.level}`; $('difficulty-description').textContent = levelDescription(prefs.level);
  document.querySelectorAll('[data-clock]').forEach(button => { const chosen = button.dataset.clock === prefs.clock; button.classList.toggle('chosen',chosen); button.setAttribute('aria-pressed',chosen); });
  document.querySelectorAll('[data-side]').forEach(button => { const chosen = button.dataset.side === prefs.side; button.classList.toggle('chosen',chosen); button.setAttribute('aria-pressed',chosen); });
}
function applyPreferences() {
  document.documentElement.dataset.theme = prefs.theme; document.documentElement.dataset.board = prefs.board;
  document.documentElement.dataset.motion = prefs.animations ? 'on' : 'off';
  document.querySelector('meta[name="theme-color"]').content = prefs.theme === 'dark' ? '#1e221f' : '#f2f4ed';
  $('theme-toggle').textContent = prefs.theme === 'dark' ? 'Tema escuro' : 'Tema claro';
  $('theme-toggle').setAttribute('aria-label', `${prefs.theme === 'dark' ? 'Tema escuro' : 'Tema claro'}: alternar tema`);
  $('motion-toggle').textContent = prefs.animations ? 'Animações ativadas' : 'Animações desativadas'; $('motion-toggle').setAttribute('aria-pressed',prefs.animations);
  $('appearance-button').textContent = `Tabuleiro ${{green:'verde',wood:'madeira',blue:'azul'}[prefs.board]}`;
  savePreferences(prefs); updateSetup(); renderPlay(); renderCollection(); if (historicalGame) renderReplay(); openingView.render(); if (lanState) renderLan(); if (puzzleView.active) puzzleView.render();
}

const playBoard = new BoardView($('play-board'), {
  onSquare: selectLocal,
  onMove: humanMove,
  canDrag: square => local.canPlay() && local.chess.get(square)?.color === local.humanColor,
});
const historicalBoard = new BoardView($('replay-board'));
const lanBoard = new BoardView($('lan-board'), {
  onSquare: selectLan,
  onMove: lanMove,
  canDrag: square => canPlayLan() && new Chess(lanState.fen).get(square)?.color === lan.color,
});
function playStatus() {
  if (local.mode === 'demo') return 'Abertura demonstrativa · Espanhola';
  if (local.result) return `${local.result.winner === null ? 'Empate' : local.result.winner === local.humanColor ? 'Você venceu' : 'Stockfish venceu'} · ${local.result.reason}`;
  if (!local.live) return `Revisando · lance ${Math.ceil(local.cursor / 2)} · ${local.cursor}/${local.moves.length}`;
  if (engineError) return engineError;
  if (thinking || local.chess.turn() !== local.humanColor) return engine.status === 'loading' ? 'Carregando Stockfish…' : 'Stockfish está pensando…';
  return local.chess.isCheck() ? 'Você está em xeque · Sua vez' : 'Sua vez';
}
function updatePlayClocks() {
  const human = local.humanColor, turn = local.mode === 'demo' ? local.position.turn() : local.chess.turn();
  for (const [id,color] of [['player-clock',human],['opponent-clock',opposite(human)]]) {
    $(id).textContent = formatClock(local.remaining[color]);
    $(id).classList.toggle('active-clock',color === turn && !local.result || local.mode === 'demo' && color === turn);
    $(id).classList.toggle('low-time',local.remaining[color] !== null && local.remaining[color] < 30_000 && !local.result);
  }
}
function renderPlay(move = null) {
  const legal = selected && local.canPlay() ? local.legalMoves(selected) : [];
  playBoard.render(local.fen, { orientation:local.humanColor, style:'classic', selected, legal, lastMove:local.lastMove, move:local.live ? move : null });
  $('engine-description').textContent = `Nível ${local.config.level} · ${levelDescription(local.config.level)}`;
  $('player-description').textContent = `Jogando de ${local.humanColor === 'w' ? 'brancas' : 'pretas'}`;
  $('game-status').textContent = playStatus();
  $('review-back').disabled = local.cursor === 0; $('review-next').disabled = local.live;
  const real = local.mode === 'computer'; $('game-actions').hidden = !real; $('game-notation').hidden = !real;
  $('undo-button').disabled = !local.moves.some(move => move.color === local.humanColor);
  $('undo-button').title = 'Desfaz seu último lance e a resposta do Stockfish, quando houver.';
  $('resign-button').disabled = !!local.result; $('live-button').hidden = local.live;
  $('retry-engine').hidden = !engineError || !!local.result;
  const focused = real && !setupVisible;
  $('play-page').classList.toggle('playing', focused);
  document.querySelector('#play-page .side-panels').hidden = focused;
  $('play-title').textContent = focused ? (local.result ? 'Uma partida. Novas ideias.' : 'O próximo lance é seu.') : 'Seu próximo grande lance.';
  document.querySelector('#play-page .page-heading p').textContent = focused ? `${TIME_CONTROLS[local.config.clock].label} · Stockfish nível ${local.config.level} · ${local.humanColor === 'w' ? 'Brancas' : 'Pretas'}` : 'Escolha o desafio. O tabuleiro é seu.';
  $('show-result').hidden = !local.result;
  $('show-setup').textContent = setupVisible ? 'Voltar ao tabuleiro' : 'Nova partida';
  if (!local.result) handledLocalResult = null;
  if (real && local.result && local.result !== handledLocalResult && !$('play-page').hidden) { handledLocalResult = local.result; resultView.show(localSnapshot()); }
  $('setup-note').textContent = real ? 'As configurações valem para a próxima partida.' : 'Na prévia, os lances são demonstrativos.';
  $('export-game').disabled = !local.moves.length;
  if (real) renderMoves($('live-moves'),local.moves,local.cursor,ply => reviewLocal(ply));
  updatePlayClocks();
}
function cancelThinking() { thinkingGeneration++; thinking = false; engineError = ''; engine.cancel(); }
async function think() {
  if (local.mode !== 'computer' || local.result || local.chess.turn() === local.humanColor || thinking) return;
  thinking = true; const generation = ++thinkingGeneration, fen = local.chess.fen(); renderPlay();
  try {
    const uci = await engine.search(fen,local.config.level);
    if (generation !== thinkingGeneration || local.chess.fen() !== fen || local.result || !uci) return;
    if (uci === '(none)' || uci === '0000') throw new Error('O motor não encontrou um lance.');
    const played = local.move({ from:uci.slice(0,2),to:uci.slice(2,4),...(uci.length === 5 ? { promotion:uci[4] } : {}) },opposite(local.humanColor));
    renderPlay(played);
  } catch (error) {
    if (generation === thinkingGeneration) { engineError = error.message; toast(error.message); }
  } finally { if (generation === thinkingGeneration) { thinking = false; $('game-status').textContent = playStatus(); $('retry-engine').hidden = !engineError || !!local.result; } }
}
engine.onStatus = () => { if (local.mode === 'computer') $('game-status').textContent = playStatus(); };
function selectLocal(square) {
  if (local.mode === 'demo') { toast('Inicie uma partida para jogar.'); return; }
  if (!local.live) { toast('Use “Voltar à partida” para continuar jogando.'); return; }
  if (!local.canPlay()) return;
  const piece = local.chess.get(square);
  if (selected && local.legalMoves(selected).some(move => move.to === square)) { humanMove(selected,square); return; }
  selected = selected === square ? null : piece?.color === local.humanColor ? square : null; renderPlay();
}
async function humanMove(from,to) {
  if (!local.canPlay()) return;
  const candidates = local.legalMoves(from).filter(move => move.to === to); if (!candidates.length) { selected = null; renderPlay(); return; }
  const fen = local.chess.fen(); let promote;
  if (candidates.some(move => move.promotion)) { promote = await promotion(local.humanColor); if (!promote) { selected = null; renderPlay(); return; } }
  if (local.chess.fen() !== fen || !local.canPlay()) return;
  try {
    const move = local.move({from,to,...(promote ? {promotion:promote} : {})},local.humanColor);
    selected = null; renderPlay(move); think();
  } catch (error) { toast(error.message); }
}
async function startGame() {
  if (local.mode === 'computer' && local.moves.length && !local.result) {
    const answer = await dialog('Começar uma nova partida?', '<p>A partida atual será encerrada. Você pode baixar o PGN antes de começar outra.</p>', [{value:'cancel',text:'Continuar jogando'},{value:'confirm',text:'Nova partida',primary:true}]);
    if (answer !== 'confirm') return;
  }
  cancelThinking(); selected = null;
  resultView.cancel(); setupVisible = false; localGameId++;
  local.start({level:prefs.level,side:prefs.side,clock:prefs.clock}); renderPlay();
  $('play-page').scrollIntoView({ behavior:'auto', block:'start' });
  playBoard.squares[56].focus({ preventScroll:true });
  if (local.chess.turn() !== local.humanColor) think();
}
function reviewLocal(cursor) {
  const move = reviewMove(local, cursor); selected = null;
  renderPlay(move);
}
function renderMoves(root,moves,cursor,onSelect) {
  const signature = moves.map(move => move.san).join(' ');
  let entry = moveLists.get(root);
  if (!entry || entry.signature !== signature || entry.moves !== moves) {
    root.replaceChildren(); entry = { signature, moves, onSelect, buttons: [] }; moveLists.set(root, entry);
    if (!moves.length) { const paragraph = document.createElement('p'); paragraph.className = 'empty-state'; paragraph.textContent = 'Os lances aparecerão aqui.'; root.append(paragraph); }
    for (let index=0; index<moves.length; index+=2) {
      const row = document.createElement('div'); row.className = 'move-row';
      const number = document.createElement('span'); number.className = 'move-number'; number.textContent = `${index/2+1}.`; row.append(number);
      for (let offset=0; offset<2; offset++) if (moves[index+offset]) {
        const ply = index+offset+1, button = document.createElement('button'); button.type = 'button'; button.textContent = moves[index+offset].san;
        button.setAttribute('aria-label',`Revisar lance ${index/2+1}, ${offset ? 'pretas' : 'brancas'}: ${button.textContent}`);
        button.addEventListener('click',() => entry.onSelect(ply)); row.append(button); entry.buttons.push(button);
      }
      root.append(row);
    }
  }
  entry.onSelect = onSelect;
  for (const [index, button] of entry.buttons.entries()) {
    const current = cursor === index + 1; button.classList.toggle('current-move', current);
    if (current) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
  }
}
function renderCollection() {
  renderMiniBoard($('hero-board'),HISTORICAL_GAMES[0].previewFen,'classic');
  $('history-cards').replaceChildren();
  for (const game of HISTORICAL_GAMES) {
    const article = document.createElement('article'); article.className = 'history-card'; article.dataset.id = game.id;
    article.innerHTML = `<div class="history-card-media"><div class="history-card-board" role="img" aria-label="Posição de ${escape(game.title)}"></div><span class="year-badge">${game.year}</span></div><div class="history-card-body"><p class="opening">${game.opening}</p><h3>${game.title}</h3><p class="historical-player">${game.white}</p><p class="historical-opponent${game.id==='opera'?' long-name':''}">vs. ${game.black}</p><a class="card-link" href="#historicas/${game.id}">Ver e analisar <span aria-hidden="true">→</span><span class="sr-only"> ${game.title}</span></a></div>`;
    renderMiniBoard(article.querySelector('.history-card-board'),game.previewFen,'classic'); $('history-cards').append(article);
  }
  filterHistory();
}
function filterHistory() {
  const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const query = normalize($('history-search').value.trim()); let count = 0;
  for (const article of $('history-cards').children) {
    const game = HISTORICAL_GAMES.find(g => g.id === article.dataset.id);
    const match = normalize(`${game.title} ${game.white} ${game.black} ${game.opening} ${game.year}`).includes(query);
    article.hidden = !match; if (match) count++;
  }
  $('history-empty').hidden = count !== 0;
}
function stopAutoplay() { clearInterval(autoplay); autoplay = null; $('replay-auto').textContent = 'Reproduzir'; }
function renderReplay(move = null) {
  if (!historicalGame) return;
  historicalBoard.render(replay.fen,{style:'classic',lastMove:replay.lastMove,move});
  $('replay-title').textContent = historicalGame.title; $('replay-subtitle').textContent = `${historicalGame.white} × ${historicalGame.black}`;
  $('historical-black').textContent = historicalGame.black; $('historical-white').textContent = historicalGame.white;
  for (const side of ['white','black']) {
    const portrait = HISTORICAL_PORTRAITS[historicalGame[side]], image = $(`historical-${side}-portrait`), link = $(`historical-${side}-portrait-link`);
    const path = portrait ? `../assets/portraits/${portrait.file}` : '../assets/pieces/wn.svg';
    const src = new URL(path,import.meta.url).href; if (image.src !== src) image.src = src;
    image.alt = portrait?.alt || 'Ícone de xadrez · retrato indisponível'; link.href = portrait?.source || new URL('../CREDITS.md',import.meta.url).href;
    link.title = portrait ? 'Ver origem e crédito do retrato' : 'Retrato livre indisponível · Ver créditos';
    link.classList.toggle('portrait-fallback',!portrait);
  }
  $('historical-meta').textContent = `${historicalGame.year} · ${historicalGame.opening}`; $('historical-location').textContent = historicalGame.location;
  $('historical-description').textContent = historicalGame.description; $('historical-source').href = historicalGame.source; $('historical-note').textContent = historicalGame.note;
  $('replay-status').textContent = replay.live ? `Fim · ${recordedResult(replay.chess)} · ${replay.chess.isCheckmate() ? 'Xeque-mate' : 'Abandono'}` : replay.cursor ? `${replay.cursor}/${replay.moves.length} · ${moveLabel(replay.cursor)} ${replay.lastMove.san}` : 'Posição inicial';
  $('replay-back').disabled = replay.cursor === 0; $('replay-next').disabled = replay.live; $('replay-auto').disabled = replay.live && !autoplay;
  renderMoves($('replay-moves'),replay.moves,replay.cursor,ply => { stopAutoplay(); replay.review(ply); renderReplay(); });
  const moment = activeMoment(historicalGame.moments, replay.cursor);
  $('historical-moment-label').textContent = moment ? `Ideia em ${moveLabel(moment.ply)} ${moment.san}` : 'Antes do primeiro lance';
  $('historical-moment-title').textContent = moment?.title || 'Acompanhe a história';
  $('historical-moment-text').textContent = moment?.text || 'Avance pelos lances ou escolha um dos momentos importantes abaixo para descobrir as ideias da partida.';
  const root = $('historical-moments');
  if (root.dataset.game !== historicalGame.id) {
    root.replaceChildren(); root.dataset.game = historicalGame.id;
    for (const point of historicalGame.moments) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'moment-button'; button.dataset.ply = point.ply;
      button.textContent = `${moveLabel(point.ply)} ${point.san} · ${point.title}`;
      button.addEventListener('click', () => { stopAutoplay(); reviewReplay(point.ply); }); root.append(button);
    }
  }
  for (const button of root.children) button.setAttribute('aria-pressed', String(Number(button.dataset.ply) === moment?.ply));
}
function reviewReplay(cursor) {
  const move = reviewMove(replay, cursor);
  renderReplay(move);
}

function setLanBusy(busy) {
  lanBusy = busy; clearTimeout(lanRequestTimer);
  $('create-room').querySelector('button').disabled = busy; $('join-room').querySelector('button').disabled = busy; $('connect-answer').disabled = busy;
  if (busy) lanRequestTimer = setTimeout(() => { setLanBusy(false); lanError('A preparação demorou demais. Confira a rede local e tente gerar códigos novos.'); },25_000);
}
function lanError(message) { setLanBusy(false); $('lan-error').textContent = message; $('lan-error').hidden = false; toast(message); }
function siteInviteUrl() {
  const url = new URL('./', location.href); url.search = ''; url.hash = 'lan';
  return url;
}
function canPlayLan() { return !!lanState && lanConnection === 'connected' && lanState.phase === 'playing' && !lanState.result && lanCursor === lanState.moves.length && lanState.turn === lan.color; }
function selectLan(square) {
  if (!canPlayLan()) return;
  const chess = new Chess(lanState.fen), piece = chess.get(square);
  if (lanSelected && chess.moves({square:lanSelected,verbose:true}).some(move => move.to === square)) { lanMove(lanSelected,square); return; }
  lanSelected = lanSelected === square ? null : piece?.color === lan.color ? square : null; renderLan();
}
async function lanMove(from,to) {
  if (!canPlayLan()) return;
  const chess = new Chess(lanState.fen), moves = chess.moves({square:from,verbose:true}).filter(move => move.to === to);
  if (!moves.length) { lanSelected = null; renderLan(); return; }
  const revision = lanState.revision; let promote;
  if (moves.some(move => move.promotion)) { promote = await promotion(lan.color); if (!promote) return; }
  if (!canPlayLan() || lanState.revision !== revision) return;
  lanSelected = null;
  try { await lan.send({type:'move',from,to,...(promote?{promotion:promote}:{}),revision}); } catch (error) { lanError(error.message); }
}
function updateLanClocks() {
  if (!lanState || !lan.color) return;
  for (const [id,color] of [['lan-player-clock',lan.color],['lan-opponent-clock',opposite(lan.color)]]) {
    const raw = lanState.clocks[color];
    const remaining = raw === null ? null : Math.max(0,raw - (lanState.running && lanConnection==='connected' && lanState.turn===color ? Math.max(0,performance.now()-lanReceivedAt) : 0));
    $(id).textContent = formatClock(remaining); $(id).classList.toggle('active-clock',lanState.running && lanState.turn===color && !lanState.result);
    $(id).classList.toggle('low-time',remaining !== null && remaining < 30000 && !lanState.result);
  }
}
function renderLan(move = null) {
  $('lan-lobby').hidden = !!lanState; $('lan-room').hidden = !lanState; if (!lanState) return;
  const ended = lan.ended || lan.hasConnected && lanConnection !== 'connected';
  const hostWaiting = lan.role === 'host' && !ended && !lan.hasConnected && lanConnection !== 'connected';
  const guestWaiting = lan.role === 'guest' && !ended && !lan.hasConnected && lanConnection !== 'connected';
  const hasGame = lanConnection === 'connected' || lan.hasConnected || !!lanState.result;
  $('host-invite-panel').hidden = !hostWaiting;
  $('host-answer-panel').hidden = ended || lan.role !== 'host' || lanConnection === 'connected' || lanConnection === 'connecting' || lan.hasConnected;
  $('guest-answer-panel').hidden = !guestWaiting;
  $('lan-game-grid').hidden = !hasGame;
  $('room-link').value = hostWaiting ? `${siteInviteUrl().href}\n\nCódigo de convite:\n${lanInviteCode}` : '';
  $('guest-answer-code').value = lanAnswerCode;
  $('leave-room').textContent = ended ? 'Voltar e criar novos códigos' : 'Encerrar tentativa';
  $('room-code-display').textContent = lanState.code.slice(-6).toUpperCase();
  const own = lanState.players.find(p => p.color === lan.color), opponent = lanState.players.find(p => p.color !== lan.color);
  const fen = lanState.frames[lanCursor] || lanState.fen, chess = new Chess(lanState.fen);
  const legal = lanSelected && canPlayLan() ? chess.moves({square:lanSelected,verbose:true}) : [];
  lanBoard.render(fen,{orientation:lan.color || 'w',style:'classic',selected:lanSelected,legal,lastMove:lanState.moves[lanCursor-1],move});
  $('room-state-label').textContent = lanState.result ? 'Partida encerrada.' : ended ? 'Conexão encerrada.' : lanConnection === 'connected' ? 'Conexão direta estabelecida.' : lanConnection === 'connecting' ? 'Conectando os dois navegadores…' : lan.role === 'guest' ? 'Resposta pronta para enviar.' : 'Convite pronto para enviar.';
  $('room-invitation-text').textContent = lanState.result ? `${TIME_CONTROLS[lanState.clock].label} · ${own?.name || 'Você'} × ${opponent?.name || 'Adversário'}` : ended ? 'Esta tentativa não pode ser recuperada. Encerre-a e gere códigos novos para tentar novamente.' : lanConnection === 'connected' ? `${TIME_CONTROLS[lanState.clock].label} · ${own?.name || 'Você'} × ${opponent?.name || 'Adversário'}` : lanConnection === 'connecting' ? 'Aguarde alguns segundos. Se falhar, confirmem que estão na mesma rede e tentem com códigos novos.' : lan.role === 'guest' ? 'Copie a resposta abaixo e envie ao anfitrião para ele concluir a conexão.' : 'Envie o convite abaixo a alguém conectado à mesma rede; depois, cole aqui a resposta que essa pessoa enviar.';
  $('lan-player-name').textContent = `${own?.name || 'Você'} · Você`; $('lan-player-description').textContent = `Jogando de ${lan.color==='w'?'brancas':'pretas'}`;
  $('lan-opponent-name').textContent = opponent?.name || 'Seu amigo'; $('lan-opponent-description').textContent = opponent?.connected ? 'Conectado à sala' : 'Aguardando conexão';
  $('lan-game-status').textContent = lanState.result ? `${lanState.result.winner === null ? 'Empate' : lanState.result.winner === lan.color ? 'Você venceu' : 'Seu amigo venceu'} · ${lanState.result.reason}` : lanConnection !== 'connected' ? lan.hasConnected ? 'Conexão encerrada' : 'Aguardando conexão' : lanCursor !== lanState.moves.length ? `Revisando · ${lanCursor}/${lanState.moves.length}` : lanState.turn === lan.color ? chess.isCheck() ? 'Você está em xeque · Sua vez' : 'Sua vez' : 'Vez do seu amigo';
  $('lan-back').disabled = lanCursor === 0; $('lan-next').disabled = lanCursor === lanState.moves.length; $('lan-live').hidden = lanCursor === lanState.moves.length;
  $('lan-result').hidden = !lanState.result;
  const resultKey = lanState.result ? `lan:${lanState.code}:${lanState.result.reason}:${lanState.result.winner}` : '';
  if (resultKey && resultKey !== handledLanResult && !$('lan-page').hidden) { handledLanResult = resultKey; resultView.show(lanSnapshot()); }
  $('lan-resign').disabled = !!lanState.result || lanState.phase !== 'playing';
  renderMoves($('lan-moves'),lanState.moves,lanCursor,ply => { lanCursor = ply; lanSelected = null; renderLan(); }); updateLanClocks();
}
lan.onState = state => {
  const live = !lanState || lanCursor === lanState.moves.length;
  const changed = !lanState || state.revision !== lanState.revision || state.phase !== lanState.phase || state.players.some((p,i)=>p.connected!==lanState.players[i]?.connected);
  const move = state.moves.length === (lanState?.moves.length || 0)+1 && live ? state.moves.at(-1) : null;
  lanState = state; lanReceivedAt = performance.now(); if (live) lanCursor = state.moves.length; else lanCursor = Math.min(lanCursor,state.moves.length);
  if (changed) lanSelected = null; setLanBusy(false); $('lan-error').hidden = true;
  if (changed) renderLan(move); else updateLanClocks();
};
lan.onError = message => { if (lanState) renderLan(); lanError(message); };
lan.onConnection = status => { lanConnection = status; if (lanState) renderLan(); };
lan.onLeave = () => { lanState = null; lanInviteCode = ''; lanAnswerCode = ''; lanCursor = 0; lanSelected = null; handledLanResult = ''; $('lan-error').hidden = true; renderLan(); };
async function createRoom(event) {
  event.preventDefault(); if (lanBusy) return;
  prefs.playerName = $('host-name').value.trim().slice(0,40); savePreferences(prefs);
  const value = await dialog('Criar partida em LAN', `<label for="lan-time">Tempo de partida</label><select id="lan-time">${Object.entries(TIME_CONTROLS).map(([key,value]) => `<option value="${key}">${value.label}</option>`).join('')}</select><p style="margin-top:16px">Você jogará de brancas. Envie o convite a alguém na mesma rede e depois cole a resposta recebida.</p>`, [{value:'cancel',text:'Cancelar'},{value:'confirm',text:'Gerar convite',primary:true}], () => { $('lan-time').value = prefs.clock; });
  if (value !== 'confirm') return;
  setLanBusy(true); $('lan-error').hidden = true;
  try {
    prefs.clock = $('lan-time').value; savePreferences(prefs);
    const created = await lan.createHost({name:prefs.playerName || 'Jogador 1',clock:prefs.clock});
    lanInviteCode = created.inviteCode; lanState = created.state; lanCursor = 0; lanConnection = lan.connection; renderLan();
  } catch (error) { lanError(error.message); }
  finally { if (lanBusy) setLanBusy(false); }
}
async function joinRoom(event) {
  event.preventDefault(); if (lanBusy) return;
  const pastedInvite = $('room-code').value.trim();
  const code = pastedInvite.match(/[A-Za-z0-9_-]{20,}$/)?.[0] || pastedInvite;
  prefs.playerName = $('guest-name').value.trim().slice(0,40); savePreferences(prefs);
  setLanBusy(true); $('lan-error').hidden = true;
  try {
    const joined = await lan.createGuest({inviteCode:code,name:prefs.playerName || 'Jogador 2'});
    lanAnswerCode = joined.answerCode; lanState = lan.state; lanCursor = 0; lanConnection = lan.connection; renderLan();
  } catch (error) { lanError(error.message); }
  finally { if (lanBusy) setLanBusy(false); }
}
async function copyText(text, fieldId, successMessage) {
  try { await navigator.clipboard.writeText(text); toast(successMessage); }
  catch { const field = $(fieldId); field.focus(); field.select(); toast('Texto selecionado. Use Copiar no menu do aparelho e envie ao amigo.'); }
}
async function copyRoom() {
  if (!lanInviteCode) return;
  const text = `${siteInviteUrl().href}\n\nCódigo de convite:\n${lanInviteCode}`;
  $('room-link').value = text;
  await copyText(text,'room-link','Convite copiado. Envie-o ao seu amigo na mesma rede.');
}
async function copyAnswer() {
  if (!lanAnswerCode) return;
  await copyText(lanAnswerCode,'guest-answer-code','Resposta copiada. Envie-a ao anfitrião.');
}
async function connectAnswer() {
  if (lanBusy) return;
  setLanBusy(true); $('lan-error').hidden = true;
  try { await lan.acceptGuestAnswer($('host-answer-code').value.trim()); }
  catch (error) { lanError(error.message); }
  finally { if (lanBusy) setLanBusy(false); }
}

function route() {
  stopAutoplay(); const fragment = location.hash.slice(1), [page,id,variation] = fragment.split('/');
  const current = page === 'historicas' ? id ? 'replay' : 'history' : page === 'aberturas' ? id ? 'opening' : 'openings' : page === 'puzzle' ? 'puzzle' : page === 'lan' ? 'lan' : 'play';
  const previous = currentPage; currentPage = current;
  if (previous === 'puzzle' && current !== 'puzzle') puzzleView.close();
  for (const name of ['play','history','replay','lan','openings','opening','puzzle']) $(`${name}-page`).hidden = current !== name;
  const nav = current === 'history' || current === 'replay' ? 'historicas' : current === 'opening' || current === 'openings' ? 'aberturas' : current === 'puzzle' ? 'puzzle' : current === 'lan' ? 'lan' : 'jogar';
  document.querySelectorAll('[data-route]').forEach(link => { const active = link.dataset.route === nav; link.classList.toggle('active',active); if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); });
  const titles = { historicas: 'Partidas históricas', aberturas: 'Aberturas', puzzle: 'Puzzle', lan: 'Jogar em LAN', jogar: 'Jogar' };
  $('breadcrumb').textContent = nav === 'jogar' ? 'Jogar contra o computador' : titles[nav];
  document.title = `${titles[nav]} · chess.io`;
  if (current === 'replay') {
    const game = HISTORICAL_GAMES.find(g => g.id === id);
    if (!game) { location.hash = 'historicas'; return; }
    if (historicalGame?.id !== game.id) { historicalGame = game; replay.replay(game.pgn); }
    renderReplay();
  } else if (current === 'opening') {
    if (!openingView.open(id, variation)) { location.hash = 'aberturas'; return; }
  } else if (current === 'puzzle') { if (previous !== 'puzzle' || !puzzleView.active) puzzleView.open(); }
  else if (current === 'lan') renderLan(); else if (current === 'play') renderPlay();
  if (previous !== current) window.scrollTo({ top: 0, behavior: 'instant' });
  if (window.innerWidth <= 760) document.querySelector('[data-route].active').scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

$('difficulty').addEventListener('input',event => { prefs.level = Number(event.target.value); updateSetup(); savePreferences(prefs); });
$('clock-options').addEventListener('click',event => { const button = event.target.closest('[data-clock]'); if (button) { prefs.clock = button.dataset.clock; updateSetup(); savePreferences(prefs); } });
$('side-options').addEventListener('click',event => { const button = event.target.closest('[data-side]'); if (button) { prefs.side = button.dataset.side; updateSetup(); savePreferences(prefs); } });
$('theme-toggle').addEventListener('click',() => { prefs.theme = prefs.theme === 'light' ? 'dark' : 'light'; applyPreferences(); });
$('motion-toggle').addEventListener('click',() => { prefs.animations = !prefs.animations; applyPreferences(); });
$('appearance-button').addEventListener('click',async () => {
  const value = await dialog('Seu tabuleiro, seu estilo', '<label for="board-theme">Tabuleiro</label><select id="board-theme"><option value="green">Verde · Original</option><option value="wood">Madeira</option><option value="blue">Azul</option></select><p class="dialog-credits">Peças clássicas: Colin M. L. Burnett, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a>. <a href="CREDITS.md" target="_blank" rel="noopener noreferrer">Créditos e licenças</a>.</p>', [{value:'cancel',text:'Cancelar'},{value:'confirm',text:'Salvar',primary:true}], () => { $('board-theme').value = prefs.board; });
  if (value === 'confirm') { prefs.board = $('board-theme').value; applyPreferences(); }
});
$('start-game').addEventListener('click',startGame);
$('show-setup').addEventListener('click',showSetup);
$('show-result').addEventListener('click',() => resultView.show(localSnapshot()));
$('lan-result').addEventListener('click',() => resultView.show(lanSnapshot()));
$('review-back').addEventListener('click',() => reviewLocal(local.cursor-1)); $('review-next').addEventListener('click',() => reviewLocal(local.cursor+1));
$('live-button').addEventListener('click',() => reviewLocal(local.moves.length));
$('undo-button').addEventListener('click',() => { cancelThinking(); selected = null; if (local.undo()) { renderPlay(); toast('Última rodada desfeita.'); } });
$('resign-button').addEventListener('click',async () => { const answer = await dialog('Abandonar a partida?', '<p>O Stockfish será declarado vencedor.</p>', [{value:'cancel',text:'Continuar jogando'},{value:'confirm',text:'Abandonar',primary:true}]); if (answer === 'confirm') { cancelThinking(); selected = null; local.resign(); renderPlay(); } });
$('retry-engine').addEventListener('click',() => { engineError = ''; think(); });
$('export-game').addEventListener('click',() => { const result = local.result ? local.result.winner === 'w' ? '1-0' : local.result.winner === 'b' ? '0-1' : '1/2-1/2' : '*'; for (const [key,value] of Object.entries({Event:'chess.io',White:local.humanColor==='w'?'Você':'Stockfish',Black:local.humanColor==='b'?'Você':'Stockfish',Result:result})) local.chess.setHeader(key,value); downloadPGN(local.chess.pgn(),'chess.io-partida.pgn'); });
$('history-search').addEventListener('input',filterHistory);
$('replay-back').addEventListener('click',() => { stopAutoplay(); reviewReplay(replay.cursor-1); }); $('replay-next').addEventListener('click',() => { stopAutoplay(); reviewReplay(replay.cursor+1); });
$('replay-reset').addEventListener('click',() => { stopAutoplay(); replay.review(0); renderReplay(); });
$('replay-auto').addEventListener('click',() => { if (autoplay) { stopAutoplay(); renderReplay(); return; } $('replay-auto').textContent = 'Pausar'; autoplay = setInterval(() => { reviewReplay(replay.cursor+1); if (replay.live) { stopAutoplay(); renderReplay(); } },1000); });
$('export-history').addEventListener('click',() => downloadPGN(historicalGame.pgn,`${historicalGame.id}.pgn`));
$('create-room').addEventListener('submit',createRoom); $('join-room').addEventListener('submit',joinRoom);
$('copy-room').addEventListener('click',copyRoom); $('copy-answer').addEventListener('click',copyAnswer); $('connect-answer').addEventListener('click',connectAnswer);
$('leave-room').addEventListener('click',async () => {
  if (lan.ended) { await lan.leave(); return; }
  const active = lanConnection === 'connected' && lanState && !lanState.result;
  const answer = await dialog(active ? 'Sair da partida?' : 'Encerrar tentativa?', active ? '<p>Se a partida estiver em andamento, sair conta como abandono.</p>' : '<p>Esta tentativa será encerrada. Para jogar, será necessário gerar novos códigos.</p>', [{value:'cancel',text:active?'Ficar na partida':'Continuar'},{value:'confirm',text:active?'Sair e abandonar':'Encerrar tentativa',primary:true}]);
  if (answer === 'confirm') await lan.leave();
});
$('lan-resign').addEventListener('click',async () => { const answer = await dialog('Abandonar a partida?', '<p>Seu amigo será declarado vencedor.</p>'); if (answer === 'confirm') lan.send({type:'resign'}).catch(error => lanError(error.message)); });
$('lan-back').addEventListener('click',() => { lanCursor = Math.max(0,lanCursor-1); lanSelected = null; renderLan(); }); $('lan-next').addEventListener('click',() => { lanCursor = Math.min(lanState.moves.length,lanCursor+1); lanSelected = null; renderLan(); }); $('lan-live').addEventListener('click',() => { lanCursor = lanState.moves.length; renderLan(); });
window.addEventListener('hashchange',route);
window.addEventListener('keydown', event => {
  if ($('app-dialog').open) return;
  const resultOpen = $('result-dialog').open;
  const delta = reviewArrow(event, { preserveBoardKeys: preserveSquareKeys({ page:currentPage, resultOpen, puzzleStatus:puzzleView.session?.status }) });
  if (!delta) return;
  let navigate;
  if (resultOpen) navigate = () => resultView.select(resultView.cursor + delta);
  else if (currentPage === 'replay') navigate = () => { stopAutoplay(); reviewReplay(replay.cursor + delta); };
  else if (currentPage === 'opening') navigate = () => openingView.step(delta);
  else if (currentPage === 'puzzle' && puzzleView.session?.status !== 'playing') navigate = () => puzzleView.stepReview(delta);
  else if (currentPage === 'play') navigate = () => reviewLocal(local.cursor + delta);
  else if (currentPage === 'lan' && lanState) navigate = () => { lanCursor = Math.max(0, Math.min(lanState.moves.length, lanCursor + delta)); lanSelected = null; renderLan(); };
  if (navigate) { event.preventDefault(); event.stopPropagation(); navigate(); }
}, true);
document.querySelector('.skip-link').addEventListener('click',event => { event.preventDefault(); $('main').focus(); $('main').scrollIntoView({behavior:'auto'}); });
window.addEventListener('pagehide',() => { engine.dispose(); resultView.cancel(); stopAutoplay(); lan.dispose(); puzzleView.close(); });
setInterval(() => {
  if (local.mode === 'computer') { const result = local.result; local.syncClock(); if (!result && local.result) { cancelThinking(); selected = null; renderPlay(); } else updatePlayClocks(); }
  lan.tick();
  updateLanClocks();
},200);
$('host-name').value = prefs.playerName;
$('guest-name').value = prefs.playerName;
applyPreferences();
route();
setLanBusy(false);
