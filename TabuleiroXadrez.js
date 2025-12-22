

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
