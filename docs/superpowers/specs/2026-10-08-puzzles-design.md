# Puzzles no chess.io — proposta técnica

Data: 08/10/2026. Estado: primeira versão implementada com 1.000.000 de puzzles; expansão completa futura.

## Objetivo e escopo

Disponibilizar muitos puzzles do Lichess dentro do próprio GitHub Pages, sem API durante o jogo, conta obrigatória, servidor de aplicação ou serviço adicional. Começar com uma validação de 100 mil, publicar inicialmente 1 milhão e ampliar para a coleção completa se as medições integrais confirmarem os limites. Esses números são metas; registros inválidos serão excluídos e a contagem real será exibida.

O nome do produto é **chess.io**. O nome não muda o endereço github.io nem registra um domínio. A aba Puzzle deve manter as cores, peças, tipografia, tabuleiro e comportamento responsivo atuais.

## Pesquisa e medições

A [base oficial do Lichess](https://database.lichess.org/#puzzles) informa 6.157.341 puzzles e permite redistribuição sob CC0. A API não é necessária para esta proposta.

| Conteúdo | Tamanho | Evidência |
|---|---:|---|
| Download original `.csv.zst` | 307.234.795 bytes; 307,2 MB / 293,0 MiB | Cabeçalho HTTP Content-Length e resposta HTTP 206 |
| CSV original descompactado completo | Aproximadamente 1,14 GB | Projeção de amostra; não foi medido integralmente |
| Dados essenciais em JSON completo | Aproximadamente 686 MB | Projeção de amostra |
| Dados essenciais em pacotes JSON + gzip | Aproximadamente 276 MB | Projeção de amostra, pacotes de 2.000 registros |
| 1 milhão em JSON + gzip | Aproximadamente 45 MB | Mesma projeção |
| Site atual, antes desta proposta | Aproximadamente 2,2 MB | Medição local do diretório dist |

Método: HEAD no download oficial, seguido de Range bytes=0-4194303, com resposta 206. Descompressão do prefixo de 4 MiB; descarte da última linha incompleta. Foram analisadas 82.852 linhas completas, com 15.335.393 bytes de CSV. Cada registro foi convertido para `[id, fen, movesUci, rating, themeIds]`. Os pacotes de 2.000 registros tiveram média de 44,88 bytes compactados por puzzle. Não foi criado banco de puzzles no aplicativo.

A amostra é o início do arquivo, ordenado por ID, e não uma amostragem aleatória. A projeção não inclui índices, eventuais traduções, mudanças de distribuição por dificuldade nem outras informações opcionais. Reservar **300–400 MB** para a coleção completa e seus índices, sujeito à medição real. Os filtros de dificuldade podem alterar a taxa de compressão.

A página informa atualização em 05/10/2026, mas o download servido respondeu Last-Modified 02/10/2026. Na importação integral, registrar hash, cabeçalhos, contagem efetiva e data; não presumir que a contagem publicada e o arquivo servido são exatamente o mesmo snapshot.

O [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) limita o site publicado a 1 GB e tem limite flexível de tráfego de 100 GB/mês. O [GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) bloqueia arquivos individuais acima de 100 MiB e recomenda repositórios pequenos. Não incluir o CSV bruto no repositório ou no site.

## Arquitetura escolhida

1. Baixar e converter o banco **uma vez no computador de desenvolvimento**. As ferramentas de conversão não são instaladas nos computadores dos jogadores. Reservar aproximadamente 4 GB de disco para origem, temporários e saída durante a importação.
2. Conservar ID original, FEN, solução UCI, rating e temas. Usar o ID para um link opcional `https://lichess.org/training/{id}`, mostrado depois da tentativa; abrir esse link é opcional e externo.
3. Gerar pacotes gzip com até 2.000 registros, organizados por intervalos de rating de 200 pontos, sem duplicar puzzles com vários temas. Usar caminhos relativos ao módulo, compatíveis com github.io/repositorio/.
4. Gerar um manifesto com versão, origem, hash do download, contagem efetiva, dicionário de temas e descritores dos pacotes. Cada descritor informa caminho, hash, bytes compactados/descompactados, quantidade, faixa de rating e contagem de cada tema.
5. Ao selecionar um novo pacote, usar probabilidade proporcional à quantidade de puzzles que correspondem ao filtro; carregar esse pacote e sortear um registro correspondente. Assim temas não exigem um índice com milhões de IDs nem requisições a pacotes vazios.
6. Baixar manifesto e um pacote somente ao abrir Puzzle. Manter no máximo três pacotes em memória; reaproveitar o pacote atual por até 20 exercícios novos compatíveis antes de sortear outro, ou trocar antes se esgotar. Não baixar toda a coleção ou iniciar download de puzzles na tela Jogar.
7. Servir `.json.gz` como arquivos estáticos e descompactar explicitamente no navegador. Usar `DecompressionStream('gzip')` com fallback local vendorizado de gunzip para navegadores sem suporte. Não depender de Content-Encoding configurável no Pages nem de CDN. [Documentação da API](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream).

Orçamento de publicação: pacotes de até 256 KiB compactados e 1 MiB descompactado, subdividindo quando necessário; manifesto até 1 MiB compactado e 8 MiB descompactado; site inteiro até **750.000.000 bytes**. Se ultrapassar, reduzir a seleção mantendo variedade. Não contornar o limite com serviços externos ou vários sites.

Publicar somente gzip e manifesto, sem uma segunda cópia JSON de toda a coleção. Atualizações do banco serão manuais e raras, para conter crescimento do histórico Git. O build normal copia pacotes previamente gerados; não baixa nem valida milhões de puzzles durante o deploy do Pages.

## Regras de treino e experiência

- Reutilizar BoardView e chess.js. Aplicar automaticamente `Moves[0]` à FEN original: o primeiro lance pertence ao adversário; o jogador começa em `Moves[1]`. Orientar o tabuleiro para o jogador.
- Validar a FEN e todos os lances UCI antes de publicar. Aceitar promoção, roque e en passant. Excluir e contabilizar registros malformados, duplicados ou com solução ilegal/incompleta.
- Lance legal incorreto não avança o exercício; permitir nova tentativa. Resposta correta recebe a réplica automática do adversário. Em mate em um, aceitar qualquer lance legal que dê mate, mesmo diferente do lance gravado.
- Filtros iniciais: misto ou tema, e faixa de dificuldade. Exibir dificuldade; em modo misto, revelar tema e solução somente depois da tentativa para evitar pistas involuntárias.
- Oferecer Dica, Ver solução, Tentar novamente e Próximo puzzle. Dica ou solução marca a tentativa como assistida, sem contar como acerto independente. Revisão com ←/→ após concluir ou revelar; durante a tentativa, preservar a navegação acessível das casas do tabuleiro.
- Guardar acertos, erros, assistidos e os últimos 5.000 IDs tentados neste navegador; evitar esses IDs enquanto existir alternativa no pacote. Não prometer sincronização entre dispositivos ou um rating oficial do Lichess.
- Armazenamento indisponível não impede jogar. Filtro sem resultados e falha de rede mostram mensagens claras, com retorno ao modo misto ou Tentar novamente. Trocar filtro/cancelar carregamento não pode exibir uma resposta antiga.

## Etapas e critérios de entrega

1. **Piloto técnico de 100 mil:** conversão, legalidade, distribuição e tamanho real de pacotes/manifesto. Ainda sem publicar coleção completa.
2. **Treino completo com 1 milhão:** aba funcional, filtros, soluções, acessibilidade, progresso local e carregamento sob demanda; previsão de aproximadamente 45 MB de puzzles, mais índices.
3. **Expansão para todos os registros válidos:** importação integral e relatório, respeitando orçamento de 750 MB e os limites do Pages. Exibir a contagem efetivamente publicada.
4. **Publicação e manutenção:** verificar no endereço github.io e em celular; futuras partidas e aberturas continuam em seus módulos atuais e compartilham a folga de armazenamento.

O sucesso da fase final depende do tamanho medido após conversão integral e do uso do site permanecer dentro dos limites de tráfego. Os visitantes baixam apenas pacotes de treino, não centenas de MB por visita. Sem login, placar mundial ou sincronização no escopo inicial.

## Resultado da primeira entrega

Origem efetiva: 6.157.341 registros, 307.234.795 bytes compactados. Seleção determinística: 1.000.000, todos legais; 509 pacotes e 73 temas. Pacotes e manifesto: 44.879.235 bytes, cerca de 44,9 MB. O download bruto e temporários ficaram fora do repositório. Relatório em data/puzzles/import-report.json. A coleção completa não foi publicada nesta etapa.
