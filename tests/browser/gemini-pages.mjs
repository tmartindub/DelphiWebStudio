// Run against an isolated desktop profile, never against a user's running editor.
// WEBSTUDIO_LIVE_GEMINI=1 permits two requests using synthetic content and the saved key.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
assert.match(process.env.WEBSTUDIO_TEST_CDP || '', /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.connectOverCDP(process.env.WEBSTUDIO_TEST_CDP);
const output = path.resolve('test-results/gemini-pages'), platform = process.env.WEBSTUDIO_PLATFORM || 'desktop';
await mkdir(output, { recursive: true });
try {
  const page = browser.contexts()[0].pages().find(item => item.url().startsWith('https://webstudio.local/')) ?? browser.contexts()[0].pages()[0];
  assert(page, 'Isolated editor is running');
  await page.waitForURL('https://webstudio.local/**');
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://webstudio.local/index.html#/editor'); await page.reload();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'or start blank', exact: true }).click();
  await page.getByText('Start building', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'AI assistant', exact: true }).waitFor();
  const blocks = [
    { id: 'test-nav', type: 'navbar', variant: 'simple', props: { links: [{ label: 'Home', url: '/' }], logoText: '', blockBackgroundColor: '#ffffff' } },
    { id: 'test-content', type: 'content', variant: 'prose', props: { body: 'Community reference page.\nWe welcome volunteers and visitors.', blockBackgroundColor: '#faf7f0', bodyRich: [{ text: 'Community reference page.', size: 22, font: 'Georgia', color: '#172033', tag: 'p', line: 1 }] } },
    { id: 'test-footer', type: 'footer', variant: 'simple', props: { copyright: 'Synthetic fixture footer', blockBackgroundColor: '#172033' } },
  ];
  const fixture = { format: 'webstudio', schemaVersion: 2, projectId: `gemini-pages-isolated-test-${Date.now()}`, config: {
    name: 'Synthetic community', blocks, theme: { bg0: '#faf7f0', bg1: '#edf3ed', text0: '#172033', accent: '#ed8b21', fontSans: 'Georgia', fontDisplay: 'Georgia' },
    pages: [{ id: 'home', name: 'Home', path: '/', blocks }, { id: 'visit', name: 'Visit', path: '/visit', blocks: [{ id: 'visit-content', type: 'content', variant: 'prose', props: { body: 'PRIVATE OTHER PAGE CONTENT' } }] }],
  }, assets: [] };
  await page.locator('[aria-label="Choose project file"]').setInputFiles({ name: 'gemini-pages-test.webstudio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.locator('[data-rich-editor="body"]').getByText('Community reference page.', { exact: true }).waitFor();
  await page.bringToFront();
  const readState = () => page.evaluate(() => JSON.parse(localStorage.getItem('openpage-config')).state);
  const original = await readState();
  await page.evaluate(() => {
    const bridge = window.chrome.webview, post = bridge.postMessage.bind(bridge), add = bridge.addEventListener.bind(bridge), remove = bridge.removeEventListener.bind(bridge), listeners = new Set();
    bridge.addEventListener = (type, listener) => { if (type === 'message') listeners.add(listener); add(type, listener); };
    bridge.removeEventListener = (type, listener) => { listeners.delete(listener); remove(type, listener); };
    bridge.postMessage = message => { if (message.kind !== 'gemini.read') return post(message); setTimeout(() => listeners.forEach(listener => listener({ data: { version: 1, kind: 'gemini.read', requestId: message.requestId, ok: true, key: 'synthetic-desktop-test-key' } })), 0); };
    window.restoreGeminiTestBridge = () => { bridge.postMessage = post; bridge.addEventListener = add; bridge.removeEventListener = remove; };
  });
  const cards = { kind: 'cards', title: 'Ways to take part', body: 'Find a welcoming place in our community.', columns: 3, tone: 'base', items: ['Visitors', 'Volunteering', 'Community events'].map(title => ({ title, subtitle: '', body: 'An editable description with room for useful information.', button: 'Learn more', url: '/visit', image: true })) };
  let requests = 0, mode = 'success';
  const endpoint = '**/v1beta/models/*:generateContent';
  await page.route(endpoint, async route => {
    requests++;
    const body = route.request().postDataJSON(), data = JSON.parse(body.contents[0].parts[0].text);
    assert(!JSON.stringify(data).includes('PRIVATE OTHER PAGE CONTENT'));
    assert(!body.tools); assert(route.request().url().endsWith('/gemini-3.5-flash-lite:generateContent'));
    assert(!('assets' in data.context));
    if (mode === 'quota') return route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
    if (mode === 'delay') await new Promise(resolve => setTimeout(resolve, 1000));
    const plan = { name: 'Community', path: data.context.mode === 'section' ? '' : '/community', sections: [cards] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(plan) }] } }] }) }).catch(() => {});
  });
  async function open(kind = 'page') {
    await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Gemini · Create a page or section' }); await dialog.waitFor();
    await dialog.getByLabel('AI creation type', { exact: true }).selectOption(kind);
    await dialog.getByLabel('AI page request', { exact: true }).fill('Create three welcoming panels with editable text, photo spaces and buttons.');
    return dialog;
  }
  async function preview(dialog) {
    await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('dialog[open] [role="alert"]') || document.querySelector('dialog[open] [aria-label="Proposed AI changes"]'), null, { timeout: 100000 });
    const error = await dialog.getByRole('alert').count() ? await dialog.getByRole('alert').textContent() : '';
    assert(!error, 'Gemini preview: ' + error);
  }
  let dialog = await open();
  assert(await dialog.getByRole('button', { name: 'Preview', exact: true }).isDisabled());
  await dialog.getByRole('checkbox').nth(1).check(); await dialog.getByRole('checkbox').nth(2).check();
  await preview(dialog);
  assert.deepEqual((await readState()).config, original.config, 'Preview leaves the site unchanged');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.deepEqual((await readState()).config, original.config, 'Cancel leaves the site unchanged');
  dialog = await open(); await preview(dialog);
  const requestCount = requests;
  await dialog.getByLabel('AI proposed page address', { exact: true }).fill('/visit');
  await dialog.getByRole('alert').filter({ hasText: 'unique page address' }).waitFor();
  assert(await dialog.getByRole('button', { name: 'Apply', exact: true }).isDisabled());
  await dialog.getByLabel('AI proposed page name', { exact: true }).fill('Community activities');
  await dialog.getByLabel('AI proposed page address', { exact: true }).fill('/community-activities');
  assert.equal(requests, requestCount, 'Editing the proposed name/address makes no API call');
  for (const label of ['Desktop', 'Tablet', 'Phone']) {
    await dialog.getByRole('button', { name: label, exact: true }).click();
    const bounds = await dialog.boundingBox(), viewport = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    assert(bounds.y >= 0 && bounds.x >= 0 && bounds.y + bounds.height <= viewport.h + 1 && bounds.x + bounds.width <= viewport.w + 1, 'Assistant fits viewport');
    const previewBox = dialog.getByLabel('AI content preview', { exact: true });
    const layout = await previewBox.evaluate(element => {
      const panels = [...element.querySelectorAll('[data-ws-object-type="panel"]')];
      return panels.map(item => {
        const visible = getComputedStyle(item).display === 'none' ? item.closest('[data-ws-object-group]') : item;
        return { width: visible.getBoundingClientRect().width, height: visible.getBoundingClientRect().height };
      });
    });
    assert.equal(layout.length, 3);
    assert(layout.every(box => box.width > 0 && box.height > 0));
    await previewBox.getByText('Ways to take part', { exact: true }).evaluate(element => new Promise((resolve, reject) => {
      const deadline = performance.now() + 1500;
      const check = () => Number(getComputedStyle(element.closest('[class*="reveal-"]') || element).opacity) > .99 ? resolve() : performance.now() < deadline ? requestAnimationFrame(check) : reject(new Error('Proposed heading stays hidden'));
      check();
    }));
    if (platform === 'Win32') await previewBox.screenshot({ path: path.join(output, 'cards-' + label.toLowerCase() + '.png') });
  }
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await dialog.getByRole('status').filter({ hasText: 'Added to your project' }).waitFor();
  let state = await readState(), added = state.config.pages.find(item => item.path === '/community-activities');
  assert(added); assert.deepEqual(state.config.pages.slice(0, 2), original.config.pages);
  assert.equal(added.blocks[0].type, 'navbar'); assert.equal(added.blocks.at(-1).type, 'footer');
  assert.equal(added.blocks[1].props.section1Objects.filter(item => item.type === 'panel').length, 3);
  assert.equal(added.blocks[1].props.section1Objects.filter(item => item.parentId).length, 12);
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.deepEqual(await readState(), original, 'Undo restores exact site and page selection');
  dialog = await open('section'); await preview(dialog);
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await dialog.getByRole('status').waitFor();
  state = await readState();
  assert.equal(state.config.pages.length, 2);
  assert.equal(state.config.pages[0].blocks.at(-2).type, 'content');
  assert.deepEqual(state.config.pages[1], original.config.pages[1]);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  const section = state.config.pages[0].blocks.at(-2);
  const text = section.props.section1Objects.find(item => item.type === 'text');
  const textBox = page.locator('[data-section-object="' + text.id + '"]');
  await textBox.click({ position: { x: 20, y: 12 } });
  const editor = textBox.locator('[contenteditable="true"]');
  await editor.fill('Edited through the normal text editor.');
  await page.getByRole('button', { name: 'AI assistant', exact: true }).focus();
  await page.waitForFunction(({ blockId, objectId }) => {
    const config = JSON.parse(localStorage.getItem('openpage-config')).state.config;
    return config.pages[0].blocks.find(block => block.id === blockId)?.props['sectionObject_' + objectId] === 'Edited through the normal text editor.';
  }, { blockId: section.id, objectId: text.id });
  await page.keyboard.press('Control+z');
  assert.equal((await readState()).config.pages[0].blocks.length, 4, 'Undoing a normal text edit retains its AI section');
  await page.keyboard.press('Control+z');
  assert.deepEqual((await readState()).config, original.config, 'Normal editor Undo removes an applied section');
  await page.keyboard.press('Control+y');
  assert.equal((await readState()).config.pages[0].blocks.length, 4);
  await page.keyboard.press('Control+z');
  mode = 'quota'; dialog = await open();
  const before = requests;
  await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'free quota' }).waitFor();
  assert.equal(requests, before + 1);
  assert.deepEqual((await readState()).config, original.config);
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  mode = 'delay'; dialog = await open(); await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByRole('button', { name: 'Stop', exact: true }).click();
  await dialog.getByRole('button', { name: 'Preview', exact: true }).waitFor();
  assert(await dialog.getByRole('button', { name: 'Apply', exact: true }).isDisabled());
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  if (process.env.WEBSTUDIO_LIVE_GEMINI === '1') {
    await page.unroute(endpoint); await page.evaluate(() => window.restoreGeminiTestBridge());
    for (const kind of ['page', 'section']) {
      dialog = await open(kind);
      await dialog.getByLabel('AI page request', { exact: true }).fill(kind === 'page'
        ? 'Create a new page named Community with path /community, with just a team directory containing three editable placeholder people: Staff member 1, Staff member 2, Staff member 3. Their roles and biographies must be clearly marked placeholders.'
        : 'Create exactly one cards section titled Welcome, with two panels titled Visitors and Volunteers. Each needs a short editable placeholder description and a Learn more button linking to /visit. No photo spaces.');
      await preview(dialog);
      assert.deepEqual((await readState()).config, original.config, 'Live Preview leaves the site unchanged');
      await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await dialog.getByRole('status').waitFor();
      state = await readState();
      if (kind === 'page') {
        added = state.config.pages.find(item => item.path === '/community');
        assert(added && added.blocks.some(block => block.type === 'team'), 'Real Gemini created editable staff directory');
        assert.deepEqual(state.config.pages.slice(0, 2), original.config.pages);
      } else assert.equal(state.config.pages[0].blocks.length, 4);
      await dialog.screenshot({ path: path.join(output, platform + '-live-' + kind + '.png') });
      await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
      assert.deepEqual(await readState(), original, 'Live Undo restores exact original site');
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, platform + (process.env.WEBSTUDIO_LIVE_GEMINI === '1' ? '-result.json' : '-ui-result.json')), JSON.stringify({ passed: true, mockRequests: requests, normalTextEditing: true, livePageAndSection: process.env.WEBSTUDIO_LIVE_GEMINI === '1', pageErrors: errors }));
  console.log('PASS: page/section Preview, Cancel, Apply, Undo/Redo, existing-page preservation, name/path edits, quota, Stop, responsive preview' + (process.env.WEBSTUDIO_LIVE_GEMINI === '1' ? ', live Gemini page and section' : ''));
} finally { await browser.close(); }
