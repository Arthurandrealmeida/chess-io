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
			brut = brut.filter(dest => movimentoEhValido(from, dest, cor));
			brut.forEach(dest => todas.push({from, to: dest}));
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
		const moves = getAllLegalMoves(color);
		if (moves.length === 0) return null;
		return moves[Math.floor(Math.random()*moves.length)];
	}

	// Nível 2: prefere capturas (aleatória entre capturas)
	function botLevel2(color){
		const moves = getAllLegalMoves(color);
		if (moves.length === 0) return null;
		const captures = moves.filter(isCaptureMove);
		return (captures.length>0) ? captures[Math.floor(Math.random()*captures.length)] : botLevel1(color);
	}

	// Nível 3: captura por maior valor (senão aleatório)
	function botLevel3(color){
		const moves = getAllLegalMoves(color);
		if (moves.length === 0) return null;
		let best = null;
		let bestVal = -Infinity;
		moves.forEach(m => {
			const v = getCapturedValue(m);
			if (v > bestVal) { bestVal = v; best = m; }
		});
		return (bestVal>0) ? best : botLevel1(color);
	}

	// Nível 4: escolhe jogada com melhor ganho material imediato (simula uma jogada)
	function botLevel4(color){
		const moves = getAllLegalMoves(color);
		if (moves.length === 0) return null;
		let best = null; let bestScore = -Infinity;
		moves.forEach(m => {
			const sc = simulateMoveAndEval(m, color);
			if (sc > bestScore) { bestScore = sc; best = m; }
		});
		return best;
	}

	// Nível 5 e 6: minimax depth 2 (com avaliação simples). Nível 6 adiciona peso de mobilidade.
	function evaluateAfterSim(move, color, mobilityWeight){
		// retorna avaliação do tabuleiro para `color` após `move`
		return simulateMoveAndEval(move, color) + (mobilityWeight||0) * mobilityAfterSim(move, color);
	}

	function mobilityAfterSim(move, color){
		// número de movimentos legais para `color` após a jogada (simulação breve)
		const casaOrigem = document.querySelector(`.casa[data-coord="${move.from}"]`);
		const casaDestino = document.querySelector(`.casa[data-coord="${move.to}"]`);
		const peca = casaOrigem?.querySelector('.peca');
		if (!peca || !casaOrigem || !casaDestino) return 0;
		const captured = casaDestino.querySelector('.peca');

		casaDestino.appendChild(peca);
		if (captured) captured.remove();

		const myMoves = getAllLegalMoves(color).length;

		// desfazer
		casaOrigem.appendChild(peca);
		if (captured) casaDestino.appendChild(captured);

		return myMoves;
	}

	function botMinimaxDepth2(color, mobilityWeight){
		const moves = getAllLegalMoves(color);
		if (moves.length === 0) return null;
		let best = null; let bestMin = -Infinity;

		moves.forEach(m => {
			// simula minha jogada
			const casaOrigem = document.querySelector(`.casa[data-coord="${m.from}"]`);
			const casaDestino = document.querySelector(`.casa[data-coord="${m.to}"]`);
			const peca = casaOrigem?.querySelector('.peca');
			if (!peca) return;
			const captured = casaDestino.querySelector('.peca');

			casaDestino.appendChild(peca);
			if (captured) captured.remove();

			// gerar todas as respostas do oponente
			const enemy = (color === 'white') ? 'black' : 'white';
			const replies = getAllLegalMoves(enemy);
			let worstForMe = Infinity;

			if (replies.length === 0) {
				// se o oponente não tem resposta, avalia posição atual
				worstForMe = materialScoreFor(color) + (mobilityWeight||0)*getAllLegalMoves(color).length;
			} else {
				replies.forEach(r => {
					const casaOrigemR = document.querySelector(`.casa[data-coord="${r.from}"]`);
					const casaDestinoR = document.querySelector(`.casa[data-coord="${r.to}"]`);
					const pecaR = casaOrigemR?.querySelector('.peca');
					if (!pecaR) return;
					const capturedR = casaDestinoR.querySelector('.peca');

					casaDestinoR.appendChild(pecaR);
					if (capturedR) capturedR.remove();

					const val = materialScoreFor(color) + (mobilityWeight||0)*getAllLegalMoves(color).length;

					casaOrigemR.appendChild(pecaR);
					if (capturedR) casaDestinoR.appendChild(capturedR);

					if (val < worstForMe) worstForMe = val;
				});
			}

			// desfazer minha jogada
			casaOrigem.appendChild(peca);
			if (captured) casaDestino.appendChild(captured);

			if (worstForMe > bestMin) { bestMin = worstForMe; best = m; }
		});

		return best;
	}

	function botLevel5(color){
		return botMinimaxDepth2(color, 0);
	}

	function botLevel6(color){
		return botMinimaxDepth2(color, 0.08); // valor de mobilidade pequeno somado à material
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
		const move = fn(color);
		if (!move) return false;
		return performMoveDOM(move);
	};

	// também expõe função para obter movimentos legais (útil para testes)
	window.getAllLegalMovesFor = getAllLegalMoves;

})();

