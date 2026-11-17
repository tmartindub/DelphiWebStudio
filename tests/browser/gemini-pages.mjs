// Run against an isolated desktop profile, never against a user's running editor.
// All Gemini requests and credential reads are mocked; live mode is refused.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
assert.notEqual(process.env.WEBSTUDIO_LIVE_GEMINI, '1', 'This regression never uses a real saved key or live Gemini');
assert.match(process.env.WEBSTUDIO_TEST_CDP || '', /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.connectOverCDP(process.env.WEBSTUDIO_TEST_CDP);
const output = path.resolve(process.env.WEBSTUDIO_TEST_OUTPUT || 'test-results/gemini-pages'), platform = process.env.WEBSTUDIO_PLATFORM || 'desktop';
await mkdir(output, { recursive: true });
try {
  const page = browser.contexts()[0].pages().find(item => item.url().startsWith('https://webstudio.local/')) ?? browser.contexts()[0].pages()[0];
  assert(page, 'Isolated editor is running');
  await page.waitForURL('https://webstudio.local/**');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('**/*', route => { const url = new URL(route.request().url()); return url.origin === 'https://webstudio.local' || url.hostname === '127.0.0.1' || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort('blockedbyclient'); });
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
    bridge.postMessage = message => { if (message.kind !== 'gemini.read') return post(message); window.fixtureCredentialReads = (window.fixtureCredentialReads || 0) + 1; setTimeout(() => listeners.forEach(listener => listener({ data: { version: 1, kind: 'gemini.read', requestId: message.requestId, ok: true, key: 'synthetic-desktop-test-key' } })), 0); };
    window.restoreGeminiTestBridge = () => { bridge.postMessage = post; bridge.addEventListener = add; bridge.removeEventListener = remove; };
  });
  const cards = { kind: 'cards', title: 'Ways to take part', body: 'Find a welcoming place in our community.', columns: 3, tone: 'base', items: ['Visitors', 'Volunteering', 'Community events'].map(title => ({ title, subtitle: '', body: 'An editable description with room for useful information.', button: 'Learn more', url: '/visit', image: true })) };
  let requests = 0, mode = 'success';
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/*:generateContent';
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
  const assistantButton = page.getByRole('button', { name: 'AI assistant', exact: true });
  async function assertFits(dialog) {
    const box = await dialog.boundingBox(), viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    assert(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, 'AI Assistant fits the current viewport');
    assert(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'Dialog has no horizontal overflow');
  }
  async function responsive(dialog) {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(viewport); await assertFits(dialog);
      await dialog.getByRole('button', { name: 'Close', exact: true }).scrollIntoViewIfNeeded();
      assert(await dialog.getByRole('button', { name: 'Close', exact: true }).isVisible(), 'Close stays reachable');
    }
    await dialog.evaluate(element => { element.scrollTop = 0; });
  }
  async function neutral() {
    await assistantButton.click();
    const dialog = page.getByRole('dialog', { name: 'AI Assistant', exact: true }); await dialog.waitFor();
    assert.equal(await dialog.getByRole('heading', { name: 'AI Assistant', exact: true }).count(), 1);
    assert.equal(await dialog.getByRole('button', { name: 'Create', exact: true }).getAttribute('aria-pressed'), 'false');
    assert.equal(await dialog.getByRole('button', { name: 'Edit existing content', exact: true }).getAttribute('aria-pressed'), 'false');
    assert.equal(await dialog.locator('textarea, select, input').count(), 0, 'Opening has no task form');
    assert.equal(await dialog.getByRole('button', { name: /^(Preview.*|New preview|Refine preview|Apply|Undo|Stop)$/ }).count(), 0, 'Neutral opening has no premature action');
    assert.deepEqual(await dialog.locator('footer button').allTextContents(), ['Close']);
    assert.equal(await dialog.locator('details').filter({ hasText: 'Connection details' }).getAttribute('open'), null, 'Technical connection details start collapsed');
    await dialog.getByText('Key saved', { exact: true }).waitFor();
    await assertFits(dialog);
    return dialog;
  }
  async function chooseMode(dialog, choice, requestName, action) {
    await dialog.getByRole('button', { name: choice, exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'AI Assistant', exact: true }); await dialog.waitFor();
    assert.equal(await dialog.getByRole('button', { name: choice, exact: true }).getAttribute('aria-pressed'), 'true');
    const input = dialog.getByLabel(requestName, { exact: true });
    assert.equal(await input.inputValue(), '', 'Choosing a task starts with an empty request');
    assert(!(await input.getAttribute('placeholder')), 'Example wording is not a request placeholder');
    const example = dialog.locator('p').filter({ hasText: /^Example:/ });
    const inputBox = await input.boundingBox(), exampleBox = await example.boundingBox();
    assert(inputBox && exampleBox && exampleBox.y >= inputBox.y + inputBox.height - 1, 'Example is below the empty request');
    assert(await dialog.getByRole('button', { name: action, exact: true }).isDisabled());
    assert.equal(await dialog.getByRole('button', { name: 'Apply', exact: true }).count(), 0, 'No Apply before a proposal');
    assert.equal(await dialog.getByRole('button', { name: 'Undo', exact: true }).count(), 0, 'No Undo before Apply');
    return dialog;
  }
  async function open(kind = 'page') {
    const dialog = await chooseMode(await neutral(), 'Create', 'AI page request', 'Preview new content');
    await dialog.getByLabel('AI creation type', { exact: true }).selectOption(kind);
    await dialog.getByLabel('AI page request', { exact: true }).fill('Create three welcoming panels with editable text, photo spaces and buttons.');
    return dialog;
  }
  async function preview(dialog) {
    await dialog.getByRole('button', { name: 'Preview new content', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('dialog[open] [role="alert"]') || document.querySelector('dialog[open] [aria-label="Proposed AI changes"]'), null, { timeout: 100000 });
    const error = await dialog.getByRole('alert').count() ? await dialog.getByRole('alert').textContent() : '';
    assert(!error, 'Gemini preview: ' + error);
  }
  let dialog = await neutral();
  await responsive(dialog);
  await dialog.screenshot({ path: path.join(output, platform + '-neutral.png') });
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  assert(await assistantButton.evaluate(element => document.activeElement === element), 'Escape returns focus to the launcher');
  assert.equal(requests, 0, 'Neutral opening and connection status make no Google request');
  dialog = await chooseMode(await neutral(), 'Create', 'AI page request', 'Preview new content');
  await responsive(dialog);
  await dialog.screenshot({ path: path.join(output, platform + '-create.png') });
  await dialog.getByLabel('AI page request', { exact: true }).fill('Create three welcoming panels with editable text, photo spaces and buttons.');
  assert(await dialog.getByRole('button', { name: 'Preview new content', exact: true }).isDisabled());
  await dialog.getByRole('checkbox', { name: /^I confirm this key/ }).check(); await dialog.getByRole('checkbox', { name: /^Send my request/ }).check();
  await preview(dialog);
  assert.deepEqual((await readState()).config, original.config, 'Preview leaves the site unchanged');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  assert.deepEqual((await readState()).config, original.config, 'Close leaves the site unchanged');
  dialog = await open(); await preview(dialog);
  assert.equal(await dialog.getByRole('button', { name: 'Undo', exact: true }).count(), 0);
  await dialog.getByRole('button', { name: 'New preview', exact: true }).waitFor();
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
  assert.equal(await dialog.getByRole('button', { name: 'Apply', exact: true }).count(), 0, 'Apply disappears after acceptance');
  await dialog.getByRole('button', { name: 'Undo', exact: true }).waitFor();
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
  await dialog.getByRole('button', { name: 'Preview new content', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'free quota' }).waitFor();
  assert.equal(requests, before + 1);
  assert.deepEqual((await readState()).config, original.config);
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  mode = 'delay'; dialog = await open(); await dialog.getByRole('button', { name: 'Preview new content', exact: true }).click();
  assert(await dialog.getByRole('button', { name: 'Create', exact: true }).isDisabled());
  assert(await dialog.getByRole('button', { name: 'Edit existing content', exact: true }).isDisabled(), 'Busy generation locks task switching');
  await dialog.getByRole('button', { name: 'Stop', exact: true }).click();
  await dialog.getByRole('button', { name: 'Preview new content', exact: true }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Apply', exact: true }).count(), 0, 'Stopped creation has no Apply');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, platform + '-ui-result.json'), JSON.stringify({ passed: true, mockRequests: requests, normalTextEditing: true, neutralOpening: true, explicitTaskChoice: true, liveRequests: 0, pageErrors: errors }));
  console.log('PASS: neutral opening, explicit Create, page/section Preview, Close, Apply, Undo/Redo, existing-page preservation, name/path edits, quota, Stop, responsive preview');
} finally { await browser.close(); }
