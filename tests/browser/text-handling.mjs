// WEBSTUDIO_PLAYWRIGHT selects the installed Playwright; optional WEBSTUDIO_TEST_CDP
// targets a desktop build with an isolated test profile. No system clipboard is changed.
import { createRequire } from 'node:module';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
const output = path.resolve('test-results/text-handling');
await mkdir(output, { recursive: true });
const fixture = path.join(output, 'paragraph-fixture.webstudio.json');
const block = { id: 'writing-example', type: 'content', variant: 'prose', props: {
  backgroundColor: '#ffffff', body: 'Riverside community\nVisit our community.\nThis paragraph stays unchanged.',
  bodyRich: [
    { text: 'Riverside community', tag: 'h2', line: 1, size: 28, color: '#14334b' },
    { text: 'Visit our ', tag: 'p', line: 2, size: 18, color: '#111111' },
    { text: 'community', tag: 'p', line: 2, size: 18, color: '#111111', href: '/visit', underline: true },
    { text: '.', tag: 'p', line: 2, size: 18, color: '#111111' },
    { text: 'This paragraph stays unchanged.', tag: 'p', line: 3, size: 18, color: '#111111' },
  ],
  section1Objects: [{ id: 'example-panel', type: 'panel', text: 'Example panel', x: 65, y: 180, width: 25, height: 80, layer: 1, backgroundColor: '#f5f5f5' }],
} };
const heading = { id: 'heading-example', type: 'hero', variant: 'minimal', props: { headline: 'A formatted heading', headlineRich: [{ text: 'A formatted heading', size: 44, color: '#ff0000' }], subheadline: '' } };
await writeFile(fixture, JSON.stringify({ format: 'webstudio', schemaVersion: 2, projectId: 'text-handling-test', config: { name: 'Writing example', blocks: [block, heading], pages: [{ id: 'home', name: 'Home', path: '/', blocks: [block, heading] }] }, assets: [] }));
let vite;
let browser;
const native = process.env.WEBSTUDIO_TEST_CDP;
try {
  if (native) {
    assert.match(native, /^http:\/\/127\.0\.0\.1:\d+$/);
    browser = await chromium.connectOverCDP(native);
  } else {
    vite = await createServer({ server: { host: '127.0.0.1', port: 0 }, appType: 'spa', ssr: { noExternal: ['pdfjs-dist'] } });
    await vite.listen();
    browser = await chromium.launch({ executablePath: process.env.WEBSTUDIO_EDGE, headless: true });
  }
  const page = native ? browser.contexts()[0].pages()[0] ?? await browser.contexts()[0].waitForEvent('page') : await browser.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  assert(page, 'Test editor exists');
  if (native) await page.waitForURL('https://webstudio.local/**');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(native ? 'https://webstudio.local/index.html#/editor' : vite.resolvedUrls.local[0] + 'editor');
  await page.getByRole('button', { name: /^Church/ }).click();
  await page.locator('[aria-label="Choose project file"]').setInputFiles(fixture);
  const editor = page.locator('[data-rich-editor="body"]');
  await editor.waitFor();
  await page.getByRole('button', { name: 'Close', exact: true }).all().then(items => Promise.all(items.map(item => item.click().catch(() => {}))));
  async function select(text, collapsed = false) {
    await editor.evaluate((element, { text, collapsed }) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const index = node.textContent.indexOf(text);
        if (index < 0) continue;
        element.focus({ preventScroll: true });
        const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + (collapsed ? 0 : text.length));
        const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); return;
      }
      throw Error('Text was not found: ' + text);
    }, { text, collapsed });
  }
  async function context() {
    await editor.evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: innerWidth - 10, clientY: innerHeight - 8 })));
    await page.getByRole('menu', { name: 'Text context menu' }).waitFor();
  }
  async function fits(locator, centered = false) {
    const b = await locator.boundingBox(), size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert(b && b.x >= 0 && b.y >= 0 && b.x + b.width <= size.width + 1 && b.y + b.height <= size.height + 1, 'Entire window fits the viewport');
    if (centered) assert(b.y < size.height / 2, 'Bottom-clicked menu opens higher on screen');
    return b;
  }
  await select('Visit our'); await context();
  const menu = page.getByRole('menu', { name: 'Text context menu' });
  assert((await fits(menu, true)).height < 300, 'Default context menu stays compact');
  await menu.screenshot({ path: path.join(output, `${native ? 'desktop' : 'browser'}-context.png`) });
  await menu.getByText('Paste options', { exact: true }).click();
  await fits(menu);
  await page.keyboard.press('Escape');
  await select('Visit our', true); await context();
  await menu.getByRole('menuitem', { name: 'Paragraph settings…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Paragraph settings', exact: true });
  await dialog.getByRole('combobox', { name: 'Paragraph alignment', exact: true }).selectOption('justify');
  for (const [name, value] of [['Line spacing', '1.75'], ['Space before (px)', '8'], ['Space after (px)', '14'], ['Left indent (px)', '12'], ['Right indent (px)', '16'], ['First line (px)', '18']]) await dialog.getByRole('spinbutton', { name, exact: true }).fill(value);
  await fits(dialog);
  await dialog.screenshot({ path: path.join(output, `${native ? 'desktop' : 'browser'}-paragraph.png`) });
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  let paragraph = editor.locator('p').filter({ hasText: 'Visit our' });
  assert.equal(await paragraph.evaluate(e => e.style.lineHeight), '1.75');
  assert.equal(await paragraph.evaluate(e => e.style.marginLeft), '12px');
  assert.equal(await paragraph.evaluate(e => e.style.textAlign), 'justify');
  assert.equal(await editor.locator('p').filter({ hasText: 'stays unchanged' }).evaluate(e => e.style.lineHeight), '', 'Unselected paragraph is untouched');
  assert.equal(await editor.locator('a[href="/visit"]').count(), 1, 'Link is retained');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await paragraph.evaluate(e => e.style.lineHeight), '', 'Undo restores paragraph spacing');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await paragraph.evaluate(e => e.style.lineHeight), '1.75');
  // A cancel must leave both document and saved configuration untouched.
  await select('Visit our'); await context();
  await menu.getByRole('menuitem', { name: 'Paragraph settings…' }).click();
  await dialog.getByRole('spinbutton', { name: 'Line spacing', exact: true }).fill('2.5');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await paragraph.evaluate(e => e.style.lineHeight), '1.75');
  // Preserve paragraph settings across a real project-file round trip.
  if (!native) {
    const config = await page.evaluate(async () => (await import('/src/store/configStore.ts')).useConfigStore.getState().config);
    const { createProjectFile, serializeProjectFile, parseProjectFile } = await vite.ssrLoadModule('/src/project/project-file.ts');
    const serialized = serializeProjectFile(createProjectFile(config, 'text-handling-reopened'));
    const reopened = parseProjectFile(serialized).project.config;
    const { exportSiteToHTML } = await vite.ssrLoadModule('/src/lib/export-html.ts');
    const html = exportSiteToHTML(reopened);
    const exported = await browser.newPage();
    for (const width of [1280, 800, 390]) {
      await exported.setViewportSize({ width, height: 850 }); await exported.setContent(html);
      const p = exported.locator('[data-rich-text] p').filter({ hasText: 'Visit our' });
      assert.equal(await p.evaluate(e => e.style.lineHeight), '1.75', `Export paragraph styles at ${width}px`);
      assert.equal(await exported.locator('a[href="/visit"]').count(), 1);
    }
    await exported.close();
    await writeFile(path.join(output, 'reopened.webstudio.json'), serialized);
    await page.locator('[aria-label="Choose project file"]').setInputFiles(path.join(output, 'reopened.webstudio.json'));
    await paragraph.waitFor();
    assert.equal(await paragraph.evaluate(e => e.style.lineHeight), '1.75', 'Saved project preserves paragraph style');
  }
  // Keyboard paste uses destination formatting, not an arbitrary source heading.
  async function paste(mode) {
    await select('This paragraph stays unchanged.');
    await editor.evaluate((element, mode) => {
      const data = new DataTransfer();
      data.setData('text/html', '<h2 style="font-size:44px;color:#ff0000">Clean&nbsp;&nbsp;wording <a href="/visit">visit</a></h2>');
      data.setData('text/plain', 'Clean  wording visit');
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, shiftKey: mode === 'plain', bubbles: true }));
      element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      element.blur();
    }, mode);
  }
  await paste('match');
  assert(!/44px|255, 0, 0/.test(await editor.innerHTML()), 'Regular paste rejects source font and red color');
  assert((await editor.textContent()).includes('Clean wording visit'), 'Regular paste cleans nonbreaking and repeated spaces');
  assert.equal(await editor.locator('a[href="/visit"]').count(), 2, 'Regular paste preserves safe links');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await paste('plain');
  assert.equal(await editor.locator('a[href="/visit"]').count(), 1, 'Plain-text paste adds no source link');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  // Mock only this test page's Clipboard API; never overwrite the user's clipboard.
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: async () => [{ types: ['text/html', 'text/plain'], getType: async type => new Blob([type === 'text/html' ? '<h2 style="font-size:44px;color:#ff0000">Source&nbsp;&nbsp;heading <a href="/visit">visit</a></h2>' : 'Source  heading visit'], { type }) }] } }));
  await select('This paragraph stays unchanged.'); await context();
  await menu.getByText('Paste options', { exact: true }).click();
  await menu.getByRole('menuitem', { name: 'Keep source formatting', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-rich-editor="body"]')?.textContent.includes('Source'));
  assert.match(await editor.innerHTML(), /44px/);
  await select('Source'); await context();
  await menu.getByRole('menuitem', { name: 'Reset to Normal text', exact: true }).click();
  assert(!/44px|255, 0, 0/.test(await editor.innerHTML()), 'Reset removes source heading formatting');
  assert((await editor.textContent()).includes('Source heading visit'), 'Reset preserves wording and normalizes spaces');
  assert.equal(await editor.locator('a[href="/visit"]').count(), 2, 'Reset preserves the inserted link');
  assert.equal(await paragraph.evaluate(e => e.style.lineHeight), '1.75', 'Reset does not change a different paragraph');
  await select('Source'); await context();
  if (!native) {
    await page.setViewportSize({ width: 600, height: 420 }); await fits(menu);
    await menu.getByText('Paste options', { exact: true }).click(); await fits(menu);
    await menu.getByRole('menuitem', { name: 'Paragraph settings…' }).click(); await fits(dialog);
  }
  await page.keyboard.press('Escape');
  const headline = page.locator('[data-rich-editor="headline"]');
  await headline.evaluate(element => {
    element.focus({ preventScroll: true }); const range = document.createRange(); range.selectNodeContents(element);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
    element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 500, clientY: innerHeight - 10 }));
  });
  await menu.getByRole('menuitem', { name: 'Reset to Normal text', exact: true }).click();
  assert.match(await headline.innerHTML(), /font-size:\s*16px/, 'Normal text also applies to a single-line Hero field');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.match(await headline.innerHTML(), /44px/, 'Undo restores a single-line field');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.match(await headline.innerHTML(), /16px/, 'Redo reapplies normal text');
  await page.locator('[data-webstudio-block-id="writing-example"]').evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: innerWidth - 8, clientY: innerHeight - 8 })));
  await fits(page.getByRole('menu', { name: 'content block actions' }), true);
  await page.keyboard.press('Escape');
  await page.locator('[data-section-object="example-panel"]').evaluate(element => element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: innerWidth - 8, clientY: innerHeight - 8 })));
  await fits(page.getByRole('menu', { name: 'Object actions' }), true);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, [], 'No runtime errors');
  console.log(`PASS ${native ? 'desktop' : 'browser'}: compact/upward menu, paragraph scope/spacing/indents, undo/redo/cancel, match/source/plain paste, reset with links${native ? '' : ', saved-project round trip and export at desktop/tablet/phone'}.`);
} finally {
  await browser?.close(); await vite?.close();
  await rm(fixture, { force: true });
}
