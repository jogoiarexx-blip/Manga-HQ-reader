# v1.7.0

- Adicionada Biblioteca 3 com o novo acervo do Batman (`1VmG0IF3bZwRXHxQ-k1g7euycikJAKZPw`).
- Sincronização Drive passa a percorrer 3 bibliotecas recursivamente.
- Novo filtro Biblioteca 3 — Batman.
- Contadores, teste de conexão e modal de fontes agora são dinâmicos para múltiplas bibliotecas.
- Cache/PWA atualizado para v1.7.0.
- Snapshot estático permanece com 230 itens conhecidos das Bibliotecas 1 e 2; a Biblioteca 3 é carregada via Drive API.

# v1.6.0

- Catálogo estático ampliado de 84 para 230 itens.
- Incluídos 146 arquivos que antes dependiam da primeira sincronização do Drive 2.
- Snapshot local passa a conter 65 itens da Biblioteca 1 e 165 da Biblioteca 2.
- Coleções antigas do Drive 2 agora aparecem imediatamente, inclusive Batman, Flash, Senhor Destino, Superman & Mulher-Maravilha, Watchmen, Guerras Secretas, Grandes Astros, Reino do Amanhã, Terra Um, Origem Secreta, Legado das Estrelas e Vampira & Gambit.
- Catálogo reorganizado por biblioteca, coleção e numeração natural.
- Sincronização pela Drive API continua disponível para descobrir alterações posteriores ao snapshot local.
- Cache/PWA atualizado para v1.6.0.

# v1.5.0

- Grade com carregamento progressivo em lotes para reduzir RAM e DOM em bibliotecas grandes.
- Filtro Novos para arquivos modificados nos últimos 30 dias.
- Campo para ir diretamente a uma página no leitor.
- Velocidade configurável da rolagem automática.
- Botão de concluído agora alterna entre lido e não lido.
- Ajustes de desempenho e usabilidade em PC e celular.

# Manga HQ Reader v1.5.0

- Filtro por fonte: Biblioteca 1, Biblioteca 2 e Offline/local.
- Teste de conexão da Google Drive API dentro das configurações.
- Guia embutido explicando como ler arquivos do Drive.
- Contagem e status das bibliotecas no modal de fontes.
- Identificação visual da fonte em cada card.
- Toque no centro da página abre/fecha os controles no celular.
- Controles móveis fecham automaticamente após alguns segundos.
- Novos atalhos no PC: F, M, D e ?.
- Melhorias de layout e ergonomia em PC e celular.

# Changelog

## 1.3.0
- Redesign completo da experiência mobile.
- Barra inferior rolável com rótulos, sem espremer 8 atalhos.
- Home compacta no celular e busca/filtros fixos durante a rolagem.
- Cards em formato horizontal em telas estreitas.
- Leitor móvel com controles em painel dedicado e mais área para a página.
- Melhorias de safe-area, modais em bottom-sheet, gestos e prevenção de toque duplo após swipe.
- PDF/CBR/CBZ em tela cheia com menos bordas e efeitos no celular.

## 1.2.0
- Adicionados 14 arquivos de Dandadan ao catálogo local.
- Adicionadas 6 edições de Sucata Joe ao catálogo local.
- Catálogo local passa de 64 para 84 itens.
- Mantidos os modos Página, Dupla, Vertical e Webtoon e o novo ícone do app.

## 1.1.1
- Novo ícone oficial do Manga HQ Reader aplicado ao PWA, favicon e atalho da tela inicial.
- Adicionados tamanhos 64, 180, 192 e 512 px para melhor compatibilidade entre PC e celular.


## v1.1.0 — novos modos de leitura

- Adicionados quatro modos: Página única, Página dupla, Vertical contínuo e Webtoon.
- Página dupla respeita leitura ocidental (LTR) e mangá (RTL).
- Em celulares estreitos na vertical, Página dupla cai automaticamente para página única para preservar legibilidade.
- Rolagem automática disponível nos modos Vertical e Webtoon.
- Progresso, barra de páginas, gestos, teclado e botões foram adaptados ao avanço de duas páginas.
- PDF e CBR/CBZ usam os novos modos de forma consistente.
- Mantidas as duas bibliotecas do Google Drive, catálogo local, offline, PWA e Batcaverna externa.

## v1.0.0 — nova base oficial

- Nova base de versionamento do Manga HQ Reader.
- Leitor PDF com PDF.js.
- Suporte a PDF, CBR, CBZ, RAR e ZIP compatíveis.
- Progresso por página, favoritos e continuar lendo.
- Leitura offline com IndexedDB.
- Desempenho adaptativo para PC e celular.
- Duas bibliotecas do Google Drive.
- Batcaverna como fonte externa.
- PWA instalável, status online/offline e última sincronização.
