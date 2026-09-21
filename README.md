# Manga HQ Reader — GitHub Pages v1.7.0

Leitor estático de mangás/HQs feito para rodar diretamente no GitHub Pages, sem Node.js, Express ou servidor próprio.

## Novidades da v1.7.0

- catálogo local ampliado com **Dandadan** (14 arquivos)
- catálogo local ampliado com **Sucata Joe** (6 edições)
- catálogo estático completo desta versão: **230 itens** (65 da Biblioteca 1 + 165 da Biblioteca 2)
- três bibliotecas do Google Drive sincronizam recursivamente

- **Página única** para leitura tradicional;
- **Página dupla** para HQs e mangás em telas maiores;
- **Vertical contínuo** para leitura página após página;
- **Webtoon** com páginas encaixadas sem espaços;
- **RTL / modo mangá** aplicado também à página dupla;
- **rolagem automática** em Vertical e Webtoon;
- adaptação automática da página dupla em celulares estreitos;
- progresso real compatível com todos os modos.

## Base preservada

- PDF.js, CBR/CBZ/RAR/ZIP;
- offline via IndexedDB;
- três bibliotecas do Google Drive;
- Batcaverna como fonte externa;
- favoritos, coleções e continuar lendo;
- PWA e otimizações para desktop/celular.

## Mobile v1.7.0
- Navegação inferior rolável e legível.
- Leitor com painel de controles próprio para telas pequenas.
- Cards compactos e home reduzida.
- Modais estilo bottom-sheet e suporte a safe-area.
- Melhor comportamento de swipe/toque no leitor.

## Recursos

- PDF, CBR/RAR e CBZ/ZIP.
- Coleções automáticas por série/arco.
- Continue de onde parou, favoritos, lidos e histórico recente.
- Página única ou leitura vertical.
- Direção ocidental ou modo mangá (direita → esquerda).
- Zoom de 60% a 300%, atalhos e navegação por toque/swipe.
- Próxima edição da mesma coleção ao terminar.
- Backup/restauração de progresso e preferências em JSON.
- Arrastar e soltar arquivos locais no PC.
- PWA responsiva para PC e celular.

## Google Drive

Pasta configurada:

`1e-gclwa21fdNBuGyoCaucMUEekTws8_g`

Sem API key, o app usa `data/catalog.json`; PDFs públicos podem ser abertos pelo preview do Drive. A chave da Google Drive API é usada para sincronizar o catálogo e também é tentada no download de CBR/CBZ. Dependendo das políticas de acesso/CORS do Google para um arquivo, o download direto de quadrinhos compactados ainda pode falhar num site puramente estático; nesse caso o leitor oferece abertura local como fallback.

Restrinja qualquer API key ao endereço do seu GitHub Pages e habilite somente a Google Drive API.

## Publicar

1. Envie todo o conteúdo desta pasta para a raiz do repositório.
2. GitHub → **Settings → Pages**.
3. **Deploy from a branch**.
4. Branch `main` e pasta `/(root)`.
5. Salve.

Para `luispauloalves500/Manga-HQ-Reader`, o endereço esperado é:

`https://luispauloalves500.github.io/Manga-HQ-Reader/`

## Dependências no navegador

- CBR/RAR: `node-unrar-js` + WebAssembly, carregados sob demanda.
- CBZ/ZIP: `JSZip`, carregado sob demanda.

Essas dependências são armazenadas pelo service worker depois do primeiro uso online. Para uma instalação totalmente autossuficiente desde o primeiro acesso offline, elas precisariam ser vendorizadas dentro do repositório.

## Limitação atual do PDF

PDF público usa o preview do Google Drive. Por isso o app não recebe o número exato da página lida dentro do iframe; o progresso do PDF é aproximado e existe o botão **Marcar lido**. Um leitor PDF próprio (PDF.js) é a evolução indicada para progresso real por página.


### Interface e navegação

- visual redesenhado com estilo mais moderno e premium
- topo e painéis com efeito glassmorphism
- hero principal mais bonito com destaque visual e tags rápidas
- cards de HQs e coleções com sombras, gradientes e hover mais elegante
- biblioteca com aparência mais limpa no PC e no celular
- modais, avisos e leitor com acabamento visual mais refinado
- base funcional consolidada, com interface mais bonita


### Logo e downloads
- nova identidade visual Manga HQ Reader integrada ao cabeçalho e aos ícones PWA
- botão de download em cada PDF/CBR/CBZ
- botão de download disponível dentro do leitor
- download direto pelo Google Drive sem carregar arquivos grandes inteiros na memória do navegador
- arquivo local também pode ser salvo novamente pelo botão de download


## Leitura offline

- Use o botão de nuvem nos cards para salvar PDF/CBR/CBZ no próprio navegador.
- A aba **Offline** mostra somente os arquivos disponíveis sem internet.
- Os arquivos ficam armazenados em IndexedDB, separados do cache comum da PWA.
- Em Configurações, o app informa o espaço usado e permite limpar toda a biblioteca offline.
- Para salvar arquivos do Google Drive offline de forma confiável, configure uma Google Drive API Key restrita ao domínio do seu GitHub Pages.
- Arquivos locais abertos pelo aparelho também podem ser salvos offline no navegador.


## Duas bibliotecas do Google Drive

Esta versão mantém três pastas do Google Drive configuradas ao mesmo tempo. Sem chave de API, esta versão já abre com um snapshot local de 230 itens encontrados nas duas bibliotecas. Com uma Google Drive API Key, o botão Atualizar percorre recursivamente as três bibliotecas e suas subpastas, encontra alterações mais recentes, mescla os arquivos e remove duplicados pelo ID do Drive.


## Revisão geral

- correção do cache PWA para não apagar caches de outros projetos do mesmo github.io
- service worker atualizado e verificação de update ao abrir o app
- 404 antigo removido; agora é um redirecionador leve para a biblioteca atual
- botão Pastas Drive mostra as três bibliotecas separadamente
- coleções agora aproveitam o caminho real das subpastas do Drive
- busca também encontra nomes de pastas/coleções
- downloads do leitor e salvamentos offline não se cancelam mais mutuamente
- verificação de espaço disponível antes de salvar arquivos offline grandes
- catálogo local traz um snapshot completo das duas bibliotecas na data desta versão; a API serve para buscar mudanças posteriores
- backup passa a registrar a versão atual do app automaticamente


### Leitor PDF próprio

PDFs agora são renderizados com PDF.js: o app salva a página exata, percentual de leitura e permite modo página/vertical, zoom, ajuste à largura e swipe. Arquivos PDF salvos offline abrem no mesmo leitor sem depender do visualizador do Google Drive. Para PDFs online do Drive, a API Key é recomendada para acesso CORS confiável.


### Otimização v5.2
O leitor possui modo de desempenho Automático, Econômico e Qualidade máxima. No Automático, celulares com pouca RAM/CPU recebem cache menor, renderização PDF mais leve e descarregamento de páginas distantes para reduzir travamentos e consumo de bateria.


## Batcaverna como fonte externa

- adiciona **Batcaverna — Acervo Externo** à janela de fontes;
- mantém as três bibliotecas do Drive sincronizadas separadamente;
- oferece botões para abrir o site oficial e o Drive externo;
- não copia nem redistribui os arquivos externos dentro do projeto.


## Google Drive
Para sincronizar e ler diretamente no leitor interno, mantenha as pastas públicas, ative a Google Drive API em um projeto do Google Cloud e informe uma API Key restrita ao domínio do GitHub Pages. O app inclui um botão de teste de conexão nas Configurações. Arquivos privados exigem OAuth 2.0.


## Biblioteca 3 — Batman

Novo acervo integrado: `1VmG0IF3bZwRXHxQ-k1g7euycikJAKZPw`. A sincronização pela Drive API percorre suas sagas e subpastas recursivamente. O snapshot estático desta versão continua com os 230 itens já catalogados das Bibliotecas 1 e 2; os itens da Biblioteca 3 aparecem após sincronizar pela API.
