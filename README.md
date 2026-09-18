# Manga HQ Reader — GitHub Pages v3.1.0

Leitor estático de mangás/HQs feito para rodar diretamente no GitHub Pages, sem Node.js, Express ou servidor próprio.

## v3.1 — correções e estabilidade

- Corrigida a corrida assíncrona ao fechar/trocar de HQ durante download ou extração.
- Downloads grandes agora são cancelados ao sair do leitor.
- Extrações de páginas antigas são invalidadas para não deixar Blob/URL preso na memória.
- Progresso não reconstrói mais a biblioteca inteira a cada página.
- Layout do leitor não reserva uma faixa vazia quando o rodapé está oculto.
- Controles de modo/direção foram compactados e permanecem acessíveis no celular.
- Toque para virar página usa apenas as laterais; o centro fica livre para leitura/zoom.
- Adicionado gesto de swipe na leitura por página.
- Busca ignora acentos (ex.: `raizes` encontra `Raízes`).
- Estatísticas contam apenas itens presentes na biblioteca atual.
- CBR/CBZ ignora lixo de compactação como `__MACOSX`, `.DS_Store` e `._arquivo`.
- Mensagem específica para CBR/RAR protegido por senha.
- Aviso de arquivo grande considera a memória aproximada do dispositivo quando disponível.
- Sincronização do Drive percorre subpastas, não apenas a raiz.
- Atalhos do leitor ficam bloqueados enquanto modais/campos de formulário estão ativos.
- PWA ganhou ícones PNG 192/512 e cache de runtime para as bibliotecas de descompactação após o primeiro uso online.
- Links externos são abertos com `noopener,noreferrer`.

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
