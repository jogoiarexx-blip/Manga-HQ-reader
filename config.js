// Configuração do Manga HQ Reader para hospedagem estática (GitHub Pages).
// A chave é opcional: sem ela, o catálogo incluído no projeto continua funcionando.
// Para sincronizar novos arquivos e ler HQs diretamente do Drive, informe a chave
// pelo botão Configurações do próprio app ou preencha driveApiKey abaixo. Pastas com
// manifest.json + páginas WebP numeradas são lidas página a página, sem baixar um CBR/CBZ inteiro.
window.MHQR_CONFIG = {
  appVersion: '2.2.5',
  folderIds: ['1e-gclwa21fdNBuGyoCaucMUEekTws8_g', '1Ly_9LzZht815cVzUsLPfR4BwvSYOilzK', '1VmG0IF3bZwRXHxQ-k1g7euycikJAKZPw', '1xVUuHmicfUlKj30fZ7h0vMf9ipdzvFjy', '1sZ0-6AUXUdcLXPN6uDMbSAjk8qs_Wq7F'],
  folderUrls: ['https://drive.google.com/drive/folders/1e-gclwa21fdNBuGyoCaucMUEekTws8_g', 'https://drive.google.com/drive/folders/1Ly_9LzZht815cVzUsLPfR4BwvSYOilzK', 'https://drive.google.com/drive/folders/1VmG0IF3bZwRXHxQ-k1g7euycikJAKZPw', 'https://drive.google.com/drive/folders/1xVUuHmicfUlKj30fZ7h0vMf9ipdzvFjy', 'https://drive.google.com/drive/folders/1sZ0-6AUXUdcLXPN6uDMbSAjk8qs_Wq7F'],
  folderId: '1e-gclwa21fdNBuGyoCaucMUEekTws8_g',
  folderUrl: 'https://drive.google.com/drive/folders/1e-gclwa21fdNBuGyoCaucMUEekTws8_g',
  externalSources: [
    {
      name: 'Batcaverna — Acervo Externo',
      siteUrl: 'https://www.batcaverna.online/#codigo',
      driveUrl: 'https://drive.google.com/drive/folders/10GXhj4FZsi-HEsb3Nk6teSNP1-JKwNGo?usp=drive_link',
      note: 'Acervo externo de Batman. O conteúdo permanece hospedado fora do Manga HQ Reader.'
    }
  ],
  driveApiKey: '',
  largeArchiveWarningMB: 180,
  pageCacheLimit: 12
};
