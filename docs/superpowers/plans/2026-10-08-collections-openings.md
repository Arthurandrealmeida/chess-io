# Coleção histórica, aberturas e navegação

Pedido: acrescentar seis partidas à coleção existente; cinco aberturas agressivas (três de brancas, duas de pretas), com linhas de teoria; setas para revisar; Puzzle em construção. Manter a referência visual e o funcionamento estático no GitHub Pages.

1. Validar o placar, a sequência completa e a posição de prévia dos nove PGNs. Acrescentar comentários em momentos decisivos, com atalhos para essas posições.
2. Criar dados locais de cinco aberturas, cada uma com três variantes legais, planos e comentários. Conferir os nomes e continuações com fontes de xadrez; incluir links na interface.
3. Reutilizar os cards e o reprodutor de tabuleiro. Criar rotas de coleção e de estudo, seletor de variante e lances clicáveis. Mostrar a perspectiva das pretas nos dois repertórios de pretas.
4. Integrar ←/→, preservando edição de texto e navegação de casas no tabuleiro de uma partida em andamento. Acrescentar Puzzle ao menu e uma página com aviso de construção. Ajustar menu móvel e cards com títulos longos.
5. Executar testes, verificação de sintaxe e build estático. Revisar a mudança completa e corrigir problemas relevantes.

Decisões: comentários nas posições importantes, pois a frase incompleta do pedido não especifica pausa automática; pergunta opcional enviada. Trabalhar na cópia já isolada em outputs/chess-studio, que contém alterações anteriores ainda sem commit. Não publicar nem sobrescrever a pasta Downloads.

Verificação: testes de dados contra placares, últimos lances e contagens conhecidos; comentários apontam para os lances corretos; variantes mantêm seus prefixos; seleção e limites de revisão; atalhos ignoram formulários e diálogos inadequados. A inspeção visual pelo navegador file:// foi bloqueada pela política anteriormente; não contornar esse bloqueio.

## Registro de execução

- Coleção: nove PGNs completos e prévias verificadas com chess.js, placares e últimos lances esperados. Comentários em todas as partidas, com seleção de momentos. Confirmação recebida do usuário: comentários nos lances importantes.
- Aberturas: cinco repertórios e quinze variantes locais, com planos, comentários e links de consulta. Navegação e exportação integram a aplicação sem dependência de servidor.
- Interface: rotas, menu com Puzzle em construção, setas e controles de revisão integrados. Cards aceitam títulos de duas linhas; menu móvel permite rolagem horizontal.
- Revisão por agente: identificou acesso a lance inexistente na primeira posição; corrigido com reviewMove, usando cursor após clamp, e teste de regressão. Corrigida perda de foco: listas de lances preservam os botões ao revisar a mesma sequência. Quatro explicações de posição/material foram ajustadas após conferir as casas e a sequência no tabuleiro.
- Verificação em 08/10/2026: npm test passou em 89/89 testes; npm run check validou 24 arquivos JavaScript; npm run build concluiu com sucesso. A renderização da lista também foi exercitada em DOM mínimo, confirmando a identidade dos botões e a atualização dos callbacks. Build estático gerado em dist/. IDs do HTML e dos diálogos conferidos. Sem inspeção visual pelo navegador, sem publicação.
