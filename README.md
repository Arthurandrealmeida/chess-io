# ♟️ Xadrez JavaScript - Jogo Completo com IA propria e StockFish

Um jogo de xadrez completo feito em **JavaScript puro** (vanilla), com interface interativa, todas as regras oficiais e 6 níveis de dificuldade de IA — do aleatório até integração com **Stockfish**.

![Demonstração do jogo](https://via.placeholder.com/800x450.png?text=Xadrez+JavaScript+Demo)  
*(substitua esta imagem por um GIF ou screenshot real do seu jogo quando puder)*

## ✨ Principais Características

- Tabuleiro interativo 8×8 com drag & drop **e** seleção por clique
- Regras completas do xadrez:
  - Roque (pequeno e grande)
  - En passant
  - Promoção de peão (atualmente para rainha)
  - Xeque, xeque-mate e empate por afogamento
  - Regra dos 50 lances
  - Repetição de posição (3×)
  - Material insuficiente
- Sistema de turno rigoroso + validação anti-xeque
- **6 níveis de dificuldade da IA**:
  1. Aleatório  
  2. Prefere capturas + controle do centro  
  3. Evita mate em 1  
  4. Minimax simples + avaliação de mobilidade  
  5. Minimax α-β depth 3 + anti-blunder agressivo  
  6. **Stockfish** (nível muito forte – praticamente imbatível)
- Interface de controle para escolher nível, cor do bot e modo auto-play
- Destaque visual de xeque no rei
- Código modular e comentado (em português)

## 🚀 Demonstração Online

Em breve... (quando hospedar no GitHub Pages, Vercel, Netlify etc.)

Ou teste localmente em segundos (veja instruções abaixo)

## 📋 Requisitos

- Navegador moderno (Chrome, Edge, Firefox, Safari...)
- Nenhum servidor necessário (funciona direto com `file://`)
- Para o **nível 6** (Stockfish):  
  precisa do arquivo `stockfish.js` (WebAssembly) na pasta correta

## 🛠️ Como Executar Localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/SEU_USUARIO/xadrez-javascript.git
   cd xadrez-javascript
