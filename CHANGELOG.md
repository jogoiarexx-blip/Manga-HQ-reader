## 2.2.1 — Biblioteca 5

- Adiciona a pasta pública do Google Drive como Biblioteca 5.
- Biblioteca 5 contém Godzilla vs Power Rangers #1 a #5 em páginas WebP separadas.
- Mantém leitura direta via Drive API com series.json e manifest.json.
- Adiciona filtro específico “Biblioteca 5 — Godzilla vs Power Rangers”.
- Atualiza o cache PWA para v2.2.1.

## 2.2.0 — Leitura direta de pastas WebP no Google Drive

- Detecta automaticamente pastas de HQ com páginas numeradas em WebP/JPG/PNG.
- Reconhece `manifest.json` por edição e `series.json` na pasta da coleção.
- Cria uma entrada por edição e usa a primeira página/capa definida no manifesto.
- Carrega somente a página necessária pela Google Drive API, evitando baixar o CBR/CBZ inteiro.
- Mantém modos Página, Dupla, Vertical e Webtoon, progresso, marcadores, miniaturas e pré-carregamento.
- Agrupa edições pela série definida em `series.json`.
- CBR/CBZ/RAR/ZIP e PDF continuam funcionando como formatos legados/alternativos.
- Interface e cache PWA atualizados para a versão 2.2.0.

# v2.1.0 — Biblioteca 4 e novos acervos

- adiciona a Biblioteca 4 a partir da pasta de novidades do Google Drive;
- incorpora 102 arquivos inéditos ao catálogo estático, sem duplicar nomes/IDs existentes;
- remove duplicata interna de Hulk Vermelho #7;
- adiciona categorias para Sonic, Spawn, Godzilla/Power Rangers, Wolverine, Vingadores, Quarteto Fantástico, Hulk, Homem de Ferro, Homem-Aranha, Doutor Estranho, Thunderbolts, X-Factor/NYX e Tempestade;
- catálogo estático passa de 230 para 332 itens.

# Changelog

## v2.1.0
- Sincronização do Drive separada por biblioteca, com progresso, cancelamento e tolerância a falha parcial.
- Miniaturas de páginas e salto direto pelo navegador de páginas.
- Preferências de leitura por arquivo: modo, direção, ajuste e corte de margens.
- Ajustes Página, Largura e Altura.
- Corte leve de margens para aproveitar melhor a tela.
- PDF protegido por senha com prompt de senha.
- Tentativa de senha em arquivos RAR/CBR criptografados.
- Modo de memória reduzida automático para quadrinhos compactados muito grandes.
- Filtros de fonte/categoria aplicados também a Coleções, Continuar lendo e Destaques.
- Trilhos por universo na página inicial.
- Diagnóstico integrado de PWA, armazenamento e motores do leitor.
- Ícones PWA com suporte maskable.
- Preferência por runtimes locais em vendor/ com fallback para CDN/cache.
- Backup/restauração inclui preferências por arquivo.

# v2.1.0

- Leitor de mangá/HQ reforçado para PDF, CBR, CBZ, RAR e ZIP.
- Detecção automática do formato real por assinatura binária: arquivos CBR/CBZ renomeados incorretamente podem abrir pelo motor correto.
- Fallback automático entre ZIP e RAR quando a extensão não corresponde ao conteúdo.
- Página dupla inteligente: a capa fica sozinha e as páginas seguintes usam pares.
- RTL/mangá preservado no modo de página dupla.
- Recuperação por página: uma imagem corrompida ou incompatível não precisa derrubar o leitor inteiro.
- Botão para tentar novamente páginas que falharam.
- Pinch-to-zoom no celular e novos atalhos PageUp/PageDown/Home/End no PC.
- Re-renderização adaptativa ao girar/redimensionar a tela.
- Melhor suporte a imagens WebP/AVIF/JPEG/PNG/GIF/BMP/JFIF/ICO dentro de arquivos compactados.
- Cache/PWA atualizado para v2.1.0.

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
