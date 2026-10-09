let stockfish = null;
let stockfishReady = false;
let pendingResolve = null;
let stockfishBusy = false;


(function initStockfish(){
    const blob = new Blob([
        "importScripts('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js');"
    ], { type: 'application/javascript' });

    stockfish = new Worker(URL.createObjectURL(blob));

    stockfish.onmessage = (e) => {
    const msg = e.data;

    if (msg === 'uciok') {
        stockfishReady = true;
        console.log("♟️ Stockfish pronto");

        // === CONFIGURAÇÕES PARA FORÇA MÁXIMA ===
        stockfish.postMessage('setoption name Skill Level value 20');     // força total
        stockfish.postMessage('setoption name Threads value 4');          // usa até 4 threads (se o browser permitir)
        stockfish.postMessage('setoption name Hash value 128');           // mais memória para transposição (até 256 se quiser)
        // opcional: desabilita limitações extras se existirem
        stockfish.postMessage('setoption name Move Overhead value 0');
    }

        if (msg.startsWith('bestmove') && pendingResolve) {       
            const move = msg.split(' ')[1];
            pendingResolve(move);
            pendingResolve = null;
            stockfishBusy = false;
        }
    };

    stockfish.postMessage('uci');
})();



(function(){
	// valores das peças para avaliação
	const VALOR = {
		'pawn': 1,
		'knight': 3,
		'bishop': 3,
		'rook': 5,
		'queen': 9,
		'king': 100
	};

	function pieceTypeFromSrc(src){
		src = src.toLowerCase();
		if (src.includes('peao')) return 'pawn';
		if (src.includes('cavalo')) return 'knight';
		if (src.includes('bispo')) return 'bishop';
		if (src.includes('torre')) return 'rook';
		if (src.includes('rainha')) return 'queen';
		if (src.includes('rei')) return 'king';
		return null;
	}

    function stateToFEN(state, turn) {
        let fen = "";
        for (let y = 0; y < 8; y++) {
            let empty = 0;
            for (let x = 0; x < 8; x++) {
                const p = state.board[y][x];
                if (!p) {
                    empty++;
                } else {
                    if (empty > 0) { fen += empty; empty = 0; }
                    const char = p.type === 'knight' ? 'n' : p.type[0];
                    const finalChar = p.color === 'white' ? char.toUpperCase() : char.toLowerCase();
                    fen += finalChar;
                }
            }
            if (empty > 0) fen += empty;
            if (y < 7) fen += "/";
        }
        // Turno, Roque (simplificado), En Passant, Meios lances, Lances totais
        fen += ` ${turn === 'white' ? 'w' : 'b'} KQkq - 0 1`;
        return fen;
    }

    // ------- Motor em memória (APENAS PSEUDO-LEGAIS, SEM DOM DURANTE A BUSCA) -------

    function buildStateFromDOM(){
        const board = Array.from({length:8}, ()=>Array(8).fill(null));
        const casas = document.querySelectorAll('.casa');
        casas.forEach(casa => {
            const coord = casa.dataset.coord;
            const pos = posiçãoNumerica(coord); // {x,y}
            const p = casa.querySelector('.peca');
            if (p) board[pos.y][pos.x] = { type: pieceTypeFromSrc(p.src), color: p.src.includes('Branco') ? 'white' : 'black' };
        });
        // detect kings positions and initialize pseudo-move cache
        const kings = { white: null, black: null };
        for (let y=0;y<8;y++) for (let x=0;x<8;x++){ const p = board[y][x]; if (p && p.type==='king') kings[p.color]= {x,y}; }
        return { board, kings, _pseudoMovesCache: {} };
    }

    function cloneState(state){
        return { board: state.board.map(r=>r.map(c=> c ? {type:c.type, color:c.color} : null)) };
    }

    function inBounds(x,y){ return x>=0 && x<8 && y>=0 && y<8; }

    function genPieceMovesState(state, x, y) {
        const p = state.board[y][x];
        if (!p) return [];

        const moves = [];
        const color = p.color;
        const dir = color === 'white' ? -1 : 1;

        // PAWN
        if (p.type === 'pawn') {
            // forward 1
            if (inBounds(x, y + dir) && !state.board[y + dir][x]) {
                moves.push({ from: { x, y }, to: { x: x, y: y + dir } });
            }

            // forward 2
            const start = color === 'white' ? 6 : 1;
            if (
                y === start &&
                !state.board[y + dir][x] &&
                !state.board[y + 2 * dir][x]
            ) {
                moves.push({ from: { x, y }, to: { x: x, y: y + 2 * dir } });
            }

            // captures
            for (const dx of [-1, 1]) {
                const nx = x + dx;
                const ny = y + dir;
                if (inBounds(nx, ny)) {
                    const t = state.board[ny][nx];
                    if (t && t.color !== color) {
                        moves.push({ from: { x, y }, to: { x: nx, y: ny } });
                    }
                }
            }

            return moves;
        }

        // KNIGHT
        if (p.type === 'knight') {
            const deltas = [
                [2, 1], [1, 2], [-1, 2], [-2, 1],
                [-2, -1], [-1, -2], [1, -2], [2, -1]
            ];

            deltas.forEach(([dx, dy]) => {
                const nx = x + dx;
                const ny = y + dy;
                if (inBounds(nx, ny)) {
                    const t = state.board[ny][nx];
                    if (!t || t.color !== color) {
                        moves.push({ from: { x, y }, to: { x: nx, y: ny } });
                    }
                }
            });

            return moves;
        }

        // BISHOP / ROOK / QUEEN
        if (p.type === 'bishop' || p.type === 'rook' || p.type === 'queen') {
            const dirs = [];

            if (p.type === 'rook' || p.type === 'queen') {
                dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
            }
            if (p.type === 'bishop' || p.type === 'queen') {
                dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
            }

            dirs.forEach(([dx, dy]) => {
                let nx = x + dx;
                let ny = y + dy;

                while (inBounds(nx, ny)) {
                    const t = state.board[ny][nx];

                    if (!t) {
                        moves.push({ from: { x, y }, to: { x: nx, y: ny } });
                    } else {
                        if (t.color !== color) {
                            moves.push({ from: { x, y }, to: { x: nx, y: ny } });
                        }
                        break;
                    }

                    nx += dx;
                    ny += dy;
                }
            });

            return moves;
        }

        // KING
        if (p.type === 'king'){
            for (let dx=-1; dx<=1; dx++){
                for (let dy=-1; dy<=1; dy++){
                    if (dx===0 && dy===0) continue;
                    const nx = x + dx, ny = y + dy;
                    if (!inBounds(nx, ny)) continue;

                    const t = state.board[ny][nx];
                    if (t && t.color === color) continue;

                    // NÃO pode mover para casa atacada
                    if (isSquareAttacked(state, nx, ny, color === 'white' ? 'black' : 'white')) continue;

                    moves.push({from:{x,y}, to:{x:nx,y:ny}});
                }
            }
            return moves;
        }

        return moves;
    }


    function getAllPseudoMovesFromState(state, color){
        state._pseudoMovesCache = state._pseudoMovesCache || {};
        if (state._pseudoMovesCache[color]) return state._pseudoMovesCache[color];
        const out = [];
        for (let y=0;y<8;y++) for (let x=0;x<8;x++){ const p = state.board[y][x]; if (!p || p.color!==color) continue; const m = genPieceMovesState(state,x,y); m.forEach(mm=> out.push(mm)); }
        state._pseudoMovesCache[color] = out;
        return out;
    }

    function makeMoveState(state, move){
        const fx = move.from.x, fy = move.from.y, tx = move.to.x, ty = move.to.y;
        const moved = state.board[fy][fx];
        const captured = state.board[ty][tx];
        state.board[ty][tx] = moved;
        state.board[fy][fx] = null;
        const info = { moved, captured };
        // simple promotion
        if (moved && moved.type==='pawn' && (ty===0||ty===7)) {
            state.board[ty][tx] = {type:'queen', color:moved.color};
            info.promoted = true;
            info.prevType = moved.type;
        }
        // update king cache if moved
        if (moved && moved.type === 'king'){
            info.prevKingPos = state.kings && state.kings[moved.color] ? {x: state.kings[moved.color].x, y: state.kings[moved.color].y} : null;
            state.kings = state.kings || {white:null, black:null};
            state.kings[moved.color] = { x: tx, y: ty };
        }
        // invalidate pseudo-move cache
        state._pseudoMovesCache = {};
        return info;
    }

    function undoMoveState(state, move, info){
        const fx = move.from.x, fy = move.from.y, tx = move.to.x, ty = move.to.y;
        state.board[fy][fx] = info.moved;
        state.board[ty][tx] = info.captured || null;
        if (info && info.promoted) {
            // restore pawn type
            state.board[fy][fx] = { type: info.prevType || 'pawn', color: info.moved.color };
        }
        if (info && info.moved && info.moved.type === 'king'){
            state.kings = state.kings || {white:null, black:null};
            if (info.prevKingPos) state.kings[info.moved.color] = { x: info.prevKingPos.x, y: info.prevKingPos.y };
            else state.kings[info.moved.color] = null;
        }
        // invalidate pseudo-move cache
        state._pseudoMovesCache = {};
    }

    // Verifica se uma casa está sob ataque de uma cor específica
function isSquareAttackedBy(state, pos, color) {
    const moves = getAllPseudoMovesFromState(state, color);
    return moves.some(m => m.to.x === pos.x && m.to.y === pos.y);
}

// Retorna quais peças estão atacando aquela casa
function getAttackers(state, pos, color) {
    const moves = getAllPseudoMovesFromState(state, color);
    const attackers = [];
    for (const m of moves) {
        if (m.to.x === pos.x && m.to.y === pos.y) {
            attackers.push(state.board[m.from.y][m.from.x]);
        }
    }
    return attackers;
}

    function evaluateState(state, color) {
        let score = 0;
        const enemy = (color === 'white' ? 'black' : 'white');

        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const piece = state.board[y][x];
                if (!piece) continue;

                const val = VALOR[piece.type] || 0;
                const isFriendly = (piece.color === color);
                
                // 1. Valor Material Base
                score += isFriendly ? val : -val;

                // 2. Bonus de Posicionamento (Centro)
                if (x >= 2 && x <= 5 && y >= 2 && y <= 5) {
                    score += isFriendly ? 15 : -15;
                }

                // 3. SEGURANÇA (O segredo para não pendurar)
                // Verificamos se a peça atual está atacada por peças inimigas
                if (isFriendly) {
                    if (isSquareAttackedBy(state, {x, y}, enemy)) {
                        // Se a peça está atacada, subtraímos parte do valor dela do score
                        // Isso faz o bot "sentir" que a peça corre risco
                        score -= (val * 0.4); 
                        
                        // Penalidade extra: Se uma peça maior está atacada por menor (ex: Dama por Peão)
                        const attackers = getAttackers(state, {x, y}, enemy);
                        for (const attacker of attackers) {
                            if (VALOR[attacker.type] < val) {
                                score -= (val * 0.2); // Pânico extra por peça maior atacada por menor
                            }
                        }
                    }
                } else {
                    // Se o inimigo está com peça pendurada, o bot vê isso como lucro
                    if (isSquareAttackedBy(state, {x, y}, color)) {
                        score += (val * 0.3);
                    }
                }
            }
        }
        return score;
    }

    function quiescenceSearch(color, alpha, beta){
        const standPat = evaluateBoardFor(color, 0, 0);

        if (standPat >= beta) return beta;
        if (alpha < standPat) alpha = standPat;

        const moves = getAllLegalMoves(color).filter(isCaptureMove);

        for (const m of moves){
            const st = makeMoveTemp(m);
            if (!st) continue;

            try {
                const score = -quiescenceSearch(
                    color === 'white' ? 'black' : 'white',
                    -beta,
                    -alpha
                );

                if (score >= beta) return beta;
                if (score > alpha) alpha = score;
            } finally {
                undoMoveTemp(st);
            }
        }
        return alpha;
    }

    function isPieceHanging(state, color, x, y){
        const enemy = color === 'white' ? 'black' : 'white';

        const enemyMoves = getAllPseudoMovesFromState(state, enemy);
        const ourMoves   = getAllPseudoMovesFromState(state, color);

        let attacked = false;
        let defended = false;

        for (const m of enemyMoves){
            if (m.to.x === x && m.to.y === y){
                attacked = true;
                break;
            }
        }

        if (!attacked) return false;

        for (const m of ourMoves){
            if (m.to.x === x && m.to.y === y){
                defended = true;
                break;
            }
        }

        return attacked && !defended;
    }




    function isSquareAttacked(state, x, y, byColor){
        for (let yy = 0; yy < 8; yy++){
            for (let xx = 0; xx < 8; xx++){
                const p = state.board[yy][xx];
                if (!p || p.color !== byColor) continue;

                // ataque de peão
                if (p.type === 'pawn'){
                    const dir = byColor === 'white' ? -1 : 1;
                    if ((xx-1 === x || xx+1 === x) && yy+dir === y){
                        return true;
                    }
                }

                // ataque de cavalo
                if (p.type === 'knight'){
                    const deltas = [[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]];
                    for (const d of deltas){
                        if (xx+d[0] === x && yy+d[1] === y) return true;
                    }
                }

                // ataque de rei (CRÍTICO)
                if (p.type === 'king'){
                    for (let dx=-1; dx<=1; dx++){
                        for (let dy=-1; dy<=1; dy++){
                            if (dx===0 && dy===0) continue;
                            if (xx+dx === x && yy+dy === y) return true;
                        }
                    }
                }

                // ataque deslizante
                if (p.type === 'bishop' || p.type === 'rook' || p.type === 'queen'){
                    const dirs = [];
                    if (p.type !== 'bishop') dirs.push([1,0],[-1,0],[0,1],[0,-1]);
                    if (p.type !== 'rook') dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);

                    for (const d of dirs){
                        let nx = xx + d[0], ny = yy + d[1];
                        while (inBounds(nx, ny)){
                            if (nx === x && ny === y) return true;
                            if (state.board[ny][nx]) break;
                            nx += d[0]; ny += d[1];
                        }
                    }
                }
            }
        }
        return false;
    }



    function filtrarMelhoresLances(moves, max) {
        // prioriza capturas
        const captures = moves.filter(isCaptureMove);

        // centro
        const center = moves.filter(m => CENTER_SQUARES.includes(m.to));

        // mistura + remove duplicados
        const set = new Map();
        [...captures, ...center].forEach(m => {
            set.set(m.from + m.to, m);
        });

        // se ainda faltar, completa aleatoriamente
        if (set.size < max) {
            for (const m of moves) {
                set.set(m.from + m.to, m);
                if (set.size >= max) break;
            }
        }

        return Array.from(set.values()).slice(0, max);
    }

    function moveIsHanging(move, color) {
        const enemy = color === 'white' ? 'black' : 'white';

        const st = makeMoveTemp(move);
        if (!st) return true;

        try {
            const enemyMoves = getAllLegalMoves(enemy);

            for (const em of enemyMoves) {
                if (em.to === move.to) {
                    const loss = getCapturedValue({ to: move.to });
                    const gain = getCapturedValue(em);
                    if (loss > gain) return true;
                }
            }
            return false;
        } finally {
            undoMoveTemp(st);
        }
    }

    function isCheckMove(move, color) {
        const enemy = color === 'white' ? 'black' : 'white';
        const st = makeMoveTemp(move);
        if (!st) return false;

        try {
            return estaEmXeque(enemy);
        } finally {
            undoMoveTemp(st);
        }
    }

    function getCapturedValueState(state, move){
        const t = state.board[move.to.y][move.to.x];
        if (!t) return 0; return VALOR[t.type] || 0;
    }

    function countAttackersState(state, x, y, byColor){
        let count = 0;
        for (let yy=0; yy<8; yy++) for (let xx=0; xx<8; xx++){ const p = state.board[yy][xx]; if(!p || p.color!==byColor) continue; const moves = genPieceMovesState(state, xx, yy); for (const m of moves) if (m.to.x===x && m.to.y===y) count++; }
        return count;
    }

    function quickScoreMoveState(state, move, color){
        const mover = state.board[move.from.y][move.from.x];
        const moverVal = mover ? (VALOR[mover.type]||0) : 0;
        const capVal = getCapturedValueState(state, move);
        let score = (capVal - moverVal*0.1)*10;
        const cx = move.to.x, cy = move.to.y;
        if (cx>=2 && cx<=5 && cy>=2 && cy<=5) score += 30;
        // check if destination attacked more than defended
        const enemy = color==='white'?'black':'white';
        const attackers = countAttackersState(state, cx, cy, enemy);
        const defenders = countAttackersState(state, cx, cy, color);
        if (attackers > defenders) score -= (attackers-defenders)*moverVal*40;
        score += capVal*5;
        return score;
    }

    // encontra posição do rei na 'state'
    function findKingPosition(state, color){
        for (let y=0;y<8;y++) for (let x=0;x<8;x++){ const p = state.board[y][x]; if (p && p.type==='king' && p.color===color) return {x,y}; }
        return null;
    }

    function isKingInCheckState(state, color){
        let kx = -1, ky = -1;

        for (let y=0; y<8; y++){
            for (let x=0; x<8; x++){
                const p = state.board[y][x];
                if (p && p.type === 'king' && p.color === color){
                    kx = x; ky = y;
                }
            }
        }

        if (kx === -1) return true;

        const enemy = color === 'white' ? 'black' : 'white';
        return isSquareAttacked(state, kx, ky, enemy);
    }


    function filterMovesResolvingCheck(state, moves, color){
        const out = [];
        for (const m of moves){
            const info = makeMoveState(state, m);
            try{
                if (!isKingInCheckState(state, color)) out.push(m);
            } finally { undoMoveState(state, m, info); }
        }
        return out;
    }

  function minimaxState(state, originalColor, currentColor, depth, alpha, beta){
        const enemy = currentColor === 'white' ? 'black' : 'white';

        if (depth === 0){
            return evaluateState(state, originalColor);
        }

        let moves = getAllPseudoMovesFromState(state, currentColor);

        // se não há movimentos
        if (moves.length === 0){
            if (isKingInCheckState(state, currentColor)){
                // mate
                return currentColor === originalColor ? -100000 : 100000;
            }
            // afogamento
            return 0;
        }

        // ordena por capturas (melhora MUITO depth 4)
        moves.sort((a,b)=> getCapturedValueState(state,b) - getCapturedValueState(state,a));

        const maximizing = (currentColor === originalColor);
        let best = maximizing ? -Infinity : Infinity;

        for (const m of moves){
            const info = makeMoveState(state, m);
            try {
                // não deixa o próprio rei em xeque
                if (isKingInCheckState(state, currentColor)) continue;

                const val = minimaxState(
                    state,
                    originalColor,
                    enemy,
                    depth - 1,
                    alpha,
                    beta
                );

                if (maximizing){
                    best = Math.max(best, val);
                    alpha = Math.max(alpha, val);
                } else {
                    best = Math.min(best, val);
                    beta = Math.min(beta, val);
                }

                if (beta <= alpha) break;
            } finally {
                undoMoveState(state, m, info);
            }
        }

        return best;
    }


	function materialScoreFor(color){
		// soma material: positivo para `color`, negativo para o oponente
		const casas = document.querySelectorAll('.casa');
		let score = 0;
		casas.forEach(casa => {
			const peca = casa.querySelector('.peca');
			if (!peca) return;
			const tipo = pieceTypeFromSrc(peca.src);
			if (!tipo) return;
			const val = VALOR[tipo] || 0;
			const cor = peca.src.includes('Branco') ? 'white' : 'black';
			score += (cor === color) ? val : -val;
		});
		return score;
	}

	function getPieceMovesFromCoord(coord){
		const casa = document.querySelector(`.casa[data-coord="${coord}"]`);
		const peca = casa?.querySelector('.peca');
		if (!peca) return [];
		const src = peca.src;
		const cor = src.includes('Branco') ? 'white' : 'black';

		if (src.includes('peao')) return movimentosPeao(coord, cor);
		if (src.includes('torre')) return movimentosTorre(coord, cor);
		if (src.includes('bispo')) return movimentosBispo(coord, cor);
		if (src.includes('cavalo')) return movimentosCavalo(coord, cor);
		if (src.includes('rei')) return movimentosRei(coord, cor);
		if (src.includes('rainha')) return movimentosRainha(coord, cor);
		return [];
	}

	function getAllLegalMoves(color){
		const todas = [];
		const casas = document.querySelectorAll('.casa');
		casas.forEach(casa => {
			const peca = casa.querySelector('.peca');
			if (!peca) return;
			const cor = peca.src.includes('Branco') ? 'white' : 'black';
			if (cor !== color) return;
			const from = casa.dataset.coord;
            let brut = getPieceMovesFromCoord(from);
            // Se estivermos em uma busca (minimax), evitar chamar movimentoEhValido
            // (que manipula DOM e pode causar recursão/overhead). Em vez disso
            // usamos movimentos pseudo-legais durante a busca e deixamos a
            // validação completa apenas fora da busca.
            if (typeof window !== 'undefined' && window.__searchDepth > 0) {
                brut.forEach(dest => todas.push({from, to: dest}));
            } else {
                brut = brut.filter(dest => movimentoEhValido(from, dest, cor));
                brut.forEach(dest => todas.push({from, to: dest}));
            }
		});
		return todas;
	}

	function isCaptureMove(move){
		const casaDestino = document.querySelector(`.casa[data-coord="${move.to}"]`);
		return !!casaDestino?.querySelector('.peca');
	}

	function getCapturedValue(move){
		const casaDestino = document.querySelector(`.casa[data-coord="${move.to}"]`);
		const p = casaDestino?.querySelector('.peca');
		if (!p) return 0;
		const tipo = pieceTypeFromSrc(p.src);
		return VALOR[tipo] || 0;
	}

	function performMoveDOM(move){
		const casaOrigem = document.querySelector(`.casa[data-coord="${move.from}"]`);
		const casaDestino = document.querySelector(`.casa[data-coord="${move.to}"]`);
		const peca = casaOrigem?.querySelector('.peca');
		if (!casaOrigem || !casaDestino || !peca) return false;
		moverPeca(casaOrigem, casaDestino, peca);
		return true;
	}

	function simulateMoveAndEval(move, color){
		// simula movimento simples (captura/remoção) e retorna materialScoreFor(color)
		const casaOrigem = document.querySelector(`.casa[data-coord="${move.from}"]`);
		const casaDestino = document.querySelector(`.casa[data-coord="${move.to}"]`);
		const peca = casaOrigem?.querySelector('.peca');
		if (!peca || !casaOrigem || !casaDestino) return -Infinity;

		const captured = casaDestino.querySelector('.peca');

		// mover
		casaDestino.appendChild(peca);
		if (captured) captured.remove();

		const val = materialScoreFor(color);

		// desfazer
		casaOrigem.appendChild(peca);
		if (captured) casaDestino.appendChild(captured);

		return val;
	}

    

	// Nível 1: jogada aleatória
    function botLevel1(color){
        const state = buildStateFromDOM();
        const moves = getAllPseudoMovesFromState(state, color);
        if (moves.length === 0) return null;
        // se o rei está em xeque, filtra apenas movimentos que resolvem o xeque
        let pool = moves;
        if (isKingInCheckState(state, color)){
            const resolving = filterMovesResolvingCheck(state, moves, color);
            if (resolving.length === 0) return null; // mate — sem jogadas legais
            pool = resolving;
        }
        const mv = pool[Math.floor(Math.random()*pool.length)];
        return { from: posicaoID(mv.from), to: posicaoID(mv.to) };
    }

	// Nível 2: tenta capturar sempre que possível; senão busca controlar o centro
	const CENTER_SQUARES = ['d4','e4','d5','e5','c4','f4','c5','f5'];
    function botLevel2(color){
        const state = buildStateFromDOM();
        let moves = getAllPseudoMovesFromState(state, color);
        if (moves.length === 0) return null;
        if (isKingInCheckState(state, color)){
            const resolving = filterMovesResolvingCheck(state, moves, color);
            if (resolving.length === 0) return null;
            moves = resolving;
        }
        // prefer captures
        moves.sort((a,b)=> getCapturedValueState(state, b) - getCapturedValueState(state, a));
        const top = moves.slice(0, Math.min(8, moves.length));
        // prefer center among top
        const centers = top.filter(m => { const x=m.to.x, y=m.to.y; return x>=2 && x<=5 && y>=2 && y<=5; });
        const chosen = centers.length>0 ? centers[Math.floor(Math.random()*centers.length)] : top[Math.floor(Math.random()*top.length)];
        return { from: posicaoID(chosen.from), to: posicaoID(chosen.to) };
    }

	// Nível 3: parecido com L2 mas olha 1 ply à frente para evitar permitir mate-in-1; toma mate imediato se existir
	function makeMoveTemp(move){
		const casaOrigem = document.querySelector(`.casa[data-coord="${move.from}"]`);
		const casaDestino = document.querySelector(`.casa[data-coord="${move.to}"]`);
		const moved = casaOrigem?.querySelector('.peca');
		if (!moved || !casaOrigem || !casaDestino) return null;
		const captured = casaDestino.querySelector('.peca');
		casaDestino.appendChild(moved);
		if (captured) captured.remove();
		return {from: casaOrigem, to: casaDestino, moved, captured};
	}

	function undoMoveTemp(state){
		if (!state) return;
		state.from.appendChild(state.moved);
		if (state.captured) state.to.appendChild(state.captured);
	}

	function isCheckmateFor(color){
		const moves = getAllLegalMoves(color);
		if (moves.length > 0) return false;
		return estaEmXeque(color);
	}

	function allowsOpponentMateInOne(myMove, myColor){
		const enemy = (myColor === 'white') ? 'black' : 'white';
		const st = makeMoveTemp(myMove);
		if (!st) return true; // se não der para simular, trate como ruim
		let allows = false;
		const replies = getAllLegalMoves(enemy);
		for (const r of replies) {
			const s2 = makeMoveTemp(r);
			if (!s2) continue;
			try {
				if (isCheckmateFor(myColor)) { allows = true; break; }
			} finally {
				undoMoveTemp(s2);
			}
		}
		undoMoveTemp(st);
		return allows;
	}

    function botLevel3(color){
        const state = buildStateFromDOM();
        let moves = getAllPseudoMovesFromState(state, color);
        if (moves.length === 0) return null;

        // 1️⃣ resolve xeque
        if (isKingInCheckState(state, color)){
            const resolving = filterMovesResolvingCheck(state, moves, color);
            if (resolving.length === 0) return null;
            moves = resolving;
        }

        // 2️⃣ evita entregar mate em 1
        const safeFromMate = moves.filter(m => !allowsOpponentMateInOne(m, color));
        if (safeFromMate.length > 0){
            moves = safeFromMate;
        }

        // 3️⃣ evita suicídio material
        const safeMaterial = moves.filter(m => {
            const mover = state.board[m.from.y][m.from.x];
            const moverVal = mover ? (VALOR[mover.type] || 0) : 0;

            const info = makeMoveState(state, m);
            let vulnerable = false;
            const enemy = color === 'white' ? 'black' : 'white';
            const enemyMoves = getAllPseudoMovesFromState(state, enemy);

            for (const em of enemyMoves){
                if (em.to.x === m.to.x && em.to.y === m.to.y){
                    const cap = state.board[em.from.y][em.from.x];
                    const capVal = cap ? (VALOR[cap.type] || 0) : 0;
                    if (capVal > moverVal){
                        vulnerable = true;
                        break;
                    }
                }
            }

            undoMoveState(state, m, info);
            return !vulnerable;
        });

        if (safeMaterial.length > 0){
            moves = safeMaterial;
        }

        // 4️⃣ capturas e centro
        moves.sort((a,b)=> getCapturedValueState(state,b) - getCapturedValueState(state,a));
        const top = moves.slice(0, Math.min(8, moves.length));

        const centers = top.filter(m => {
            const x = m.to.x, y = m.to.y;
            return x >= 2 && x <= 5 && y >= 2 && y <= 5;
        });

        const chosen =
            centers.length > 0
                ? centers[Math.floor(Math.random() * centers.length)]
                : top[Math.floor(Math.random() * top.length)];

        return {
            from: posicaoID(chosen.from),
            to: posicaoID(chosen.to)
        };
    }


	// Nível 4: minimax depth 2 + mobilidade (anterior level6)
    function evaluateBoardFor(color, mobilityWeight, cachedMovesCount) {
        // ⚡ avaliação RÁPIDA (sem contarAtacantesDOM)
        let score = 0;

        const casas = document.querySelectorAll('.casa');

        for (const casa of casas) {
            const peca = casa.querySelector('.peca');
            if (!peca) continue;

            const tipo = pieceTypeFromSrc(peca.src);
            if (!tipo) continue;

            const cor = peca.classList.contains('white') ? 'white' : 'black';
            const sinal = (cor === color) ? 1 : -1;

            const valores = {
                pawn: 100,
                knight: 320,
                bishop: 330,
                rook: 500,
                queen: 900,
                king: 20000
            };

            score += sinal * valores[tipo];
        }

        // mobilidade (barato)
        if (mobilityWeight && cachedMovesCount != null) {
            score += mobilityWeight * cachedMovesCount * 10;
        }

        // penaliza xeque
        if (estaEmXeque(color)) score -= 300;

        return score;
    }

	function minimaxAlphaBeta(originalColor, currentColor, depth, alpha, beta, mobilityWeight){
        if (typeof window !== 'undefined') {
            window.__searchDepth = (window.__searchDepth || 0) + 1;
        }

        try {
            // 🔴 1. folha → quiescence
            if (depth <= 0){
                return quiescenceSearch(currentColor, alpha, beta);
            }

            const moves = getAllLegalMoves(currentColor);

            // 🔴 2. sem movimentos
            if (moves.length === 0){
                if (estaEmXeque(currentColor)){
                    // mate mais rápido é melhor
                    return (currentColor === originalColor)
                        ? -100000 - depth
                        :  100000 + depth;
                }
                return 0; // afogamento
            }

            const maximizing = (currentColor === originalColor);
            let bestVal = maximizing ? -Infinity : Infinity;

            // 🔴 3. poda agressiva
            let maxMoves = 12;
            if (depth === 3) maxMoves = 8;
            if (depth >= 4) maxMoves = 6;

            const filteredMoves = filtrarMelhoresLances(moves, maxMoves);

            for (const m of filteredMoves){
                const st = makeMoveTemp(m);
                if (!st) continue;

                try {
                    const val = minimaxAlphaBeta(
                        originalColor,
                        currentColor === 'white' ? 'black' : 'white',
                        depth - 1,
                        alpha,
                        beta,
                        mobilityWeight
                    );

                    if (maximizing){
                        bestVal = Math.max(bestVal, val);
                        alpha = Math.max(alpha, val);
                    } else {
                        bestVal = Math.min(bestVal, val);
                        beta = Math.min(beta, val);
                    }

                    if (alpha >= beta) break;
                } finally {
                    undoMoveTemp(st);
                }
            }

            return bestVal;
        } finally {
            if (typeof window !== 'undefined'){
                window.__searchDepth = Math.max(0, (window.__searchDepth || 1) - 1);
            }
        }
    }



    function botLevel4(color){
        const state = buildStateFromDOM();
        let moves = getAllPseudoMovesFromState(state, color);
        if (moves.length === 0) return null;

        if (isKingInCheckState(state, color)){
            const resolving = filterMovesResolvingCheck(state, moves, color);
            if (resolving.length === 0) return null;
            moves = resolving;
        }

        // ordena por heurística leve e reduz candidatos
        moves = moves.map(m=>({m, s: quickScoreMoveState(state,m,color)})).sort((a,b)=>b.s-a.s).slice(0,10).map(x=>x.m);

        let best = null; let bestVal = -Infinity;
        const enemy = color === 'white' ? 'black' : 'white';
        const depth = 5;
        for (const m of moves){
            const info = makeMoveState(state, m);
            try{
                const val = minimaxState(state, color, enemy, depth-1, -Infinity, Infinity, 0.04);
                if (val > bestVal){ bestVal = val; best = m; }
            } finally { undoMoveState(state, m, info); }
        }
        return best ? { from: posicaoID(best.from), to: posicaoID(best.to) } : null;
    }

    // Nível 5: busca maior profundidade (depth 3)
function botLevel5(color) {
    const state = buildStateFromDOM();
    let moves = getAllPseudoMovesFromState(state, color);

    // 1️⃣ Resolver xeque é obrigatório
    moves = filterMovesResolvingCheck(state, moves, color);
    if (moves.length === 0) return null;

    const enemy = color === 'white' ? 'black' : 'white';

    // 2️⃣ Filtrar movimentos que penduram peças (anti-blunder forte)
    //     Verifica se a peça movida fica pendurada (atacada sem defesa) ou se perde material óbvio
    const safeMoves = [];
    for (const m of moves) {
        const piece = state.board[m.from.y][m.from.x];
        if (!piece) continue;

        const pieceValue = VALOR[piece.type] || 0;

        const info = makeMoveState(state, m);
        let isBlunder = false;

        // 2.1 Verifica se a peça movida fica pendurada (atacada sem defesa adequada)
        if (isPieceHanging(state, color, m.to.x, m.to.y)) {
            // Penaliza extra se peça valiosa
            if (pieceValue > 1) {
                isBlunder = true;
            }
        } else {
            // 2.2 Verifica trocas ruins: se o inimigo pode capturar de volta com peça menor ou igual
            const enemyAttacks = getAllPseudoMovesFromState(state, enemy);
            for (const attack of enemyAttacks) {
                if (attack.to.x === m.to.x && attack.to.y === m.to.y) {
                    const attacker = state.board[attack.from.y][attack.from.x];
                    const attackerValue = attacker ? (VALOR[attacker.type] || 0) : 0;

                    // Se atacante menor ou igual, e não recapturável facilmente
                    if (attackerValue <= pieceValue) {
                        const defenders = countAttackersState(state, m.to.x, m.to.y, color);
                        const attackers = countAttackersState(state, m.to.x, m.to.y, enemy);
                        if (attackers > defenders || attackerValue < pieceValue) {
                            isBlunder = true;
                            break;
                        }
                    }
                }
            }
        }

        // 2.3 Verifica se o movimento deixa outras peças próprias penduradas (cheque global anti-blunder)
        if (!isBlunder) {
            for (let y = 0; y < 8; y++) {
                for (let x = 0; x < 8; x++) {
                    const p = state.board[y][x];
                    if (p && p.color === color && (x !== m.to.x || y !== m.to.y)) { // Ignora a movida (já checada)
                        const pVal = VALOR[p.type] || 0;
                        if (pVal > 1 && isPieceHanging(state, color, x, y)) {
                            isBlunder = true;
                            break;
                        }
                    }
                }
                if (isBlunder) break;
            }
        }

        undoMoveState(state, m, info);

        if (!isBlunder) {
            safeMoves.push(m);
        }
    }

    // Preferir movimentos seguros se existirem; senão fallback para todos (mas ordenados)
    if (safeMoves.length > 0) {
        moves = safeMoves;
    }

    // 3️⃣ Ordenação agressiva: capturas, checks, centro, e penaliza riscos
    moves.sort((a, b) => {
        const scoreA = quickScoreMoveState(state, a, color);
        const scoreB = quickScoreMoveState(state, b, color);
        return scoreB - scoreA; // descendente
    });

    // 4️⃣ Evitar mates em 1 do oponente (prioridade máxima)
    const nonBlunderMoves = [];
    for (const m of moves) {
        const info = makeMoveState(state, m);

        let allowsMateInOne = false;
        const enemyReplies = getAllPseudoMovesFromState(state, enemy);
        const legalReplies = enemyReplies.filter(r => {
            const info2 = makeMoveState(state, r);
            const inCheck = isKingInCheckState(state, enemy);
            undoMoveState(state, r, info2);
            return !inCheck;
        });
        for (const reply of legalReplies) {
            const info2 = makeMoveState(state, reply);
            const resolving = filterMovesResolvingCheck(state, getAllPseudoMovesFromState(state, color), color);
            if (isKingInCheckState(state, color) && resolving.length === 0) {
                allowsMateInOne = true;
                undoMoveState(state, reply, info2);
                break;
            }
            undoMoveState(state, reply, info2);
        }

        undoMoveState(state, m, info);

        if (!allowsMateInOne) {
            nonBlunderMoves.push(m);
        }
    }

    // Usar só movimentos que não permitem mate em 1
    if (nonBlunderMoves.length > 0) {
        moves = nonBlunderMoves;
        moves.sort((a, b) => quickScoreMoveState(state, b, color) - quickScoreMoveState(state, a, color));
    }

    // 5️⃣ Busca minimax com profundidade fixa + quiescence básica para capturas
    const DEPTH = 3;
    const MAX_CANDIDATES = Math.min(16, moves.length); // Aumentado para mais precisão anti-blunder

    let bestMove = null;
    let bestVal = -Infinity;

    for (let i = 0; i < MAX_CANDIDATES && i < moves.length; i++) {
        const m = moves[i];
        const info = makeMoveState(state, m);

        let val;
        try {
            val = minimaxState(
                state,
                color,           // originalColor
                enemy,           // currentColor após movimento
                DEPTH - 1,
                -Infinity,
                Infinity
            );
        } finally {
            undoMoveState(state, m, info);
        }

        if (val > bestVal) {
            bestVal = val;
            bestMove = m;
        }
    }

    // Fallback seguro
    if (!bestMove && moves.length > 0) {
        bestMove = moves[0];
    }

    return bestMove
        ? { from: posicaoID(bestMove.from), to: posicaoID(bestMove.to) }
        : null;
}

/**
 * Função Minimax Robusta para suportar o Level 5 e 6
 */
function minimaxState(state, originalColor, currentColor, depth, alpha, beta) {
    // Caso base
    if (depth <= 0) {
        return evaluateState(state, originalColor);
    }

    const moves = getAllPseudoMovesFromState(state, currentColor);
    
    const legalMoves = moves.filter(m => {
        const info = makeMoveState(state, m);
        const inCheck = isKingInCheckState(state, currentColor);
        undoMoveState(state, m, info);
        return !inCheck;
    });

    if (legalMoves.length === 0) {
        if (isKingInCheckState(state, currentColor)) {
            // Se o atual for o bot, ele levou mate (-100000). Se for o inimigo, bot ganhou (+100000).
            return (currentColor === originalColor ? -100000 : 100000);
        }
        return 0; // Empate (afogamento)
    }

    const maximizing = (currentColor === originalColor);
    let bestVal = maximizing ? -Infinity : Infinity;

    // Ordenação básica dentro da recursão para acelerar a poda
    legalMoves.sort((a, b) => {
        const valA = getCapturedValueState(state, a);
        const valB = getCapturedValueState(state, b);
        return valB - valA;
    });

    for (const m of legalMoves) {
        const info = makeMoveState(state, m);
        const val = minimaxState(
            state, 
            originalColor, 
            (currentColor === 'white' ? 'black' : 'white'), 
            depth - 1, 
            alpha, 
            beta
        );
        undoMoveState(state, m, info);

        if (maximizing) {
            bestVal = Math.max(bestVal, val);
            alpha = Math.max(alpha, val);
        } else {
            bestVal = Math.min(bestVal, val);
            beta = Math.min(beta, val);
        }

        if (alpha >= beta) break; // Poda Alpha-Beta
    }
    return bestVal;
}

function getBestMoveFromStockfish(fen, timeMs = 500) { 
    if (stockfishBusy) return Promise.resolve(null);

    stockfishBusy = true;

    return new Promise(resolve => {
        pendingResolve = resolve;
        stockfish.postMessage(`position fen ${fen}`);
        stockfish.postMessage(`go movetime ${timeMs}`);
    });
}




// Nível 6: MONSTRO TÁTICO IMPOSSÍVEL DE VENCER — SEM ERROS, PREVÊ CONTRA-JOGADAS, XEQUES SÓ ÚTEIS
    async function botLevel6(color) {
        // checar turno atual (definido em TabuleiroXadrez.js)
        if (typeof turnoAtual !== 'undefined' && turnoAtual !== color) return false;
        if (!stockfishReady || stockfishBusy) return false;

        const state = buildStateFromDOM();
        const fen = stateToFEN(state, color);

        console.log("♟️ Stockfish pensando:", fen);

        const moveStr = await getBestMoveFromStockfish(fen, 1500);
        if (!moveStr || moveStr === '(none)') return false;

        const from = moveStr.slice(0,2);
        const to = moveStr.slice(2,4);

        const casaOrigem = document.querySelector(`.casa[data-coord="${from}"]`);
        const casaDestino = document.querySelector(`.casa[data-coord="${to}"]`);
        const peca = casaOrigem?.querySelector('.peca');

        if (peca && casaDestino) {
            moverPeca(casaOrigem, casaDestino, peca);
            return true;
        }
        return false;
    }



    // interface pública: executa o movimento caso o nível retorne {from,to}
    window.playBot = async function(level, color) {
        if (window.gameOver) return false;

        const fns = {
            1: botLevel1,
            2: botLevel2,
            3: botLevel3,
            4: botLevel4,
            5: botLevel5,
            6: botLevel6
        };

        const fn = fns[level] || botLevel1;
        const result = await fn(color);

        // Se o bot já executou a jogada (nivel 6 retorna boolean), apenas retorna
        if (result === true) return true;
        if (!result) return false;

        // Se recebeu um objeto {from,to}, executa o movimento no DOM
        if (typeof result === 'object' && result.from && result.to) {
            const casaOrigem = document.querySelector(`.casa[data-coord="${result.from}"]`);
            const casaDestino = document.querySelector(`.casa[data-coord="${result.to}"]`);
            const peca = casaOrigem?.querySelector('.peca');
            if (casaOrigem && casaDestino && peca) {
                moverPeca(casaOrigem, casaDestino, peca);
                return true;
            }
            return false;
        }

        return !!result;
    };

    // também expõe função para obter movimentos legais (útil para testes)
    window.getAllLegalMovesFor = getAllLegalMoves;

})();

