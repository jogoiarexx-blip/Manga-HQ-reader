import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const app = read('js/app.js');
const html = read('index.html');
const config = read('config.js');
const sw = read('sw.js');
const catalog = JSON.parse(read('data/catalog.json'));

// 1) JavaScript syntax.
new Function(app);

// 2) HTML ids must be unique.
const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(htmlIds).size, htmlIds.length, 'index.html possui IDs duplicados');

// 3) Direct #id selectors should point to real or intentionally dynamic elements.
const usedIds = [...new Set([...app.matchAll(/\$\('#([^']+)'\)/g)].map(m => m[1]))];
const dynamicIds = new Set(['errorLocalBtn','errorDriveBtn','errorSettingsBtn']);
const missingIds = usedIds.filter(id => !htmlIds.includes(id) && !dynamicIds.has(id));
assert.deepEqual(missingIds, [], 'app.js referencia IDs ausentes no index.html');

// 4) Prevent the regression that caused $(...).forEach runtime failures.
const invalidForEach = app.split('\n')
  .map((line, i) => ({ line: i + 1, text: line }))
  .filter(x => x.text.includes('$(') && !x.text.includes('$$(') && x.text.includes('.forEach'));
assert.deepEqual(invalidForEach, [], 'Use $$() para listas antes de .forEach()');

// 5) Keep versions aligned.
const appVersion = app.match(/appVersion:\s*'([^']+)'/)?.[1];
const configVersion = config.match(/appVersion:\s*'([^']+)'/)?.[1];
const titleVersion = html.match(/<title>[^<]*v(\d+\.\d+\.\d+)<\/title>/)?.[1];
const swVersion = sw.match(/CACHE_PREFIX\}v([^\x60]+)/)?.[1];
assert.ok(appVersion, 'Versão não encontrada em app.js');
assert.equal(configVersion, appVersion, 'config.js e app.js com versões diferentes');
assert.equal(titleVersion, appVersion, 'index.html e app.js com versões diferentes');
assert.equal(swVersion, appVersion, 'sw.js e app.js com versões diferentes');
assert.ok(html.includes(`./config.js?v=${appVersion}`), 'cache-busting de config.js desatualizado');
assert.ok(html.includes(`./js/app.js?v=${appVersion}`), 'cache-busting de app.js desatualizado');

// 6) Catalog integrity.
const ids = catalog.map(item => item?.id).filter(Boolean);
assert.equal(new Set(ids).size, ids.length, 'data/catalog.json possui IDs duplicados');
for (const item of catalog) {
  assert.ok(item?.id && item?.name, 'Item do catálogo sem id/name');
  if (item.readerType !== 'drive-pages') continue;
  assert.ok(item.driveFolderId, `${item.name}: driveFolderId ausente`);
  assert.ok(Array.isArray(item.drivePages) && item.drivePages.length > 0, `${item.name}: drivePages ausente`);
  assert.equal(Number(item.pageCount), item.drivePages.length, `${item.name}: pageCount divergente`);
  const pageIds = item.drivePages.map(p => p?.id);
  assert.ok(pageIds.every(Boolean), `${item.name}: página sem ID`);
  assert.equal(new Set(pageIds).size, pageIds.length, `${item.name}: IDs de página duplicados`);
  assert.equal(item.coverPageId, item.drivePages[0]?.id, `${item.name}: capa não corresponde à primeira página`);
  const numbered = item.drivePages.map(p => Number(String(p.name || '').match(/^(\d+)\./)?.[1])).filter(Number.isFinite);
  if (numbered.length === item.drivePages.length) {
    numbered.forEach((n, i) => assert.equal(n, i + 1, `${item.name}: sequência de páginas quebrada na posição ${i + 1}`));
  }
}

// 7) Configured Drive roots must be unique and URL/id counts must match.
const idsBlock = config.match(/folderIds:\s*\[([^\]]+)\]/)?.[1] || '';
const urlsBlock = config.match(/folderUrls:\s*\[([^\]]+)\]/)?.[1] || '';
const folderIds = [...idsBlock.matchAll(/'([^']+)'/g)].map(m => m[1]);
const folderUrls = [...urlsBlock.matchAll(/'([^']+)'/g)].map(m => m[1]);
assert.ok(folderIds.length > 0, 'Nenhuma biblioteca Drive configurada');
assert.equal(folderIds.length, folderUrls.length, 'folderIds e folderUrls possuem quantidades diferentes');
assert.equal(new Set(folderIds).size, folderIds.length, 'folderIds possui duplicatas');
folderIds.forEach((id, i) => assert.ok(folderUrls[i].includes(id), `URL da Biblioteca ${i + 1} não corresponde ao ID`));

// 8) Service worker core files must exist.
const coreBlock = sw.match(/const CORE = \[([\s\S]*?)\]\.map/)?.[1] || '';
const corePaths = [...coreBlock.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
for (const p of corePaths) assert.ok(fs.existsSync(path.join(root, p)), `Arquivo do cache PWA ausente: ${p}`);

// 9) Remote Drive URLs must not be blindly revoked as Blob URLs.
assert.ok(!app.includes('URL.revokeObjectURL(state.pageUrls.get('), 'URL remota sendo revogada como Blob URL');

console.log(`Smoke OK — v${appVersion} — ${catalog.length} itens — ${catalog.filter(x => x.readerType === 'drive-pages').length} HQ(s) WebP diretas.`);
