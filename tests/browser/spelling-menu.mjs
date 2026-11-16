// Connect only to an expendable desktop test profile via WEBSTUDIO_TEST_CDP.
// Set WEBSTUDIO_PREPARE_SPELLING=1 to load the fixture and open the Windows menu;
// select "beautiful" in that native menu when prompted. Without this flag, verify
// an already prepared/corrected fixture. No system clipboard/dictionary is changed.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
assert.match(process.env.WEBSTUDIO_TEST_CDP || '', /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.connectOverCDP(process.env.WEBSTUDIO_TEST_CDP);
try {
  const page = browser.contexts()[0].pages().find(p => p.url().startsWith('https://webstudio.local/'));
  assert(page, 'Use the isolated spelling test editor');
  assert.equal(await page.evaluate(() => window.webstudioNativeSpellingMenu), true);
  if (process.env.WEBSTUDIO_PREPARE_SPELLING === '1') {
    await page.goto('https://webstudio.local/index.html#/editor');
    const starter = page.getByRole('button', { name: /^Church/ });
    if (await starter.count()) await starter.click();
    const block = { id: 'spelling', type: 'content', variant: 'prose', props: { blockBackgroundColor: '#ffffff', body: 'Practice text.', bodyRich: [{ text: 'Practice text.', tag: 'p', line: 1, font: 'Arial', size: 22, color: '#17334b' }] } };
    await page.locator('[aria-label="Choose project file"]').setInputFiles({ name: 'spelling.webstudio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'webstudio', schemaVersion: 2, projectId: 'spelling-test', config: { name: 'Spelling correction test', blocks: [block], pages: [{ id: 'home', name: 'Home', path: '/', blocks: [block] }] }, assets: [] })) });
    await page.evaluate(() => { window.spellingTestReplies = []; window.chrome.webview.addEventListener('message', event => { if (event.data.kind === 'ui.text.context') window.spellingTestReplies.push(event.data); }); });
    const input = page.locator('[data-rich-editor="body"]');
    await input.click(); await page.keyboard.press('Control+a'); await page.keyboard.type('This is a beutiful day. ', { delay: 35 }); await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(1200); // Windows spell checker processes real keyboard input asynchronously.
    const point = await input.evaluate(e => {
      const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let node;
      while ((node = walker.nextNode())) {
        const start = node.textContent.indexOf('beutiful'); if (start < 0) continue;
        const range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + 8);
        const box = range.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      }
      throw Error('Misspelling missing');
    });
    await page.mouse.click(point.x, point.y, { button: 'right' });
    console.log('Choose "beautiful" in the Windows spelling menu. Waiting up to two minutes.');
    await page.waitForFunction(() => document.querySelector('[data-rich-editor="body"]')?.textContent.includes('beautiful'), null, { timeout: 120000 });
  }
  assert(await page.evaluate(() => window.spellingTestReplies?.some(reply => reply.native === true)), 'Windows spelling menu was selected by the host');
  const editor = page.locator('[data-rich-editor="body"]');
  assert.equal((await editor.textContent()).trim(), 'This is a beautiful day.', 'Actual Windows suggestion corrected only the word');
  const style = await editor.evaluate(e => {
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let node;
    while ((node = walker.nextNode())) if (node.textContent.includes('beautiful')) {
      const s = getComputedStyle(node.parentElement); return { size: s.fontSize, font: s.fontFamily, color: s.color };
    }
  });
  assert.equal(style.size, '22px'); assert.match(style.font, /Arial/); assert.equal(style.color, 'rgb(23, 51, 75)');
  await page.keyboard.press('Control+z');
  assert.match(await editor.textContent(), /beutiful/, 'Native correction remains undoable');
  await page.keyboard.press('Control+y');
  assert.match(await editor.textContent(), /beautiful/, 'Native correction remains redoable');
  await page.getByRole('button', { name: 'Toggle preview mode', exact: true }).click();
  assert.match(await page.locator('[data-rich-text]').textContent(), /beautiful/);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('openpage-config')).state.config.blocks[0].props);
  assert.match(stored.body, /beautiful/, 'Corrected wording reaches the saved model');
  assert(stored.bodyRich.some(run => run.text.includes('beautiful') && run.size === 22 && run.font.includes('Arial')), 'Rich formatting is retained in the model');
  await page.getByRole('button', { name: 'Toggle preview mode', exact: true }).click();
  await editor.click();
  const point = await editor.evaluate(e => {
    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let node;
    while ((node = walker.nextNode())) if (node.textContent.includes('day')) {
      const start = node.textContent.indexOf('day'), range = document.createRange(); range.setStart(node, start); range.setEnd(node, start + 3);
      const box = range.getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }
    throw Error('Correctly spelled text missing');
  });
  await page.mouse.click(point.x, point.y, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Text context menu', exact: true }); await menu.waitFor();
  assert.equal(await page.evaluate(() => window.spellingTestReplies.at(-1).native), false, 'Ordinary text uses the compact editor menu');
  await menu.getByRole('menuitem', { name: 'Paragraph settings…', exact: true }).click();
  const paragraph = page.getByRole('dialog', { name: 'Paragraph settings', exact: true });
  await paragraph.getByRole('spinbutton', { name: 'Space after (px)', exact: true }).fill('12');
  await paragraph.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(await editor.locator('p').evaluate(e => e.style.marginBottom), '12px');
  console.log('PASS: actual Windows correction, font/size/color preservation, undo/redo, Preview and model persistence; ordinary right-click retains compact Paragraph settings.');
} finally { await browser.close(); }
