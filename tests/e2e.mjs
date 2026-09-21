import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173/';
const TARGET = 'Godzilla vs Power Rangers #1';

async function waitForReaderPage(page) {
  await page.locator('#reader:not(.hidden)').waitFor({ state:'visible', timeout:15000 });
  const img = page.locator('.page-stage img').first();
  await img.waitFor({ state:'visible', timeout:15000 });
  await page.waitForFunction(() => {
    const img = document.querySelector('.page-stage img');
    return Boolean(img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
  }, null, { timeout:20000 });
  return img;
}

async function assertNoHorizontalOverflow(page, label) {
  const result = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  assert.ok(result.doc <= result.innerWidth + 2, `${label}: document overflow horizontal (${result.doc} > ${result.innerWidth})`);
  assert.ok(result.body <= result.innerWidth + 2, `${label}: body overflow horizontal (${result.body} > ${result.innerWidth})`);
}

async function runProfile(browser, name, contextOptions) {
  const context = await browser.newContext({
    ...contextOptions,
    serviceWorkers: 'block'
  });
  const page = await context.newPage();
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', err => errors.push(err.message || String(err)));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Image/network failures are asserted separately by naturalWidth.
      if (!/Failed to load resource/i.test(text)) consoleErrors.push(text);
    }
  });

  await page.goto(BASE, { waitUntil:'domcontentloaded', timeout:30000 });
  await page.locator('#libraryGrid .card').first().waitFor({ state:'visible', timeout:15000 });
  await assertNoHorizontalOverflow(page, `${name}/biblioteca`);

  // Search and source filter must work.
  await page.locator('#sourceSelect').selectOption('library-5');
  await page.waitForFunction(() => document.querySelectorAll('#libraryGrid .card').length === 5, null, { timeout:10000 });
  const names = await page.locator('#libraryGrid .card .title').allTextContents();
  assert.equal(names.length, 5, `${name}: Biblioteca 5 deveria ter 5 edições`);
  assert.ok(names.some(x => x.includes(TARGET)), `${name}: edição alvo não encontrada`);

  // Open first issue.
  const card = page.locator('#libraryGrid .card').filter({ hasText: TARGET }).first();
  await card.locator('[data-action="read"]').click();
  await waitForReaderPage(page);
  assert.match(await page.locator('#readerMeta').textContent(), /22 páginas/i, `${name}: contador de páginas incorreto`);
  assert.match(await page.locator('#pageLabel').textContent(), /1\s*\/\s*22/, `${name}: página inicial incorreta`);

  // Next/previous page.
  await page.locator('#nextPage').click();
  await page.waitForFunction(() => /2\s*\/\s*22/.test(document.querySelector('#pageLabel')?.textContent || ''), null, { timeout:10000 });
  await waitForReaderPage(page);
  await page.locator('#prevPage').click();
  await page.waitForFunction(() => /1\s*\/\s*22/.test(document.querySelector('#pageLabel')?.textContent || ''), null, { timeout:10000 });

  // Reader controls and responsive layout.
  if (name === 'mobile') {
    await page.locator('#readerMenuBtn').click();
    assert.equal(await page.locator('#readerMenuBtn').getAttribute('aria-expanded'), 'true', 'mobile: menu do leitor não abriu');
  }
  await assertNoHorizontalOverflow(page, `${name}/leitor`);

  // Exercise spread then vertical/webtoon rendering.
  await page.locator('#modeBtn').click(); // page -> spread
  await page.waitForTimeout(200);
  await page.locator('#modeBtn').click(); // spread -> vertical
  await page.waitForFunction(() => document.querySelectorAll('.page-slot').length === 22, null, { timeout:10000 });
  await page.waitForFunction(() => {
    const img = document.querySelector('.page-slot img');
    return Boolean(img && img.complete && img.naturalWidth > 0);
  }, null, { timeout:20000 });

  // Bookmarks and display controls should be interactive.
  await page.locator('#bookmarkBtn').click();
  assert.match(await page.locator('#bookmarkBtn').textContent(), /Marcado|★|Marcador/i);
  await page.locator('#displayBtn').click();
  await page.locator('#readerDisplayPanel:not(.hidden)').waitFor({ state:'visible', timeout:5000 });
  await page.locator('#closeDisplayBtn').click();

  // Close and reopen another issue to catch stale state/observer bugs.
  await page.locator('#closeReader').click();
  await page.locator('#reader.hidden').waitFor({ state:'attached', timeout:5000 });
  const second = page.locator('#libraryGrid .card').filter({ hasText:'Godzilla vs Power Rangers #2' }).first();
  await second.locator('[data-action="read"]').click();
  await waitForReaderPage(page);
  assert.match(await page.locator('#readerMeta').textContent(), /22 páginas/i);

  assert.deepEqual(errors, [], `${name}: pageerror detectado: ${errors.join(' | ')}`);
  assert.deepEqual(consoleErrors, [], `${name}: console.error detectado: ${consoleErrors.join(' | ')}`);

  await context.close();
  console.log(`E2E OK: ${name}`);
}

const browser = await chromium.launch({ headless:true });
try {
  await runProfile(browser, 'desktop', {
    viewport:{ width:1440, height:900 }
  });
  await runProfile(browser, 'mobile', {
    ...devices['Pixel 7']
  });
} finally {
  await browser.close();
}
