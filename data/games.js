// Movetext transcrito das fontes abaixo; todas as linhas são validadas nos testes.
export const DEMO_PGN = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *';
export const HISTORICAL_GAMES = [
  {
    id: 'opera', title: 'A Partida da Ópera', year: '1858', opening: 'Defesa Philidor',
    white: 'Paul Morphy', black: 'Duque de Brunswick e Conde Isouard', location: 'Paris, França',
    description: 'Desenvolvimento rápido, iniciativa e um sacrifício de dama. Morphy transforma a coordenação das peças em um ataque decisivo.',
    source: 'https://en.wikipedia.org/wiki/Opera_Game',
    note: 'A data exata e a ópera apresentada são discutidas pelas fontes; o PGN registra apenas o ano confirmado.',
    previewPly: 28,
    previewFen: '4kb1r/p2r1ppp/4qn2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4',
    moments: [
      { ply: 19, san: 'Nxb5', title: 'Abrir linhas', text: 'Morphy entrega o cavalo para abrir diagonais. Com o rei preto no centro, desenvolver com ameaças vale mais que guardar material.' },
      { ply: 25, san: 'Rxd7', title: 'Eliminar o defensor', text: 'A torre captura o cavalo que protege o rei. A outra torre pode ocupar a coluna d sem perder tempo.' },
      { ply: 31, san: 'Qb8+', title: 'Desviar o cavalo', text: 'O sacrifício de dama atrai o cavalo para b8 e libera d8. Depois de ...Nxb8, a torre dá mate.' },
    ],
    pgn: `[Event "Partida da Ópera"]
[Site "Paris FRA"]
[Date "1858.??.??"]
[White "Paul Morphy"]
[Black "Duque de Brunswick e Conde Isouard"]
[Result "1-0"]
[ECO "C41"]

1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5
6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5
11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6
15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`,
  },
  {
    id: 'imortal', title: 'A Partida Imortal', year: '1851', opening: 'Gambito do Rei',
    white: 'Adolf Anderssen', black: 'Lionel Kieseritzky', location: 'Londres, Inglaterra',
    description: 'Uma sequência de sacrifícios conduz a um ataque memorável. As peças menores de Anderssen protagonizam o desfecho.',
    source: 'https://en.wikipedia.org/wiki/Immortal_Game',
    note: 'Reproduzimos a linha tradicional até o mate; relatos históricos divergem sobre a ordem de alguns lances e o momento do abandono.',
    previewPly: 35,
    previewFen: 'rnb1k1nr/p2p1ppp/3B4/1pbN1N1P/4P1P1/3P1Q2/PqP5/R4KR1',
    moments: [
      { ply: 35, san: 'Bd6', title: 'Atividade acima de material', text: 'O bispo entra com tempo e as brancas permitem a captura das torres. O ataque depende da coordenação dos cavalos e bispos perto do rei.' },
      { ply: 37, san: 'e5', title: 'Fechar a fuga', text: 'O peão bloqueia a diagonal da dama preta e prepara a entrada do cavalo em g7. O rei preto continua sem rocar.' },
      { ply: 43, san: 'Qf6+', title: 'O último sacrifício', text: 'A dama atrai o cavalo de g8 para f6. Isso deixa e7 acessível ao bispo, que encerra o ataque com mate.' },
    ],
    pgn: `[Event "Partida Imortal"]
[Site "London ENG"]
[Date "1851.??.??"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]
[ECO "C33"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6
6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6
11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6
16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+
20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`,
  },
  {
    id: 'sempre-viva', title: 'A Sempre-Viva', year: '1852', opening: 'Gambito Evans',
    white: 'Adolf Anderssen', black: 'Jean Dufresne', location: 'Berlim, Alemanha',
    description: 'O Gambito Evans abre linhas para uma combinação de xeques e sacrifícios. Explore como as peças se encontram no ataque.',
    source: 'https://en.wikipedia.org/wiki/Evergreen_Game',
    note: 'Os lances finais reproduzem a continuação tradicional do mate anunciado; a publicação original não registrou todos eles.',
    previewPly: 38,
    previewFen: '1r2k1r1/pbppnp1p/1bn2P2/8/Q7/B1PB1q2/P4PPP/3RR1K1',
    moments: [
      { ply: 33, san: 'Nf6+', title: 'Abrir a coluna g', text: 'O cavalo se oferece com xeque. Após ...gxf6 e exf6, o peão branco em f6 participa do ataque ao rei no centro.' },
      { ply: 39, san: 'Rxe7+', title: 'Forçar o rei a sair', text: 'A torre elimina o cavalo com xeque e prepara um segundo sacrifício. As pretas têm ameaças, mas precisam responder aos xeques.' },
      { ply: 41, san: 'Qxd7+', title: 'A dama abre caminho', text: 'O rei captura a dama em d7. Os dois bispos, apoiados pela torre, coordenam a sequência de mate.' },
    ],
    pgn: `[Event "A Sempre-Viva"]
[Site "Berlin GER"]
[Date "1852.??.??"]
[White "Adolf Anderssen"]
[Black "Jean Dufresne"]
[Result "1-0"]
[ECO "C52"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5
6. d4 exd4 7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7
11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5
16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3
20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0`,
  },
  {
    id: 'seculo', title: 'A Partida do Século', year: '1956', opening: 'Defesa Grünfeld',
    white: 'Donald Byrne', black: 'Bobby Fischer', location: 'Nova York, Estados Unidos',
    description: 'Fischer, aos 13 anos, troca a dama por atividade e transforma suas peças em uma rede de mate.',
    source: 'https://en.wikipedia.org/wiki/The_Game_of_the_Century_(chess)',
    note: 'Torneio Rosenwald. A partida começa com 1.Nf3 e transpõe para uma estrutura da Grünfeld.',
    previewPly: 34, previewFen: 'r3r1k1/pp3pbp/1qp1b1p1/2B5/2BP4/Q1n2N2/P4PPP/3R1K1R',
    moments: [
      { ply: 22, san: 'Na4', title: 'Um cavalo em ação', text: 'Fischer desloca o cavalo para atacar a dama e explorar a falta de coordenação branca. A iniciativa nasce de ameaças concretas.' },
      { ply: 34, san: 'Be6', title: 'A dama pode esperar', text: 'O bispo se desenvolve deixando a dama em b6 sob ataque. Se ela for capturada, ...Bxc4+ inicia uma sequência de xeques e recupera material.' },
      { ply: 46, san: 'axb6', title: 'Compensação concreta', text: 'Depois dos xeques, o peão captura o bispo em b6. As peças pretas trabalham juntas e as torres ganham linhas para invadir.' },
      { ply: 82, san: 'Rc2#', title: 'Coordenação até o mate', text: 'A torre chega a c2, apoiada pelas peças menores. O rei branco não tem saída: a dama branca está longe demais para ajudar.' },
    ],
    pgn: `[Event "Rosenwald"]
[Site "New York USA"]
[Date "1956.10.17"]
[White "Donald Byrne"]
[Black "Bobby Fischer"]
[Result "0-1"]
[ECO "D92"]

1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5
6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4
11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6
15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+
19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+
23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2
27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5
31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7
35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+
39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1`,
  },
  {
    id: 'kasparov-topalov', title: 'A Imortal de Kasparov', year: '1999', opening: 'Defesa Pirc',
    white: 'Garry Kasparov', black: 'Veselin Topalov', location: 'Wijk aan Zee, Países Baixos',
    description: 'Um sacrifício de torre lança uma perseguição ao rei preto. A combinação atravessa o tabuleiro inteiro.',
    source: "https://en.wikipedia.org/wiki/Kasparov's_Immortal",
    note: 'Topalov abandonou após 44.Qa7; a posição final não é xeque-mate.',
    previewPly: 47, previewFen: 'b2r3r/k4p1p/p2q1np1/NppP4/3R1Q2/P4PPB/1PP4P/1K2R3',
    moments: [
      { ply: 47, san: 'Rxd4', title: 'O sacrifício que abre o ataque', text: 'A torre captura em d4 e pode ser tomada pelo peão c5. Kasparov calcula a invasão da outra torre em e7 com xeque.' },
      { ply: 49, san: 'Re7+', title: 'Manter a iniciativa', text: 'A segunda torre entra na sétima fileira com xeque. Capturá-la permite Qxd4+; na partida, o rei segue para b6.' },
      { ply: 71, san: 'Bf1', title: 'Um lance calmo entre xeques', text: 'O bispo volta a f1 e ataca a dama em c4. Após ...Rd2, Rd7 crava a torre contra o rei em d1, permitindo Bxc4.' },
      { ply: 77, san: 'Qxh8', title: 'Converter o ataque', text: 'A dama captura a torre de h8. A perseguição deu lugar a um final favorável de dama contra torre e peões.' },
    ],
    pgn: `[Event "Hoogovens"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]
[ECO "B07"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6
6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7
10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O
14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8
18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4
22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6
26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7
30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3
34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7
38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1
42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0`,
  },
  {
    id: 'short-timman', title: 'A Marcha do Rei', year: '1991', opening: 'Defesa Alekhine',
    white: 'Nigel Short', black: 'Jan Timman', location: 'Tilburg, Países Baixos',
    description: 'Com as peças pretas presas à defesa, Short leva o próprio rei ao ataque no meio-jogo.',
    source: 'https://rafaelleitao.com/short-x-timman/',
    note: 'Timman abandonou após 34.Kg5, antes de o mate ser executado.',
    previewPly: 65, previewFen: '4rrk1/1bpR1p2/1pq1pQp1/p3P2p/P1PR1K1P/5N2/2P2PP1/8',
    moments: [
      { ply: 47, san: 'Rd8', title: 'Invadir a oitava fileira', text: 'A torre ocupa d8 e restringe as peças pretas. A segunda torre poderá se juntar a ela na coluna d.' },
      { ply: 61, san: 'Kh2', title: 'O rei entra no plano', text: 'Em vez de procurar outro atacante, Short usa o rei. A posição bloqueada e o controle das casas claras tornam possível essa caminhada.' },
      { ply: 65, san: 'Kf4', title: 'Aproximar sem perder a segurança', text: 'O rei segue para g5. A dama e as torres limitam o contrajogo, e o rei branco pode ajudar a atacar h6.' },
      { ply: 67, san: 'Kg5', title: 'A ameaça decide', text: 'O plano é Kh6, seguido de Qg7 mate. Timman abandona: o ataque ganhou uma peça que normalmente ficaria protegida.' },
    ],
    pgn: `[Event "Tilburg"]
[Site "Tilburg NED"]
[Date "1991.10.21"]
[White "Nigel Short"]
[Black "Jan Timman"]
[Result "1-0"]
[ECO "B04"]

1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. Nf3 g6 5. Bc4 Nb6
6. Bb3 Bg7 7. Qe2 Nc6 8. O-O O-O 9. h3 a5 10. a4 dxe5
11. dxe5 Nd4 12. Nxd4 Qxd4 13. Re1 e6 14. Nd2 Nd5
15. Nf3 Qc5 16. Qe4 Qb4 17. Bc4 Nb6 18. b3 Nxc4
19. bxc4 Re8 20. Rd1 Qc5 21. Qh4 b6 22. Be3 Qc6
23. Bh6 Bh8 24. Rd8 Bb7 25. Rad1 Bg7 26. R8d7 Rf8
27. Bxg7 Kxg7 28. R1d4 Rae8 29. Qf6+ Kg8 30. h4 h5
31. Kh2 Rc8 32. Kg3 Rce8 33. Kf4 Bc8 34. Kg5 1-0`,
  },
  {
    id: 'rubinstein', title: 'A Imortal de Rubinstein', year: '1907', opening: 'Defesa Tarrasch',
    white: 'Gersz Rotlewi', black: 'Akiba Rubinstein', location: 'Łódź, Polônia',
    description: 'Torres e bispos exploram uma defesa sobrecarregada. Rubinstein entrega a dama para construir uma ameaça de mate.',
    source: 'https://en.wikipedia.org/wiki/Rotlewi_versus_Rubinstein',
    note: 'Rotlewi abandonou após 25...Rh3, diante da ameaça ...Rxh2 mate.',
    previewPly: 44, previewFen: '3r2k1/1b3ppp/pb2p3/1p2P3/1P2BPnq/P1r3P1/1B2Q2P/R4R1K',
    moments: [
      { ply: 44, san: 'Rxc3', title: 'Remover um defensor', text: 'A torre elimina o cavalo de c3, que defendia o bispo e4. A dama branca agora precisa proteger e4 e h2 ao mesmo tempo.' },
      { ply: 46, san: 'Rd2', title: 'Desviar a dama', text: 'Mesmo depois de perder a dama, Rubinstein oferece outra torre. Ao capturá-la, a dama branca deixa de defender o bispo e4.' },
      { ply: 50, san: 'Rh3', title: 'O mate vale mais que a dama', text: 'As pretas ameaçam ...Rxh2 mate. A dama branca está presa à defesa de g2 e a atividade dos bispos decide a partida.' },
    ],
    pgn: `[Event "Lodz"]
[Site "Lodz POL"]
[Date "1907.12.26"]
[White "Gersz Rotlewi"]
[Black "Akiba Rubinstein"]
[Result "0-1"]
[ECO "D32"]

1. d4 d5 2. Nf3 e6 3. e3 c5 4. c4 Nc6 5. Nc3 Nf6
6. dxc5 Bxc5 7. a3 a6 8. b4 Bd6 9. Bb2 O-O 10. Qd2 Qe7
11. Bd3 dxc4 12. Bxc4 b5 13. Bd3 Rd8 14. Qe2 Bb7
15. O-O Ne5 16. Nxe5 Bxe5 17. f4 Bc7 18. e4 Rac8
19. e5 Bb6+ 20. Kh1 Ng4 21. Be4 Qh4 22. g3 Rxc3
23. gxh4 Rd2 24. Qxd2 Bxe4+ 25. Qg2 Rh3 0-1`,
  },
  {
    id: 'lasker-bauer', title: 'O Duplo Sacrifício', year: '1889', opening: 'Abertura Bird',
    white: 'Emanuel Lasker', black: 'Johann Hermann Bauer', location: 'Amsterdã, Países Baixos',
    description: 'Dois bispos derrubam a proteção do rei. Depois do ataque, Lasker converte a vantagem material com precisão.',
    source: 'https://en.wikipedia.org/wiki/Lasker_versus_Bauer,_Amsterdam,_1889',
    note: 'A partida prossegue após a combinação: Bauer abandonou no lance 38.',
    previewPly: 33, previewFen: 'r4rk1/1b2bpB1/ppq1p3/2pp3Q/5P2/1P2P3/P1PP2PP/R4RK1',
    moments: [
      { ply: 29, san: 'Bxh7+', title: 'O primeiro bispo', text: 'Lasker sacrifica o bispo em h7 para tirar o rei do abrigo. A dama se aproxima por h5 com xeque.' },
      { ply: 33, san: 'Bxg7', title: 'O segundo bispo', text: 'O outro bispo elimina o peão g7. Sem a cobertura de peões, o rei fica exposto à dama e à torre pela terceira fileira.' },
      { ply: 43, san: 'Qd7', title: 'Recuperar material com um garfo', text: 'A dama ataca os dois bispos pretos. Esse detalhe garante uma vantagem material depois dos sacrifícios e da troca da torre pela dama.' },
    ],
    pgn: `[Event "Amsterdam"]
[Site "Amsterdam NED"]
[Date "1889.08.26"]
[White "Emanuel Lasker"]
[Black "Johann Hermann Bauer"]
[Result "1-0"]
[ECO "A03"]

1. f4 d5 2. e3 Nf6 3. b3 e6 4. Bb2 Be7 5. Bd3 b6
6. Nc3 Bb7 7. Nf3 Nbd7 8. O-O O-O 9. Ne2 c5 10. Ng3 Qc7
11. Ne5 Nxe5 12. Bxe5 Qc6 13. Qe2 a6 14. Nh5 Nxh5
15. Bxh7+ Kxh7 16. Qxh5+ Kg8 17. Bxg7 Kxg7 18. Qg4+ Kh7
19. Rf3 e5 20. Rh3+ Qh6 21. Rxh6+ Kxh6 22. Qd7 Bf6
23. Qxb7 Kg7 24. Rf1 Rab8 25. Qd7 Rfd8 26. Qg4+ Kf8
27. fxe5 Bg7 28. e6 Rb7 29. Qg6 f6 30. Rxf6+ Bxf6
31. Qxf6+ Ke8 32. Qh8+ Ke7 33. Qg7+ Kxe6 34. Qxb7 Rd6
35. Qxa6 d4 36. exd4 cxd4 37. h4 d3 38. Qxd3 1-0`,
  },
  {
    id: 'marshall', title: 'As Moedas de Ouro', year: '1912', opening: 'Defesa Francesa',
    white: 'Stepan Levitsky', black: 'Frank Marshall', location: 'Breslau, atual Wrocław, Polônia',
    description: 'Uma dama aparentemente indefesa cria várias ameaças ao rei. Descubra por que capturá-la não resolve a posição.',
    source: 'https://en.wikipedia.org/wiki/Levitsky_versus_Marshall',
    note: 'O relato de moedas lançadas ao tabuleiro é uma lenda discutida. Levitsky abandonou após 23...Qg3.',
    previewPly: 46, previewFen: '5rk1/pp4pp/4p3/2R3Q1/3n4/6qr/P1P2PPP/5RK1',
    moments: [
      { ply: 40, san: 'Ref8', title: 'Dobrar as torres', text: 'As torres pressionam a coluna f. As peças brancas estão longe da defesa do rei, e Marshall prepara a passagem de uma torre para h6.' },
      { ply: 44, san: 'Rxh3', title: 'Destruir o escudo', text: 'A torre captura o bispo e entra em h3. A ameaça ao rei permite às pretas ignorar os ataques contra o restante do material.' },
      { ply: 46, san: 'Qg3', title: 'Uma dama entre três capturas', text: 'A dama ameaça ...Qxh2 mate. Se hxg3, segue ...Ne2 mate; se fxg3, ...Ne2+ e ...Rxf1 mate. Qxg3 evita o mate imediato, mas ...Ne2+ ganha material.' },
    ],
    pgn: `[Event "Breslau"]
[Site "Breslau"]
[Date "1912.07.20"]
[White "Stepan Levitsky"]
[Black "Frank Marshall"]
[Result "0-1"]
[ECO "C10"]

1. d4 e6 2. e4 d5 3. Nc3 c5 4. Nf3 Nc6 5. exd5 exd5
6. Be2 Nf6 7. O-O Be7 8. Bg5 O-O 9. dxc5 Be6
10. Nd4 Bxc5 11. Nxe6 fxe6 12. Bg4 Qd6 13. Bh3 Rae8
14. Qd2 Bb4 15. Bxf6 Rxf6 16. Rad1 Qc5 17. Qe2 Bxc3
18. bxc3 Qxc3 19. Rxd5 Nd4 20. Qh5 Ref8 21. Re5 Rh6
22. Qg5 Rxh3 23. Rc5 Qg3 0-1`,
  },
];
