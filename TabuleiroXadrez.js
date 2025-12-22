

const tabuleiro = document.getElementById('board');

    const letras = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const numeros = ['8', '7', '6', '5', '4', '3', '2', '1'];

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

        }
    }
}

criarTabuleiro();

const imgpath = {
    'black': {
        'pawn': '/img/peãoPreto.png',
        'rook': '/img/torrePreto.png',
        'knight': '/img/cavaloPreto.png',
        'bishop': '/img/bispoPreto.png',
        'queen': '/img/rainhaPreto.png',
        'king': '/img/reiPreto.png',
    },
    'white': {
        'pawn': '/img/peãoBranco.png',
        'rook': '/img/torreBranco.png',
        'knight': '/img/cavaloBranco.png',
        'bishop': '/img/bispoBranco.png',
        'queen': '/img/rainhaBranco.png',
        'king': '/img/reiBranco.png',
    }
};