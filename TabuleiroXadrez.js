//==================================
//VARIAVEIS GLOBAIS
//==================================
let movimentosPossiveis = []; // lista de casas válidas da peça selecionada


//==================================
//CONFIGURAÇÃO DO TABULEIRO
//==================================
const tabuleiro = document.getElementById('board');

    const letras = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']; 
    const numeros = ['8', '7', '6', '5', '4', '3', '2', '1'];

    const imgpath = {
    'black': {
        'pawn': 'img/peãoPreto.png',
        'rook': 'img/torrePreto.png',
        'knight': 'img/cavaloPreto.png',
        'bishop': 'img/bispoPreto.png',
        'queen': 'img/rainhaPreto.png',
        'king': 'img/reiPreto.png',
    },
    'white': {
        'pawn': 'img/peãoBranco.png',
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
                casa.appendChild(peca);
            }
        }
    }
}

//==================================
//FUNÇÕES DE COORDENADAS NUMÉRICAS
//==================================

function posiçãoNumerica(coord) { //ex: 'a2' -> {x:0, y:6}
    const letra = coord[0]; // pega a letra da coordenada ex: 'a' de 'a2'
    const numero = coord[1]; // pega o número da coordenada ex: '2' de 'a2'

    return { 
        x: letras.indexOf(letra), //converte letra em número o indexOf retorna a posição dela no array
        y: numeros.indexOf(numero) //converte número em índice o indexOf retorna a posição dela no array ex: '8' = 0
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

//==================================
//MOVIMENTO DAS PEÇAS
//==================================

let pecaSelecionada = null; //guarda a img da peça selecionada
let casaSelecionada = null;  //guarda a casa onde a peça estava antes de ser movida a div.casa

function corDaPeca(peca) { //retorna a cor da peça ('white' ou 'black')
    return peca.src.includes('Branco') ? 'white' : 'black'; //verifica a cor da peça pelo nome do arquivo da imagem
}


tabuleiro.addEventListener('click', (e) => { //e é o evento de clique na div#board
    const casaClicada = e.target.closest('.casa'); //pega a casa clicada
    if (!casaClicada) return; //se não clicou em uma casa, sai da função
    const pecaNaCasa = casaClicada.querySelector('.peca'); //pega a peça na casa clicada

    //em um click entra no if, no outro entra no else
        if (!pecaSelecionada) { //se nenhuma peça está selecionada
            if (pecaNaCasa) { //se há uma peça na casa clicada

                //identificar a peça e onde ela está
                const coordAtual = casaClicada.dataset.coord; //pega a coordenada da casa clicada
                const cor = corDaPeca(pecaNaCasa); //pega a cor da peça na casa clicada

                //pega a peca e seleciona ela
                pecaSelecionada = pecaNaCasa; //seleciona a peça
                casaSelecionada = casaClicada; //guarda a casa onde a peça estava antes de ser movida
                pecaSelecionada.style.opacity = '0.5';

                //calcular os movimentos possíveis
                movimentosPossiveis = movimentosPeão(coordAtual, cor); //chama a função de movimentos do peão e guarda os movimentos possíveis na variável global

                console.log('Movimentos possíveis:', movimentosPossiveis);
            }
        }

        else {
            const coordDestino = casaClicada.dataset.coord; //pega a coordenada da casa clicada (destino)
            // cancelar seleção
            if (casaClicada === casaSelecionada) { //se clicou na mesma casa da peça selecionada
                pecaSelecionada.style.opacity = '1'; 
                pecaSelecionada = null; // deseleciona a peça
                casaSelecionada = null; // deseleciona a casa
                movimentosPossiveis = []; //limpa os movimentos possíveis
                return; // sai da função
            }

            // verificar se o destino é válido
            if (movimentosPossiveis.includes(coordDestino)) {

    const pecaDestino = casaClicada.querySelector('.peca');

    // se tiver peça na casa, é captura → remove
    if (pecaDestino) {
        pecaDestino.remove();
    }

    // move a peça selecionada
    casaClicada.appendChild(pecaSelecionada);
}


            // limpar seleção (sempre)
            pecaSelecionada.style.opacity = '1'; 
            pecaSelecionada = null; // deseleciona a peça
            casaSelecionada = null; // deseleciona a casa
            movimentosPossiveis = []; //limpa os movimentos possíveis
        }

});




//==================================
// PEÃO
//==================================
function movimentosPeão (coordAtual, cor) { // função que retorna os movimentos possíveis do peão
    const posicao = posiçãoNumerica(coordAtual); //converte a coordenada atual para posição numérica ex: 'a2' -> {x:0, y:6}
    const movimentos = []; //array que vai guardar os movimentos possíveis
    const direcao = (cor === 'white') ? -1 : 1; //define a direção do movimento do peão (branco para cima, preto para baixo)

    // Capturas diagonais

    // 1 casa à frente
    const frente = { x: posicao.x, y: posicao.y + direcao }; //cria o objeto frente, x é a propriedade (a chave), posicao.x é o valor que voce está atribuindo a essa chave, Por que o X não muda? Porque o peão, ao andar para frente, permanece na mesma coluna (mesmo valor de X)., posicao.y é  a linha atual do peão, direcao é +1 ou -1 dependendo da cor do peão
    console.log(frente);

    //2 casas a frente (movimento inicial)
    const frente2 = { x: posicao.x, y: posicao.y + 2 * direcao }; //mesma lógica do frente, mas multiplica a direção por 2 para andar 2 casas
    console.log(frente2);

    if ( //verifica se o peão pode andar 2 casas
        posicaoNoTabu(frente2) && //verifica se a posição está dentro do tabuleiro
        !temPecaNaPosicao(frente) && //verifica se não há peça na posição frente
        !temPecaNaPosicao(frente2) //verifica se não há peça na posição frente2
    ) {
        //verifica se o peão está na posição inicial
        if ((cor === 'white' && posicao.y === 6) || (cor === 'black' && posicao.y === 1)) {
            movimentos.push(posicaoID(frente2)); //adiciona a posição frente2 aos movimentos possíveis
        }
    }

    if (
        posicaoNoTabu(frente) && //verifica se a posição está dentro do tabuleiro
        !temPecaNaPosicao(frente) //verifica se não há peça na posição frente
    ) {
        movimentos.push(posicaoID(frente)); //adiciona a posição frente aos movimentos possíveis
    }


    // ======================
    // CAPTURAS DIAGONAIS
    // ======================

    const diagonalEsquerda = { 
        x: posicao.x - 1, 
        y: posicao.y + direcao 
    };

const diagonalDireita = { 
    x: posicao.x + 1, 
    y: posicao.y + direcao 
};

// esquerda
if (posicaoNoTabu(diagonalEsquerda)) {
    const peca = temPecaNaPosicao(diagonalEsquerda);
    if (peca && peca.color !== cor) {
        movimentos.push(posicaoID(diagonalEsquerda));

    }
}

// direita
if (posicaoNoTabu(diagonalDireita)) {
    const peca = temPecaNaPosicao(diagonalDireita);
    if (peca && peca.color !== cor) {
        movimentos.push(posicaoID(diagonalDireita));
    }
}



    return movimentos;
}

//==================================
// TORRE
//==================================
function movimentosTorre (coordAtual, cor) { // função que retorna os movimentos possíveis da torre
    const posicao = posiçãoNumerica(coordAtual);
    const movimentos = [];
    
}