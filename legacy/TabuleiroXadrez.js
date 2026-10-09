//==================================
//VARIAVEIS GLOBAIS
//==================================
let movimentosPossiveis = []; // lista de casas válidas da peça selecionada
let enPassantAlvo = null; // guarda a posição alvo para En Passant {square: 'e6', pawnColor: 'black'} e para as brancas seria {square: 'e3', pawnColor: 'white'}
let historicoPosicoes = {}; // Objeto que guardará: {'string_do_tabuleiro': quantidade}
let turnoAtual = 'white'; // O jogo sempre começa com as brancas
let contador50Lances = 0; // Conta lances sem captura ou movimento de peão
// flag global para indicar fim de jogo (xeque-mate, empate, etc.)
window.gameOver = false;


 const estadoJogo = {
        reiBrancoMoveu: false,
        torreBrancaEsqMoveu: false,
        torreBrancaDirMoveu: false,
        reiPretoMoveu: false,
        torrePretaEsqMoveu: false,
        torrePretaDirMoveu: false
    };


//==================================
//CONFIGURAÇÃO DO TABULEIRO
//==================================
const tabuleiro = document.getElementById('board');

    const letras = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']; 
    const numeros = ['8', '7', '6', '5', '4', '3', '2', '1'];

    const imgpath = {
    'black': {
        'pawn': 'img/peaoPreto.png', 
        'rook': 'img/torrePreto.png',
        'knight': 'img/cavaloPreto.png',
        'bishop': 'img/bispoPreto.png',
        'queen': 'img/rainhaPreto.png',
        'king': 'img/reiPreto.png',
    },
    'white': {
        'pawn': 'img/peaoBranco.png', 
        'rook': 'img/torreBranco.png',
        'knight': 'img/cavaloBranco.png',
        'bishop': 'img/bispoBranco.png',
        'queen': 'img/rainhaBranco.png',
        'king': 'img/reiBranco.png',
    }
};

//==================================
//CRIAÇÃO DO TABULEIRO
//==================================

function criarTabuleiro() {
    for (let linha = 0; linha < 8; linha++) {
        for (let coluna = 0; coluna < 8; coluna++) { 
            const casa = document.createElement('div');
            casa.classList.add('casa');
            casa.setAttribute('data-coord', letras[coluna] + numeros[linha]);

            if ((linha + coluna) % 2 === 0) {
                casa.classList.add('branca');
            } else {
                casa.classList.add('preta');
            }
            tabuleiro.appendChild(casa);

            let tipodaPeca = null; 
            let cordaPeca = null;

            if (linha === 1){ tipodaPeca = 'pawn'; cordaPeca = 'black'; }
            if (linha === 6){ tipodaPeca = 'pawn'; cordaPeca = 'white'; }
            if (linha === 0 || linha === 7) { 
                cordaPeca = (linha === 0) ? 'black' : 'white';
                if (coluna === 1 || coluna === 6) { tipodaPeca = 'knight'; }
                if (coluna === 0 || coluna === 7) { tipodaPeca = 'rook'; }
                if (coluna === 2 || coluna === 5) { tipodaPeca = 'bishop'; }
                if (coluna === 3) { tipodaPeca = 'queen'; }
                if (coluna === 4) { tipodaPeca = 'king'; }
            }

            if (tipodaPeca) { // Se há uma peça para colocar
                const peca = document.createElement('img'); // Usando img para representar a peça
                peca.src = imgpath[cordaPeca][tipodaPeca]; // Definindo o caminho da imagem
                peca.classList.add('peca');
                // atributos úteis para seleção e debug
                peca.setAttribute('data-tipo', tipodaPeca);
                peca.setAttribute('data-cor', cordaPeca);
                casa.appendChild(peca);
            }
        }
    }

    // quando (re)cria o tabuleiro, zera flag de fim de jogo
    window.gameOver = false;
}

//==================================
//funções de DRAG & DROP(arrastar e soltar)
//==================================

// Torna todas as peças arrastáveis
function tornarPecasArrastaveis() {
    document.querySelectorAll('.peca').forEach(peca => {
        peca.setAttribute('draggable', true);

        peca.addEventListener('dragstart', (e) => {
            const cor = corDaPeca(peca);

            // ❌ NÃO use preventDefault aqui
            if (cor !== turnoAtual || window.gameOver) {
                return;
            }

            e.dataTransfer.effectAllowed = 'move'; // 🔑 IMPORTANTE

            const casaOrigem = peca.parentElement;
            const coordAtual = casaOrigem.dataset.coord;

            if (peca.src.includes('peao')) movimentosPossiveis = movimentosPeao(coordAtual, cor);
            else if (peca.src.includes('torre')) movimentosPossiveis = movimentosTorre(coordAtual, cor);
            else if (peca.src.includes('bispo')) movimentosPossiveis = movimentosBispo(coordAtual, cor);
            else if (peca.src.includes('cavalo')) movimentosPossiveis = movimentosCavalo(coordAtual, cor);
            else if (peca.src.includes('rei')) movimentosPossiveis = movimentosRei(coordAtual, cor);
            else if (peca.src.includes('rainha')) movimentosPossiveis = movimentosRainha(coordAtual, cor);

            movimentosPossiveis = movimentosPossiveis.filter(dest =>
                movimentoEhValido(coordAtual, dest, cor)
            );

            // 🔑 obrigatório no Chrome
            e.dataTransfer.setData('text/plain', coordAtual);

            pecaSelecionada = peca;
            casaSelecionada = casaOrigem;
            peca.style.opacity = '0.6';
        });


        peca.addEventListener('dragend', () => {
            if (pecaSelecionada) pecaSelecionada.style.opacity = '1';
        });
    });
}

// Adiciona eventos nas casas (será chamado APÓS a criação do tabuleiro)
function adicionarEventosCasas() {
    document.querySelectorAll('.casa').forEach(casa => {
        casa.addEventListener('dragover', (e) => {
            e.preventDefault(); // permite drop
        });

        casa.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!pecaSelecionada) return;

            const coordOrigem = e.dataTransfer.getData('text/plain');
            const coordDestino = casa.dataset.coord;

            if (movimentosPossiveis.includes(coordDestino)) {
                moverPeca(casaSelecionada, casa, pecaSelecionada);
            }

            resetarSelecao();
        });
    });
}

//==================================
//Função do Turno
//==================================

function alternarTurno() {
    
    turnoAtual = (turnoAtual === 'white') ? 'black' : 'white';

    
    
    // Verifica a regra dos 50 lances (100 "meios-lances")
    if (contador50Lances >= 100) {
        alert("Empate pela regra dos 50 lances!");
        // marca fim de jogo
        window.gameOver = true;
    }
}

//==================================
//FUNÇÕES DE COORDENADAS NUMÉRICAS
//==================================

function posiçãoNumerica(coord) { //ex: 'a2' -> {x:0, y:6}
    const letra = coord[0]; // pega a letra da coordenada ex: 'a' de 'a2'
    const numero = coord[1]; // pega o número da coordenada ex: '2' de 'a2'

    return { 
        x: letras.indexOf(letra), //converte letra em número o indexOf retorna a posição dela no array ex: 'a' = 0  --coluna--
        y: numeros.indexOf(numero) //converte número em índice o indexOf retorna a posição dela no array ex: '8' = 0 por que 8 é a primeira linha do tabuleiro  --linha--

        //quanto MAIOR o y, mais para BAIXO no tabuleiro
        //quanto MENOR o y, mais para CIMA no tabuleiro
    }
}

function posicaoID(pos){ // função inversa da posiçãoNumerica {x:0, y:6} -> 'a2'
    return letras[pos.x] + numeros[pos.y]; //converte a posição numérica de volta para a coordenada alfanumérica
}

function posicaoNoTabu(pos) { //verifica se a posição está dentro do tabuleiro
    return pos.x >= 0 && pos.x < 8 && pos.y >= 0 && pos.y < 8; //retorna true se a posição estiver dentro do tabuleiro
}

function temPecaNaPosicao(pos) { //1. {x:0, y:6} 2. vira 'a2' 3. acha a .casa[data-coord="a2"] 4. procura .peca dentro 5. retorna: null → casa vazia {element, color} → casa ocupada

    const coord = posicaoID(pos); //converte a posição numérica para a coordenada alfanumérica
    const casa = document.querySelector(`.casa[data-coord="${coord}"]`); //seleciona a casa com a coordenada dada
    if (!casa) return null; //se a casa não existir, retorna null

    const peca = casa.querySelector('.peca'); //seleciona a peça dentro da casa
    if (!peca) return null; //se não houver peça, retorna null

    return { //se houver peça, retorna um objeto com a peça e sua cor
        element: peca, //elemento da peça (img)
        color: peca.src.includes('Preto') ? 'black' : 'white' //verifica a cor da peça pelo nome do arquivo da imagem
    };
}


criarTabuleiro();
// Após criar o tabuleiro, anexar listeners nas casas e tornar as peças arrastáveis
adicionarEventosCasas();
tornarPecasArrastaveis();

//==================================
//MOVIMENTO DAS PEÇAS
//==================================

let pecaSelecionada = null; //guarda a img da peça selecionada
let casaSelecionada = null;  //guarda a casa onde a peça estava antes de ser movida a div.casa

function corDaPeca(peca) { //retorna a cor da peça ('white' ou 'black')
    return peca.src.includes('Branco') ? 'white' : 'black'; //verifica a cor da peça pelo nome do arquivo da imagem
}


tabuleiro.addEventListener('click', (e) => {
    const casaClicada = e.target.closest('.casa');
    if (!casaClicada) return;
    const pecaNaCasa = casaClicada.querySelector('.peca');

    if (!pecaSelecionada) {
        if (!pecaNaCasa) return;

        // --- VERIFICAÇÃO DE TURNO ---

        const corPeca = corDaPeca(pecaNaCasa);
        if (corPeca !== turnoAtual) {
            console.log("Não é o seu turno! Vez das: " + (turnoAtual === 'white' ? "Brancas" : "Pretas"));
            return; 
        }

        const coordAtual = casaClicada.dataset.coord;
        const cor = corDaPeca(pecaNaCasa);

        // Calcula movimentos brutos
        if (pecaNaCasa.src.includes('peao')) movimentosPossiveis = movimentosPeao(coordAtual, cor);
        else if (pecaNaCasa.src.includes('torre')) movimentosPossiveis = movimentosTorre(coordAtual, cor);
        else if (pecaNaCasa.src.includes('bispo')) movimentosPossiveis = movimentosBispo(coordAtual, cor);
        else if (pecaNaCasa.src.includes('cavalo')) movimentosPossiveis = movimentosCavalo(coordAtual, cor);
        else if (pecaNaCasa.src.includes('rei')) movimentosPossiveis = movimentosRei(coordAtual, cor);
        else if (pecaNaCasa.src.includes('rainha')) movimentosPossiveis = movimentosRainha(coordAtual, cor);

        // FILTRO ESSENCIAL: Impede que o jogador se coloque em xeque
        movimentosPossiveis = movimentosPossiveis.filter(destino => 
            movimentoEhValido(coordAtual, destino, cor)
        );

        pecaSelecionada = pecaNaCasa;
        casaSelecionada = casaClicada;
        pecaSelecionada.style.opacity = '0.5';

    } else {
        const coordDestino = casaClicada.dataset.coord;
        const corJogadorAtual = corDaPeca(pecaSelecionada);

        if (casaClicada === casaSelecionada) {
            resetarSelecao();
            return;
        }

        if (movimentosPossiveis.includes(coordDestino)) {
            moverPeca(casaSelecionada, casaClicada, pecaSelecionada);
        }
        
        resetarSelecao();
    }
});

function mostrarXeque(cor) {
    removerXeque(); // limpa antes
    console.log('mostrarXeque: procurando rei da cor', cor);
    // os data-tipo em `criarTabuleiro` usam nomes em inglês ('king','queen',...)
    const rei = document.querySelector(`.peca[data-tipo="king"][data-cor="${cor}"]`);
    if (!rei) {
        // tentativas de fallback por segurança
        const fallback = document.querySelector(`.peca[src*="rei"][data-cor="${cor}"]`) || document.querySelector(`.peca[data-cor="${cor}"]`);
        console.log('mostrarXeque: rei não encontrado com data-tipo=king, fallback=', !!fallback);
        if (!fallback) return;
        console.log('mostrarXeque: usando fallback para rei');
        rei = fallback;
    }
    const casa = rei.parentElement;
    if (!casa) { console.log('mostrarXeque: casa do rei não encontrada'); return; }

    const blur = document.createElement('div');
    blur.classList.add('xeque-blur');
    // garantir overlay maior que a casa para efeito de blur visível
    blur.style.width = '140%';
    blur.style.height = '140%';
    blur.style.left = '-20%';
    blur.style.top = '-20%';

    casa.appendChild(blur);
    console.log('mostrarXeque: overlay adicionado em', casa.dataset.coord);
}

function removerXeque() {
    const found = document.querySelectorAll('.xeque-blur');
    if (found.length) console.log('removerXeque: removendo', found.length, 'overlays');
    found.forEach(el => el.remove());
}


function verificarSituacaoJogo(cor) {
    const todasAsCasas = document.querySelectorAll('.casa');
    let temMovimentoLegal = false;

    // 1. Verificar se o jogador ainda tem algum movimento válido
    for (let casa of todasAsCasas) {
        const peca = casa.querySelector('.peca');
        if (peca && corDaPeca(peca) === cor) {
            const coord = casa.dataset.coord;
            let movimentosBrutos = [];

            if (peca.src.includes('peao')) movimentosBrutos = movimentosPeao(coord, cor);
            else if (peca.src.includes('torre')) movimentosBrutos = movimentosTorre(coord, cor);
            else if (peca.src.includes('bispo')) movimentosBrutos = movimentosBispo(coord, cor);
            else if (peca.src.includes('cavalo')) movimentosBrutos = movimentosCavalo(coord, cor);
            else if (peca.src.includes('rei')) movimentosBrutos = movimentosRei(coord, cor);
            else if (peca.src.includes('rainha')) movimentosBrutos = movimentosRainha(coord, cor);

            // Se pelo menos UM movimento tirar o rei do perigo, não é mate
            const movimentosValidos = movimentosBrutos.filter(dest => movimentoEhValido(coord, dest, cor));
            
            if (movimentosValidos.length > 0) {
                temMovimentoLegal = true;
                break;
            }
        }
    }

    const emXeque = estaEmXeque(cor);

    if (!temMovimentoLegal) {
        if (emXeque) {
            alert("XEQUE-MATE! Fim de jogo.");
            window.gameOver = true;
        } else {
            alert("EMPATE por Afogamento!");
            window.gameOver = true;
        }
        return; // Sai da função
    }

    // 2. Xeque Normal
    if (emXeque) {
        mostrarXeque(cor);
    } else {
        removerXeque();
    }


    // 3. NOVO: Verificação de Material Insuficiente
    if (verificarMaterialInsuficiente()) {
        alert("EMPATE por Material Insuficiente!");
        window.gameOver = true;
        return;
    }
}

function resetarSelecao() {
    if (pecaSelecionada) pecaSelecionada.style.opacity = '1';
    pecaSelecionada = null;
    casaSelecionada = null;
    movimentosPossiveis = [];
}

function moverPeca(casaOrigem, casaDestino, peca) { //move a peça no tabuleiro a diferença é que essa função agora lida com capturas, en passant e promoção e o addeventlistener só chama essa função quando o movimento é válido ficando mais organizado antes o addeventlistener tinha muita coisa dentro dele agora ele só chama essa função quando o movimento é válido e o addeventlistener lida apenas com a seleção e deseleção das peças e chama a função das peças para obter os movimentos possíveis     casaOrigem, casaDestino, peca *significa * de onde saiu  * para onde foi * qual peça foi movida então é isso que estamos lidando nessa função

    //aqui estamos respondendo * de onde ? * para onde ? * de qual cor ?
    const coordOrigem = casaOrigem.dataset.coord; //pega a coordenada da casa de origem 
    const coordDestino = casaDestino.dataset.coord; //pega a coordenada da casa de destino
    const cor = corDaPeca(peca); //pega a cor da peça que está sendo movida

    //trasformando as coordenadas em posições numéricas para facilitar os cálculos ex 'a2' -> {x:0, y:6} fazemos isso para as letras e numeros
    const posOrigem = posiçãoNumerica(coordOrigem); //converte a coordenada de origem para posição numérica
    const posDestino = posiçãoNumerica(coordDestino); //converte a coordenada de destino para posição numérica

    // ==========================
    // CAPTURA
    // ==========================

    const pecaNaCasaDestino = casaDestino.querySelector('.peca'); //verifica se há uma peça na casa de destino onde a peça vai ser movida

    if (peca.src.includes('peao') || pecaNaCasaDestino) {
        contador50Lances = 0;
    } else {
        contador50Lances++;
    }

    // En Passant
    if (
        enPassantAlvo && //se existe um alvo para En Passant e sabemos que existe um algo para en passant porque o peão inimigo moveu 2 casas na jogada anterior verificamos isso na parte de atualização do enPassantAlvo 
        coordDestino === enPassantAlvo.square && //se a casa de destino é a casa alvo do En Passant ou seja, se o peão que está se movendo está indo para a casa onde ele pode capturar via En Passant
        peca.src.includes('peao') //se a peça que está se movendo é um peão
    ) {
        const direcaoInversa = (cor === 'white') ? 1 : -1; //direção inversa para encontrar o peão capturado é necessario para saber qual peão capturar sem isso não saberíamos se o peão capturado está acima ou abaixo do peão que está se movendo já que peao branco captura para baixo e o preto para cima
        const casaPeaoCapturado = posicaoID({ //posição do peão que será capturado via En Passant
            x: posDestino.x, //mesma coluna do peão que está se movendo isso porque o peão capturado está na mesma coluna do peão que está se movendo
            y: posDestino.y + direcaoInversa //calculamos onde está o peao capturado somando a direção inversa à posição y do peão que está se movendo assim encontramos a linha correta do peão capturado ex: se o peão branco está em e5 (x:4, y:3) e o preto em d5 (x:3, y:3) e o branco move para d6 (x:3, y:2) o peão capturado estará em d5 (x:3, y:3) então fazemos 2 + 1 = 3 assim encontramos a linha correta do peão capturado e removemos ele do tabuleiro com document.querySelector(`.casa[data-coord="${casaPeaoCapturado}"]`) aqui ele seleciona a casa onde está o peão capturado e .querySelector('.peca') ?.remove() remove a peça dessa casa
        });

        document.querySelector(`.casa[data-coord="${casaPeaoCapturado}"]`)?.querySelector('.peca') ?.remove(); // fazemos a captura removendo o peão capturado do tabuleiro é para isso que serve. aqui estamos selecionando a casa onde está o peão capturado e removendo a peça dela o ? serve para evitar erros caso a casa ou a peça não existam por que se não existir, o código pararia de funcionar então o ? verifica se o elemento existe antes de tentar acessar suas propriedades ou métodos assim evitamos erros o ? é chamado de encadeamento opcional 
    }
    // Captura normal
    else if (pecaNaCasaDestino) { //se houver uma peça na casa de destino
        pecaNaCasaDestino.remove();//remove a peça capturada do tabuleiro
    }

    // ==========================
    // ROQUE (movimento da torre)
    // ==========================
    const fezRoque = peca.src.includes('rei') && Math.abs(posOrigem.x - posDestino.x) === 2; // verifica se o movimento é um roque o math.abs retorna o valor absoluto da diferença entre as posições x de origem e destino ou seja, se o rei moveu 2 casas para a esquerda ou para a direita, a diferença será 2 independente da direção (esquerda ou direita) por isso usamos o math.abs para garantir que sempre teremos um valor positivo para comparar com 2 e ele só move 2 casas quando faz roque então se a diferença for 2, significa que o rei fez roque

    if (fezRoque) { 
        // roque pequeno
        if (posDestino.x === 6) { //se o destino do rei for na coluna 6 (g1 para branco, g8 para preto) isso significa que o rei está fazendo roque pequeno
            const casaTorreOrigem = document.querySelector( // seleciona a casa onde a torre está antes do roque
                `.casa[data-coord="${cor === 'white' ? 'h1' : 'h8'}"]` //se for branco, a torre está em h1 se for preto, a torre está em h8
            );
            const casaTorreDestino = document.querySelector( // seleciona a casa onde a torre deve ir após o roque
                `.casa[data-coord="${cor === 'white' ? 'f1' : 'f8'}"]`//se for branco, a torre vai para f1 se for preto, a torre vai para f8
            );
            const torre = casaTorreOrigem.querySelector('.peca'); //seleciona a peça (torre) dentro da casa de origem
            if (
                torre &&
                torre.src.includes('torre') &&
                corDaPeca(torre) === cor
            ) {
                casaTorreDestino.appendChild(torre);
            }

        }

         // roque grande
        if (posDestino.x === 2) { // se o destino do rei for na coluna 2 (c1 para branco, c8 para preto) isso significa que o rei está fazendo roque grande
            const casaTorreOrigem = document.querySelector(
                `.casa[data-coord="${cor === 'white' ? 'a1' : 'a8'}"]` //se for branco, a torre está em a1 se for preto, a torre está em a8
            );
            const casaTorreDestino = document.querySelector(
                `.casa[data-coord="${cor === 'white' ? 'd1' : 'd8'}"]`
            );
            const torre = casaTorreOrigem.querySelector('.peca');
            if (
                torre &&
                torre.src.includes('torre') &&
                corDaPeca(torre) === cor
            ) {
                casaTorreDestino.appendChild(torre);
            }

        }
    }

    // ==========================
    // MOVE NO DOM
    // ==========================
    casaDestino.appendChild(peca); //move a peça no DOM isso significa que a peça agora está na casa de destino agora a peça é movida de verdade

    const corOponente = (corDaPeca(peca) === 'white') ? 'black' : 'white';

    alternarTurno();
    verificarSituacaoJogo(corOponente);
    // ==========================
    // ATUALIZA ESTADO DO JOGO PARA ROQUE
    // ==========================

    if (peca.src.includes('rei')) { //se a peça movida for o rei
    cor === 'white'
        ? estadoJogo.reiBrancoMoveu = true //se for branco, marca que o rei branco moveu
        : estadoJogo.reiPretoMoveu = true; //se for preto, marca que o rei preto moveu é importante mudar para true para impedir futuros roques
    }

    //verificação se a peça movida foi uma torre se foi, atualiza o estado do jogo para impedir futuros roques
    if (peca.src.includes('torre')) { //se a peça movida for a torre
        if (coordOrigem === 'a1') estadoJogo.torreBrancaEsqMoveu = true; //se for branco e a torre da esquerda (a1), marca que a torre branca esquerda moveu
        if (coordOrigem === 'h1') estadoJogo.torreBrancaDirMoveu = true;
        if (coordOrigem === 'a8') estadoJogo.torrePretaEsqMoveu = true;
        if (coordOrigem === 'h8') estadoJogo.torrePretaDirMoveu = true;
    }

    


    if (fezRoque) { //se fez roque, atualiza o estado do jogo para impedir futuros roques
        // roque pequeno
        if (posDestino.x === 6) { // roque pequeno
            cor === 'white' 
                ? estadoJogo.torreBrancaDirMoveu = true //se for branco, marca que a torre branca direita moveu
                : estadoJogo.torrePretaDirMoveu = true;
        }

        if (posDestino.x === 2) { // roque grande
            cor === 'white'
                ? estadoJogo.torreBrancaEsqMoveu = true
                : estadoJogo.torrePretaEsqMoveu = true;
        }
    }




    // ==========================
    // EN PASSANT (ATUALIZA)
    // ==========================
    //precisamos atualizar o enPassantAlvo toda vez que um peão se move para garantir que o En Passant só esteja disponível na jogada imediatamente após o peão inimigo mover 2 casas
    if (peca.src.includes('peao') && Math.abs(posOrigem.y - posDestino.y) === 2) { //se o peão moveu 2 casas o math.abs retorna o valor absoluto da diferença entre as posições y de origem e destino, ou seja, se o peão moveu 2 casas para frente, a diferença será 2 independente da direção (para cima ou para baixo) por isso usamos o math.abs para garantir que sempre teremos um valor positivo para comparar com 2 não importando se o peão é branco ou preto ou para cima ou para baixo isso é importante para definir o enPassantAlvo corretamente se não usássemos o math.abs, teríamos que fazer verificações adicionais para saber se o peão é branco ou preto e para onde ele está se movendo o .src faz parte do objeto img que contém o caminho da imagem da peça então estamos verificando se o caminho da imagem contém a palavra 'peao' para garantir que a peça que está se movendo é um peão e o .includes é um método de string que verifica se uma string contém outra string então aqui estamos vendo no caminho src se tem a palavra peão, o posOrigem.y e posDestino.y são as posições numéricas y (linhas) da casa de origem e destino do peão o posdestino é a linha onde o peão está indo e posorigem é a linha onde o peão estava antes de se mover

        const yAlvo = (cor === 'white') ? 5 : 2; //linha alvo para o peão inimigo capturar via En Passant se for branco a linha alvo é 5 (linha 6 no tabuleiro) se for preto a linha alvo é 2 (linha 3 no tabuleiro) isso porque o peão branco move para cima e o preto para baixo então o peão inimigo precisa estar na linha correta para capturar via En Passant

        enPassantAlvo = { //objeto que guarda a posição alvo para En Passant
            square: letras[posOrigem.x] + numeros[yAlvo], //casa alvo para En Passant poderiamos fazer sem calculo mas assim é o jeito "correto" de fazer o yalvo é a linha onde o peão inimigo pode capturar via En Passant então usamos o posOrigem.x para manter a mesma coluna do peão que moveu 2 casas e o numeros[yAlvo] para definir a linha correta onde o peão inimigo pode capturar via En Passant
            pawnColor: cor //cor do peão que moveu 2 casas
        };
    } else { //se não, reseta o enPassantAlvo
        enPassantAlvo = null; //reseta o enPassantAlvo
    }

    // ==========================
    // PROMOÇÃO
    // ==========================
    if (verificarPromocaoPeao(peca, coordDestino)) { //verifica se o peão chegou na última linha para promoção
        promoverPeao(coordDestino, cor, 'queen');
    }

    const snapshotAtual = gerarSnapshotTabuleiro(turnoAtual);

    // Incrementa o contador para esta posição específica
    historicoPosicoes[snapshotAtual] = (historicoPosicoes[snapshotAtual] || 0) + 1;

    if (historicoPosicoes[snapshotAtual] >= 3) {
        setTimeout(() => {
            alert("Empate por repetição de 3 posições!");
        }, 100);
    }
}

function atualizarEstadoRoque(peca, cor, coordOrigem, fezRoque, posDestino) {
    if (peca.src.includes('rei')) {
        cor === 'white' ? estadoJogo.reiBrancoMoveu = true : estadoJogo.reiPretoMoveu = true;
    }
    if (peca.src.includes('torre')) {
        if (coordOrigem === 'a1') estadoJogo.torreBrancaEsqMoveu = true;
        if (coordOrigem === 'h1') estadoJogo.torreBrancaDirMoveu = true;
        if (coordOrigem === 'a8') estadoJogo.torrePretaEsqMoveu = true;
        if (coordOrigem === 'h8') estadoJogo.torrePretaDirMoveu = true;
    }
}

function atualizarEnPassantAlvo(peca, cor, posOrigem, posDestino) {
    if (peca.src.includes('peao') && Math.abs(posOrigem.y - posDestino.y) === 2) {
        const yAlvo = (cor === 'white') ? 5 : 2;
        enPassantAlvo = { square: letras[posOrigem.x] + numeros[yAlvo], pawnColor: cor };
    } else {
        enPassantAlvo = null;
    }
}


//==================================
// PEÃO
//==================================
function movimentosPeao(coordAtual, cor) { // função que retorna os movimentos possíveis do peão
    const posicao = posiçãoNumerica(coordAtual); //converte a coordenada para posição numérica
    const movimentos = []; //lista de movimentos possíveis
    const direcao = (cor === 'white') ? -1 : 1; //direção do peão (branco para cima, preto para baixo)

    // 1 casa à frente
    const frente = { x: posicao.x, y: posicao.y + direcao }; //posição à frente do peão
    if (posicaoNoTabu(frente) && !temPecaNaPosicao(frente)) { //se a posição está no tabuleiro e não há peça na frente
        movimentos.push(posicaoID(frente)); //adiciona a posição à lista de movimentos possíveis

        // 2 casas à frente (apenas se estiver na linha inicial)
        const linhaInicial = (cor === 'white') ? 6 : 1; //linha inicial do peão
        const frente2 = { x: posicao.x, y: posicao.y + (2 * direcao) }; //posição duas casas à frente do peão
        if (posicao.y === linhaInicial && !temPecaNaPosicao(frente2)) { //se o peão está na linha inicial e não há peça duas casas à frente
            movimentos.push(posicaoID(frente2)); //adiciona a posição à lista de movimentos possíveis
        }
    }

    // Capturas Diagonais Normais
    const diagonais = [ //posições diagonais para captura
        { x: posicao.x - 1, y: posicao.y + direcao }, //diagonal esquerda
        { x: posicao.x + 1, y: posicao.y + direcao } //diagonal direita
    ];

    diagonais.forEach(diag => { //verifica cada diagonal
        if (posicaoNoTabu(diag)) { //se a posição está no tabuleiro
             // Captura Normal
            const pecaInimiga = temPecaNaPosicao(diag); //verifica se há uma peça inimiga na diagonal
            if (pecaInimiga && pecaInimiga.color !== cor) { //se há uma peça inimiga na diagonal
                movimentos.push(posicaoID(diag)); //adiciona a posição à lista de movimentos possíveis
            }
            
            // Lógica En Passant dentro da verificação de diagonal
            if (enPassantAlvo && posicaoID(diag) === enPassantAlvo.square && enPassantAlvo.pawnColor !== cor) { //verifica se a diagonal é a casa alvo do En Passant e se a cor do peão alvo é diferente o enPassantAlvo.square é a casa onde o peão pode se mover para capturar via En Passant
                movimentos.push(enPassantAlvo.square); //adiciona a posição do En Passant à lista de movimentos possíveis esse enPassantAlvo.square é a casa onde o peão pode se mover para capturar via En Passant
            }
        }
    });

    return movimentos;
}

function verificarPromocaoPeao(peca, coordDestino) { //verifica se o peão chegou na última linha para promoção pega a peça e a coordenada de destino
    if (!peca.src.includes('peao')) return false; //se a peça não for um peão, retorna false

    const pos = posiçãoNumerica(coordDestino); //converte a coordenada de destino para posição numérica
    const cor = corDaPeca(peca); //pega a cor da peça

    return ( //verifica se o peão chegou na última linha
        (cor === 'white' && pos.y === 0) || //se for branco, a última linha é 0
        (cor === 'black' && pos.y === 7) //se for preto, a última linha é 7
    );
}


function promoverPeao(coord, cor, novaPeca) { //coord é a casa onde o peão está sendo promovido cor é a cor do peão e novaPeca é o tipo de peça para a qual o peão está sendo promovido (ex: 'queen', 'rook', 'bishop', 'knight')
    const casa = document.querySelector(`.casa[data-coord="${coord}"]`); //seleciona a casa onde o peão está sendo promovido ex 'a8' é onde o peão está
    if (!casa) return; //se a casa não existir, sai da função isso aparece se houver algum erro na coordenada passada

    const peca = casa.querySelector('.peca'); //seleciona a peça (peão) dentro da casa
    if (!peca) return; //se não houver peça, sai da função isso aparece se houver algum erro na coordenada passada denovo

    peca.src = imgpath[cor][novaPeca]; //atualiza o src da imagem para a nova peça isso muda a imagem do peão para a imagem da nova peça ex: se for rainha, muda para a imagem da rainha
    tornarPecasArrastaveis(); // essa linha aqui é importante para garantir que a nova peça promovida seja arrastável no tabuleiro sem isso, a nova peça não poderia ser movida
}


//==================================
// TORRE
//==================================
function movimentosTorre(coordAtual, cor) {
    const posicao = posiçãoNumerica(coordAtual); //converte a coordenada para posição numérica ex: 'a2' -> {x:0, y:6}
    const movimentos = [];
    const direcoes = [ //essa array define as 4 direções possíveis da torre 
        { x: 0, y: 1 },  // 1 casa para cima
        { x: 0, y: -1 }, // 1 casa para baixo
        { x: 1, y: 0 },  // 1 casa para direita
        { x: -1, y: 0 }  // 1 casa para esquerda
    ];
    direcoes.forEach(direcao => { //esse forEach percorre cada direção possível da torre entao ele faz isso até encontrar uma peça ou sair do tabuleiro esse foreach serve para a torre se mover em todas as direções possíveis é melhor usar o forEach do que um for normal pois o forEach já percorre todo o array sem precisar de um contador


        let passo = 1; //contador de passos na direção atual entao ele começa com 1 passo e vai aumentando até encontrar uma peça ou sair do tabuleiro isso serve para a torre se mover várias casas em linha
        while (true) { //loop infinito que só para quando encontrar uma peça ou sair do tabuleiro, enquando eu puder me mover nessa direção eu continuo o loop, se eu encontrar uma peça ou sair do tabuleiro eu paro o loop pois será false
            const novaPos = { x: posicao.x + direcao.x * passo, y: posicao.y + direcao.y * passo }; //calcula a nova posição baseado na direção e no passo atual essa novaPos é a posição que a torre está tentando se mover o * serve para multiplicar a direção pelo número de passos que a torre deu nessa direção ex: se a direção for {x:0, y:1} e o passo for 3, a novaPos será {x:0, y:3} ou seja, 3 casas para cima
            
            if (!posicaoNoTabu(novaPos)) break; //se a nova posição não estiver no tabuleiro, sai do loop
            const peca = temPecaNaPosicao(novaPos);//verifica se há uma peça na nova posição se houver uma peça, peca será um objeto com a peça e sua cor, se não houver, peca será null
            if (peca) { //se houver uma peça na nova posição
                if (peca.color !== cor) { //se a peça for de cor diferente (inimiga) se não for inimiga, a torre não pode se mover para essa posição e o loop para (break)
                    movimentos.push(posicaoID(novaPos)); //adiciona a posição à lista de movimentos possíveis (captura)
                }
                break;
            }
            movimentos.push(posicaoID(novaPos)); //adiciona a posição à lista de movimentos possíveis (casa vazia) e o posicaoID converte a posição numérica de volta para a coordenada alfanumérica ex: {x:0, y:6} -> 'a2'
            passo++;
        }
    });
    return movimentos;
}

//==================================
// BISPO
//==================================

function movimentosBispo(coordAtual, cor) { 
    const posicao = posiçãoNumerica(coordAtual);
    const movimentos = [];
    const direcoes = [ //essa array define as 4 direções possíveis do bispo
        { x: 1, y: 1 },   // diagonal para cima e direita
        { x: -1, y: 1 },  // diagonal para cima e esquerda
        { x: 1, y: -1 },  // diagonal para baixo e direita
        { x: -1, y: -1 }  // diagonal para baixo e esquerda
    ];
    direcoes.forEach(direcao => { //esse forEach percorre cada direção possível do bispo até encontrar uma peça ou sair do tabuleiro
        let passo = 1; //contador de passos na direção, ele serve para contar quantas casas o bispo pode se mover nessa direção
        while (true) { //loop infinito que só para quando encontrar uma peça ou sair do tabuleiro
            const novaPos = { x: posicao.x + direcao.x * passo, y: posicao.y + direcao.y * passo }; //calcula a nova posição baseado na direção e no passo atual a diferença é que o bispo se move na diagonal então tanto x quanto y mudam ao mesmo tempo entao se a direção for {x:1, y:1} e o passo for 2, a novaPos será {x:2, y:2} ou seja, 2 casas para cima e 2 casas para direita
            if (!posicaoNoTabu(novaPos)) break; //verifica se a nova posição está dentro do tabuleiro
            const peca = temPecaNaPosicao(novaPos); //verifica se há uma peça na nova posição se tiver uma peca, verifica a cor dela se for inimiga, adiciona a posição à lista de movimentos possíveis e para o loop se for da mesma cor, apenas para o loop
            if (peca) {
                if (peca.color !== cor) { //se a peca for de cor diferente, 
                    movimentos.push(posicaoID(novaPos)); //adiciona a posição à lista de movimentos possíveis (captura) entra aqui se houver uma peça na nova posição e for inimiga
                }
                break;
            }
            movimentos.push(posicaoID(novaPos)); //adiciona a posição à lista de movimentos possíveis (casa vazia) entra aqui se não houver peça na nova posição
            passo++;
        }
    });
    return movimentos;
}

//==================================
// CAVALO
//==================================
function movimentosCavalo(coordAtual, cor) { 
    const posicao = posiçãoNumerica(coordAtual); //posiçãoNumerica(coordAtual) isso faz a conversão de 'a2' para {x:0, y:6} como ? r
    const movimentos = [];
    const direcoes = [
        { x: 2, y: 1 },   // 2 casas para direita e 1 para cima
        { x: 1, y: 2 },   // 1 casa para direita e 2 para cima
        { x: -1, y: 2 },  // 1 casa para esquerda e 2 para cima
        { x: -2, y: 1 },  // 2 casas para esquerda e 1 para cima
        { x: -2, y: -1 }, // 2 casas para esquerda e 1 para baixo
        { x: -1, y: -2 }, // 1 casa para esquerda e 2 para baixo
        { x: 1, y: -2 },  // 1 casa para direita e 2 para baixo
        { x: 2, y: -1 }   // 2 casas para direita e 1 para baixo
    ];
    direcoes.forEach(direcao => { //para cada direção possível do cavalo
        const novaPos = { x: posicao.x + direcao.x, y: posicao.y + direcao.y }; //a novapos é a direçao que o cavalo pode se mover ex: se a direção for {x:2, y:1} e a posição atual for {x:0, y:6}, a novaPos será {x:2, y:7} ou seja, 2 casas para direita e 1 para cima a posicao é a posição atual do cavalo e a direcao é a que vai ser somada para ver aonde o cavalo pode ir mesma coisa para o y que é a linha
        if (!posicaoNoTabu(novaPos)) return;
        const peca = temPecaNaPosicao(novaPos); //verifica se há uma peça na nova posição
        if (peca) {
            if (peca.color !== cor) {
                movimentos.push(posicaoID(novaPos));
            }
            return;
        }
        movimentos.push(posicaoID(novaPos));
    });
    return movimentos;
}

//==================================
// REI
//==================================
function movimentosRei(coordAtual, cor) {
    const posicao = posiçãoNumerica(coordAtual);
    const movimentos = [];
    const direcoes = [
        { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
        { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }
    ];

    direcoes.forEach(direcao => {
        const novaPos = { x: posicao.x + direcao.x, y: posicao.y + direcao.y };
        if (!posicaoNoTabu(novaPos)) return;
        const peca = temPecaNaPosicao(novaPos);
        if (peca) {
            if (peca.color !== cor) movimentos.push(posicaoID(novaPos));
            return;
        }
        movimentos.push(posicaoID(novaPos));
    });

    // --- LÓGICA DO ROQUE ATUALIZADA ---
    const corInimiga = (cor === 'white') ? 'black' : 'white';
    
    // 1. O Rei NÃO pode fazer roque se estiver em xeque agora
    if (estaEmXeque(cor)) return movimentos;

    if (cor === 'white') {
        if (!estadoJogo.reiBrancoMoveu) {
            // Roque Pequeno (Lado da Torre h1)
            if (!estadoJogo.torreBrancaDirMoveu && 
                !temPecaNaPosicao({x: 5, y: 7}) && !temPecaNaPosicao({x: 6, y: 7})) {
                // O Rei passa por f1 (5,7) e g1 (6,7). Nenhuma pode estar atacada.
                if (!casaEstaSendoAtacada('f1', 'black') && !casaEstaSendoAtacada('g1', 'black')) {
                    movimentos.push('g1');
                }
            }
            // Roque Grande (Lado da Torre a1)
            if (!estadoJogo.torreBrancaEsqMoveu && 
                !temPecaNaPosicao({x: 1, y: 7}) && !temPecaNaPosicao({x: 2, y: 7}) && !temPecaNaPosicao({x: 3, y: 7})) {
                // O Rei passa por d1 (3,7) e c1 (2,7). A casa b1 (1,7) pode estar atacada!
                if (!casaEstaSendoAtacada('d1', 'black') && !casaEstaSendoAtacada('c1', 'black')) {
                    movimentos.push('c1');
                }
            }
        }
    } else {
        if (!estadoJogo.reiPretoMoveu) {
            // Roque Pequeno Pretas (h8)
            if (!estadoJogo.torrePretaDirMoveu && 
                !temPecaNaPosicao({x: 5, y: 0}) && !temPecaNaPosicao({x: 6, y: 0})) {
                if (!casaEstaSendoAtacada('f8', 'white') && !casaEstaSendoAtacada('g8', 'white')) {
                    movimentos.push('g8');
                }
            }
            // Roque Grande Pretas (a8)
            if (!estadoJogo.torrePretaEsqMoveu && 
                !temPecaNaPosicao({x: 1, y: 0}) && !temPecaNaPosicao({x: 2, y: 0}) && !temPecaNaPosicao({x: 3, y: 0})) {
                if (!casaEstaSendoAtacada('d8', 'white') && !casaEstaSendoAtacada('c8', 'white')) {
                    movimentos.push('c8');
                }
            }
        }
    }

    return movimentos;
}

//==================================
// RAINHA
//==================================
function movimentosRainha(coordAtual, cor) {
    return [...movimentosTorre(coordAtual, cor), ...movimentosBispo(coordAtual, cor)]; //esses ... servem para juntar os dois arrays em um só ... é o operador spread lembre que as 2 funções retornam arrays então aqui eu estou juntando os arrays retornados pelas funções movimentosTorre e movimentosBispo em um só array e retornando ele como os movimentos possíveis da rainha 
}


//==================================
// ROQUE
//==================================
function casasEntreVazias(listaCasas) {
    return listaCasas.every(coord => {
        const casa = document.querySelector(`.casa[data-coord="${coord}"]`);
        return !casa.querySelector('.peca');
    });
}

function movimentosRoque(coordAtual, cor) {
    const movimentos = [];
    const reiPos = posiçãoNumerica(coordAtual);

    // ==========================
    // ROQUE BRANCO
    // ==========================
    if (cor === 'white' && reiPos.x === 4 && reiPos.y === 7) { 

        // ---------- Roque pequeno (h1 → f1) ----------
        const casaTorreDir = document.querySelector('.casa[data-coord="h1"]');
        const torreDir = casaTorreDir?.querySelector('.peca');

        if (
            estadoJogo.reiBrancoMoveu === false &&
            estadoJogo.torreBrancaDirMoveu === false &&
            torreDir &&
            torreDir.src.includes('torre') &&
            corDaPeca(torreDir) === 'white'
        ) {
            const casas = [
                { x: 5, y: 7 },
                { x: 6, y: 7 }
            ];

            if (casasEntreVazias(casas.map(posicaoID))) {
                movimentos.push(posicaoID({ x: 6, y: 7 }));
            }
        }

        // ---------- Roque grande (a1 → d1) ----------
        const casaTorreEsq = document.querySelector('.casa[data-coord="a1"]');
        const torreEsq = casaTorreEsq?.querySelector('.peca');

        if (
            estadoJogo.reiBrancoMoveu === false &&
            estadoJogo.torreBrancaEsqMoveu === false &&
            torreEsq &&
            torreEsq.src.includes('torre') &&
            corDaPeca(torreEsq) === 'white'
        ) {
            const casas = [
                { x: 3, y: 7 },
                { x: 2, y: 7 },
                { x: 1, y: 7 }
            ];

            if (casasEntreVazias(casas.map(posicaoID))) {
                movimentos.push(posicaoID({ x: 2, y: 7 }));
            }
        }
    }

    // ==========================
    // ROQUE PRETO
    // ==========================
    if (cor === 'black' && reiPos.x === 4 && reiPos.y === 0) {

        // ---------- Roque pequeno (h8 → f8) ----------
        const casaTorreDir = document.querySelector('.casa[data-coord="h8"]');
        const torreDir = casaTorreDir?.querySelector('.peca');

        if (
            estadoJogo.reiPretoMoveu === false &&
            estadoJogo.torrePretaDirMoveu === false &&
            torreDir &&
            torreDir.src.includes('torre') &&
            corDaPeca(torreDir) === 'black'
        ) {
            const casas = [
                { x: 5, y: 0 },
                { x: 6, y: 0 }
            ];

            if (casasEntreVazias(casas.map(posicaoID))) {
                movimentos.push(posicaoID({ x: 6, y: 0 }));
            }
        }

        // ---------- Roque grande (a8 → d8) ----------
        const casaTorreEsq = document.querySelector('.casa[data-coord="a8"]');
        const torreEsq = casaTorreEsq?.querySelector('.peca');

        if (
            estadoJogo.reiPretoMoveu === false &&
            estadoJogo.torrePretaEsqMoveu === false &&
            torreEsq &&
            torreEsq.src.includes('torre') &&
            corDaPeca(torreEsq) === 'black'
        ) {
            const casas = [
                { x: 3, y: 0 },
                { x: 2, y: 0 },
                { x: 1, y: 0 }
            ];

            if (casasEntreVazias(casas.map(posicaoID))) {
                movimentos.push(posicaoID({ x: 2, y: 0 }));
            }
        }
    }

    return movimentos;
}

//=========================================
//Funções de xeque e xeque mate
//=========================================


function encontrarRei(cor) {
    const casas = document.querySelectorAll('.casa');
    for (let casa of casas) {
        const peca = casa.querySelector('.peca');
        if (peca && peca.src.includes('rei') && corDaPeca(peca) === cor) {
            return casa.dataset.coord;
        }
    }
    return null;
}

// Verifica se uma casa específica está sendo atacada por QUALQUER peça inimiga
function casaEstaSendoAtacada(coord, corInimiga) {
    const casas = document.querySelectorAll('.casa');
    for (let casa of casas) {
        const peca = casa.querySelector('.peca');
        if (peca && corDaPeca(peca) === corInimiga) {
            const coordAtacante = casa.dataset.coord;
            let movimentos = [];

            // Obtém movimentos brutos (sem verificar xeque para evitar loop infinito)
            if (peca.src.includes('peao')) {
                // Para o peão, só importa a captura diagonal ao verificar ataque
                const pos = posiçãoNumerica(coordAtacante);
                const direcao = (corInimiga === 'white') ? -1 : 1;
                const diag1 = posicaoID({x: pos.x - 1, y: pos.y + direcao});
                const diag2 = posicaoID({x: pos.x + 1, y: pos.y + direcao});
                movimentos = [diag1, diag2];
            } else if (peca.src.includes('torre')) movimentos = movimentosTorre(coordAtacante, corInimiga);
            else if (peca.src.includes('bispo')) movimentos = movimentosBispo(coordAtacante, corInimiga);
            else if (peca.src.includes('cavalo')) movimentos = movimentosCavalo(coordAtacante, corInimiga);
            else if (peca.src.includes('rainha')) movimentos = movimentosRainha(coordAtacante, corInimiga);
            else if (peca.src.includes('rei')) {
                // Movimento básico do rei inimigo (sem roque)
                const pos = posiçãoNumerica(coordAtacante);
                const direcoesRei = [{x:1,y:0}, {x:-1,y:0}, {x:0,y:1}, {x:0,y:-1}, {x:1,y:1}, {x:-1,y:1}, {x:1,y:-1}, {x:-1,y:-1}];
                direcoesRei.forEach(d => {
                    const np = {x: pos.x + d.x, y: pos.y + d.y};
                    if (posicaoNoTabu(np)) movimentos.push(posicaoID(np));
                });
            }

            if (movimentos.includes(coord)) return true;
        }
    }
    return false;
}

function estaEmXeque(cor) {
    const coordRei = encontrarRei(cor);
    const corInimiga = (cor === 'white') ? 'black' : 'white';
    return casaEstaSendoAtacada(coordRei, corInimiga);
}

// A FUNÇÃO MAIS IMPORTANTE: Valida se o movimento resolve o xeque ou não cria um
function movimentoEhValido(coordOrigem, coordDestino, cor) {
    const casaOrigem = document.querySelector(`.casa[data-coord="${coordOrigem}"]`);
    const casaDestino = document.querySelector(`.casa[data-coord="${coordDestino}"]`);
    const peca = casaOrigem.querySelector('.peca');
    const pecaAlvo = casaDestino.querySelector('.peca');
    
    // Simula o movimento
    casaDestino.appendChild(peca);
    if (pecaAlvo) pecaAlvo.remove();

    const emXeque = estaEmXeque(cor);

    // Desfaz a simulação
    casaOrigem.appendChild(peca);
    if (pecaAlvo) casaDestino.appendChild(pecaAlvo);

    return !emXeque;
}

function gerarSnapshotTabuleiro(corDaVez) { //serve para gerar uma representação única do estado atual do tabuleiro de xadrez incluindo a posição de todas as peças e o turno atual do jogador isso é usado para detectar repetições de posições no jogo
    let snapshot = "";
    const casas = document.querySelectorAll('.casa');
    
    casas.forEach(casa => {
        const peca = casa.querySelector('.peca');
        if (peca) {
            // Pega o nome da imagem e a cor para identificar a peça
            const tipo = peca.src.split('/').pop(); 
            snapshot += casa.dataset.coord + ":" + tipo + "|";
        } else {
            snapshot += "vazio|";
        }
    });

    // Importante: a repetição só conta se for a vez do mesmo jogador
    snapshot += "turno:" + corDaVez;
    
    // Também incluímos o estado do roque, pois se o direito ao roque mudar, a posição é diferente
    snapshot += JSON.stringify(estadoJogo);
    
    return snapshot;
}

function verificarMaterialInsuficiente() {
    const casas = document.querySelectorAll('.casa');
    let pecasBrancas = [];
    let pecasPretas = [];

    // 1. Coletar todas as peças ativas no tabuleiro
    casas.forEach(casa => {
        const peca = casa.querySelector('.peca');
        if (peca) {
            const cor = corDaPeca(peca);
            const tipo = peca.src.toLowerCase();
            const infoPeca = {
                tipo: tipo,
                coord: casa.dataset.coord,
                pos: posiçãoNumerica(casa.dataset.coord)
            };

            if (cor === 'white') pecasBrancas.push(infoPeca);
            else pecasPretas.push(infoPeca);
        }
    });

    const totalPecas = pecasBrancas.length + pecasPretas.length;

    // Caso 1: Rei vs Rei (2 peças no total)
    if (totalPecas === 2) return true;

    // Caso 2: Rei + Bispo vs Rei OU Rei + Cavalo vs Rei (3 peças no total)
    if (totalPecas === 3) {
        const pecaExtra = pecasBrancas.length === 2 ? 
            pecasBrancas.find(p => !p.tipo.includes('rei')) : 
            pecasPretas.find(p => !p.tipo.includes('rei'));

        if (pecaExtra.tipo.includes('bispo') || pecaExtra.tipo.includes('cavalo')) {
            return true;
        }
    }

    // Caso 3: Rei + Bispo vs Rei + Bispo (4 peças no total)
    if (totalPecas === 4 && pecasBrancas.length === 2 && pecasPretas.length === 2) {
        const bispoBranco = pecasBrancas.find(p => p.tipo.includes('bispo'));
        const bispoPreto = pecasPretas.find(p => p.tipo.includes('bispo'));

        if (bispoBranco && bispoPreto) {
            // Empate se os bispos estiverem em casas da mesma cor
            const corCasaBranco = (bispoBranco.pos.x + bispoBranco.pos.y) % 2;
            const corCasaPreto = (bispoPreto.pos.x + bispoPreto.pos.y) % 2;

            if (corCasaBranco === corCasaPreto) return true;
        }
    }

    return false; // Ainda há material suficiente
}