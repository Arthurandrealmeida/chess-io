//==================================
//VARIAVEIS GLOBAIS
//==================================
let movimentosPossiveis = []; // lista de casas válidas da peça selecionada
let enPassantAlvo = null;


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


tabuleiro.addEventListener('click', (e) => { //evento de clique no tabuleiro
    const casaClicada = e.target.closest('.casa');//pega a casa clicada
    if (!casaClicada) return; //se não for uma casa, sai da função
    const pecaNaCasa = casaClicada.querySelector('.peca');//pega a peça na casa clicada (se houver)

     // Se nenhuma peça está selecionada

    if (!pecaSelecionada) { //nenhuma peça foi selecionada ainda
        if (pecaNaCasa) { //se houver uma peça na casa clicada
            const coordAtual = casaClicada.dataset.coord; //pega a coordenada da casa clicada
            const cor = corDaPeca(pecaNaCasa); //pega a cor da peça na casa clicada

            // Seleciona a peça

            pecaSelecionada = pecaNaCasa; //guarda a img da peça selecionada
            casaSelecionada = casaClicada; //guarda a casa onde a peça estava antes de ser movida
            pecaSelecionada.style.opacity = '0.5'; //efeito visual de seleção

            // Importante: agora verificamos o tipo da peça para chamar a função correta
            if (pecaSelecionada.src.includes('peao')) { //se for um peão
                movimentosPossiveis = movimentosPeao(coordAtual, cor); //chama a função de movimentos do peão
            } else {
                movimentosPossiveis = []; // Adicione outras peças aqui depois
            }
        }
    } else { // Já há uma peça selecionada
        const coordDestino = casaClicada.dataset.coord; //pega a coordenada da casa clicada (destino)

        // Se clicar na mesma casa, deseleciona a peça

        if (casaClicada === casaSelecionada) {
            pecaSelecionada.style.opacity = '1';
            pecaSelecionada = null;
            casaSelecionada = null;
            movimentosPossiveis = [];
            return;
        }

        if (movimentosPossiveis.includes(coordDestino)) { //não deixa capturar peça da mesma cor
            const origem = casaSelecionada.dataset.coord; //pega a coordenada da casa de origem
            const cor = corDaPeca(pecaSelecionada); //pega a cor da peça selecionada
            const posOrigem = posiçãoNumerica(origem); //converte a coordenada de origem para posição numérica
            const posDestino = posiçãoNumerica(coordDestino); //converte a coordenada de destino para posição numérica

            // ==========================
            // LÓGICA DE CAPTURA
            // ==========================
            
            // 1. Verifica se foi En Passant
            if (enPassantAlvo && coordDestino === enPassantAlvo.square && pecaSelecionada.src.includes('peao')) { // Se for En Passant
                const direcaoInversa = (cor === 'white') ? 1 : -1; // Direção oposta para encontrar o peão capturado o peão está atras da casa de destino então voce precisa voltar uma linha
                const casaPeaoCapturado = posicaoID({ // Coordenadas do peão capturado 
                    x: posDestino.x, //mesma coluna do destino 
                    y: posDestino.y + direcaoInversa //linha atrás do destino ex: se o peão branco foi para 5, o preto está em 6
                });
                
                const casaInimiga = document.querySelector(`.casa[data-coord="${casaPeaoCapturado}"]`); //seleciona a casa do peão capturado
                const peaoInimigo = casaInimiga?.querySelector('.peca'); //seleciona o peão inimigo na casa capturada
                if (peaoInimigo) peaoInimigo.remove(); //remove o peão capturado do tabuleiro
            } 
            // 2. Captura Normal (se houver peça na casa de destino)
            else if (pecaNaCasa) { // Se houver uma peça na casa de destino
                pecaNaCasa.remove(); //remove a peça capturada do tabuleiro
            }

            // Move a peça
            casaClicada.appendChild(pecaSelecionada); //move a peça para a casa de destino

            // ==========================
            // ATUALIZAR STATUS EN PASSANT
            // ==========================
            
            // Se o peão moveu 2 casas, ele cria uma oportunidade de En Passant para o próximo turno
            if (pecaSelecionada.src.includes('peao') && Math.abs(posOrigem.y - posDestino.y) === 2) { // traducao A diferença entre a linha de origem e destino é 2 ?
                const direcaoMeio = (cor === 'white') ? 5 : 2; // Linha intermediária onde o peão "pula"
                const yAlvo = (cor === 'white') ? 5 : 2; // Linha onde o peão inimigo pode capturar via En Passant

                // Define a casa alvo para En Passant
                
                enPassantAlvo = { // Armazena a posição alvo para En Passant
                    square: letras[posOrigem.x] + numeros[yAlvo], // Coordenada alfanumérica da casa alvo
                    pawnColor: cor // Cor do peão que pode ser capturado via En Passant
                };
            } else {
                // Se qualquer outra jogada foi feita, o En Passant expira
                enPassantAlvo = null; // Reseta o status de En Passant
            }
        }

        // Reset
        pecaSelecionada.style.opacity = '1'; 
        pecaSelecionada = null;
        casaSelecionada = null;
        movimentosPossiveis = [];
    }
});




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
            if (enPassantAlvo && posicaoID(diag) === enPassantAlvo.square && enPassantAlvo.pawnColor !== cor) { //verifica se a diagonal é a casa alvo do En Passant e se a cor do peão alvo é diferente
                movimentos.push(enPassantAlvo.square); //adiciona a posição do En Passant à lista de movimentos possíveis
            }
        }
    });

    return movimentos;
}