// Configuração do Manga HQ Reader para hospedagem estática (GitHub Pages).
// A chave é opcional: sem ela, o catálogo incluído no projeto continua funcionando.
// Para sincronizar novos arquivos e tentar baixar CBR/CBZ direto do Drive, informe a chave
// pelo botão Configurações do próprio app ou preencha driveApiKey abaixo. O navegador ainda
// pode bloquear alguns downloads por regras de acesso/CORS; o app mantém arquivo local como fallback.
window.MHQR_CONFIG = {
  appVersion: '3.1.0',
  folderId: '1e-gclwa21fdNBuGyoCaucMUEekTws8_g',
  folderUrl: 'https://drive.google.com/drive/folders/1e-gclwa21fdNBuGyoCaucMUEekTws8_g?usp=sharing',
  driveApiKey: '',
  largeArchiveWarningMB: 180,
  pageCacheLimit: 12
};
