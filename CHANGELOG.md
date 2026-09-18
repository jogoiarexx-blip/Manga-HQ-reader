## v5.3.0
- modo de desempenho Automático, Econômico e Qualidade máxima
- cache de páginas adaptativo conforme celular/RAM/CPU
- PDFs usam DPR reduzido em aparelhos limitados para economizar RAM e bateria
- páginas verticais distantes são descarregadas da memória e recarregadas quando necessário
- correção: páginas removidas do cache agora podem ser carregadas novamente
- pré-carregamento vizinho desativado em modo econômico
- otimizações de scroll, composição e efeitos visuais no celular
- limpeza extra de memória quando o app vai para segundo plano

## v5.3.0
- leitor PDF próprio com PDF.js 6.3.289
- progresso real por página para PDFs
- PDF em modo página e vertical
- zoom, ajuste à largura, swipe e navegação por teclado também em PDFs
- PDFs offline usam o mesmo leitor próprio
- carregamento por páginas no modo vertical para reduzir uso de memória
- mantém fallback de erro com acesso ao Drive quando a origem bloquear CORS

## v5.0.0
- revisão geral de arquitetura, PWA, Drive, offline e leitor
- correção de limpeza perigosa de cache no github.io
- correção do 404 antigo
- duas pastas do Drive acessíveis no app
- coleções organizadas por subpastas quando disponível
- busca inclui caminho da coleção
- downloads de leitura e offline com controladores independentes
- checagem de espaço antes do modo offline
- status claro de catálogo local versus sincronização completa
- backup versionado dinamicamente

## v4.4.0
- biblioteca offline com IndexedDB
- aba Offline
- salvar/remover offline por arquivo
- leitura offline de PDF/CBR/CBZ
- indicador de armazenamento e limpeza dos arquivos offline

## v4.1.0
- nova logo oficial integrada
- download direto nos cards
- download dentro do leitor
- novos ícones PWA derivados da identidade visual

## v4.1.0
- redesign visual completo: interface mais bonita, moderna e premium
- hero, cards, coleção, toolbar, sidebar e modais refeitos
- melhorias de contraste, sombras, gradientes e glassmorphism
- refinamento visual do leitor e da versão mobile

# Changelog

## 3.1.0

### Corrigido
- cancelamento de download e proteção contra resultados assíncronos antigos;
- vazamento de URLs Blob após fechar/trocar leitura;
- reconstrução desnecessária da biblioteca a cada página;
- faixa vazia do leitor sem rodapé;
- controles ausentes/espremidos em telas pequenas;
- atalhos disparando enquanto modais/campos estavam ativos;
- contagem de favoritos/progresso de itens fora da biblioteca;
- arquivos lixo de macOS tratados como páginas;
- diagnóstico de CBR/RAR criptografado;
- busca sem tolerância a acentos;
- sincronização limitada apenas à pasta raiz do Drive.

### Melhorado
- swipe e zonas laterais de navegação;
- limites de arquivos grandes adaptados à memória do aparelho;
- ícones PWA 192/512;
- cache de runtime das dependências de descompactação;
- segurança ao abrir links externos;
- mensagens de erro e fallback para arquivo local.
