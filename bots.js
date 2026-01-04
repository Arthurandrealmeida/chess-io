// bots.js
// Implementa 6 níveis de bots e expõe `playBot(level, color)`
// Uso: chamar `playBot(1, 'black')` para jogar com o bot nível 1 nas pretas.

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
        return { board };
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
        if (p.type === 'king') {
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const nx = x + dx;
                    const ny = y + dy;
                    if (inBounds(nx, ny)) {
                        const t = state.board[ny][nx];
                        if (!t || t.color !== color) {
                            moves.push({ from: { x, y }, to: { x: nx, y: ny } });
                        }
                    }
                }
            }
            return moves;
        }

        return moves;
    }


    function getAllPseudoMovesFromState(state, color){
        const out = [];
        for (let y=0;y<8;y++) for (let x=0;x<8;x++){ const p = state.board[y][x]; if (!p || p.color!==color) continue; const m = genPieceMovesState(state,x,y); m.forEach(mm=> out.push(mm)); }
        return out;
    }

    function makeMoveState(state, move){
        const fx = move.from.x, fy = move.from.y, tx = move.to.x, ty = move.to.y;
        const moved = state.board[fy][fx];
        const captured = state.board[ty][tx];
        state.board[ty][tx] = moved;
        state.board[fy][fx] = null;
        // simple promotion
        if (moved && moved.type==='pawn' && (ty===0||ty===7)) state.board[ty][tx] = {type:'queen', color:moved.color};
        return {moved, captured};
    }

    function undoMoveState(state, move, info){
        const fx = move.from.x, fy = move.from.y, tx = move.to.x, ty = move.to.y;
        state.board[fy][fx] = info.moved;
        state.board[ty][tx] = info.captured || null;
    }

    function evaluateState(state, color){
        let score = 0;
        for (let y=0;y<8;y++) for (let x=0;x<8;x++){ const p = state.board[y][x]; if(!p) continue; const v = VALOR[p.type]||0; score += (p.color===color)? v : -v; if (x>=2 && x<=5 && y>=2 && y<=5) score += (p.color===color)? 0.3*v : -0.3*v; }
        return score;
    }



    function contarAtacantesDOM(alvoX, alvoY, corAtacante) {
        let total = 0;

        const alvoCoord =
            String.fromCharCode(97 + alvoX) + (8 - alvoY);

        const casas = document.querySelectorAll('.casa');

        for (const casa of casas) {
            const peca = casa.querySelector('.peca');
            if (!peca) continue;

            const cor =
                peca.classList.contains('white') ? 'white' : 'black';

            if (cor !== corAtacante) continue;

            const from = casa.dataset.coord;

            let moves = [];

            if (peca.src.includes('peao')) moves = movimentosPeao(from, cor);
            else if (peca.src.includes('torre')) moves = movimentosTorre(from, cor);
            else if (peca.src.includes('bispo')) moves = movimentosBispo(from, cor);
            else if (peca.src.includes('cavalo')) moves = movimentosCavalo(from, cor);
            else if (peca.src.includes('rainha')) moves = movimentosRainha(from, cor);
            else if (peca.src.includes('rei')) moves = movimentosRei(from, cor);

            // verifica se ataca a casa alvo
            if (moves.includes(alvoCoord)) {
                total++;
            }
        }

        return total;
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


    function quickScoreMove(move, color) {
        // pontuação rápida: captura, centro, cheque, risco de perda
        const fromEl = document.querySelector(`.casa[data-coord="${move.from}"]`);
        const mover = fromEl?.querySelector('.peca');
        const moverType = mover ? pieceTypeFromSrc(mover.src) : null;
        const moverVal = moverType ? (VALOR[moverType] || 0) : 0;

        const capturedVal = getCapturedValue(move);
        let score = (capturedVal - moverVal * 0.1) * 10; // base

        if (CENTER_SQUARES.includes(move.to)) score += 30;
        if (isCheckMove(move, color)) score += 200;

        // penaliza movimentos que deixam a peça exposta (heurística barata)
        const pos = posiçãoNumerica(move.to);
        const enemy = color === 'white' ? 'black' : 'white';
        const atacantes = contarAtacantesDOM(pos.x, pos.y, enemy);
        const defensores = contarAtacantesDOM(pos.x, pos.y, color);
        if (atacantes > defensores) {
            score -= (atacantes - defensores) * moverVal * 40; // penalidade proporcional
        }

        // promova captura de peças de alto valor
        score += capturedVal * 5;

        return score;
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
        const king = findKingPosition(state, color);
        if (!king) return false; // sem rei (situação inválida) trate como não em xeque
        const enemy = color==='white'?'black':'white';
        return countAttackersState(state, king.x, king.y, enemy) > 0;
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

    function minimaxState(state, originalColor, currentColor, depth, alpha, beta, mobilityWeight){
        if (depth <= 0) return evaluateState(state, originalColor) + (mobilityWeight||0)*getAllPseudoMovesFromState(state, currentColor).length;
        const moves = getAllPseudoMovesFromState(state, currentColor);
        if (moves.length===0) return evaluateState(state, originalColor);
        const maximizing = (currentColor === originalColor);
        let bestVal = maximizing ? -Infinity : Infinity;
        // order by capture value desc
        moves.sort((a,b)=> getCapturedValueState(state, b) - getCapturedValueState(state, a));
        for (const m of moves){
            const info = makeMoveState(state, m);
            try{
                const val = minimaxState(state, originalColor, (currentColor==='white'?'black':'white'), depth-1, alpha, beta, mobilityWeight);
                if (maximizing){ bestVal = Math.max(bestVal, val); alpha = Math.max(alpha, val); }
                else { bestVal = Math.min(bestVal, val); beta = Math.min(beta, val); }
                if (alpha >= beta) break;
            } finally { undoMoveState(state, m, info); }
        }
        return bestVal;
    }

    function avaliarTabuleiro(_, corBot) {
        const valores = {
            pawn: 100,
            knight: 320,
            bishop: 330,
            rook: 500,
            queen: 900,
            king: 20000
        };

        let score = 0;

        const casas = document.querySelectorAll('.casa');

        for (const casa of casas) {
            const pecaEl = casa.querySelector('.peca');
            if (!pecaEl) continue;

            const tipo = pieceTypeFromSrc(pecaEl.src);
            if (!tipo) continue;

            const pecaCor = pecaEl.classList.contains('white') ? 'white' : 'black';
            const sinal = (pecaCor === corBot) ? 1 : -1;
            const valorBase = valores[tipo];

            score += sinal * valorBase;

            const coord = casa.dataset.coord; // ex: "e4"
            const x = coord.charCodeAt(0) - 97;
            const y = 8 - parseInt(coord[1]);

            // 🔹 centro
            if (x >= 2 && x <= 5 && y >= 2 && y <= 5) {
                score += sinal * 15;
            }

            // 🔹 atacantes vs defensores
            const atacantes = contarAtacantesDOM(x, y, pecaCor === 'white' ? 'black' : 'white');
            const defensores = contarAtacantesDOM(x, y, pecaCor);

            if (atacantes > defensores) {
                score -= sinal * valorBase * 0.6;
            }

            // 🔹 dama exposta
            if (tipo === 'queen' && atacantes > 0 && defensores === 0) {
                score -= sinal * 250;
            }

            // 🔹 rei inseguro
            if (tipo === 'king' && atacantes > defensores) {
                score -= sinal * 400;
            }
        }

        return score;
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

        if (isKingInCheckState(state, color)){
            const resolving = filterMovesResolvingCheck(state, moves, color);
            if (resolving.length === 0) return null;
            moves = resolving;
        }

        // evita movimentos que deixam a peça imediatamente capturável por valor maior
        const safe = moves.filter(m => {
            const mover = state.board[m.from.y][m.from.x];
            const moverVal = mover ? (VALOR[mover.type]||0) : 0;
            // simula
            const info = makeMoveState(state, m);
            let vulnerable = false;
            const enemy = color==='white'?'black':'white';
            const enemyMoves = getAllPseudoMovesFromState(state, enemy);
            for (const em of enemyMoves){
                if (em.to.x===m.to.x && em.to.y===m.to.y){
                    const cap = state.board[em.from.y][em.from.x];
                    const capVal = cap ? (VALOR[cap.type]||0) : 0;
                    if (capVal > moverVal) { vulnerable = true; break; }
                }
            }
            undoMoveState(state, m, info);
            return !vulnerable;
        });

        if (safe.length>0) moves = safe;

        // prefer capturas e centro
        moves.sort((a,b)=> getCapturedValueState(state,b) - getCapturedValueState(state,a));
        const top = moves.slice(0, Math.min(8, moves.length));
        const centers = top.filter(m => { const x=m.to.x, y=m.to.y; return x>=2 && x<=5 && y>=2 && y<=5; });
        const chosen = centers.length>0 ? centers[Math.floor(Math.random()*centers.length)] : top[Math.floor(Math.random()*top.length)];
        return { from: posicaoID(chosen.from), to: posicaoID(chosen.to) };
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
        // marca que estamos entrando em busca (para getAllLegalMoves usar pseudo-legais)
        if (typeof window !== 'undefined') window.__searchDepth = (window.__searchDepth || 0) + 1;
        let result = null;
        try {
            const moves = getAllLegalMoves(currentColor);

            if (depth <= 0) {
                result = evaluateBoardFor(originalColor, mobilityWeight, moves.length, depth);
                return result;
            }

            if (moves.length === 0) {
                if (estaEmXeque(currentColor)) result = (currentColor === originalColor ? -10000 : 10000);
                else result = 0;
                return result;
            }

            const maximizing = (currentColor === originalColor);
            let bestVal = maximizing ? -Infinity : Infinity;

            // 🔥 FILTRO DE LANCES
            let maxMoves = 12;
            if (depth === 3) maxMoves = 8;
            if (depth >= 4) maxMoves = 6;

            const filteredMoves = filtrarMelhoresLances(moves, maxMoves);

            for (const m of filteredMoves) {
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

                    if (maximizing) {
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

            result = bestVal;
            return result;
        } finally {
            // sair do contexto de busca — garante decremento mesmo em returns
            if (typeof window !== 'undefined') window.__searchDepth = Math.max(0, (window.__searchDepth || 1) - 1);
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
        const depth = 2;
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
    function botLevel5(color){
        const state = buildStateFromDOM();
        let moves = getAllPseudoMovesFromState(state, color);
        if (moves.length === 0) return null;

        if (isKingInCheckState(state, color)){
            const resolving = filterMovesResolvingCheck(state, moves, color);
            if (resolving.length === 0) return null;
            moves = resolving;
        }

        // evita suicídios óbvios (estado apenas)
        const safe = moves.filter(m => {
            const mover = state.board[m.from.y][m.from.x];
            const moverVal = mover ? (VALOR[mover.type]||0) : 0;
            const info = makeMoveState(state, m);
            let vulnerable = false;
            const enemy = color === 'white' ? 'black' : 'white';
            const emoves = getAllPseudoMovesFromState(state, enemy);
            for (const em of emoves){
                if (em.to.x===m.to.x && em.to.y===m.to.y){
                    const cap = state.board[em.from.y][em.from.x];
                    const capVal = cap ? (VALOR[cap.type]||0) : 0;
                    if (capVal > moverVal){ vulnerable = true; break; }
                }
            }
            undoMoveState(state, m, info);
            return !vulnerable;
        });
        if (safe.length>0) moves = safe;

        // ordena por heurística e mantém top
        const scored = moves.map(m=>({m, s: quickScoreMoveState(state,m,color)})).sort((a,b)=>b.s-a.s);
        const TOP = Math.min(6, scored.length);
        const candidates = scored.slice(0, TOP).map(x=>x.m);

        let best = null; let bestVal = -Infinity;
        const enemy = color === 'white' ? 'black' : 'white';
        const depth = 3;
        for (const m of candidates){
            const info = makeMoveState(state, m);
            try{
                const val = minimaxState(state, color, enemy, depth-1, -Infinity, Infinity, 0.05);
                if (val > bestVal){ bestVal = val; best = m; }
            } finally { undoMoveState(state, m, info); }
        }
        return best ? { from: posicaoID(best.from), to: posicaoID(best.to) } : null;
    }

    // Nível 6: versão mais forte (depth 4 com seleção e pequenas variações)
    function botLevel6(color){
        const state = buildStateFromDOM();
        let moves = getAllPseudoMovesFromState(state, color);
        if (moves.length === 0) return null;

        if (isKingInCheckState(state, color)){
            const resolving = filterMovesResolvingCheck(state, moves, color);
            if (resolving.length === 0) return null;
            moves = resolving;
        }

        // remove suicídios óbvios
        moves = moves.filter(m => {
            const mover = state.board[m.from.y][m.from.x];
            const moverVal = mover ? (VALOR[mover.type]||0) : 0;
            const info = makeMoveState(state, m);
            let vulnerable = false;
            const enemy = color === 'white' ? 'black' : 'white';
            const emoves = getAllPseudoMovesFromState(state, enemy);
            for (const em of emoves){ if (em.to.x===m.to.x && em.to.y===m.to.y){ const cap = state.board[em.from.y][em.from.x]; const capVal = cap ? (VALOR[cap.type]||0) : 0; if (capVal > moverVal){ vulnerable = true; break; } } }
            undoMoveState(state, m, info);
            return !vulnerable;
        });

        // pontua e seleciona candidatos
        const scored = moves.map(m=>({m, s: quickScoreMoveState(state,m,color)})).sort((a,b)=>b.s-a.s);
        const checks = []; // sem verificação de xeque global — mantemos heurística apenas
        let candidates = scored.slice(0, Math.min(12, scored.length)).map(x=>x.m);

        let depth = 4;
        if (candidates.length > 20) depth = 3;
        if (candidates.length > 28) depth = 2;

        let best = null; let bestVal = -Infinity;
        const enemy = color === 'white' ? 'black' : 'white';
        for (const m of candidates){
            const info = makeMoveState(state, m);
            try{
                let val = evaluateState(state, color);
                val += minimaxState(state, color, enemy, depth-1, -Infinity, Infinity, depth <= 2 ? 0.03 : 0);
                if (Math.random() < 0.05) val += (Math.random()-0.5)*10; // pequena aleatoriedade
                if (val > bestVal){ bestVal = val; best = m; }
            } finally { undoMoveState(state, m, info); }
        }
        return best ? { from: posicaoID(best.from), to: posicaoID(best.to) } : null;
    }





	// interface pública
	window.playBot = function(level, color){
		const lvl = Number(level);
		const fns = {
			1: botLevel1,
			2: botLevel2,
			3: botLevel3,
			4: botLevel4,
			5: botLevel5,
			6: botLevel6
		};
		const fn = fns[lvl] || botLevel1;
        // não joga se o jogo já terminou
        if (typeof window !== 'undefined' && window.gameOver) return false;
        const move = fn(color);
		if (!move) return false;
		return performMoveDOM(move);
	};

	// também expõe função para obter movimentos legais (útil para testes)
	window.getAllLegalMovesFor = getAllLegalMoves;

})();

