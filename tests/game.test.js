import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../vendor/chess.js';
import { GameSession, formatClock, resultFor, resultOutcome } from '../src/game.js';
import { DEMO_PGN, HISTORICAL_GAMES } from '../data/games.js';
import { readPreferences, savePreferences } from '../src/preferences.js';

const initialFen = new Chess().fen();
function position(fen) {
  const game = new GameSession(); game.start({clock:'unlimited'}); game.chess = new Chess(fen); game.frames = [fen]; return game;
}
test('posição inicial e bloqueio de turno', () => {
  const game = new GameSession(); assert.equal(game.legalMoves().length,20);
  assert.throws(() => game.move({from:'e7',to:'e5'},'b'), /turno/);
  assert.equal(game.chess.fen(),initialFen);
});
test('movimento ilegal não altera posição, histórico ou incremento', () => {
  const game = new GameSession({now:()=>0}); game.start({clock:'blitz'});
  assert.throws(() => game.move({from:'e2',to:'e5'},'w'), /permitido/);
  assert.equal(game.moves.length,0); assert.equal(game.remaining.w,180000); assert.equal(game.chess.fen(),initialFen);
});
test('FEN inclui en passant capturável e contadores reais', () => {
  const game = new GameSession(); for (const move of ['e4','a6','e5','d5']) game.move(move);
  assert.equal(game.chess.fen().split(' ')[3],'d6'); assert.equal(game.chess.fen().split(' ')[5],'3');
});
test('en passant legal remove o peão correto', () => {
  const game = new GameSession(); for (const move of ['e4','a6','e5','d5','exd6']) game.move(move);
  assert.equal(game.chess.get('d5'),undefined); assert.equal(game.chess.get('d6').color,'w');
});
test('en passant não pode expor o próprio rei', () => {
  const game = position('4k3/8/8/r4pPK/8/8/8/8 w - f6 0 1');
  assert.equal(game.legalMoves('g5').some(m=>m.to==='f6'),false);
});
test('en passant pode resolver um xeque', () => {
  const game = position('4k3/8/8/3pP3/4K3/8/8/8 w - d6 0 1');
  assert.equal(game.chess.isCheck(),true); assert.equal(game.legalMoves('e5').some(m=>m.to==='d6'),true);
  game.move({from:'e5',to:'d6'}); assert.equal(game.chess.get('d5'),undefined);
});
test('peça cravada não pode expor o rei', () => {
  const game = position('k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1');
  assert.equal(game.legalMoves('e2').some(m=>m.to==='f2'),false);
});
test('roque move rei e torre e perde direitos', () => {
  const game = position('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'); game.move('O-O');
  assert.equal(game.chess.get('g1').type,'k'); assert.equal(game.chess.get('f1').type,'r');
  assert.equal(game.chess.get('h1'),undefined); assert.equal(game.chess.fen().split(' ')[2],'kq');
});
test('roque não atravessa casa atacada', () => {
  const game = position('4kr2/8/8/8/8/8/8/4K2R w K - 0 1');
  assert.equal(game.legalMoves('e1').some(m=>m.san==='O-O'),false);
});
test('capturar a torre remove o direito ao roque', () => {
  const game = position('4k2r/6B1/8/8/8/8/8/4K3 w k - 0 1'); game.move('Bxh8');
  assert.equal(game.chess.fen().split(' ')[2],'-');
});
for (const promotion of ['q','r','b','n']) test(`promoção para ${promotion}`, () => {
  const game = position('7k/P7/8/8/8/8/8/7K w - - 0 1'); game.move({from:'a7',to:'a8',promotion});
  assert.equal(game.chess.get('a8').type,promotion);
});
test('xeque-mate encerra e bloqueia novos lances', () => {
  const game = new GameSession(); for (const move of ['f3','e5','g4','Qh4#']) game.move(move);
  assert.equal(game.result.winner,'b'); assert.equal(game.canPlay(),false);
  assert.throws(()=>game.move('a3'),/terminou/);
});
test('afogamento e material insuficiente', () => {
  assert.equal(resultFor(new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).reason,'Empate por afogamento');
  assert.equal(resultFor(new Chess('7k/8/8/8/8/8/8/7K w - - 0 1')).reason,'Empate por material insuficiente');
});
test('a posição inicial conta na terceira repetição', () => {
  const game = new GameSession(); for(const move of ['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']) game.move(move);
  assert.equal(game.result.reason,'Empate por repetição'); assert.equal(game.moves.length,8);
});
test('regra dos 50 lances', () => {
  const game = position('7k/8/8/8/8/8/8/R6K w - - 99 51'); game.move('Ra2');
  assert.equal(game.result.reason,'Empate pela regra dos 50 lances');
});
test('revisão não altera a posição real, turno ou histórico', () => {
  const game = new GameSession(); game.move('e4'); game.move('e5'); const live=game.chess.fen();
  game.review(0); assert.equal(game.fen,initialFen); assert.equal(game.chess.fen(),live); assert.equal(game.canPlay(),false);
  game.review(2); assert.equal(game.fen,live); assert.equal(game.moves.length,2);
});
test('Desfazer retira a rodada completa e restaura os relógios', () => {
  let now=0; const game = new GameSession({now:()=>now}); game.start({clock:'blitz'});
  now=1000;game.move('e4');now=2500;game.move('e5');game.review(0);
  assert.equal(game.undo(),true); assert.equal(game.chess.fen(),initialFen);assert.deepEqual(game.remaining,{w:180000,b:180000});assert.equal(game.cursor,0);
});
test('Desfazer durante o cálculo retira apenas o lance humano', () => {
  const game = new GameSession();game.move('e4');game.undo();assert.equal(game.chess.fen(),initialFen);assert.equal(game.canPlay(),true);
});
test('jogar de pretas não permite desfazer antes do primeiro lance humano', () => {
  const game = new GameSession();game.start({side:'b'});game.move('e4','w');assert.equal(game.undo(),false);
});
test('relógio com incremento, pausa e retorno', () => {
  let now=0;const game = new GameSession({now:()=>now});game.start({clock:'blitz'});
  now=5000;game.move('e4');assert.equal(game.remaining.w,177000);
  now=6000;game.pause();assert.equal(game.remaining.b,179000);now=16000;game.syncClock();assert.equal(game.remaining.b,179000);
  game.resume();now=17000;game.syncClock();assert.equal(game.remaining.b,178000);
});
test('tempo esgotado encerra e sem tempo não desconta', () => {
  let now=0;const game=new GameSession({now:()=>now});game.start({clock:'blitz'});now=180000;game.syncClock();assert.equal(game.result.winner,'b');
  game.start({clock:'unlimited'});now+=999999;game.syncClock();assert.equal(game.result,null);assert.equal(game.remaining.w,null);
});
test('abandono identifica vencedor e nova partida limpa o estado', () => {
  const game=new GameSession();game.move('e4');game.resign();assert.equal(game.result.winner,'b');game.start();assert.equal(game.result,null);assert.equal(game.moves.length,0);assert.equal(game.chess.fen(),initialFen);
});
test('tela de resultado distingue vitória, derrota e empate para ambas as cores',()=>{
  for(const color of ['w','b']) {
    assert.equal(resultOutcome({winner:color},color),'victory');
    assert.equal(resultOutcome({winner:color==='w'?'b':'w'},color),'defeat');
    assert.equal(resultOutcome({winner:null},color),'draw');
  }
});
for(const historical of HISTORICAL_GAMES) test(`PGN ${historical.id}: todos os lances e posição da referência`,()=>{
  const game=new GameSession();game.replay(historical.pgn,historical.previewPly);
  assert.equal(game.fen.split(' ')[0],historical.previewFen);
  if(game.chess.isCheckmate()) assert.equal(game.result.winner,game.chess.getHeaders().Result==='1-0'?'w':'b');
  for(let i=game.moves.length;i>=0;i--){game.review(i);assert.doesNotThrow(()=>new Chess(game.fen));}assert.equal(game.fen,initialFen);
});
test('prévia espanhola corresponde ao sexto meio-lance',()=>{
  const game=new GameSession();game.replay(DEMO_PGN,6,'demo');assert.equal(game.position.get('a6').type,'p');assert.equal(game.position.get('b5').type,'b');assert.equal(game.active,false);
});
test('formatação dos relógios',()=>{assert.equal(formatClock(600000),'10:00');assert.equal(formatClock(1001),'0:02');assert.equal(formatClock(0),'0:00');assert.equal(formatClock(null),'∞');});
for (const [clock,time] of [['bullet',60000],['blitz3',180000],['blitz5',300000]]) test(`${clock}: novo tempo sem acréscimo e preferência persistida`,()=>{
  let now=0; const game=new GameSession({now:()=>now});game.start({clock});
  assert.deepEqual(game.remaining,{w:time,b:time});now=1000;game.move('e4');assert.equal(game.remaining.w,time-1000);
  const prefs=readPreferences({getItem:()=>JSON.stringify({clock,pieces:'type'})});assert.equal(prefs.clock,clock);assert.equal(Object.hasOwn(prefs,'pieces'),false);
});
test('preferências inválidas e armazenamento indisponível são recuperáveis',()=>{
  assert.equal(readPreferences({getItem:()=>'{'}).theme,'light');
  assert.equal(readPreferences({getItem:()=>JSON.stringify({level:100,board:'fake',theme:'dark'})}).level,5);
  assert.equal(readPreferences({getItem:()=>JSON.stringify({theme:'dark'})}).theme,'dark');
  assert.equal(savePreferences({}, {setItem(){throw Error()}}),false);
});
