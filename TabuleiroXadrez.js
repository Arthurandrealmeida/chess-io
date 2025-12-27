

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


criarTabuleiro();

let pecaSelecionada = null; //guarda a img da peça selecionada
let casaSelecionada = null;  //guarda a casa onde a peça estava antes de ser movida a div.casa

tabuleiro.addEventListener('click', (e) => { //e é o evento de clique na div#board
    const casaClicada = e.target.closest('.casa'); //pega a casa clicada
    if (!casaClicada) return; //se não clicou em uma casa, sai da função
    const pecaNaCasa = casaClicada.querySelector('.peca'); //pega a peça na casa clicada

    //em um click entra no if, no outro entra no else
    if (!pecaSelecionada) {   //se nenhuma peça está selecionada se for true entra no if se for false entra no else
        if (pecaNaCasa) { //se uma peça na casa clicada
            pecaSelecionada = pecaNaCasa; //seleciona a peça
            casaSelecionada = casaClicada; //guarda a casa onde a peça estava
            pecaSelecionada.style.opacity = '0.5'; //deixa a peça semi-transparente para indicar que está selecionada
        }
    } 
    else { 
        if (casaClicada === casaSelecionada) { //se clicou na mesma casa onde a peça estava
            pecaSelecionada.style.opacity = '1'; //deixa a peça opaca novamente
            pecaSelecionada = null; //deseleciona a peça
            casaSelecionada = null;  //limpa a casa selecionada
        }

        if (!pecaNaCasa) { //se clicou em uma casa diferente da casa onde a peça estava
            if (!pecaNaCasa) { //se não há peça na casa clicada
                casaClicada.appendChild(pecaSelecionada); //move a peça para a nova casa
                pecaSelecionada.style.opacity = '1'; //deixa a peça opaca novamente
                pecaSelecionada = null; //deseleciona a peça
                casaSelecionada = null; //limpa a casa selecionada
            }
        }
    }
});