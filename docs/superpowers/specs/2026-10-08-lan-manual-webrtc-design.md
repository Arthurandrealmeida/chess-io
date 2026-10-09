# Chess Studio — convite manual de partida LAN

## Objetivo

Permitir que duas pessoas abram o Chess Studio no GitHub Pages (ou em outra hospedagem estática), sem instalar programas e sem servidor de sala externo, e joguem quando seus aparelhos conseguem se comunicar na mesma rede local.

## Abordagens consideradas

1. **Sinalização manual com WebRTC (escolhida):** o navegador do anfitrião cria uma oferta, o convidado cria uma resposta, e os dois códigos são trocados por copiar/colar. Depois da negociação, os lances trafegam diretamente pelo DataChannel.
2. **Servidor local existente:** mantém a troca de sala automática, mas exige iniciar o servidor Node no computador anfitrião e usar o endereço local desse computador.
3. **Sinalização hospedada:** permite um único link que conecta automaticamente, mas depende de um serviço externo, o que o usuário quer evitar.

A primeira opção atende ao pedido de não instalar nada e não depender de uma infraestrutura de salas. Ela tem mais um passo de troca manual e exige que a rede permita tráfego direto entre os aparelhos.

## Fluxo da partida

- O anfitrião informa nome e tempo, cria a partida e joga de brancas. O navegador cria um `RTCPeerConnection` e um DataChannel confiável/ordenado.
- Após terminar de coletar candidatos ICE locais, a tela mostra um código de convite copiável junto ao endereço do Chess Studio. O anfitrião envia essa mensagem ao convidado.
- O convidado abre o site, cola o código de convite e informa o nome. O navegador aplica a oferta, cria a resposta e mostra um código de resposta copiável.
- O convidado devolve o código. O anfitrião o cola na própria tela para concluir a negociação. Quando o DataChannel abrir, começa a partida; o convidado joga de pretas.
- Não há serviço de sala, STUN, TURN, retransmissão de lances ou tráfego para outro dispositivo de rede. Os códigos carregam descrições de sessão e candidatos de rede usados apenas para estabelecer essa conexão.

## Estado e regras do jogo

- O anfitrião é a autoridade da partida: valida os lances, controla os relógios, calcula o resultado e transmite snapshots ao convidado. Isso preserva as regras atuais sem exigir que os dois navegadores conciliem estados concorrentes.
- Ambos continuam usando a tela LAN existente: tabuleiro, relógios, revisão de lances, abandono, resultado, PGN e análise local do Stockfish.
- A conexão é de um anfitrião para um convidado. Os códigos são válidos para uma tentativa/sessão; para começar outra sala ou refazer uma negociação que falhou, gere novos códigos.
- Fechar/atualizar a aba ou perder a conexão sem recuperação do DataChannel encerra a sessão atual; não há servidor para guardar a sala ou restaurá-la após recarregar.

## UI e tutorial

- Substituir o aviso atual de que é necessário executar `npm run lan` por uma tela de convite manual que funciona na hospedagem estática.
- Criar e entrar devem mostrar fases explícitas: preparando convite, convite pronto, aguardando resposta, resposta pronta, conectando, conectado e erro.
- Incluir tutorial visível com os quatro passos: criar e copiar o convite; amigo abrir o site e colar; amigo copiar a resposta e devolver; anfitrião colar a resposta e começar.
- Incluir um aviso curto e persistente: os dois aparelhos precisam estar na mesma rede; a conexão pode falhar se o roteador/rede de convidados bloquear comunicação entre dispositivos. Quando o navegador solicitar acesso à rede local, a pessoa deve permitir.
- Os campos devem ser `textarea` acessíveis, com botões de copiar e fallback de seleção manual. Mostrar erros para código inválido, navegador sem WebRTC, negociação expirada ou timeout de conexão.
- No convite enviado, copiar o endereço estático do site e o código de oferta no mesmo texto, para que o amigo possa abrir e entrar no fluxo correto.

## Restrição de rede e privacidade

- Usar WebRTC nativo com `iceServers: []`; não consultar STUN/TURN nem enviar candidatos a serviços externos.
- Compartilhar somente candidatos locais de host (endereços privados/link-local e nomes mDNS `.local`), removendo candidatos públicos da descrição. Isso mantém o objetivo LAN-only, inclusive quando um navegador reúne candidatos IPv6 globais.
- A oferta/resposta pode conter dados de sessão e identificadores de endereços locais. A interface deve dizer para enviar o código apenas ao adversário e não tratá-lo como código público de sala.
- O WebRTC protege o canal entre navegadores, mas o anfitrião é a autoridade do jogo e o protocolo não pretende resistir a clientes modificados.
- GitHub Pages fornece HTTPS e os arquivos estáticos; browsers com proteção de rede local podem pedir uma autorização durante a conexão. O tutorial explica esse passo sem depender de uma chamada HTTP ao IP local.

## Arquivos e validação esperados

- Criar um módulo independente para negociação WebRTC, codificação/validação dos códigos, filtragem de candidatos locais e DataChannel.
- Adaptar a integração LAN em `src/app.js`, o formulário em `index.html`, os estilos LAN em `estiloXadrez.css` e as instruções em `README.md`.
- Atualizar build/publicação estática para incluir o novo módulo automaticamente; nenhum pacote novo deve ser necessário.
- Criar testes significativos para codificação de oferta/resposta, rejeição de conteúdo inválido e filtragem de candidatos públicos. Validar compilação e suíte existente.
- Fazer uma verificação manual com dois contextos de navegador no mesmo computador, incluindo a troca dos códigos e lances nos dois sentidos. Isso valida o fluxo do navegador, mas não substitui teste em dois aparelhos físicos na rede do usuário.

## Fora do escopo

- Partidas entre redes diferentes, lobby público, links curtos de sala, contas, chat, persistência, serviço de sinalização, TURN, instalação de aplicativos e retomada da partida após recarregar a página.

## Riscos conhecidos

- O isolamento de clientes em redes de convidados, firewall local, VPN, políticas do navegador e suporte/permissão de rede local podem impedir a conexão direta.
- Como o SDP completo é trocado manualmente, os códigos podem ser longos. A UI deve permitir copiar/colar texto; não depender de URLs gigantes ou códigos de seis caracteres.
- Relógios sincronizam por snapshots enviados pelo anfitrião. A tela do convidado estima a contagem localmente entre mensagens; latência pode causar pequenas diferenças visuais, mas apenas o relógio do anfitrião decide o resultado.
