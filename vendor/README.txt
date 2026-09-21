Runtimes locais opcionais.

Se estes arquivos forem adicionados, o app prefere versões locais antes de usar CDN/cache:
- pdfjs/pdf.mjs
- pdfjs/pdf.worker.mjs
- jszip/jszip.mjs
- unrar/unrar.mjs
- unrar/unrar.wasm

A build v2.1.0 NÃO inclui binários falsos. Sem esses arquivos, o app usa CDN e Service Worker como fallback.
