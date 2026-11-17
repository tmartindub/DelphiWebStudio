// Run only against a disposable native WebView profile. No live keys or Google requests.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

assert.notEqual(process.env.WEBSTUDIO_LIVE_GEMINI, '1');
assert.match(process.env.WEBSTUDIO_TEST_CDP || '', /^http:\/\/127\.0\.0\.1:\d+$/);
const { chromium } = createRequire(import.meta.url)(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
const browser = await chromium.connectOverCDP(process.env.WEBSTUDIO_TEST_CDP);
const output = path.resolve(process.env.WEBSTUDIO_TEST_OUTPUT || 'test-results/ai-targeting');
const platform = process.env.WEBSTUDIO_PLATFORM || 'desktop';
await mkdir(output, { recursive: true });
try {
  const page = browser.contexts()[0].pages()[0];
  await page.waitForURL('https://webstudio.local/**');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === 'https://webstudio.local' || url.hostname === '127.0.0.1' || ['blob:', 'data:'].includes(url.protocol)
      ? route.continue() : route.abort('blockedbyclient');
  });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://webstudio.local/index.html#/editor');
  const editorBundle = await page.locator('script[type="module"][src]').evaluate(el => new URL(el.src).pathname.split('/').at(-1));
  assert.match(editorBundle, /^index-[\w-]+\.js$/, 'Record the actual staged editor bundle loaded by WebView');
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'or start blank', exact: true }).click();
  await page.getByText('Start building', { exact: true }).waitFor();
  const baseBlocks = [
    { id: 'hero', type: 'hero', variant: 'minimal', props: { headline: 'Comunidad', subheadline: 'Connect a community or club', blockBackgroundColor: '#090909', textColor: '#ffffff', section1Objects: [{ id: 'hero-panel', type: 'panel', text: 'Hero child panel', x: 8, y: 340, width: 30, height: 50, color: '#333333' }] } },
    { id: 'lower', type: 'panel', variant: 'default', props: { title: 'Lower section', body: 'This section must keep its original color.', blockBackgroundColor: '#e8edf2', textColor: '#172033', layoutHeight: 180 } },
    { id: 'footer', type: 'footer', variant: 'simple', props: { copyright: 'Synthetic fixture footer', blockBackgroundColor: '#172033', textColor: '#ffffff' } },
  ];
  async function loadFixture(duplicate = false) {
    const blocks = structuredClone(baseBlocks);
    if (duplicate) blocks.splice(1, 0, { id: 'second-hero', type: 'hero', variant: 'minimal', props: { headline: 'Another welcome', subheadline: 'Second hero', blockBackgroundColor: '#ffffff' } });
    const fixture = { format: 'webstudio', schemaVersion: 2, projectId: 'gemini-targeting-' + Date.now(), config: { name: 'AI targeting fixture', theme: { bg0: '#ffffff', text0: '#172033', accent: '#ed8b21' }, blocks, pages: [{ id: 'home', name: 'Home', path: '/', blocks }, { id: 'private', name: 'Private', path: '/private', blocks: [{ id: 'private-content', type: 'content', variant: 'prose', props: { body: 'PRIVATE_OTHER_PAGE_CONTENT' } }] }] }, assets: [] };
    await page.locator('[aria-label="Choose project file"]').setInputFiles({ name: 'ai-targeting-fixture.webstudio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
    await page.getByRole('heading', { name: 'Lower section', exact: true }).waitFor();
  }
  await loadFixture();
  await page.evaluate(() => {
    const bridge = window.chrome.webview, original = bridge.postMessage.bind(bridge), add = bridge.addEventListener.bind(bridge), remove = bridge.removeEventListener.bind(bridge), listeners = new Set();
    bridge.addEventListener = (type, listener) => { if (type === 'message') listeners.add(listener); add(type, listener); };
    bridge.removeEventListener = (type, listener) => { listeners.delete(listener); remove(type, listener); };
    bridge.postMessage = message => {
      if (message.kind !== 'gemini.read') return original(message);
      setTimeout(() => listeners.forEach(listener => listener({ data: { version: 1, kind: 'gemini.read', requestId: message.requestId, ok: true, key: 'synthetic-targeting-key' } })), 0);
    };
  });
  let mode = 'wrong-block', requests = 0;
  const op = (target, field, value) => ({ action: 'set', target, field, value: JSON.stringify(value) });
  await page.route('https://generativelanguage.googleapis.com/v1beta/models/*:generateContent', async route => {
    requests++;
    const body = route.request().postDataJSON(), input = JSON.parse(body.contents[0].parts[0].text);
    assert.equal(route.request().headers()['x-goog-api-key'], 'synthetic-targeting-key');
    assert(!JSON.stringify(input).includes('PRIVATE_OTHER_PAGE_CONTENT'));
    assert.equal(input.context.target, 'block:hero', 'Named hero is the effective request target');
    assert(!input.context.targets.some(target => target.blockId === 'lower'), 'Lower section is excluded from named hero context');
    const operations = mode === 'wrong-block' ? [op('block:lower', 'blockBackgroundColor', '#ffff00')]
      : mode === 'wrong-child' ? [op('object:hero:1:hero-panel', 'color', '#ffff00')]
      : [op('block:hero', 'blockBackgroundColor', '#ffff00')];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ summary: 'Change the hero background to yellow.', operations }) }] } }] }) });
  });
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('openpage-config')).state);
  const config = async () => (await state()).config;
  const original = await state();
  async function open() {
    await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'AI Assistant', exact: true });
    await dialog.getByRole('button', { name: 'Edit existing content', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'AI Assistant', exact: true });
    await dialog.getByRole('checkbox', { name: /^This saved key uses Free tier/ }).check();
    await dialog.getByRole('checkbox', { name: /^Send this target/ }).check();
    return dialog;
  }
  async function preview(dialog) {
    await dialog.getByRole('button', { name: /^(Preview changes|Refine preview)$/, exact: true }).click();
    await dialog.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.querySelector('dialog[open] [role="alert"]') || document.querySelector('dialog[open] [aria-label="AI edit changes"]'));
  }
  await page.locator('[data-webstudio-block-id="lower"]').click({ position: { x: 12, y: 14 } });
  let dialog = await open();
  assert.equal(await dialog.getByLabel('AI edit target', { exact: true }).inputValue(), 'block:lower');
  await dialog.getByLabel('AI edit request', { exact: true }).fill('Change the hero section color to yellow.');
  await dialog.getByRole('alert').waitFor();
  assert(await dialog.getByRole('button', { name: 'Preview changes', exact: true }).isDisabled(), 'Conflicting selection blocks Preview');
  assert.equal(requests, 0, 'Conflict warning makes no Google request');
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'Warning fits narrow windows');
  }
  await dialog.screenshot({ path: path.join(output, platform + '-target-conflict.png') });
  await dialog.getByRole('button', { name: 'Use 1. hero: Comunidad', exact: true }).click();
  assert.equal(await dialog.getByLabel('AI edit target', { exact: true }).inputValue(), 'block:hero');
  assert.deepEqual(await state(), original, 'Choosing the correct target does not change project content');
  await preview(dialog);
  await dialog.getByRole('alert').filter({ hasText: /outside|target|background|hero/i }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Apply', exact: true }).count(), 0, 'Wrong lower-block response cannot be applied');
  assert.deepEqual(await state(), original);
  mode = 'wrong-child'; await preview(dialog);
  await dialog.getByRole('alert').filter({ hasText: /outside|target|background|hero/i }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Apply', exact: true }).count(), 0, 'Hero child-panel response cannot replace the hero background');
  assert.deepEqual(await state(), original);
  mode = 'yellow'; await preview(dialog);
  await dialog.getByRole('button', { name: 'Apply', exact: true }).waitFor();
  assert.equal(await dialog.getByRole('alert').count(), 0);
  assert.deepEqual(await state(), original, 'Yellow Preview leaves project unchanged');
  const review = dialog.locator('[aria-label="AI edit visual preview"]');
  assert.equal(await review.locator('[data-ws-scope$="-hero"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 0)');
  assert.equal(await review.locator('[data-ws-scope$="-lower"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(232, 237, 242)');
  await dialog.screenshot({ path: path.join(output, platform + '-hero-yellow-preview.png') });
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await dialog.getByRole('status').filter({ hasText: 'Applied.' }).waitFor();
  let current = await config();
  assert.equal(current.blocks.find(b => b.id === 'hero').props.blockBackgroundColor, '#ffff00');
  assert.deepEqual(current.blocks.find(b => b.id === 'lower'), original.config.blocks.find(b => b.id === 'lower'));
  assert.deepEqual(current.blocks.find(b => b.id === 'hero').props.section1Objects, original.config.blocks.find(b => b.id === 'hero').props.section1Objects);
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.deepEqual(await state(), original, 'Assistant Undo restores exact original project');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();

  // A whole-page request is narrowed to the explicit hero, not every block.
  dialog = await open();
  await dialog.getByLabel('AI edit target', { exact: true }).selectOption('page:home');
  await dialog.getByLabel('AI edit request', { exact: true }).fill('Change the hero section color to yellow.');
  assert.equal(await dialog.getByRole('alert').count(), 0);
  await preview(dialog);
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await dialog.getByRole('status').filter({ hasText: 'Applied.' }).waitFor();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  assert.equal(await page.locator('[data-webstudio-block-id="hero"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 0)', 'Editor displays yellow hero');
  await page.getByRole('button', { name: 'Toggle preview mode', exact: true }).click();
  assert.equal(await page.locator('[data-ws-scope="ws-0"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 0)', 'Site Preview displays yellow hero');
  assert.equal(await page.locator('[data-ws-scope="ws-1"]').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(232, 237, 242)', 'Site Preview keeps lower section unchanged');
  await page.screenshot({ path: path.join(output, platform + '-hero-yellow-site-preview.png') });
  await page.getByRole('button', { name: 'Toggle preview mode', exact: true }).click();
  await page.keyboard.press('Control+z');
  assert.deepEqual(await state(), original, 'Ordinary editor Undo also restores the original project');

  // Two heroes require a deliberate choice rather than a guess.
  await loadFixture(true);
  dialog = await open();
  await dialog.getByLabel('AI edit target', { exact: true }).selectOption('page:home');
  await dialog.getByLabel('AI edit request', { exact: true }).fill('Change the hero section color to yellow.');
  await dialog.getByRole('alert').waitFor();
  assert(await dialog.getByRole('button', { name: 'Preview changes', exact: true }).isDisabled());
  assert.equal(await dialog.getByRole('button', { name: /^Use \d+\. hero:/ }).count(), 2, 'Duplicate heroes are offered separately');
  await dialog.screenshot({ path: path.join(output, platform + '-duplicate-hero-choice.png') });
  await dialog.getByRole('button', { name: 'Use 1. hero: Comunidad', exact: true }).click();
  assert.equal(await dialog.getByRole('alert').count(), 0, 'Selecting a matching hero disambiguates the request');
  const duplicateOriginal = await state();
  await dialog.getByLabel('AI edit target', { exact: true }).selectOption('page:home');
  await dialog.getByLabel('AI edit request', { exact: true }).fill('Change the "Comunidad" section background to yellow.');
  assert.equal(await dialog.getByRole('alert').count(), 0, 'An exact heading uniquely identifies one of two heroes');
  await preview(dialog);
  await dialog.getByRole('button', { name: 'Apply', exact: true }).waitFor();
  assert.deepEqual(await state(), duplicateOriginal, 'Named-heading Preview leaves duplicate-hero fixture unchanged');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  assert.equal(requests, 5, 'Only the five explicit Preview actions reach the mocked Google endpoint');
  const result = { passed: true, platform, editorBundle, mockRequests: requests, liveRequests: 0, conflictingSelectionWarnedBeforeRequest: true, wrongBlockRejected: true, wrongChildRejected: true, heroYellowInEditorAndSitePreview: true, lowerSectionUnchanged: true, wholePageNarrowed: true, duplicateHeroChoice: true, exactHeadingResolution: true, exactUndo: true, pageErrors: errors };
  await writeFile(path.join(output, platform + '-result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await browser.close(); }
