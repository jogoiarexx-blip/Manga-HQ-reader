const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const CONFIG = {
  folderId: '1e-gclwa21fdNBuGyoCaucMUEekTws8_g',
  folderUrl: 'https://drive.google.com/drive/folders/1e-gclwa21fdNBuGyoCaucMUEekTws8_g?usp=sharing',
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
  prefs: 'mhqr:prefs'
};

const storageGet = key => { try { return localStorage.getItem(key); } catch { return null; } };
const storageSet = (key, value) => { try { localStorage.setItem(key, value); return true; } catch { return false; } };
const storageRemove = key => { try { localStorage.removeItem(key); } catch {} };
const readJson = (key, fallback) => {
  try { return JSON.parse(storageGet(key)) ?? fallback; }
  catch { return fallback; }
};

const state = {
  items: [], filter: 'all', search: '', sort: 'name', current: null,
  pages: [], page: 0, mode: 'page', fit: 'contain', direction: 'ltr', zoom: 1, collection: '', archive: null,
  pageUrls: new Map(), pageUse: new Map(), verticalObserver: null,
  verticalScrollHandler: null, renderToken: 0, openToken: 0, pdfObjectUrl: '', largePending: null,
  downloadController: null, touchStart: null
};

const favorites = new Set(readJson(LS.fav, []));
const progress = readJson(LS.progress, {});
const prefs = { defaultMode: 'page', direction: 'ltr', ...readJson(LS.prefs, {}) };
function savePrefs() { storageSet(LS.prefs, JSON.stringify(prefs)); }
let installPrompt = null;
let unrarModulePromise = null;
let unrarWasmPromise = null;
let jszipModulePromise = null;

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
  if (item.localFile) return '';
  return item.thumbnailLink || `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.id)}&sz=w420`;
}
function driveViewUrl(item) { return `https://drive.google.com/file/d/${encodeURIComponent(item.id)}/view`; }
function drivePreviewUrl(item) { return `https://drive.google.com/file/d/${encodeURIComponent(item.id)}/preview`; }
function safeOpen(url) { window.open(url, '_blank', 'noopener,noreferrer'); }
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
  return uniqueItems(await r.json());
}

async function listDriveFolder(apiKey) {
  const fields = 'nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,resourceKey)';
  const queue = [{ id: CONFIG.folderId, path: '' }];
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
        $('#syncStatus').textContent = 'Sincronizado com Drive';
        $('#syncDetail').textContent = 'Novos arquivos aparecem ao tocar em Atualizar';
      } catch (err) {
        state.items = await loadStaticCatalog();
        $('#syncStatus').textContent = 'Catálogo local ativo';
        $('#syncDetail').textContent = 'A chave não sincronizou; usando o catálogo incluído';
        toast(`Drive API: ${err.message}`);
      }
    } else {
      state.items = await loadStaticCatalog();
      $('#syncStatus').textContent = 'Catálogo local ativo';
      $('#syncDetail').textContent = 'Configure a Drive API para sincronização e CBR/CBZ';
    }
  } catch (err) {
    state.items = [];
    $('#syncStatus').textContent = 'Falha no catálogo';
    $('#syncDetail').textContent = err.message;
    toast(`Falha ao carregar biblioteca: ${err.message}`);
  } finally {
    $('#refreshBtn').disabled = false;
    render();
  }
}

function seriesLabel(name) {
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
function seriesKey(name) { return normalizeText(seriesLabel(name)); }
function collectionGroups() {
  const map = new Map();
  for (const item of state.items) {
    const key = seriesKey(item.name);
    if (!map.has(key)) map.set(key, { key, label: seriesLabel(item.name), items: [] });
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
function itemCard(item) {
  const type = extType(item), pct = percentFor(item), thumb = thumbUrl(item);
  const status = pct >= 100 ? 'concluído' : pct ? `${Math.round(pct)}% lido` : 'não iniciado';
  return `<article class="card" data-id="${escapeHtml(item.id)}">
    <div class="cover">
      ${thumb ? `<img class="cover-img" src="${thumb}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      <span class="badge">${type === 'pdf' ? 'PDF' : type === 'comic' ? 'CBR/CBZ' : 'ARQ'}</span>
      <button class="fav ${favorites.has(item.id) ? 'on' : ''}" data-action="fav" title="Favoritar">★</button>
      <div class="cover-word">${escapeHtml(shortCover(item.name))}</div>
    </div>
    <div class="card-body">
      <div class="title">${escapeHtml(item.name)}</div>
      <div class="meta"><span>${bytes(item.size)}</span><span>${status}</span></div>
      <div class="progress"><i style="width:${pct}%"></i></div>
      <div class="card-actions"><button data-action="read">${pct >= 100 ? 'Ler novamente' : pct ? 'Continuar' : 'Ler agora'}</button>${item.localFile ? '' : '<button class="secondary" data-action="drive" title="Abrir no Drive">↗</button>'}</div>
    </div>
  </article>`;
}
function filtered() {
  const arr = state.items.filter(item => {
    const t = extType(item), p = progress[item.id];
    if (state.collection && seriesKey(item.name) !== state.collection) return false;
    if (state.filter === 'favorites' && !favorites.has(item.id)) return false;
    if (state.filter === 'reading' && !(p && p.percent > 0 && p.percent < 100)) return false;
    if (state.filter === 'completed' && !(p && p.percent >= 100)) return false;
    if (state.filter === 'pdf' && t !== 'pdf') return false;
    if (state.filter === 'comic' && t !== 'comic') return false;
    if (state.search && !normalizeText(item.name).includes(state.search)) return false;
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
  $('#libraryGrid').innerHTML = arr.map(itemCard).join('');
}

function setReaderButtons(type) {
  const comic = type === 'comic';
  $('#modeBtn').classList.toggle('hidden', !comic);
  $('#directionBtn').classList.toggle('hidden', !comic);
  $('#fitBtn').classList.toggle('hidden', !comic);
  $('#zoomControls').classList.toggle('hidden', !comic);
  $('#readerFooter').classList.add('hidden');
  updateCompleteButton();
}

function updateCompleteButton() {
  const done = Boolean(state.current && (progress[state.current.id]?.percent || 0) >= 100);
  $('#completeBtn').textContent = done ? '✓ Lido' : '✓ Marcar lido';
  $('#completeBtn').classList.toggle('is-complete', done);
}

function updateReaderPrefsUI() {
  $('#directionBtn').textContent = `Leitura: ${state.direction === 'rtl' ? '←' : '→'}`;
  $('#directionBtn').dataset.arrow = state.direction === 'rtl' ? '←' : '→';
  $('#modeBtn').textContent = `Modo: ${state.mode === 'page' ? 'Página' : 'Vertical'}`;
  $('#modeBtn').dataset.short = state.mode === 'page' ? '▣' : '↕';
  $('#zoomLabel').textContent = `${Math.round(state.zoom * 100)}%`;
  $('#zoomControls').classList.toggle('hidden', state.mode !== 'page' || extType(state.current || {}) !== 'comic');
}

async function openItem(item, forceLarge = false) {
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
  state.mode = progress[item.id]?.mode === 'vertical' ? 'vertical' : (progress[item.id]?.mode === 'page' ? 'page' : prefs.defaultMode);
  state.direction = progress[item.id]?.direction || prefs.direction || 'ltr';
  state.zoom = 1;
  $('#reader').classList.remove('hidden'); $('#reader').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  $('#readerTitle').textContent = item.name; $('#readerMeta').textContent = bytes(item.size);
  setReaderButtons(type);
  updateReaderPrefsUI();
  if (type === 'pdf') return openPdf(item, token);
  if (type === 'comic') return openComic(item, token);
  if (token === state.openToken) showReaderError('Formato não suportado', 'Este arquivo não é PDF, CBR, CBZ, RAR ou ZIP.');
}

function openPdf(item, token) {
  if (token !== state.openToken) return;
  $('#readerLoading').classList.add('hidden');
  $('#readerFooter').classList.add('hidden');
  let src;
  if (item.localFile) {
    state.pdfObjectUrl = URL.createObjectURL(item.localFile);
    src = `${state.pdfObjectUrl}#toolbar=1&navpanes=0`;
  } else {
    src = drivePreviewUrl(item);
  }
  $('#readerBody').innerHTML = `<iframe class="pdf-frame" src="${src}" title="${escapeHtml(item.name)}" allow="autoplay"></iframe>`;
  progress[item.id] = { ...(progress[item.id] || {}), percent: Math.max(5, progress[item.id]?.percent || 0), page: 0, mode: 'pdf', updated: Date.now() };
  saveProgress(); updateLibraryStats(); updateCompleteButton();
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

async function downloadDriveFile(item, token) {
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
  state.downloadController?.abort();
  state.downloadController = controller;
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
    if (state.downloadController === controller) state.downloadController = null;
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
  const limit = Math.max(4, Number(CONFIG.pageCacheLimit || 12));
  if (state.pageUrls.size <= limit) return;
  const candidates = [...state.pageUrls.keys()].filter(i => Math.abs(i - center) > 2).sort((a, b) => (state.pageUse.get(a) || 0) - (state.pageUse.get(b) || 0));
  while (state.pageUrls.size > limit && candidates.length) {
    const i = candidates.shift(); const url = state.pageUrls.get(i);
    URL.revokeObjectURL(url); state.pageUrls.delete(i); state.pageUse.delete(i);
    const slot = $(`.page-slot[data-i="${i}"]`);
    if (slot) slot.innerHTML = `<span class="page-placeholder">Página ${i + 1}</span>`;
  }
}

async function renderReaderPages() {
  if (!state.pages.length) return;
  const token = ++state.renderToken;
  stopVerticalObserver();
  if (state.mode === 'vertical') {
    $('#readerFooter').classList.add('hidden');
    $('#readerBody').classList.remove('page-mode');
    $('#readerBody').innerHTML = `<div class="vertical-pages">${state.pages.map((_, i) => `<div class="page-slot" data-i="${i}"><span class="page-placeholder">Página ${i + 1}</span></div>`).join('')}</div>`;
    setupVerticalObserver();
    requestAnimationFrame(() => $(`.page-slot[data-i="${state.page}"]`)?.scrollIntoView({ block: 'start' }));
  } else {
    $('#readerFooter').classList.remove('hidden');
    $('#readerLoading').classList.remove('hidden'); $('#loadingText').textContent = `Carregando página ${state.page + 1}…`;
    try {
      const url = await getPageUrl(state.page, token);
      if (token !== state.renderToken) return;
      $('#readerBody').classList.add('page-mode');
      const zoomStyle = state.zoom === 1 ? '' : `style="width:${Math.round(state.zoom * 100)}%;max-width:none;height:auto"`;
      $('#readerBody').innerHTML = `<div class="page-stage ${state.fit === 'width' ? 'fit-width' : ''}"><img src="${url}" alt="Página ${state.page + 1}" ${zoomStyle}></div>`;
      [state.page - 1, state.page + 1].filter(i => i >= 0 && i < state.pages.length).forEach(i => setTimeout(() => getPageUrl(i, token).catch(() => {}), 30));
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
  }, { root, rootMargin: '1200px 0px', threshold: 0.01 });
  $$('.page-slot').forEach(slot => state.verticalObserver.observe(slot));
  let ticking = false;
  state.verticalScrollHandler = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false; updateVerticalPosition();
    });
  };
  root.addEventListener('scroll', state.verticalScrollHandler, { passive: true });
}

async function loadVerticalSlot(slot) {
  if (!slot?.isConnected || slot.querySelector('img')) return;
  const i = Number(slot.dataset.i); const url = await getPageUrl(i);
  if (!slot.isConnected) return;
  const img = new Image(); img.alt = `Página ${i + 1}`; img.loading = 'lazy'; img.src = url;
  img.onload = () => { if (img.naturalWidth && img.naturalHeight) slot.style.aspectRatio = `${img.naturalWidth}/${img.naturalHeight}`; };
  slot.innerHTML = ''; slot.appendChild(img);
}

function updateVerticalPosition() {
  if (state.mode !== 'vertical' || !state.pages.length) return;
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
  const group = state.items.filter(i => seriesKey(i.name) === seriesKey(state.current.name)).sort((a, b) => naturalSort(a.name, b.name));
  const i = group.findIndex(x => x.id === state.current.id);
  return i >= 0 && i < group.length - 1 ? group[i + 1] : null;
}
function updatePageControls() {
  if (!state.pages.length) return;
  $('#pageRange').value = state.page + 1; $('#pageLabel').textContent = `${state.page + 1} / ${state.pages.length}`;
  const next = getNextIssue();
  const showNext = state.page >= state.pages.length - 1 && Boolean(next);
  $('#nextIssueBtn').classList.toggle('hidden', !showNext);
  if (showNext) $('#nextIssueBtn').title = next.name;
}
function updateProgress() {
  if (!state.current || !state.pages.length) return;
  const pct = Math.round(((state.page + 1) / state.pages.length) * 100);
  progress[state.current.id] = { percent: pct, page: state.page, mode: state.mode, direction: state.direction, updated: Date.now() };
  saveProgress(); updateLibraryStats(); updateCompleteButton();
}
async function setPage(n) {
  if (!state.pages.length) return;
  state.page = Math.max(0, Math.min(state.pages.length - 1, n));
  await renderReaderPages();
}

async function cleanupReaderData() {
  state.downloadController?.abort();
  state.downloadController = null;
  stopVerticalObserver();
  state.renderToken++;
  state.touchStart = null;
  for (const url of state.pageUrls.values()) URL.revokeObjectURL(url);
  state.pageUrls.clear(); state.pageUse.clear();
  if (state.pdfObjectUrl) { URL.revokeObjectURL(state.pdfObjectUrl); state.pdfObjectUrl = ''; }
  state.archive = null; state.pages = []; $('#readerBody')?.classList.remove('page-mode');
}
async function closeReader() {
  if (state.mode === 'vertical') updateVerticalPosition();
  state.openToken++;
  await cleanupReaderData();
  $('#reader').classList.add('hidden'); $('#reader').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = ''; state.current = null; $('#readerBody').innerHTML = ''; render();
}

function markComplete() {
  if (!state.current) return;
  const page = state.pages.length ? state.pages.length - 1 : 0;
  progress[state.current.id] = { percent: 100, page, mode: extType(state.current) === 'pdf' ? 'pdf' : state.mode, direction: state.direction, updated: Date.now() };
  saveProgress(); updateLibraryStats(); updateCompleteButton(); toast('Marcado como lido.');
}

function openSettings() {
  $('#apiKeyInput').value = getApiKey();
  $('#defaultModeSelect').value = prefs.defaultMode || 'page';
  $('#directionSelect').value = prefs.direction || 'ltr';
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
    if (action === 'read') { openItem(item); return; }
  }
  const nav = e.target.closest('.nav');
  if (nav) { $$('.nav').forEach(n => n.classList.remove('active')); nav.classList.add('active'); state.collection = ''; state.filter = nav.dataset.filter; render(); }
});

$('#searchInput').addEventListener('input', e => { state.search = normalizeText(e.target.value.trim()); render(); });
$('#sortSelect').addEventListener('change', e => { state.sort = e.target.value; render(); });
$('#showReadingBtn').addEventListener('click', () => { state.collection = ''; state.filter = 'reading'; $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.filter === 'reading')); render(); });
$('#backCollectionsBtn').addEventListener('click', () => { state.collection = ''; state.filter = 'collections'; $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.filter === 'collections')); render(); });
$('#refreshBtn').addEventListener('click', loadLibrary);
$('#driveBtn').addEventListener('click', () => safeOpen(CONFIG.folderUrl));
$('#settingsBtn').addEventListener('click', openSettings);
$('#noticeSettingsBtn').addEventListener('click', openSettings);
$('#closeSettings').addEventListener('click', closeSettings);
$('#settingsModal').addEventListener('click', e => { if (e.target === $('#settingsModal')) closeSettings(); });
$('#saveKeyBtn').addEventListener('click', async () => {
  const key = $('#apiKeyInput').value.trim();
  prefs.defaultMode = $('#defaultModeSelect').value === 'vertical' ? 'vertical' : 'page';
  prefs.direction = $('#directionSelect').value === 'rtl' ? 'rtl' : 'ltr';
  savePrefs();
  if (key) storageSet(LS.apiKey, key); else storageRemove(LS.apiKey);
  $('#configStatus').textContent = key ? 'Chave salva. Sincronizando…' : 'Chave removida.';
  closeSettings(); await loadLibrary();
});
$('#clearKeyBtn').addEventListener('click', async () => {
  storageRemove(LS.apiKey); $('#apiKeyInput').value = ''; $('#configStatus').textContent = 'Chave removida.'; closeSettings(); await loadLibrary();
});

$('#localBtn').addEventListener('click', () => $('#localFileInput').click());
$('#localFileInput').addEventListener('change', async e => { const file = e.target.files?.[0]; e.target.value = ''; await openLocalSelected(file); });
$('#closeReader').addEventListener('click', closeReader);
$('#completeBtn').addEventListener('click', markComplete);
$('#prevPage').addEventListener('click', () => setPage(state.page - 1));
$('#nextPage').addEventListener('click', () => setPage(state.page + 1));
$('#nextIssueBtn').addEventListener('click', async () => { const next = getNextIssue(); if (next) await openItem(next); });
$('#pageRange').addEventListener('input', e => setPage(Number(e.target.value) - 1));
$('#modeBtn').addEventListener('click', async () => {
  if (!state.pages.length) return;
  state.mode = state.mode === 'page' ? 'vertical' : 'page';
  updateReaderPrefsUI();
  await renderReaderPages();
});
$('#fitBtn').addEventListener('click', async () => {
  state.fit = state.fit === 'contain' ? 'width' : 'contain'; $('#fitBtn').textContent = state.fit === 'width' ? 'Largura' : 'Ajustar';
  await renderReaderPages();
});
$('#directionBtn').addEventListener('click', () => {
  state.direction = state.direction === 'rtl' ? 'ltr' : 'rtl';
  prefs.direction = state.direction; savePrefs(); updateReaderPrefsUI(); updateProgress();
  toast(state.direction === 'rtl' ? 'Modo mangá: avance tocando à esquerda.' : 'Leitura ocidental: avance tocando à direita.');
});
async function setZoom(value) {
  state.zoom = Math.max(.6, Math.min(3, Math.round(value * 10) / 10)); updateReaderPrefsUI();
  if (state.mode === 'page' && state.pages.length) await renderReaderPages();
}
$('#zoomOutBtn').addEventListener('click', () => setZoom(state.zoom - .2));
$('#zoomInBtn').addEventListener('click', () => setZoom(state.zoom + .2));
$('#zoomLabel').addEventListener('click', () => setZoom(1));
$('#fullscreenBtn').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : $('#reader').requestFullscreen?.());
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
  if (settingsOpen) { if (e.key === 'Escape') closeSettings(); return; }
  if (largeOpen) {
    if (e.key === 'Escape') { state.largePending = null; $('#largeFileModal').classList.add('hidden'); }
    return;
  }
  if (e.target?.matches?.('input,select,textarea,[contenteditable="true"]')) return;
  if ($('#reader').classList.contains('hidden')) return;
  if (e.key === 'Escape') { closeReader(); return; }
  if (state.mode === 'page' && e.key === 'ArrowRight') setPage(state.page + (state.direction === 'rtl' ? -1 : 1));
  if (state.mode === 'page' && e.key === 'ArrowLeft') setPage(state.page + (state.direction === 'rtl' ? 1 : -1));
  if (state.mode === 'page' && (e.key === '+' || e.key === '=')) setZoom(state.zoom + .2);
  if (state.mode === 'page' && e.key === '-') setZoom(state.zoom - .2);
  if (state.mode === 'page' && e.key === '0') setZoom(1);
});

$('#readerBody').addEventListener('click', e => {
  if (state.mode !== 'page' || !state.pages.length || e.target.closest('button,a')) return;
  const rect = $('#readerBody').getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / Math.max(1, rect.width);
  if (ratio > .30 && ratio < .70) return;
  const leftZone = ratio <= .30;
  const next = state.direction === 'rtl' ? leftZone : !leftZone;
  setPage(state.page + (next ? 1 : -1));
});
$('#readerBody').addEventListener('dblclick', e => { if (state.mode === 'page' && e.target.closest('img')) setZoom(state.zoom === 1 ? 1.6 : 1); });
$('#readerBody').addEventListener('touchstart', e => {
  if (state.mode !== 'page' || !state.pages.length || e.touches.length !== 1 || state.zoom > 1.01) return;
  const t = e.touches[0]; state.touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
}, { passive: true });
$('#readerBody').addEventListener('touchend', e => {
  const start = state.touchStart; state.touchStart = null;
  if (!start || state.mode !== 'page' || !state.pages.length || state.zoom > 1.01) return;
  const t = e.changedTouches?.[0]; if (!t) return;
  const dx = t.clientX - start.x, dy = t.clientY - start.y;
  if (Date.now() - start.time > 700 || Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
  const swipeLeft = dx < 0;
  const next = state.direction === 'rtl' ? !swipeLeft : swipeLeft;
  setPage(state.page + (next ? 1 : -1));
}, { passive: true });

function exportReaderData() {
  const data = { app: 'Manga HQ Reader', version: '3.1.0', exportedAt: new Date().toISOString(), favorites: [...favorites], progress, prefs };
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

if (storageGet(LS.theme) === 'light') document.documentElement.classList.add('light');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
loadLibrary();
