const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const CONFIG = {
  appVersion: '1.7.0',
  folderIds: ['1e-gclwa21fdNBuGyoCaucMUEekTws8_g', '1Ly_9LzZht815cVzUsLPfR4BwvSYOilzK', '1VmG0IF3bZwRXHxQ-k1g7euycikJAKZPw'],
  folderUrls: ['https://drive.google.com/drive/folders/1e-gclwa21fdNBuGyoCaucMUEekTws8_g', 'https://drive.google.com/drive/folders/1Ly_9LzZht815cVzUsLPfR4BwvSYOilzK', 'https://drive.google.com/drive/folders/1VmG0IF3bZwRXHxQ-k1g7euycikJAKZPw'],
  folderId: '1e-gclwa21fdNBuGyoCaucMUEekTws8_g',
  folderUrl: 'https://drive.google.com/drive/folders/1e-gclwa21fdNBuGyoCaucMUEekTws8_g',
  driveApiKey: '',
  largeArchiveWarningMB: 180,
  pageCacheLimit: 12,
  ...(window.MHQR_CONFIG || {})
};

const LS = {
  fav: 'mhqr:favorites',
  progress: 'mhqr:progress',
  theme: 'mhqr:theme',
  apiKey: 'mhqr:driveApiKey',
  prefs: 'mhqr:prefs',
  catalog: 'mhqr:catalogCache',
  syncMeta: 'mhqr:syncMeta'
};



const RUNTIME_URLS = [
  'https://esm.sh/pdfjs-dist@6.3.289/build/pdf.mjs',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.mjs',
  'https://esm.sh/jszip@3.10.1',
  'https://esm.sh/node-unrar-js@2.0.2?bundle',
  'https://cdn.jsdelivr.net/npm/node-unrar-js@2.0.2/esm/js/unrar.wasm'
];
function formatDateTime(ts) {
  if (!ts) return '';
  try { return new Intl.DateTimeFormat('pt-BR', { dateStyle:'short', timeStyle:'short' }).format(new Date(ts)); }
  catch { return ''; }
}
function setNetworkStatus() {
  const el = $('#networkStatus'); if (!el) return;
  const online = navigator.onLine !== false;
  el.textContent = online ? '● Online' : '● Offline';
  el.classList.toggle('online', online); el.classList.toggle('offline', !online);
  el.title = online ? 'Conectado à internet' : 'Sem internet — usando dados e HQs salvos';
}
async function warmReaderRuntimes() {
  const el = $('#runtimeStatus');
  if (!navigator.onLine) { if (el) { el.textContent = 'Offline: usando motores já armazenados no cache, quando disponíveis.'; el.className = 'runtime-status warn'; } return; }
  if (el) { el.textContent = 'Preparando motores de PDF/CBR/CBZ para uso offline…'; el.className = 'runtime-status'; }
  const results = await Promise.allSettled(RUNTIME_URLS.map(url => fetch(url, { mode:'cors', cache:'reload' }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })));
  const ok = results.filter(r => r.status === 'fulfilled').length;
  if (el) {
    if (ok === RUNTIME_URLS.length) { el.textContent = 'Motores de PDF/CBR/CBZ preparados para uso offline após esta primeira conexão.'; el.className = 'runtime-status ok'; }
    else { el.textContent = `Motores offline parcialmente preparados (${ok}/${RUNTIME_URLS.length}). O app tentará novamente quando houver internet.`; el.className = 'runtime-status warn'; }
  }
}

const storageGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
const storageSet = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };
const storageRemove = key => { try { localStorage.removeItem(key); } catch {} };
const readJson = (key, fallback) => {
  try { return JSON.parse(storageGet(key)) ?? fallback; }
  catch { return fallback; }
};

const state = {
  items: [], filter: 'all', source: 'all', search: '', sort: 'name', current: null, renderLimit: 60,
  pages: [], page: 0, mode: 'page', fit: 'contain', direction: 'ltr', zoom: 1, collection: '', archive: null,
  pageUrls: new Map(), pageUse: new Map(), verticalObserver: null,
  verticalScrollHandler: null, renderToken: 0, openToken: 0, pdfObjectUrl: '', pdfDoc: null, pdfRenderTask: null, largePending: null,
  readerDownloadController: null, offlineControllers: new Map(), touchStart: null, offlineIds: new Set(), offlineMeta: new Map(), offlineBusy: new Set(), autoScrollId: 0, autoScrollLast: 0
};

const favorites = new Set(readJson(LS.fav, []));
const progress = readJson(LS.progress, {});
const prefs = { defaultMode: 'page', direction: 'ltr', performance: 'auto', autoScrollSpeed: 46, ...readJson(LS.prefs, {}) };
function savePrefs() { storageSet(LS.prefs, JSON.stringify(prefs)); }

function performanceProfile() {
  const mode = prefs.performance || 'auto';
  const mobile = matchMedia('(max-width: 850px)').matches || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || '');
  const memory = Number(navigator.deviceMemory || 0);
  const cores = Number(navigator.hardwareConcurrency || 0);
  const constrained = (memory && memory <= 4) || (cores && cores <= 4);
  const eco = mode === 'eco' || (mode === 'auto' && mobile && constrained);
  const quality = mode === 'quality';
  return {
    mode, mobile, eco, quality,
    cacheLimit: eco ? 5 : (mobile && !quality ? 8 : Math.max(8, Number(CONFIG.pageCacheLimit || 12))),
    pdfDpr: eco ? 1 : (mobile && !quality ? 1.35 : 2),
    verticalWindow: eco ? 1 : (mobile && !quality ? 2 : 5),
    observerMargin: eco ? 420 : (mobile && !quality ? 700 : 1200),
    prefetch: !eco && document.visibilityState !== 'hidden'
  };
}
function performanceLabel() {
  const p = performanceProfile();
  return p.eco ? 'Econômico' : (p.quality ? 'Qualidade' : 'Automático');
}

let installPrompt = null;
let unrarModulePromise = null;
let unrarWasmPromise = null;
let jszipModulePromise = null;
let pdfjsModulePromise = null;



const OFFLINE_DB = { name: 'mhqr-offline-v1', version: 1, store: 'files' };
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB.name, OFFLINE_DB.version);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OFFLINE_DB.store)) db.createObjectStore(OFFLINE_DB.store, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB indisponível.'));
  });
}
async function offlineDbAction(mode, fn) {
  const db = await openOfflineDB();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_DB.store, mode);
      const store = tx.objectStore(OFFLINE_DB.store);
      let value;
      try { value = fn(store, resolve, reject); } catch (e) { reject(e); return; }
      tx.oncomplete = () => { if (value !== undefined) resolve(value); };
      tx.onerror = () => reject(tx.error || new Error('Falha no armazenamento offline.'));
      tx.onabort = () => reject(tx.error || new Error('Operação offline cancelada.'));
    });
  } finally { db.close(); }
}
async function refreshOfflineIndex() {
  try {
    const rows = await offlineDbAction('readonly', (store, resolve, reject) => {
      const req = store.getAll(); req.onsuccess = () => resolve(req.result || []); req.onerror = () => reject(req.error);
    });
    state.offlineIds = new Set(rows.map(r => r.id));
    state.offlineMeta = new Map(rows.map(r => [r.id, { id:r.id, name:r.name, size:Number(r.size||r.blob?.size||0), mimeType:r.mimeType, modifiedTime:r.modifiedTime, folderPath:r.folderPath, resourceKey:r.resourceKey, savedAt:r.savedAt, offline:true }]));
    return rows;
  } catch (err) {
    console.warn('Offline storage indisponível:', err);
    state.offlineIds = new Set(); state.offlineMeta = new Map(); return [];
  }
}
async function getOfflineRecord(id) {
  if (!id) return null;
  return offlineDbAction('readonly', (store, resolve, reject) => {
    const req = store.get(id); req.onsuccess = () => resolve(req.result || null); req.onerror = () => reject(req.error);
  });
}
async function deleteOfflineRecord(id) {
  await offlineDbAction('readwrite', (store) => store.delete(id));
  state.offlineIds.delete(id); state.offlineMeta.delete(id);
  await updateOfflineStorageInfo(); render();
}
async function updateOfflineStorageInfo() {
  const el = $('#offlineStorageInfo'); if (!el) return;
  let total = 0; for (const m of state.offlineMeta.values()) total += Number(m.size || 0);
  let quotaText = '';
  try {
    const est = await navigator.storage?.estimate?.();
    if (est?.quota) quotaText = ` • navegador: ${bytes(est.usage || 0)} de ${bytes(est.quota)}`;
  } catch {}
  el.textContent = `${state.offlineIds.size} arquivo(s) • ${bytes(total)} salvos${quotaText}`;
}
async function ensureOfflineItem(item) {
  if (!item) return item;
  const id = item.offlineOriginId || item.id;
  if (!state.offlineIds.has(id)) return item;
  const rec = await getOfflineRecord(id);
  if (!rec?.blob) return item;
  return { ...item, id, name: rec.name || item.name, size: rec.size || rec.blob.size, mimeType: rec.mimeType || item.mimeType, localFile: rec.blob, offline: true, offlineOriginId: id };
}
async function saveItemOffline(item) {
  if (!item) return;
  const id = item.offlineOriginId || item.id;
  if (state.offlineBusy.has(id)) return;
  if (state.offlineIds.has(id)) { toast('Este arquivo já está disponível offline.'); return; }
  state.offlineBusy.add(id); render();
  try {
    try { await navigator.storage?.persist?.(); } catch {}
    let blob;
    if (item.localFile) blob = item.localFile;
    else {
      try {
        const est = await navigator.storage?.estimate?.();
        const free = est?.quota ? Math.max(0, Number(est.quota) - Number(est.usage || 0)) : 0;
        if (free && item.size && Number(item.size) * 1.12 > free) throw new Error(`Espaço insuficiente para salvar offline. Livre: ${bytes(free)}.`);
      } catch (err) { if (/Espaço insuficiente/.test(err?.message || '')) throw err; }
      if (!getApiKey()) toast('Preparando cópia offline. Se o Drive bloquear, configure a API Key.');
      const data = await downloadDriveFile(item, -1, 'offline');
      blob = new Blob([data], { type: item.mimeType || 'application/octet-stream' });
    }
    const record = { id, name:item.name, size:Number(item.size || blob.size), mimeType:item.mimeType || blob.type, modifiedTime:item.modifiedTime || '', folderPath:item.folderPath || '', resourceKey:item.resourceKey || '', savedAt:Date.now(), blob };
    await offlineDbAction('readwrite', (store) => store.put(record));
    state.offlineIds.add(id);
    state.offlineMeta.set(id, { ...record, blob: undefined, offline:true });
    toast('Salvo para leitura offline.');
    await updateOfflineStorageInfo();
  } catch (err) {
    if (err?.name !== 'AbortError') toast(`Não foi possível salvar offline: ${err.message}`);
  } finally { state.offlineBusy.delete(id); render(); }
}
async function toggleOfflineItem(item) {
  const id = item?.offlineOriginId || item?.id; if (!id) return;
  if (state.offlineBusy.has(id)) {
    state.offlineControllers.get(id)?.abort();
    toast('Salvamento offline cancelado.');
    return;
  }
  if (state.offlineIds.has(id)) {
    if (!confirm(`Remover “${item.name}” da biblioteca offline?`)) return;
    await deleteOfflineRecord(id); toast('Arquivo removido do offline.');
  } else await saveItemOffline(item);
}
async function clearOfflineLibrary() {
  for (const c of state.offlineControllers.values()) c.abort();
  state.offlineControllers.clear();
  if (!state.offlineIds.size) { toast('A biblioteca offline já está vazia.'); return; }
  if (!confirm(`Remover ${state.offlineIds.size} arquivo(s) salvos offline?`)) return;
  await offlineDbAction('readwrite', (store) => store.clear());
  await refreshOfflineIndex(); await updateOfflineStorageInfo(); render(); toast('Biblioteca offline limpa.');
}
function saveFav() { storageSet(LS.fav, JSON.stringify([...favorites])); }
function saveProgress() { storageSet(LS.progress, JSON.stringify(progress)); }
function getApiKey() { return (storageGet(LS.apiKey) || CONFIG.driveApiKey || '').trim(); }
function bytes(n) {
  n = Number(n || 0);
  if (!n) return '—';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i ? 1 : 0)} ${u[i]}`;
}
function extType(item) {
  const n = (item.name || '').toLowerCase();
  if (n.endsWith('.pdf')) return 'pdf';
  if (/\.(cbr|cbz|rar|zip)$/.test(n)) return 'comic';
  return 'other';
}
function extension(name) { return (name.match(/\.[^.]+$/)?.[0] || '').toLowerCase(); }
function isArchiveJunk(name) {
  const parts = String(name || '').replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.some(part => part === '__MACOSX' || part === '.DS_Store' || part.startsWith('._'));
}
function isImage(name) { return !isArchiveJunk(name) && /\.(avif|webp|png|jpe?g|jfif|gif|bmp)$/i.test(name); }
function mimeFromName(name) {
  const e = extension(name);
  return e === '.png' ? 'image/png' : e === '.webp' ? 'image/webp' : e === '.gif' ? 'image/gif' : e === '.avif' ? 'image/avif' : e === '.bmp' ? 'image/bmp' : 'image/jpeg';
}
function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR');
}
function naturalSort(a, b) { return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }); }
function shortCover(name) {
  return name.replace(/\.(pdf|cbr|cbz|rar|zip)$/i, '').replace(/\([^)]*\)/g, '').replace(/[-_]+/g, ' ').trim().split(/\s+/).slice(0, 5).join(' ');
}
function percentFor(item) { return Math.max(0, Math.min(100, progress[item.id]?.percent || 0)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function toast(msg) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}
function uniqueItems(items) {
  return [...new Map(items.filter(x => x?.id && x?.name).map(x => [x.id, { ...x, size: Number(x.size || 0) }])).values()];
}
function thumbUrl(item) {
  if (item.localFile && !item.thumbnailLink) return '';
  return item.thumbnailLink || `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.id)}&sz=w420`;
}
function driveViewUrl(item) { const u = new URL(`https://drive.google.com/file/d/${encodeURIComponent(item.id)}/view`); if (item.resourceKey) u.searchParams.set('resourcekey', item.resourceKey); return u.href; }
function drivePreviewUrl(item) { return `https://drive.google.com/file/d/${encodeURIComponent(item.id)}/preview`; }
function safeOpen(url) {
  try {
    const u = new URL(url, location.href);
    if (!['https:','http:'].includes(u.protocol)) throw new Error('Protocolo não permitido');
    window.open(u.href, '_blank', 'noopener,noreferrer');
  } catch { toast('Link externo inválido ou bloqueado.'); }
}
function sanitizeFilename(name) {
  return String(name || 'arquivo').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'arquivo';
}
function directDownloadUrl(item) {
  if (!item || item.localFile) return '';
  const u = new URL('https://drive.usercontent.google.com/download');
  u.searchParams.set('id', item.id);
  u.searchParams.set('export', 'download');
  u.searchParams.set('confirm', 't');
  if (item.resourceKey) u.searchParams.set('resourcekey', item.resourceKey);
  return u.href;
}
async function downloadItem(item) {
  if (!item) return;
  if (item.localFile) {
    const url = URL.createObjectURL(item.localFile);
    const a = document.createElement('a');
    a.href = url; a.download = sanitizeFilename(item.name); a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Download iniciado.');
    return;
  }
  // Use navegação direta para o endpoint de download do Drive: o arquivo não precisa
  // ser carregado inteiro na memória do celular, o que é importante para CBRs grandes.
  const url = directDownloadUrl(item);
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.download = sanitizeFilename(item.name); a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  toast('Download aberto pelo Google Drive.');
}
function archiveWarningLimitMB() {
  const configured = Math.max(40, Number(CONFIG.largeArchiveWarningMB || 180));
  const memory = Number(navigator.deviceMemory || 0);
  if (memory && memory <= 2) return Math.min(configured, 70);
  if (memory && memory <= 4) return Math.min(configured, 120);
  return configured;
}

async function loadStaticCatalog() {
  const r = await fetch('./data/catalog.json', { cache: 'no-store' });
  if (!r.ok) throw new Error(`Catálogo local: HTTP ${r.status}`);
  const bundled = uniqueItems(await r.json());
  const cached = readJson(LS.catalog, []);
  return uniqueItems([...bundled, ...(Array.isArray(cached) ? cached : [])]);
}
function saveCatalogCache(items) {
  const clean = uniqueItems(items).map(({ localFile, offline, ...item }) => item);
  storageSet(LS.catalog, JSON.stringify(clean));
}

async function listDriveFolder(apiKey) {
  const fields = 'nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,resourceKey)';
  const roots = Array.isArray(CONFIG.folderIds) && CONFIG.folderIds.length ? CONFIG.folderIds : [CONFIG.folderId];
  const queue = roots.filter(Boolean).map((id, index) => ({ id, path: `Biblioteca ${index + 1}` }));
  const seenFolders = new Set();
  const items = [];
  while (queue.length) {
    const folder = queue.shift();
    if (!folder?.id || seenFolders.has(folder.id)) continue;
    seenFolders.add(folder.id);
    let pageToken = '';
    do {
      const q = `'${folder.id}' in parents and trashed = false`;
      const u = new URL('https://www.googleapis.com/drive/v3/files');
      u.searchParams.set('q', q);
      u.searchParams.set('fields', fields);
      u.searchParams.set('pageSize', '1000');
      u.searchParams.set('orderBy', 'name_natural');
      u.searchParams.set('supportsAllDrives', 'true');
      u.searchParams.set('includeItemsFromAllDrives', 'true');
      u.searchParams.set('key', apiKey);
      if (pageToken) u.searchParams.set('pageToken', pageToken);
      const r = await fetch(u, { mode: 'cors' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error?.message || `Drive API: HTTP ${r.status}`);
      for (const file of (d.files || [])) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          queue.push({ id: file.id, path: folder.path ? `${folder.path}/${file.name}` : file.name });
        } else if (/\.(pdf|cbr|cbz|rar|zip)$/i.test(file.name || '')) {
          items.push({ ...file, folderPath: folder.path });
        }
      }
      pageToken = d.nextPageToken || '';
    } while (pageToken);
  }
  return uniqueItems(items);
}

async function loadLibrary() {
  $('#refreshBtn').disabled = true;
  $('#syncStatus').textContent = 'Atualizando…';
  const key = getApiKey();
  $('#apiNotice').classList.toggle('hidden', Boolean(key));
  try {
    if (key) {
      try {
        state.items = await listDriveFolder(key);
        saveCatalogCache(state.items);
        const syncedCounts = libraryCounts();
        storageSet(LS.syncMeta, JSON.stringify({ at: Date.now(), count: state.items.length, counts: syncedCounts }));
        $('#syncStatus').textContent = 'Sincronizado com Drive';
        $('#syncDetail').textContent = `${state.items.length} arquivos • ${Array.from({length:(CONFIG.folderIds||[]).length},(_,i)=>`Biblioteca ${i+1}: ${syncedCounts[`library-${i+1}`]||0}`).join(' • ')} • agora`;
        $('#catalogNotice').classList.add('hidden');
      } catch (err) {
        state.items = await loadStaticCatalog();
        const sm = readJson(LS.syncMeta, {}); const last = formatDateTime(sm.at);
        $('#syncStatus').textContent = 'Catálogo salvo ativo';
        $('#syncDetail').textContent = `Falha na sincronização; usando ${state.items.length} itens${last ? ` • última sincronização: ${last}` : ''}`;
        $('#catalogNoticeText').textContent = 'A biblioteca completa continua disponível quando a Drive API sincroniza novamente.';
        $('#catalogNotice').classList.remove('hidden');
        toast(`Drive API: ${err.message}`);
      }
    } else {
      state.items = await loadStaticCatalog();
      const sm = readJson(LS.syncMeta, {}); const last = formatDateTime(sm.at);
      $('#syncStatus').textContent = last ? 'Catálogo salvo ativo' : 'Catálogo local ativo';
      $('#syncDetail').textContent = `${state.items.length} itens disponíveis${last ? ` • última sincronização: ${last}` : ' • configure a API para carregar todas as subpastas'}`;
      $('#catalogNoticeText').textContent = 'Sem a API Key, o app mostra o catálogo incluído no ZIP. Com a API, ele percorre as três bibliotecas e todas as subpastas.';
      $('#catalogNotice').classList.remove('hidden');
    }
  } catch (err) {
    state.items = [];
    $('#syncStatus').textContent = 'Falha no catálogo';
    $('#syncDetail').textContent = err.message;
    toast(`Falha ao carregar biblioteca: ${err.message}`);
  } finally {
    for (const meta of state.offlineMeta.values()) if (!state.items.some(x => x.id === meta.id)) state.items.push({ ...meta });
    state.items = uniqueItems(state.items);
    $('#refreshBtn').disabled = false;
    resetRenderLimit();
    render();
  }
}

function cleanFolderLabel(path) {
  const leaf = String(path || '').split('/').filter(Boolean).at(-1) || '';
  if (!leaf || /^Biblioteca\s+\d+$/i.test(leaf)) return '';
  return leaf.replace(/^\d+\s*[-–—]\s*/, '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
}
function seriesLabel(name, folderPath = '') {
  const folder = cleanFolderLabel(folderPath);
  if (folder) return folder;
  let s = String(name || '').replace(/\.(pdf|cbr|cbz|rar|zip)$/i, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bSIX\b/gi, 'Seis')
    .replace(/#\s*TPB\b/gi, ' ')
    .replace(/\bvol(?:ume)?\.?\s*\d+\b/gi, ' ')
    .replace(/#\s*\d+\b/g, ' ')
    .replace(/\b\d{1,3}\s*\(de\s*\d+\)/gi, ' ')
    .replace(/\b\d{1,3}\b/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s || shortCover(name) || 'Sem coleção';
}
function seriesKeyFor(item) { return normalizeText(seriesLabel(item?.name, item?.folderPath)); }
function collectionGroups() {
  const map = new Map();
  for (const item of state.items) {
    const key = seriesKeyFor(item);
    if (!map.has(key)) map.set(key, { key, label: seriesLabel(item.name, item.folderPath), items: [] });
    map.get(key).items.push(item);
  }
  return [...map.values()].sort((a, b) => b.items.length - a.items.length || naturalSort(a.label, b.label));
}
function renderContinueRail() {
  const recent = state.items.filter(i => {
    const p = progress[i.id]; return p && p.percent > 0 && p.percent < 100;
  }).sort((a, b) => (progress[b.id]?.updated || 0) - (progress[a.id]?.updated || 0)).slice(0, 10);
  $('#continueSection').classList.toggle('hidden', !recent.length || !['all', 'reading'].includes(state.filter) || Boolean(state.collection));
  $('#continueRail').innerHTML = recent.map(item => {
    const pct = percentFor(item), thumb = thumbUrl(item);
    return `<article class="continue-card" data-id="${escapeHtml(item.id)}"><div class="continue-thumb">${thumb ? `<img src="${thumb}" alt="" loading="lazy" onerror="this.remove()">` : escapeHtml(shortCover(item.name).slice(0,18))}</div><div class="continue-info"><strong>${escapeHtml(item.name)}</strong><small>${Math.round(pct)}% • pág. ${(progress[item.id]?.page || 0) + 1}</small><button data-continue="${escapeHtml(item.id)}">Continuar</button></div></article>`;
  }).join('');
}
function sourceKeyFor(item) {
  if (!item) return 'other';
  if (item.localFile || item.offline || item.offlineOriginId) return 'offline';
  const path = String(item.folderPath || '');
  const match = path.match(/^Biblioteca\s+(\d+)(?:\/|$)/i);
  return match ? `library-${match[1]}` : 'other';
}
function sourceLabelFor(item) {
  const key = sourceKeyFor(item);
  if (key === 'offline') return 'Offline/local';
  const match = key.match(/^library-(\d+)$/);
  return match ? `Biblioteca ${match[1]}` : 'Catálogo local';
}
function libraryCounts() {
  const counts = { offline:0, other:0 };
  for (let i = 0; i < (CONFIG.folderIds || []).length; i++) counts[`library-${i+1}`] = 0;
  for (const item of state.items) counts[sourceKeyFor(item)] = (counts[sourceKeyFor(item)] || 0) + 1;
  return counts;
}

function itemCard(item) {
  const type = extType(item), pct = percentFor(item), thumb = thumbUrl(item);
  const status = pct >= 100 ? 'concluído' : pct ? `${Math.round(pct)}% lido` : 'não iniciado';
  const offline = state.offlineIds.has(item.offlineOriginId || item.id);
  const offlineBusy = state.offlineBusy.has(item.offlineOriginId || item.id);
  return `<article class="card ${offline ? 'is-offline' : ''}" data-id="${escapeHtml(item.id)}">
    <div class="cover">
      ${thumb ? `<img class="cover-img" src="${thumb}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      <span class="badge">${type === 'pdf' ? 'PDF' : type === 'comic' ? 'CBR/CBZ' : 'ARQ'}</span>${offline ? '<span class="offline-badge">OFFLINE</span>' : ''}
      <button class="fav ${favorites.has(item.id) ? 'on' : ''}" data-action="fav" title="Favoritar">★</button>
      <div class="cover-word">${escapeHtml(shortCover(item.name))}</div>
    </div>
    <div class="card-body">
      <div class="title">${escapeHtml(item.name)}</div>
      <div class="meta"><span>${bytes(item.size)}</span><span>${status}</span></div><div class="source-line"><span class="source-chip source-${escapeHtml(sourceKeyFor(item))}">${escapeHtml(sourceLabelFor(item))}</span>${item.folderPath ? `<span class="source-path" title="${escapeHtml(item.folderPath)}">${escapeHtml(cleanFolderLabel(item.folderPath) || item.folderPath)}</span>` : ''}</div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="card-actions"><button data-action="read">${pct >= 100 ? 'Ler novamente' : pct ? 'Continuar' : 'Ler agora'}</button><button class="secondary offline-action ${offline ? 'on' : ''}" data-action="offline" title="${offline ? 'Remover do offline' : 'Salvar para ler offline'}">${offlineBusy ? '…' : offline ? '✓' : '☁'}</button><button class="secondary download-action" data-action="download" title="Baixar arquivo">⇩</button>${item.localFile ? '' : '<button class="secondary" data-action="drive" title="Abrir no Drive">↗</button>'}</div>
    </div>
  </article>`;
}
function isNewItem(item, days = 30) {
  const ts = Date.parse(item?.modifiedTime || '');
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= days * 86400000 && Date.now() >= ts;
}
function resetRenderLimit() { state.renderLimit = 60; }
function filtered() {
  const arr = state.items.filter(item => {
    const t = extType(item), p = progress[item.id];
    if (state.collection && seriesKeyFor(item) !== state.collection) return false;
    if (state.source !== 'all' && sourceKeyFor(item) !== state.source) return false;
    if (state.filter === 'favorites' && !favorites.has(item.id)) return false;
    if (state.filter === 'reading' && !(p && p.percent > 0 && p.percent < 100)) return false;
    if (state.filter === 'completed' && !(p && p.percent >= 100)) return false;
    if (state.filter === 'offline' && !state.offlineIds.has(item.offlineOriginId || item.id)) return false;
    if (state.filter === 'new' && !isNewItem(item)) return false;
    if (state.filter === 'pdf' && t !== 'pdf') return false;
    if (state.filter === 'comic' && t !== 'comic') return false;
    if (state.search && !normalizeText(`${item.name} ${item.folderPath || ''}`).includes(state.search)) return false;
    return true;
  });
  arr.sort((a, b) => state.sort === 'name' ? naturalSort(a.name, b.name)
    : state.sort === 'name-desc' ? naturalSort(b.name, a.name)
    : state.sort === 'size' ? (a.size || 0) - (b.size || 0)
    : state.sort === 'size-desc' ? (b.size || 0) - (a.size || 0)
    : state.sort === 'recent' ? (progress[b.id]?.updated || 0) - (progress[a.id]?.updated || 0)
    : state.sort === 'modified' ? String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || ''))
    : naturalSort(a.name, b.name));
  return arr;
}
function renderCollections() {
  const groups = collectionGroups().filter(g => !state.search || normalizeText(g.label).includes(state.search));
  $('#emptyState').classList.toggle('hidden', groups.length > 0);
  $('#libraryGrid').innerHTML = groups.map(g => {
    const reading = g.items.filter(i => percentFor(i) > 0 && percentFor(i) < 100).length;
    const done = g.items.filter(i => percentFor(i) >= 100).length;
    return `<article class="collection-card" data-collection="${escapeHtml(g.key)}"><div class="collection-cover"><strong>${escapeHtml(g.label)}</strong></div><div><div class="title">${escapeHtml(g.label)}</div><div class="collection-meta"><span>${g.items.length} ${g.items.length === 1 ? 'arquivo' : 'arquivos'}</span><span>${done} lidos${reading ? ` • ${reading} lendo` : ''}</span></div></div><button data-open-collection="${escapeHtml(g.key)}">Abrir coleção</button></article>`;
  }).join('');
}
function updateLibraryStats() {
  const ids = new Set(state.items.map(item => item.id));
  const readingTotal = state.items.filter(item => {
    const p = progress[item.id]; return p && p.percent > 0 && p.percent < 100;
  }).length;
  const completedTotal = state.items.filter(item => (progress[item.id]?.percent || 0) >= 100).length;
  const favoriteTotal = [...favorites].filter(id => ids.has(id)).length;
  $('#itemCount').textContent = state.items.length;
  $('#favoriteCount').textContent = favoriteTotal;
  $('#readingCount').textContent = readingTotal;
  $('#completedCount').textContent = completedTotal;
  updateOfflineStorageInfo();
}
function render() {
  updateLibraryStats();
  renderContinueRail();
  const group = state.collection ? collectionGroups().find(g => g.key === state.collection) : null;
  $('#collectionBar').classList.toggle('hidden', !group);
  if (group) { $('#collectionTitle').textContent = group.label; $('#collectionMeta').textContent = `${group.items.length} arquivos`; }
  if (state.filter === 'collections' && !state.collection) return renderCollections();
  const arr = filtered();
  $('#emptyState').classList.toggle('hidden', arr.length > 0);
  const visible = arr.slice(0, state.renderLimit);
  $('#libraryGrid').innerHTML = visible.map(itemCard).join('');
  const more = $('#loadMoreBtn');
  if (more) {
    const left = Math.max(0, arr.length - visible.length);
    more.classList.toggle('hidden', left <= 0);
    more.textContent = left > 0 ? `Carregar mais (${left} restantes)` : 'Carregar mais';
  }
}

function setReaderButtons(type) {
  const readable = type === 'comic' || type === 'pdf';
  $('#modeBtn').classList.toggle('hidden', !readable);
  $('#directionBtn').classList.toggle('hidden', !readable);
  $('#fitBtn').classList.toggle('hidden', !readable);
  $('#zoomControls').classList.toggle('hidden', !readable);
  $('#readerFooter').classList.add('hidden');
  updateCompleteButton();
}

function updateOfflineCurrentButton() {
  const btn = $('#offlineCurrentBtn'); if (!btn || !state.current) return;
  const id = state.current.offlineOriginId || state.current.id;
  const saved = state.offlineIds.has(id);
  btn.textContent = saved ? '✓ Offline' : '☁ Salvar offline';
  btn.classList.toggle('is-offline', saved);
  btn.title = saved ? 'Remover arquivo da biblioteca offline' : 'Salvar para ler sem internet';
}

function updateCompleteButton() {
  const done = Boolean(state.current && (progress[state.current.id]?.percent || 0) >= 100);
  $('#completeBtn').textContent = done ? '↶ Marcar não lido' : '✓ Marcar lido';
  $('#completeBtn').classList.toggle('is-complete', done);
}

function modeLabel(mode = state.mode) {
  return ({ page:'Página', spread:'Dupla', vertical:'Vertical', webtoon:'Webtoon' })[mode] || 'Página';
}
function modeIcon(mode = state.mode) {
  return ({ page:'▣', spread:'▥', vertical:'↕', webtoon:'▤' })[mode] || '▣';
}
function isVerticalMode(mode = state.mode) { return mode === 'vertical' || mode === 'webtoon'; }
function isPagedMode(mode = state.mode) { return mode === 'page' || mode === 'spread'; }
function pageStep() { return state.mode === 'spread' ? 2 : 1; }
function normalizedMode(mode) { return ['page','spread','vertical','webtoon'].includes(mode) ? mode : 'page'; }
function effectiveMode(mode = state.mode) {
  if (mode === 'spread' && matchMedia('(max-width: 650px)').matches && !matchMedia('(orientation: landscape)').matches) return 'page';
  return mode;
}
function updateReaderPrefsUI() {
  $('#directionBtn').textContent = `Leitura: ${state.direction === 'rtl' ? '←' : '→'}`;
  $('#directionBtn').dataset.arrow = state.direction === 'rtl' ? '←' : '→';
  $('#modeBtn').textContent = `Modo: ${modeLabel(state.mode)}`;
  $('#modeBtn').dataset.short = modeIcon(state.mode);
  $('#zoomLabel').textContent = `${Math.round(state.zoom * 100)}%`;
  $('#zoomControls').classList.toggle('hidden', !isPagedMode() || !['comic','pdf'].includes(extType(state.current || {})));
  const auto = $('#autoScrollBtn');
  if (auto) {
    auto.classList.toggle('hidden', !isVerticalMode());
    auto.textContent = state.autoScrollId ? '⏸ Auto' : '▶ Auto';
    auto.title = state.autoScrollId ? 'Pausar rolagem automática' : 'Iniciar rolagem automática';
  }
}

async function openItem(item, forceLarge = false) {
  item = await ensureOfflineItem(item);
  const type = extType(item);
  const warningLimit = archiveWarningLimitMB();
  if (type === 'comic' && !forceLarge && item.size > warningLimit * 1024 * 1024) {
    state.largePending = item;
    $('#largeFileMeta').textContent = `${item.name} • ${bytes(item.size)} • limite recomendado neste aparelho: ${warningLimit} MB`;
    $('#largeFileModal').classList.remove('hidden');
    return;
  }
  const token = ++state.openToken;
  await cleanupReaderData();
  if (token !== state.openToken) return;
  state.current = item;
  state.page = progress[item.id]?.page || 0;
  state.mode = normalizedMode(progress[item.id]?.mode || prefs.defaultMode);
  state.direction = progress[item.id]?.direction || prefs.direction || 'ltr';
  state.zoom = 1;
  $('#reader').classList.remove('hidden'); $('#reader').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('#readerTitle').textContent = item.name; $('#readerMeta').textContent = `${bytes(item.size)}${item.offline ? ' • OFFLINE' : ''}`;
  updateOfflineCurrentButton();
  setReaderButtons(type);
  updateReaderPrefsUI();
  if (type === 'pdf') return openPdf(item, token);
  if (type === 'comic') return openComic(item, token);
  if (token === state.openToken) showReaderError('Formato não suportado', 'Este arquivo não é PDF, CBR, CBZ, RAR ou ZIP.');
}

async function loadPdfJs() {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import('https://esm.sh/pdfjs-dist@6.3.289/build/pdf.mjs').then(pdfjs => {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.mjs';
      return pdfjs;
    });
  }
  return pdfjsModulePromise;
}

async function openPdf(item, token) {
  if (token !== state.openToken) return;
  $('#readerLoading').classList.remove('hidden');
  $('#loadingText').textContent = item.localFile ? 'Preparando PDF offline…' : 'Abrindo PDF no leitor…';
  $('#readerBody').innerHTML = '';
  $('#readerFooter').classList.add('hidden');
  try {
    const pdfjs = await loadPdfJs();
    if (token !== state.openToken) return;
    const options = { disableAutoFetch: false, disableStream: false, disableRange: false };
    if (item.localFile) {
      options.data = await item.localFile.arrayBuffer();
    } else {
      const key = getApiKey();
      if (key) {
        const api = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}`);
        api.searchParams.set('alt', 'media'); api.searchParams.set('key', key);
        options.url = api.href;
        if (item.resourceKey) options.httpHeaders = { 'X-Goog-Drive-Resource-Keys': `${item.id}/${item.resourceKey}` };
      } else {
        // Tenta o endpoint público. Se o Drive bloquear CORS, mostramos um fallback claro.
        options.url = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(item.id)}&export=download&confirm=t`;
      }
    }
    const task = pdfjs.getDocument(options);
    state.pdfDoc = await task.promise;
    if (token !== state.openToken) { await state.pdfDoc.destroy().catch(() => {}); state.pdfDoc = null; return; }
    state.pages = Array.from({ length: state.pdfDoc.numPages }, (_, i) => ({ index: i, name: `Página ${i + 1}` }));
    state.page = Math.max(0, Math.min(state.page, state.pages.length - 1));
    $('#pageRange').max = state.pages.length;
    $('#readerLoading').classList.add('hidden');
    updateReaderPrefsUI();
    await renderReaderPages();
  } catch (err) {
    if (token !== state.openToken || err?.name === 'AbortError') return;
    $('#readerLoading').classList.add('hidden');
    const noKeyHint = !item.localFile && !getApiKey() ? ' Configure a Google Drive API Key para usar o leitor PDF próprio com arquivos do Drive.' : '';
    showReaderError('Não foi possível abrir este PDF', `${err.message || err}${noKeyHint}`, !item.localFile);
  }
}

async function fetchArrayBufferWithProgress(url, headers = {}, signal, token) {
  const r = await fetch(url, { mode: 'cors', headers, redirect: 'follow', signal });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    let msg = `HTTP ${r.status}`;
    try { msg = JSON.parse(txt).error?.message || msg; } catch {}
    throw new Error(msg);
  }
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('text/html')) throw new Error('O Google Drive retornou uma página de confirmação em vez do arquivo.');
  const total = Number(r.headers.get('content-length') || 0);
  if (!r.body) return r.arrayBuffer();
  const reader = r.body.getReader();
  let received = 0; let target = total ? new Uint8Array(total) : null; let offset = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal?.aborted) throw new DOMException('Download cancelado.', 'AbortError');
    received += value.byteLength;
    if (target && offset + value.byteLength <= target.length) {
      target.set(value, offset); offset += value.byteLength;
    } else {
      if (target) { chunks.push(target.slice(0, offset)); target = null; }
      chunks.push(value);
    }
    if (token === state.openToken && !$('#reader').classList.contains('hidden')) {
      $('#loadingText').textContent = total ? `Baixando… ${Math.min(100, Math.round(received / total * 100))}% (${bytes(received)} / ${bytes(total)})` : `Baixando… ${bytes(received)}`;
    }
  }
  if (target) return target.slice(0, offset).buffer;
  const all = new Uint8Array(received); let pos = 0;
  for (const chunk of chunks) { all.set(chunk, pos); pos += chunk.byteLength; }
  return all.buffer;
}

async function downloadDriveFile(item, token, purpose = 'reader') {
  const key = getApiKey();
  const attempts = [];
  if (key) {
    const api = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(item.id)}`);
    api.searchParams.set('alt', 'media'); api.searchParams.set('key', key);
    const headers = item.resourceKey ? { 'X-Goog-Drive-Resource-Keys': `${item.id}/${item.resourceKey}` } : {};
    attempts.push({ url: api.href, headers, label: 'Drive API' });
  }
  attempts.push({ url: `https://drive.usercontent.google.com/download?id=${encodeURIComponent(item.id)}&export=download&confirm=t`, headers: {}, label: 'link público' });
  const controller = new AbortController();
  const offlineId = item.offlineOriginId || item.id;
  if (purpose === 'reader') {
    state.readerDownloadController?.abort();
    state.readerDownloadController = controller;
  } else {
    state.offlineControllers.get(offlineId)?.abort();
    state.offlineControllers.set(offlineId, controller);
  }
  let lastError = null;
  try {
    for (const a of attempts) {
      try { return await fetchArrayBufferWithProgress(a.url, a.headers, controller.signal, token); }
      catch (err) {
        if (err?.name === 'AbortError') throw err;
        lastError = new Error(`${a.label}: ${err.message}`);
      }
    }
  } finally {
    if (purpose === 'reader' && state.readerDownloadController === controller) state.readerDownloadController = null;
    if (purpose !== 'reader' && state.offlineControllers.get(offlineId) === controller) state.offlineControllers.delete(offlineId);
  }
  if (!key) throw new Error('O navegador não conseguiu baixar este CBR/CBZ pelo link público por causa das restrições de CORS do Google Drive. Configure uma Google Drive API Key restrita ao seu GitHub Pages ou abra um arquivo local.');
  throw lastError || new Error('Falha ao baixar do Google Drive.');
}

async function loadJsZip() {
  if (!jszipModulePromise) jszipModulePromise = import('https://esm.sh/jszip@3.10.1').then(m => m.default || m);
  return jszipModulePromise;
}
async function loadUnrar() {
  if (!unrarModulePromise) unrarModulePromise = import('https://esm.sh/node-unrar-js@2.0.2?bundle');
  if (!unrarWasmPromise) unrarWasmPromise = fetch('https://cdn.jsdelivr.net/npm/node-unrar-js@2.0.2/esm/js/unrar.wasm').then(r => {
    if (!r.ok) throw new Error(`unrar.wasm HTTP ${r.status}`); return r.arrayBuffer();
  });
  return Promise.all([unrarModulePromise, unrarWasmPromise]);
}

async function prepareArchive(item, data, token) {
  const ext = extension(item.name);
  if (token === state.openToken) $('#loadingText').textContent = 'Lendo índice de páginas…';
  if (ext === '.cbz' || ext === '.zip') {
    const JSZip = await loadJsZip();
    if (token !== state.openToken) return null;
    const zip = await JSZip.loadAsync(data);
    if (token !== state.openToken) return null;
    const entries = Object.values(zip.files).filter(f => !f.dir && isImage(f.name)).sort((a, b) => naturalSort(a.name, b.name));
    if (!entries.length) throw new Error('Nenhuma imagem foi encontrada dentro do CBZ/ZIP.');
    return { archive: { type: 'zip', engine: zip, entries }, pages: entries.map((e, i) => ({ index: i, name: e.name })) };
  }
  const [unrar, wasmBinary] = await loadUnrar();
  if (token !== state.openToken) return null;
  const extractor = await unrar.createExtractorFromData({ wasmBinary, data });
  if (token !== state.openToken) return null;
  const list = extractor.getFileList();
  const allHeaders = [...list.fileHeaders];
  const encryptedImages = allHeaders.filter(h => !h.flags.directory && h.flags.encrypted && isImage(h.name)).length;
  const headers = allHeaders.filter(h => !h.flags.directory && !h.flags.encrypted && isImage(h.name)).sort((a, b) => naturalSort(a.name, b.name));
  if (!headers.length && encryptedImages) throw new Error('As páginas deste CBR/RAR estão protegidas por senha.');
  if (!headers.length) throw new Error('Nenhuma imagem legível foi encontrada dentro do CBR/RAR.');
  return { archive: { type: 'rar', engine: extractor, entries: headers }, pages: headers.map((e, i) => ({ index: i, name: e.name })) };
}

async function openComic(item, token) {
  $('#readerLoading').classList.remove('hidden');
  $('#loadingText').textContent = item.localFile ? 'Lendo arquivo do aparelho…' : 'Conectando ao Google Drive…';
  $('#readerBody').innerHTML = ''; $('#readerFooter').classList.add('hidden');
  try {
    const data = item.localFile ? await item.localFile.arrayBuffer() : await downloadDriveFile(item, token);
    if (token !== state.openToken) return;
    const prepared = await prepareArchive(item, data, token);
    if (token !== state.openToken || !prepared) return;
    state.archive = prepared.archive;
    state.pages = prepared.pages;
    state.page = Math.max(0, Math.min(state.page, state.pages.length - 1));
    $('#readerLoading').classList.add('hidden');
    $('#pageRange').max = state.pages.length;
    updateReaderPrefsUI();
    await renderReaderPages();
  } catch (err) {
    if (token !== state.openToken || err?.name === 'AbortError') return;
    $('#readerLoading').classList.add('hidden');
    showReaderError('Não foi possível abrir este quadrinho', err.message, !item.localFile);
  }
}

function showReaderError(title, message, offerLocal = false) {
  $('#readerFooter').classList.add('hidden');
  $('#readerBody').innerHTML = `<div class="reader-error"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p><div class="reader-error-actions">
    ${offerLocal ? '<button id="errorLocalBtn">Abrir arquivo local</button>' : ''}
    ${state.current && !state.current.localFile ? '<button id="errorDriveBtn" class="secondary-btn">Abrir no Drive</button>' : ''}
    ${!getApiKey() ? '<button id="errorSettingsBtn" class="secondary-btn">Configurar Drive API</button>' : ''}
  </div></div>`;
  $('#errorLocalBtn')?.addEventListener('click', () => $('#localFileInput').click());
  $('#errorDriveBtn')?.addEventListener('click', () => safeOpen(driveViewUrl(state.current)));
  $('#errorSettingsBtn')?.addEventListener('click', openSettings);
}

async function renderPdfInto(container, index, token, vertical = false) {
  if (!state.pdfDoc || token !== state.renderToken || !container?.isConnected) return;
  const page = await state.pdfDoc.getPage(index + 1);
  if (token !== state.renderToken || !container?.isConnected) return;
  const base = page.getViewport({ scale: 1 });
  const root = $('#readerBody');
  const spread = !vertical && effectiveMode() === 'spread';
  const baseWidth = vertical ? Math.min(root.clientWidth, state.mode === 'webtoon' ? 820 : 1100) : root.clientWidth;
  const availableWidth = Math.max(spread ? 180 : 280, (baseWidth - (vertical ? 8 : 28)) / (spread ? 2 : 1));
  const availableHeight = Math.max(280, root.clientHeight - 24);
  let scale = availableWidth / base.width;
  if (!vertical && state.fit === 'contain') scale = Math.min(scale, availableHeight / base.height);
  scale = Math.max(.25, Math.min(4, scale * (vertical ? 1 : state.zoom)));
  const viewport = page.getViewport({ scale });
  const dpr = Math.min(performanceProfile().pdfDpr, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.className = 'pdf-page-canvas';
  canvas.width = Math.max(1, Math.floor(viewport.width * dpr));
  canvas.height = Math.max(1, Math.floor(viewport.height * dpr));
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  canvas.setAttribute('aria-label', `Página ${index + 1}`);
  const ctx = canvas.getContext('2d', { alpha: false });
  const renderContext = { canvasContext: ctx, viewport, transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0] };
  if (!vertical) {
    state.pdfRenderTask?.cancel?.();
    state.pdfRenderTask = page.render(renderContext);
    try { await state.pdfRenderTask.promise; } catch (e) { if (e?.name !== 'RenderingCancelledException') throw e; }
    finally { if (state.pdfRenderTask) state.pdfRenderTask = null; }
  } else {
    const task = page.render(renderContext); await task.promise;
  }
  if (token !== state.renderToken || !container?.isConnected) return;
  container.innerHTML = ''; container.appendChild(canvas);
  if (vertical) container.style.aspectRatio = `${viewport.width}/${viewport.height}`;
}

async function renderPdfPageMode(token) {
  $('#readerFooter').classList.remove('hidden');
  $('#readerLoading').classList.remove('hidden');
  const spread = effectiveMode() === 'spread';
  const indexes = spread ? [state.page, state.page + 1].filter(i => i < state.pages.length) : [state.page];
  $('#loadingText').textContent = spread ? `Renderizando PDF • páginas ${indexes.map(i => i + 1).join('–')}…` : `Renderizando PDF • página ${state.page + 1}…`;
  $('#readerBody').classList.add('page-mode');
  const dirClass = spread && state.direction === 'rtl' ? ' spread-rtl' : '';
  $('#readerBody').innerHTML = `<div class="page-stage ${spread ? 'spread-stage' : ''}${dirClass} ${state.fit === 'width' ? 'fit-width' : ''}">${indexes.map(i => `<div class="pdf-page-mount spread-page" data-pdf-i="${i}"><span class="page-placeholder">Página ${i + 1}</span></div>`).join('')}</div>`;
  try {
    for (const i of indexes) await renderPdfInto($(`[data-pdf-i="${i}"]`), i, token, false);
  } finally { if (token === state.renderToken) $('#readerLoading').classList.add('hidden'); }
}

async function renderPdfVerticalMode(token) {
  $('#readerFooter').classList.add('hidden');
  $('#readerBody').classList.remove('page-mode');
  $('#readerBody').innerHTML = `<div class="vertical-pages pdf-vertical ${state.mode === 'webtoon' ? 'webtoon-pages' : ''}">${state.pages.map((_, i) => `<div class="page-slot pdf-slot" data-i="${i}"><span class="page-placeholder">Página ${i + 1}</span></div>`).join('')}</div>`;
  setupVerticalObserver();
  requestAnimationFrame(() => $(`.page-slot[data-i="${state.page}"]`)?.scrollIntoView({ block: 'start' }));
}

async function getPageUrl(index, expectedToken = state.renderToken) {
  const archive = state.archive;
  const page = state.pages[index];
  if (!archive || !page) throw new Error('Página inexistente.');
  if (state.pageUrls.has(index)) { state.pageUse.set(index, Date.now()); return state.pageUrls.get(index); }
  const entry = archive.entries[index]; let blob;
  if (archive.type === 'zip') {
    blob = await entry.async('blob');
  } else {
    const result = archive.engine.extract({ files: [entry.name] });
    const files = [...result.files];
    const file = files.find(f => f.fileHeader?.name === entry.name) || files[0];
    if (!file?.extraction) throw new Error(`Falha ao extrair a página ${index + 1}.`);
    blob = new Blob([file.extraction], { type: mimeFromName(entry.name) });
  }
  // A troca/fechamento do leitor invalida extrações que ainda estavam em andamento.
  if (expectedToken !== state.renderToken || archive !== state.archive) throw new DOMException('Leitura cancelada.', 'AbortError');
  const url = URL.createObjectURL(blob);
  state.pageUrls.set(index, url); state.pageUse.set(index, Date.now());
  trimPageCache(index);
  return url;
}

function trimPageCache(center) {
  const limit = performanceProfile().cacheLimit;
  if (state.pageUrls.size <= limit) return;
  const candidates = [...state.pageUrls.keys()].filter(i => Math.abs(i - center) > 2).sort((a, b) => (state.pageUse.get(a) || 0) - (state.pageUse.get(b) || 0));
  while (state.pageUrls.size > limit && candidates.length) {
    const i = candidates.shift(); const url = state.pageUrls.get(i);
    URL.revokeObjectURL(url); state.pageUrls.delete(i); state.pageUse.delete(i);
    const slot = $(`.page-slot[data-i="${i}"]`);
    if (slot) { slot.dataset.loaded = ''; slot.innerHTML = `<span class="page-placeholder">Página ${i + 1}</span>`; }
  }
}

async function renderReaderPages() {
  if (!state.pages.length) return;
  const token = ++state.renderToken;
  stopVerticalObserver();
  const isPdf = extType(state.current || {}) === 'pdf' && Boolean(state.pdfDoc);
  if (isPdf) {
    try {
      if (isVerticalMode()) await renderPdfVerticalMode(token);
      else await renderPdfPageMode(token);
    } catch (err) {
      if (token === state.renderToken && err?.name !== 'RenderingCancelledException') showReaderError('Falha ao renderizar PDF', err.message || String(err));
    }
  } else if (isVerticalMode()) {
    $('#readerFooter').classList.add('hidden');
    $('#readerBody').classList.remove('page-mode');
    $('#readerBody').innerHTML = `<div class="vertical-pages ${state.mode === 'webtoon' ? 'webtoon-pages' : ''}">${state.pages.map((_, i) => `<div class="page-slot" data-i="${i}"><span class="page-placeholder">Página ${i + 1}</span></div>`).join('')}</div>`;
    setupVerticalObserver();
    requestAnimationFrame(() => $(`.page-slot[data-i="${state.page}"]`)?.scrollIntoView({ block: 'start' }));
  } else {
    $('#readerFooter').classList.remove('hidden');
    $('#readerLoading').classList.remove('hidden'); $('#loadingText').textContent = `Carregando página ${state.page + 1}…`;
    try {
      const spread = effectiveMode() === 'spread';
      const indexes = spread ? [state.page, state.page + 1].filter(i => i < state.pages.length) : [state.page];
      const urls = await Promise.all(indexes.map(i => getPageUrl(i, token)));
      if (token !== state.renderToken) return;
      $('#readerBody').classList.add('page-mode');
      const zoomStyle = state.zoom === 1 ? '' : `style="width:${Math.round(state.zoom * 100)}%;max-width:none;height:auto"`;
      const dirClass = spread && state.direction === 'rtl' ? ' spread-rtl' : '';
      $('#readerBody').innerHTML = `<div class="page-stage ${spread ? 'spread-stage' : ''}${dirClass} ${state.fit === 'width' ? 'fit-width' : ''}">${urls.map((url, n) => `<img src="${url}" alt="Página ${indexes[n] + 1}" ${zoomStyle}>`).join('')}</div>`;
      if (performanceProfile().prefetch) {
        const step = spread ? 2 : 1;
        [state.page - step, state.page + step].filter(i => i >= 0 && i < state.pages.length).forEach(i => setTimeout(() => getPageUrl(i, token).catch(() => {}), 50));
      }
    } catch (err) {
      if (token === state.renderToken) showReaderError('Falha ao carregar página', err.message);
    } finally {
      if (token === state.renderToken) $('#readerLoading').classList.add('hidden');
    }
  }
  updateProgress(); updatePageControls();
}

function setupVerticalObserver() {
  const root = $('#readerBody');
  state.verticalObserver = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) loadVerticalSlot(entry.target).catch(() => {});
  }, { root, rootMargin: `${performanceProfile().observerMargin}px 0px`, threshold: 0.01 });
  $$('.page-slot').forEach(slot => state.verticalObserver.observe(slot));
  let ticking = false;
  state.verticalScrollHandler = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false; updateVerticalPosition(); cleanupVerticalSlots();
    });
  };
  root.addEventListener('scroll', state.verticalScrollHandler, { passive: true });
}

async function loadVerticalSlot(slot) {
  if (!slot?.isConnected || slot.dataset.loaded === '1') return;
  const i = Number(slot.dataset.i);
  slot.dataset.loaded = '1';
  try {
    if (extType(state.current || {}) === 'pdf' && state.pdfDoc) {
      await renderPdfInto(slot, i, state.renderToken, true);
      return;
    }
    const url = await getPageUrl(i);
    if (!slot.isConnected) return;
    const img = new Image(); img.alt = `Página ${i + 1}`; img.loading = 'lazy'; img.decoding = 'async'; img.fetchPriority = 'low'; img.src = url;
    img.onload = () => { if (img.naturalWidth && img.naturalHeight) slot.style.aspectRatio = `${img.naturalWidth}/${img.naturalHeight}`; };
    slot.innerHTML = ''; slot.appendChild(img);
  } catch (err) {
    slot.dataset.loaded = '';
    if (slot.isConnected) slot.innerHTML = `<span class="page-placeholder">Falha na página ${i + 1}</span>`;
  }
}


function cleanupVerticalSlots(force = false) {
  if (!isVerticalMode() || !state.pages.length) return;
  const profile = performanceProfile();
  if (!force && !profile.mobile && !profile.eco) return;
  const keep = profile.verticalWindow;
  for (const slot of $$('.page-slot')) {
    if (slot.dataset.loaded !== '1') continue;
    const i = Number(slot.dataset.i);
    if (Math.abs(i - state.page) <= keep) continue;
    slot.dataset.loaded = '';
    slot.innerHTML = `<span class="page-placeholder">Página ${i + 1}</span>`;
    if (extType(state.current || {}) !== 'pdf' && state.pageUrls.has(i)) {
      URL.revokeObjectURL(state.pageUrls.get(i));
      state.pageUrls.delete(i); state.pageUse.delete(i);
    }
  }
}

function updateVerticalPosition() {
  if (!isVerticalMode() || !state.pages.length) return;
  const rootRect = $('#readerBody').getBoundingClientRect(); let best = state.page; let dist = Infinity;
  for (const slot of $$('.page-slot')) {
    const d = Math.abs(slot.getBoundingClientRect().top - rootRect.top);
    if (d < dist) { dist = d; best = Number(slot.dataset.i); }
  }
  if (best !== state.page) { state.page = best; updateProgress(); updatePageControls(); }
}

function stopVerticalObserver() {
  state.verticalObserver?.disconnect(); state.verticalObserver = null;
  if (state.verticalScrollHandler) $('#readerBody')?.removeEventListener('scroll', state.verticalScrollHandler);
  state.verticalScrollHandler = null;
}
function getNextIssue() {
  if (!state.current || state.current.localFile) return null;
  const currentKey = seriesKeyFor(state.current);
  const group = state.items.filter(i => seriesKeyFor(i) === currentKey).sort((a, b) => naturalSort(a.name, b.name));
  const i = group.findIndex(x => x.id === state.current.id);
  return i >= 0 && i < group.length - 1 ? group[i + 1] : null;
}
function updatePageControls() {
  if (!state.pages.length) return;
  $('#pageRange').value = state.page + 1;
  const pageNumberInput = $('#pageNumberInput');
  if (pageNumberInput) { pageNumberInput.max = state.pages.length; pageNumberInput.value = state.page + 1; }
  const end = effectiveMode() === 'spread' ? Math.min(state.pages.length, state.page + 2) : state.page + 1;
  $('#pageLabel').textContent = effectiveMode() === 'spread' && end > state.page + 1 ? `${state.page + 1}–${end} / ${state.pages.length}` : `${state.page + 1} / ${state.pages.length}`;
  const next = getNextIssue();
  const showNext = state.page >= state.pages.length - 1 && Boolean(next);
  $('#nextIssueBtn').classList.toggle('hidden', !showNext);
  if (showNext) $('#nextIssueBtn').title = next.name;
}
function updateProgress() {
  if (!state.current || !state.pages.length) return;
  const readThrough = effectiveMode() === 'spread' ? Math.min(state.pages.length, state.page + 2) : state.page + 1;
  const pct = Math.round((readThrough / state.pages.length) * 100);
  progress[state.current.id] = { percent: pct, page: state.page, mode: state.mode, direction: state.direction, updated: Date.now() };
  saveProgress(); updateLibraryStats(); updateCompleteButton();
}
async function setPage(n) {
  if (!state.pages.length) return;
  state.page = Math.max(0, Math.min(state.pages.length - 1, n));
  await renderReaderPages();
}

async function cleanupReaderData() {
  stopAutoScroll();
  state.readerDownloadController?.abort();
  state.readerDownloadController = null;
  stopVerticalObserver();
  state.renderToken++;
  state.touchStart = null;
  for (const url of state.pageUrls.values()) URL.revokeObjectURL(url);
  state.pageUrls.clear(); state.pageUse.clear();
  if (state.pdfObjectUrl) { URL.revokeObjectURL(state.pdfObjectUrl); state.pdfObjectUrl = ''; }
  state.pdfRenderTask?.cancel?.(); state.pdfRenderTask = null;
  if (state.pdfDoc) { await state.pdfDoc.destroy().catch(() => {}); state.pdfDoc = null; }
  state.archive = null; state.pages = []; $('#readerBody')?.classList.remove('page-mode');
}
async function closeReader() {
  closeReaderControls();
  if (isVerticalMode()) updateVerticalPosition();
  state.openToken++;
  await cleanupReaderData();
  $('#reader').classList.add('hidden'); $('#reader').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = ''; state.current = null; $('#readerBody').innerHTML = ''; render();
}

function markComplete() {
  if (!state.current) return;
  const done = (progress[state.current.id]?.percent || 0) >= 100;
  if (done) {
    progress[state.current.id] = { percent: 0, page: 0, mode: state.mode, direction: state.direction, updated: Date.now() };
    toast('Marcado como não lido.');
  } else {
    const page = state.pages.length ? state.pages.length - 1 : 0;
    progress[state.current.id] = { percent: 100, page, mode: state.mode, direction: state.direction, updated: Date.now() };
    toast('Marcado como lido.');
  }
  saveProgress(); updateLibraryStats(); updateCompleteButton(); render();
}

function openSettings() {
  $('#apiKeyInput').value = getApiKey();
  $('#defaultModeSelect').value = normalizedMode(prefs.defaultMode);
  $('#directionSelect').value = prefs.direction || 'ltr';
  if ($('#performanceSelect')) $('#performanceSelect').value = prefs.performance || 'auto';
  if ($('#autoScrollSpeedSelect')) $('#autoScrollSpeedSelect').value = String(prefs.autoScrollSpeed || 46);
  if ($('#performanceHint')) $('#performanceHint').textContent = `Ativo: ${performanceLabel()} • ${navigator.deviceMemory ? navigator.deviceMemory + ' GB RAM' : 'RAM não informada'}${navigator.hardwareConcurrency ? ' • ' + navigator.hardwareConcurrency + ' núcleos' : ''}`;
  $('#configStatus').textContent = getApiKey() ? 'Chave configurada neste navegador.' : 'Nenhuma chave configurada.';
  $('#settingsModal').classList.remove('hidden');
}
function closeSettings() { $('#settingsModal').classList.add('hidden'); }

function makeLocalItem(file) {
  return { id: `local:${file.name}:${file.size}:${file.lastModified}`, name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream', localFile: file };
}
async function openLocalSelected(file) {
  if (!file) return;
  const item = makeLocalItem(file);
  if (!/\.(pdf|cbr|cbz|rar|zip)$/i.test(item.name)) { toast('Formato não suportado.'); return; }
  await openItem(item);
}

document.addEventListener('click', e => {
  const continueBtn = e.target.closest('[data-continue]');
  if (continueBtn) { const item = state.items.find(x => x.id === continueBtn.dataset.continue); if (item) openItem(item); return; }
  const collectionBtn = e.target.closest('[data-open-collection]');
  if (collectionBtn) { state.collection = collectionBtn.dataset.openCollection; state.filter = 'all'; state.search = ''; $('#searchInput').value = ''; $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.filter === 'all')); render(); return; }
  const card = e.target.closest('.card');
  if (card) {
    const item = state.items.find(x => x.id === card.dataset.id); if (!item) return;
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'fav') { favorites.has(item.id) ? favorites.delete(item.id) : favorites.add(item.id); saveFav(); render(); return; }
    if (action === 'drive') { safeOpen(driveViewUrl(item)); return; }
    if (action === 'download') { downloadItem(item); return; }
    if (action === 'offline') { toggleOfflineItem(item); return; }
    if (action === 'read') { openItem(item); return; }
  }
  const nav = e.target.closest('.nav');
  if (nav) { $$('.nav').forEach(n => n.classList.remove('active')); nav.classList.add('active'); state.collection = ''; state.filter = nav.dataset.filter; resetRenderLimit(); render(); }
});

$('#searchInput').addEventListener('input', e => { state.search = normalizeText(e.target.value.trim()); resetRenderLimit(); render(); });
$('#sortSelect').addEventListener('change', e => { state.sort = e.target.value; resetRenderLimit(); render(); });
$('#showReadingBtn').addEventListener('click', () => { state.collection = ''; state.filter = 'reading'; $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.filter === 'reading')); render(); });
$('#backCollectionsBtn').addEventListener('click', () => { state.collection = ''; state.filter = 'collections'; $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.filter === 'collections')); render(); });
$('#sourceSelect')?.addEventListener('change', e => { state.source = e.target.value || 'all'; resetRenderLimit(); render(); });
$('#refreshBtn').addEventListener('click', loadLibrary);
function openDriveModal() {
  const urls = Array.isArray(CONFIG.folderUrls) && CONFIG.folderUrls.length ? CONFIG.folderUrls : [CONFIG.folderUrl].filter(Boolean);
  const counts = libraryCounts();
  const sync = readJson(LS.syncMeta, {});
  const last = formatDateTime(sync.at);
  $('#driveSummary').innerHTML = `<div><strong>${getApiKey() ? 'Drive API configurada' : 'Drive API não configurada'}</strong><small>${getApiKey() ? `${state.items.length} itens disponíveis${last ? ` • última sincronização ${last}` : ''}` : 'O catálogo local funciona, mas a API é recomendada para ler e sincronizar tudo.'}</small></div>`;
  $('#driveRoots').innerHTML = urls.map((url, i) => { const key=`library-${i+1}`; const count=counts[key]||0; return `<button class="drive-root" data-drive-url="${escapeHtml(url)}"><span>Biblioteca ${i + 1}<em>${count ? `${count} itens carregados` : 'Abrir pasta no Drive'}</em></span><small>Google Drive próprio • ${getApiKey() ? 'API pronta' : 'configure a API para sincronização completa'}</small><b>↗</b></button>`; }).join('');
  const external = Array.isArray(CONFIG.externalSources) ? CONFIG.externalSources : [];
  $('#externalSources').innerHTML = external.length ? `<div class="source-section-title">Fontes externas</div>${external.map(src => `<article class="external-source-card"><div class="external-source-head"><div><span class="external-badge">EXTERNO</span><strong>${escapeHtml(src.name || 'Fonte externa')}</strong></div></div><p>${escapeHtml(src.note || 'Conteúdo hospedado em uma fonte externa.')}</p><div class="external-source-actions">${src.siteUrl ? `<button class="secondary-btn" data-external-url="${escapeHtml(src.siteUrl)}">Abrir site</button>` : ''}${src.driveUrl ? `<button data-external-url="${escapeHtml(src.driveUrl)}">Abrir acervo ↗</button>` : ''}</div></article>`).join('')}` : '';
  $('#driveModal').classList.remove('hidden');
}
function closeDriveModal() { $('#driveModal').classList.add('hidden'); }
$('#driveBtn').addEventListener('click', openDriveModal);
$('#closeDriveModal').addEventListener('click', closeDriveModal);
$('#driveModal').addEventListener('click', e => { if (e.target === $('#driveModal')) closeDriveModal(); });
$('#driveRoots').addEventListener('click', e => { const b=e.target.closest('[data-drive-url]'); if (b) safeOpen(b.dataset.driveUrl); });
$('#externalSources').addEventListener('click', e => { const b=e.target.closest('[data-external-url]'); if (b) safeOpen(b.dataset.externalUrl); });
async function testDriveConnection() {
  const key = ($('#apiKeyInput')?.value || getApiKey()).trim();
  const out = $('#driveHealthText');
  if (!key) { out.textContent = 'Cole uma API Key para testar. O catálogo local continua funcionando sem ela.'; out.className = 'warn'; return false; }
  out.textContent = `Testando ${(CONFIG.folderIds || []).length} bibliotecas…`; out.className = '';
  const roots = Array.isArray(CONFIG.folderIds) && CONFIG.folderIds.length ? CONFIG.folderIds : [CONFIG.folderId].filter(Boolean);
  try {
    const results = [];
    for (const id of roots) {
      const u = new URL('https://www.googleapis.com/drive/v3/files');
      u.searchParams.set('q', `'${id}' in parents and trashed = false`);
      u.searchParams.set('fields', 'files(id,name,mimeType),nextPageToken');
      u.searchParams.set('pageSize', '1');
      u.searchParams.set('supportsAllDrives', 'true');
      u.searchParams.set('includeItemsFromAllDrives', 'true');
      u.searchParams.set('key', key);
      const r = await fetch(u, { mode:'cors' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error?.message || `HTTP ${r.status}`);
      results.push((d.files || []).length);
    }
    out.textContent = `Conexão OK • ${roots.length} bibliotecas acessíveis. Agora salve e sincronize.`; out.className = 'ok';
    return true;
  } catch (err) {
    out.textContent = `Falha: ${err.message}`; out.className = 'warn';
    return false;
  }
}
$('#testDriveBtn')?.addEventListener('click', testDriveConnection);

$('#settingsBtn').addEventListener('click', openSettings);
$('#noticeSettingsBtn').addEventListener('click', openSettings);
$('#closeSettings').addEventListener('click', closeSettings);
$('#settingsModal').addEventListener('click', e => { if (e.target === $('#settingsModal')) closeSettings(); });
$('#saveKeyBtn').addEventListener('click', async () => {
  const key = $('#apiKeyInput').value.trim();
  prefs.defaultMode = normalizedMode($('#defaultModeSelect').value);
  prefs.direction = $('#directionSelect').value === 'rtl' ? 'rtl' : 'ltr';
  prefs.performance = ['auto','eco','quality'].includes($('#performanceSelect')?.value) ? $('#performanceSelect').value : 'auto';
  prefs.autoScrollSpeed = Number($('#autoScrollSpeedSelect')?.value || 46);
  savePrefs();
  if (key) storageSet(LS.apiKey, key); else storageRemove(LS.apiKey);
  $('#configStatus').textContent = key ? 'Chave salva. Sincronizando…' : 'Chave removida.';
  closeSettings(); await (async () => { await refreshOfflineIndex(); await updateOfflineStorageInfo(); await loadLibrary(); })();
});
$('#clearKeyBtn').addEventListener('click', async () => {
  storageRemove(LS.apiKey); $('#apiKeyInput').value = ''; $('#configStatus').textContent = 'Chave removida.'; closeSettings(); await (async () => { await refreshOfflineIndex(); await updateOfflineStorageInfo(); await loadLibrary(); })();
});

$('#localBtn').addEventListener('click', () => $('#localFileInput').click());
$('#localFileInput').addEventListener('change', async e => { const file = e.target.files?.[0]; e.target.value = ''; await openLocalSelected(file); });

function closeReaderControls() {
  $('#reader').classList.remove('controls-open');
  $('#readerMenuBtn')?.setAttribute('aria-expanded','false');
}
let readerControlsTimer = 0;
function toggleReaderControls() {
  const open = $('#reader').classList.toggle('controls-open');
  $('#readerMenuBtn')?.setAttribute('aria-expanded', open ? 'true' : 'false');
  clearTimeout(readerControlsTimer);
  if (open && matchMedia('(max-width:850px)').matches) readerControlsTimer = setTimeout(closeReaderControls, 6000);
}
$('#readerMenuBtn')?.addEventListener('click', toggleReaderControls);

$('#closeReader').addEventListener('click', closeReader);
$('#downloadCurrentBtn').addEventListener('click', () => downloadItem(state.current));
$('#offlineCurrentBtn').addEventListener('click', async () => { if (state.current) { await toggleOfflineItem(state.current); updateOfflineCurrentButton(); } });
$('#clearOfflineBtn').addEventListener('click', clearOfflineLibrary);
$('#completeBtn').addEventListener('click', markComplete);
$('#prevPage').addEventListener('click', () => setPage(state.page - pageStep()));
$('#nextPage').addEventListener('click', () => setPage(state.page + pageStep()));
$('#nextIssueBtn').addEventListener('click', async () => { const next = getNextIssue(); if (next) await openItem(next); });
$('#pageRange').addEventListener('input', e => setPage(Number(e.target.value) - 1));
$('#pageNumberInput')?.addEventListener('change', e => { const n = Number(e.target.value || 1); setPage(n - 1); });
$('#pageNumberInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); const n = Number(e.target.value || 1); setPage(n - 1); } });
$('#loadMoreBtn')?.addEventListener('click', () => { state.renderLimit += 60; render(); });
$('#modeBtn').addEventListener('click', async () => {
  if (window.matchMedia('(max-width:850px)').matches) closeReaderControls();
  if (!state.pages.length) return;
  stopAutoScroll();
  const modes = ['page','spread','vertical','webtoon'];
  state.mode = modes[(modes.indexOf(normalizedMode(state.mode)) + 1) % modes.length];
  if (state.mode === 'spread' && effectiveMode() !== 'spread') toast('Página dupla ficará ativa ao usar tela maior ou celular na horizontal.');
  updateReaderPrefsUI();
  await renderReaderPages();
});
$('#fitBtn').addEventListener('click', async () => {
  state.fit = state.fit === 'contain' ? 'width' : 'contain'; $('#fitBtn').textContent = state.fit === 'width' ? 'Largura' : 'Ajustar';
  await renderReaderPages();
});
$('#directionBtn').addEventListener('click', () => {
  if (window.matchMedia('(max-width:850px)').matches) closeReaderControls();
  state.direction = state.direction === 'rtl' ? 'ltr' : 'rtl';
  prefs.direction = state.direction; savePrefs(); updateReaderPrefsUI(); updateProgress();
  toast(state.direction === 'rtl' ? 'Modo mangá: avance tocando à esquerda.' : 'Leitura ocidental: avance tocando à direita.');
});
async function setZoom(value) {
  state.zoom = Math.max(.6, Math.min(3, Math.round(value * 10) / 10)); updateReaderPrefsUI();
  if (isPagedMode() && state.pages.length) await renderReaderPages();
}
$('#zoomOutBtn').addEventListener('click', () => setZoom(state.zoom - .2));
$('#zoomInBtn').addEventListener('click', () => setZoom(state.zoom + .2));
$('#zoomLabel').addEventListener('click', () => setZoom(1));
$('#fullscreenBtn').addEventListener('click', () => { closeReaderControls(); document.fullscreenElement ? document.exitFullscreen() : $('#reader').requestFullscreen?.(); });
function stopAutoScroll() {
  if (state.autoScrollId) cancelAnimationFrame(state.autoScrollId);
  state.autoScrollId = 0; state.autoScrollLast = 0; updateReaderPrefsUI();
}
function autoScrollFrame(ts) {
  if (!state.autoScrollId || !isVerticalMode() || $('#reader').classList.contains('hidden')) return stopAutoScroll();
  if (!state.autoScrollLast) state.autoScrollLast = ts;
  const dt = Math.min(50, ts - state.autoScrollLast); state.autoScrollLast = ts;
  const root = $('#readerBody');
  root.scrollTop += (Number(prefs.autoScrollSpeed || 46) * dt) / 1000;
  if (root.scrollTop + root.clientHeight >= root.scrollHeight - 3) return stopAutoScroll();
  state.autoScrollId = requestAnimationFrame(autoScrollFrame);
}
function toggleAutoScroll() {
  if (!isVerticalMode()) return;
  if (state.autoScrollId) return stopAutoScroll();
  state.autoScrollLast = 0; state.autoScrollId = requestAnimationFrame(autoScrollFrame); updateReaderPrefsUI();
}
$('#autoScrollBtn')?.addEventListener('click', toggleAutoScroll);
$('#themeBtn').addEventListener('click', () => {
  document.documentElement.classList.toggle('light');
  storageSet(LS.theme, document.documentElement.classList.contains('light') ? 'light' : 'dark');
});

$('#cancelLargeBtn').addEventListener('click', () => { state.largePending = null; $('#largeFileModal').classList.add('hidden'); });
$('#continueLargeBtn').addEventListener('click', async () => {
  const item = state.largePending; state.largePending = null; $('#largeFileModal').classList.add('hidden'); if (item) await openItem(item, true);
});

document.addEventListener('keydown', e => {
  const settingsOpen = !$('#settingsModal').classList.contains('hidden');
  const largeOpen = !$('#largeFileModal').classList.contains('hidden');
  const driveOpen = !$('#driveModal').classList.contains('hidden');
  if (settingsOpen) { if (e.key === 'Escape') closeSettings(); return; }
  if (driveOpen) { if (e.key === 'Escape') closeDriveModal(); return; }
  if (largeOpen) {
    if (e.key === 'Escape') { state.largePending = null; $('#largeFileModal').classList.add('hidden'); }
    return;
  }
  if (e.target?.matches?.('input,select,textarea,[contenteditable="true"]')) return;
  if ($('#reader').classList.contains('hidden')) return;
  if (e.key === 'Escape') { closeReader(); return; }
  if (isPagedMode() && e.key === 'ArrowRight') setPage(state.page + (state.direction === 'rtl' ? -pageStep() : pageStep()));
  if (isPagedMode() && e.key === 'ArrowLeft') setPage(state.page + (state.direction === 'rtl' ? pageStep() : -pageStep()));
  if (isPagedMode() && (e.key === '+' || e.key === '=')) setZoom(state.zoom + .2);
  if (isPagedMode() && e.key === '-') setZoom(state.zoom - .2);
  if (isPagedMode() && e.key === '0') setZoom(1);
  if (e.key.toLowerCase() === 'f') document.fullscreenElement ? document.exitFullscreen() : $('#reader').requestFullscreen?.();
  if (e.key.toLowerCase() === 'm') $('#modeBtn').click();
  if (e.key.toLowerCase() === 'd') $('#directionBtn').click();
  if (e.key === '?') toast('Atalhos: ←/→ páginas • +/- zoom • 0 reset • F tela cheia • M modo • D direção • Esc sair');
});

$('#readerBody').addEventListener('click', e => {
  if (!isPagedMode() || !state.pages.length || e.target.closest('button,a') || (Date.now() - Number(state.lastSwipeAt || 0) < 450)) return;
  const rect = $('#readerBody').getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / Math.max(1, rect.width);
  if (ratio > .30 && ratio < .70) {
    if (matchMedia('(max-width:850px)').matches) toggleReaderControls();
    return;
  }
  const leftZone = ratio <= .30;
  const next = state.direction === 'rtl' ? leftZone : !leftZone;
  setPage(state.page + (next ? pageStep() : -pageStep()));
});
$('#readerBody').addEventListener('dblclick', e => { if (isPagedMode() && e.target.closest('img,canvas')) setZoom(state.zoom === 1 ? 1.6 : 1); });
$('#readerBody').addEventListener('touchstart', e => {
  if (!isPagedMode() || !state.pages.length || e.touches.length !== 1 || state.zoom > 1.01) return;
  const t = e.touches[0]; state.touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
}, { passive: true });
$('#readerBody').addEventListener('touchend', e => {
  const start = state.touchStart; state.touchStart = null;
  if (!start || !isPagedMode() || !state.pages.length || state.zoom > 1.01) return;
  const t = e.changedTouches?.[0]; if (!t) return;
  const dx = t.clientX - start.x, dy = t.clientY - start.y;
  if (Date.now() - start.time > 700 || Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
  const swipeLeft = dx < 0;
  const next = state.direction === 'rtl' ? !swipeLeft : swipeLeft;
  state.lastSwipeAt = Date.now();
  setPage(state.page + (next ? pageStep() : -pageStep()));
}, { passive: true });

function exportReaderData() {
  const data = { app: 'Manga HQ Reader', version: CONFIG.appVersion || '1.7.0', exportedAt: new Date().toISOString(), favorites: [...favorites], progress, prefs };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'manga-hq-reader-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#exportDataBtn').addEventListener('click', exportReaderData);
$('#importDataBtn').addEventListener('click', () => $('#importDataInput').click());
$('#importDataInput').addEventListener('change', async e => {
  const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    favorites.clear(); for (const id of (data.favorites || [])) favorites.add(id);
    for (const key of Object.keys(progress)) delete progress[key]; Object.assign(progress, data.progress || {});
    Object.assign(prefs, data.prefs || {}); saveFav(); saveProgress(); savePrefs();
    toast('Backup restaurado.'); closeSettings(); render();
  } catch { toast('Arquivo de backup inválido.'); }
});
$('#resetProgressBtn').addEventListener('click', () => {
  if (!confirm('Apagar todo o progresso de leitura? Os favoritos serão mantidos.')) return;
  for (const key of Object.keys(progress)) delete progress[key]; saveProgress(); render(); toast('Progresso apagado.');
});

let dragDepth = 0;
window.addEventListener('dragenter', e => { if (![...e.dataTransfer?.types || []].includes('Files')) return; e.preventDefault(); dragDepth++; $('#dropOverlay').classList.remove('hidden'); });
window.addEventListener('dragover', e => { if ([...e.dataTransfer?.types || []].includes('Files')) e.preventDefault(); });
window.addEventListener('dragleave', e => { if (![...e.dataTransfer?.types || []].includes('Files')) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dropOverlay').classList.add('hidden'); });
window.addEventListener('drop', async e => { e.preventDefault(); dragDepth = 0; $('#dropOverlay').classList.add('hidden'); const file = e.dataTransfer?.files?.[0]; if (file) await openLocalSelected(file); });

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#installBtn').classList.remove('hidden'); });
$('#installBtn').addEventListener('click', async () => {
  if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('#installBtn').classList.add('hidden');
});

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') cleanupVerticalSlots(true); });

if (storageGet(LS.theme) === 'light') document.documentElement.classList.add('light');
setNetworkStatus();
window.addEventListener('online', () => { setNetworkStatus(); warmReaderRuntimes().catch(() => {}); });
window.addEventListener('offline', setNetworkStatus);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(async reg => {
    reg.update().catch(() => {});
    try { await navigator.serviceWorker.ready; await new Promise(r => setTimeout(r, 250)); await warmReaderRuntimes(); } catch {}
  }).catch(() => { warmReaderRuntimes().catch(() => {}); });
} else warmReaderRuntimes().catch(() => {});
(async () => { await refreshOfflineIndex(); await updateOfflineStorageInfo(); await loadLibrary(); })();
