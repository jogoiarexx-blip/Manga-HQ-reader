// Configuração do Manga HQ Reader para hospedagem estática (GitHub Pages).
// A chave é opcional: sem ela, o catálogo incluído no projeto continua funcionando.
// Para sincronizar novos arquivos e tentar baixar CBR/CBZ direto do Drive, informe a chave
// pelo botão Configurações do próprio app ou preencha driveApiKey abaixo. O navegador ainda
// pode bloquear alguns downloads por regras de acesso/CORS; o app mantém arquivo local como fallback.
window.MHQR_CONFIG = {
  appVersion: '1.7.0',
  folderIds: ['1e-gclwa21fdNBuGyoCaucMUEekTws8_g', '1Ly_9LzZht815cVzUsLPfR4BwvSYOilzK', '1VmG0IF3bZwRXHxQ-k1g7euycikJAKZPw'],
  folderUrls: ['https://drive.google.com/drive/folders/1e-gclwa21fdNBuGyoCaucMUEekTws8_g', 'https://drive.google.com/drive/folders/1Ly_9LzZht815cVzUsLPfR4BwvSYOilzK', 'https://drive.google.com/drive/folders/1VmG0IF3bZwRXHxQ-k1g7euycikJAKZPw'],
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
