// Only an isolated desktop profile. All Gemini requests and key reads are mocked.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
assert.notEqual(process.env.WEBSTUDIO_LIVE_GEMINI, '1', 'This regression never uses a real saved key or live Gemini');
assert.match(process.env.WEBSTUDIO_TEST_CDP || '', /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.connectOverCDP(process.env.WEBSTUDIO_TEST_CDP);
const output = path.resolve(process.env.WEBSTUDIO_TEST_OUTPUT || 'test-results/ai-completion'), platform = process.env.WEBSTUDIO_PLATFORM || 'desktop';
await mkdir(output, { recursive: true });
try {
  const page = browser.contexts()[0].pages()[0]; await page.waitForURL('https://webstudio.local/**');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('**/*', route => { const url = new URL(route.request().url()); return url.origin === 'https://webstudio.local' || url.hostname === '127.0.0.1' || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort('blockedbyclient'); });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://webstudio.local/index.html#/editor'); await page.reload();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click(); await page.getByRole('button', { name: 'or start blank', exact: true }).click();
  await page.getByText('Start building', { exact: true }).waitFor(); await page.getByRole('button', { name: 'AI assistant', exact: true }).waitFor();
  const blocks = [
    { id: 'nav', type: 'navbar', variant: 'default', props: { navItems: [{ id: 'home-link', label: 'Home', url: '/' }, { id: 'about-link', label: 'About', url: '/visit', children: [] }], logo: '', blockBackgroundColor: '#ffffff', textColor: '#172033' } },
    { id: 'hero', type: 'hero', variant: 'minimal', props: { headline: 'Welcome friends', subheadline: 'Community reference', blockBackgroundColor: '#faf7f0', textColor: '#172033', headlineRich: [{ text: 'Welcome ', font: 'Georgia', bold: true, line: 1, size: 34, color: '#172033' }, { text: 'friends', font: 'Georgia', line: 1, size: 34, color: '#172033' }] } },
    { id: 'panel', type: 'panel', variant: 'default', props: { title: 'Visitor information', body: 'Keep this description.', blockBackgroundColor: '#edf2ef', textColor: '#172033', layoutWidth: 70, layoutHeight: 180, rawHtml: 'PRIVATE_RAW_SOURCE', formEndpoint: 'PRIVATE_ENDPOINT', apiKey: 'PRIVATE_KEY' } },
    { id: 'gallery', type: 'gallery', variant: 'responsive', props: { title: 'Community photos', images: [{ id: 'existing-photo', src: '', alt: 'Original photo', caption: 'Keep this caption.' }] } },
    { id: 'staff', type: 'team', variant: 'directory', props: { title: 'Staff', members: [{ id: 'existing-person', name: 'Existing member', role: 'Volunteer', bio: 'Original biography.' }] } },
    { id: 'calendar', type: 'calendar', variant: 'default', props: { title: 'Calendar', events: [] } },
    { id: 'bulletins', type: 'documentLibrary', variant: 'weekly-bulletins', props: { title: 'Bulletins', items: [] } },
    { id: 'footer', type: 'footer', variant: 'simple', props: { copyright: 'Synthetic fixture footer', blockBackgroundColor: '#172033', textColor: '#ffffff' } },
  ];
  const fixture = { format: 'webstudio', schemaVersion: 2, projectId: 'gemini-editor-test-' + Date.now(), config: { name: 'AI editing fixture', theme: { bg0: '#faf7f0', text0: '#172033', accent: '#ed8b21', fontSans: 'Georgia', fontDisplay: 'Georgia' }, blocks, pages: [{ id: 'home', name: 'Home', path: '/', blocks }, { id: 'visit', name: 'Visit', path: '/visit', blocks: [{ id: 'visit-content', type: 'content', variant: 'prose', props: { body: 'PRIVATE OTHER PAGE CONTENT', blockBackgroundColor: '#ffffff' } }] }] }, assets: [] };
  await page.locator('[aria-label="Choose project file"]').setInputFiles({ name: 'ai-edit-fixture.webstudio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.getByRole('heading', { name: 'Visitor information', exact: true }).waitFor();
  await page.bringToFront();
  const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('openpage-config')).state);
  const original = await state();
  await page.evaluate(() => {
    const bridge = window.chrome.webview, post = bridge.postMessage.bind(bridge), add = bridge.addEventListener.bind(bridge), remove = bridge.removeEventListener.bind(bridge), listeners = new Set();
    bridge.addEventListener = (type, listener) => { if (type === 'message') listeners.add(listener); add(type, listener); };
    bridge.removeEventListener = (type, listener) => { listeners.delete(listener); remove(type, listener); };
    bridge.postMessage = message => { if (message.kind !== 'gemini.read') return post(message); window.fixtureCredentialReads = (window.fixtureCredentialReads || 0) + 1; setTimeout(() => listeners.forEach(listener => listener({ data: { version: 1, kind: 'gemini.read', requestId: message.requestId, ok: true, key: 'synthetic-test-key' } })), 0); };
    window.restoreGeminiTestBridge = () => { bridge.postMessage = post; bridge.addEventListener = add; bridge.removeEventListener = remove; };
  });
  await page.evaluate(() => {
    const getAll = IDBIndex.prototype.getAll;
    IDBIndex.prototype.getAll = function(query, ...args) { if (this.name === 'projectId' && typeof query === 'string') window.fixtureMediaProjectId = query; return getAll.call(this, query, ...args); };
    window.restoreFixtureIndex = () => { IDBIndex.prototype.getAll = getAll; };
  });
  await page.getByRole('button', { name: 'AI assistant', exact: true }).click();
  const mediaSetup = page.getByRole('dialog', { name: 'AI Assistant', exact: true });
  assert.equal(await mediaSetup.locator('textarea, select, input').count(), 0);
  await mediaSetup.getByRole('button', { name: 'Edit existing content', exact: true }).click();
  await page.waitForFunction(() => typeof window.fixtureMediaProjectId === 'string');
  await page.getByRole('dialog', { name: 'AI Assistant', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.evaluate(async () => {
    const project = { id: window.fixtureMediaProjectId }; window.restoreFixtureIndex();
    const request = indexedDB.open('webstudio-media', 3), db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 160; const context = canvas.getContext('2d'); context.fillStyle = '#c8dcea'; context.fillRect(0, 0, 240, 160); context.fillStyle = '#172033'; context.font = '24px Georgia'; context.fillText('Synthetic photo', 24, 86); const image = new Uint8Array(await (await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))).arrayBuffer());
    const transaction = db.transaction('assetsV2', 'readwrite'), store = transaction.objectStore('assetsV2');
    for (const id of ['photo-one', 'photo-two']) store.put({ id, projectId: project.id, path: 'assets/' + id + '.png', name: id === 'photo-one' ? 'Church.png' : 'Portrait.png', mime: 'image/png', size: image.length, sha256: 'synthetic', folder: 'Fixture photos', content: new Blob([image], { type: 'image/png' }) });
    store.put({ id: 'bulletin-pdf', projectId: project.id, path: 'assets/bulletin.pdf', name: 'Bulletin.pdf', mime: 'application/pdf', size: 20, sha256: 'synthetic', folder: 'Bulletins', content: new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }) });
    await new Promise((resolve, reject) => { transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); }); db.close();

  });
  const operation = (action, target, field, value) => ({ action, target, field, value: JSON.stringify(value) });
  let mode = 'edit', requests = 0;
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/*:generateContent';
  await page.route(endpoint, async route => {
    requests++; const body = route.request().postDataJSON(), input = JSON.parse(body.contents[0].parts[0].text);
    assert(!JSON.stringify(input).match(/PRIVATE_KEY|PRIVATE_ENDPOINT|PRIVATE_RAW_SOURCE|PRIVATE OTHER PAGE CONTENT/));
    assert(!body.tools); assert(route.request().url().endsWith('/gemini-3.5-flash-lite:generateContent'));
    if (mode === 'quota') return route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
    if (mode === 'delay') await new Promise(resolve => setTimeout(resolve, 1000));
    let operations = [operation('set', 'block:panel', 'layoutWidth', 50), operation('set', 'block:panel', 'blockBackgroundColor', '#dceafa')];
    if (mode === 'refine') { assert(input.recentConversation.at(-1).state === 'previewed'); assert(input.context.targets.find(item => item.id === 'block:panel').fields.layoutWidth.value === 50); operations = [operation('set', 'block:panel', 'layoutWidth', 45), operation('set', 'block:panel', 'blockBackgroundColor', '#eef5fc')]; }
    if (mode === 'media') {
      assert.equal(input.context.media.length, 3); assert(!JSON.stringify(input.context.media).includes('assets/'));
      operations = [operation('setMedia', 'item:gallery:images:existing-photo', 'src', 'photo-two'), operation('addItem', 'block:staff', 'members', { name: 'New volunteer', role: 'Volunteer', bio: 'User supplied biography.' }), operation('addItem', 'block:calendar', 'events', { title: 'Provided meeting', date: '2026-11-20', time: '18:30' }), operation('addItem', 'block:bulletins', 'items', { title: 'Current bulletin', assetId: 'bulletin-pdf' })];
    }
    if (mode === 'navigation') operations = [operation('addItem', 'item:nav:navItems:about-link', 'children', { label: 'Visitor information', url: '/visit' }), operation('set', 'block:panel', 'anchorName', 'visitor-information'), operation('linkText', 'block:hero', 'headline', { text: 'friends', url: '#visitor-information' })];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ summary: 'Reviewed ' + mode + ' changes.', operations }) }] } }] }) }).catch(() => {});
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
  async function open() {
    const dialog = await chooseMode(await neutral(), 'Edit existing content', 'AI edit request', 'Preview changes');
    await dialog.getByRole('checkbox', { name: /^This saved key uses Free tier/ }).check();
    await dialog.getByRole('checkbox', { name: /^Send this target/ }).check();
    return dialog;
  }
  async function preview(dialog, text) {
    await dialog.getByLabel('AI edit request', { exact: true }).fill(text);
    await dialog.getByRole('button', { name: /^(Preview changes|Refine preview)$/, exact: true }).click();
    await dialog.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'detached', timeout: 100000 });
    await page.waitForFunction(() => document.querySelector('dialog[open] [role="alert"]') || document.querySelector('dialog[open] [aria-label="AI edit changes"]'), null, { timeout: 100000 });
    const error = (await dialog.getByRole('alert').allTextContents()).join('');
    assert(!error, 'AI preview failed: ' + error);
  }
  await page.locator('[data-webstudio-block-id="panel"]').click({ position: { x: 12, y: 14 } });
  let dialog = await neutral();
  assert.equal(requests, 0, 'Opening with a selected panel still makes no Google request');
  await dialog.screenshot({ path: path.join(output, platform + '-neutral-selected.png') });
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  assert(await assistantButton.evaluate(element => document.activeElement === element), 'Escape restores launcher focus');
  dialog = await chooseMode(await neutral(), 'Edit existing content', 'AI edit request', 'Preview changes');
  assert.equal(await dialog.getByLabel('AI edit target', { exact: true }).inputValue(), 'block:panel', 'Explicit Edit retains the selected component');
  await dialog.locator('p').filter({ hasText: /^Editing:/ }).filter({ hasText: 'Visitor information' }).waitFor();
  await dialog.getByRole('button', { name: 'Change selection', exact: true }).click();
  assert(await dialog.getByLabel('AI edit page', { exact: true }).evaluate(element => document.activeElement === element), 'Change selection reveals and focuses page selection');
  await responsive(dialog);
  await dialog.screenshot({ path: path.join(output, platform + '-edit-targets.png') });
  await dialog.getByRole('checkbox', { name: /^This saved key uses Free tier/ }).check();
  await dialog.getByRole('checkbox', { name: /^Send this target/ }).check();
  await dialog.getByLabel('AI edit target', { exact: true }).selectOption('block:panel');
  await preview(dialog, 'Make this panel 50% wide and light blue.');
  assert.deepEqual(await state(), original, 'Preview does not change the project');
  mode = 'refine'; await preview(dialog, 'Make it 45% wide and use an even lighter blue.');
  assert.deepEqual(await state(), original, 'Follow-up remains unapplied');
  await dialog.locator('[aria-label="AI edit visual preview"]').evaluate(container => { const panel = container.querySelector('[data-ws-scope$="-panel"]'); if (panel) container.scrollTop += panel.getBoundingClientRect().top - container.getBoundingClientRect().top; });
  await dialog.getByRole('heading', { name: 'Visitor information', exact: true }).waitFor();
  await dialog.screenshot({ path: path.join(output, platform + '-edit-review.png') });
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await dialog.getByRole('status').filter({ hasText: 'Applied.' }).waitFor();
  assert.equal(await dialog.getByRole('button', { name: 'Apply', exact: true }).count(), 0, 'Accepted proposal no longer offers Apply');
  await dialog.getByRole('button', { name: 'Undo', exact: true }).waitFor();
  assert.equal((await state()).config.blocks.find(block => block.id === 'panel').props.layoutWidth, 45);
  assert.deepEqual((await state()).config.pages[1], original.config.pages[1]);
  await dialog.screenshot({ path: path.join(output, platform + '-edit-conversation.png') });
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); assert.deepEqual(await state(), original);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  mode = 'media'; dialog = await open(); await dialog.getByLabel('Allow project media catalog', { exact: true }).check();
  await page.waitForFunction(() => document.querySelector('dialog[open] [aria-label="AI media folder"]')?.textContent.includes('All media (3)'));
  await preview(dialog, 'Replace the gallery photo using Portrait.png. Add the supplied volunteer, meeting and bulletin.');
  await dialog.screenshot({ path: path.join(output, platform + '-media-review.png') });
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await dialog.getByRole('status').filter({ hasText: 'Applied.' }).waitFor();
  let current = await state();
  assert.deepEqual(current.config.blocks.find(block => block.id === 'gallery').props.images[0], { id: 'existing-photo', src: 'assets/photo-two.png', assetId: 'photo-two', alt: 'Original photo', caption: 'Keep this caption.' });
  assert.equal(current.config.blocks.find(block => block.id === 'staff').props.members.length, 2);
  assert.equal(current.config.blocks.find(block => block.id === 'calendar').props.events[0].date, '2026-11-20');
  assert.equal(current.config.blocks.find(block => block.id === 'bulletins').props.items[0].src, 'assets/bulletin.pdf');
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); assert.deepEqual(await state(), original);
  mode = 'navigation'; await preview(dialog, 'Add Visitor information under About and link friends to an anchor on the visitor panel.');
  for (const label of ['Tablet', 'Phone', 'Desktop']) await dialog.getByRole('button', { name: label, exact: true }).click();
  await responsive(dialog);
  await dialog.screenshot({ path: path.join(output, platform + '-navigation-preview.png') });
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await dialog.getByRole('status').filter({ hasText: 'Applied.' }).waitFor();
  current = await state();
  assert.equal(current.config.blocks[0].props.navItems[1].url, '/visit');
  assert.equal(current.config.blocks[0].props.navItems[1].children[0].url, '/visit');
  assert.equal(current.config.blocks.find(block => block.id === 'panel').props.anchorName, 'visitor-information');
  assert(current.config.blocks.find(block => block.id === 'hero').props.headlineRich.some(run => run.text === 'friends' && run.href === '#visitor-information'));
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); assert.deepEqual(await state(), original);
  mode = 'quota'; const before = requests;
  await dialog.getByLabel('AI edit request', { exact: true }).fill('Change the panel.');
  await dialog.getByRole('button', { name: 'Preview changes', exact: true }).click(); await dialog.getByRole('alert').filter({ hasText: 'free quota' }).waitFor();
  assert.equal(requests, before + 1); assert.deepEqual(await state(), original);
  mode = 'delay'; await dialog.getByRole('button', { name: 'Preview changes', exact: true }).click();
  assert(await dialog.getByRole('button', { name: 'Create', exact: true }).isDisabled());
  assert(await dialog.getByRole('button', { name: 'Edit existing content', exact: true }).isDisabled(), 'Busy editing locks task switching');
  await dialog.getByRole('button', { name: 'Stop', exact: true }).click();
  await dialog.getByRole('button', { name: 'Preview changes', exact: true }).waitFor(); assert.equal(await dialog.getByRole('button', { name: 'Apply', exact: true }).count(), 0, 'Stopped request has no Apply');
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, platform + '-result.json'), JSON.stringify({ passed: true, mockRequests: requests, neutralOpeningWithSelection: true, explicitTaskChoice: true, selectedTargetRetained: true, liveRequests: 0, pageErrors: errors }));
  console.log('PASS: existing editing, follow-up preview, exact Undo, real local asset references, staff/bulletin/calendar data, navigation/submenu/inline anchors, quota and Stop');
} finally { await browser.close(); }
