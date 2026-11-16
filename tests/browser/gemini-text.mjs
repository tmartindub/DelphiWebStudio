// Use only an expendable desktop profile. No saved user project is opened or changed.
// Mock requests exercise production UI + real credential bridge without contacting Google.
// WEBSTUDIO_LIVE_GEMINI=1 permits one synthetic live request after Free tier is confirmed.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = createRequire(import.meta.url)(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
assert.match(process.env.WEBSTUDIO_TEST_CDP || '', /^http:\/\/127\.0\.0\.1:\d+$/);
const browser = await chromium.connectOverCDP(process.env.WEBSTUDIO_TEST_CDP);
const output = path.resolve('test-results/gemini-text');
await mkdir(output, { recursive: true });
try {
  const page = browser.contexts()[0].pages().find(item => item.url().startsWith('https://webstudio.local/')) ?? browser.contexts()[0].pages()[0] ?? await browser.contexts()[0].waitForEvent('page');
  assert(page, 'Isolated desktop editor is running');
  await page.waitForURL('https://webstudio.local/**');
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://webstudio.local/index.html#/editor');
  await page.reload();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('button', { name: 'or start blank', exact: true }).click();
  // Test-only, page-scoped credential reply. Never write a dummy credential to Windows.
  await page.evaluate(() => {
    const bridge = window.chrome.webview, post = bridge.postMessage.bind(bridge), add = bridge.addEventListener.bind(bridge), remove = bridge.removeEventListener.bind(bridge), listeners = new Set();
    bridge.addEventListener = (type, listener) => { if (type === 'message') listeners.add(listener); add(type, listener); };
    bridge.removeEventListener = (type, listener) => { listeners.delete(listener); remove(type, listener); };
    bridge.postMessage = message => { if (message.kind !== 'gemini.read') return post(message); setTimeout(() => listeners.forEach(listener => listener({ data: { version: 1, kind: 'gemini.read', requestId: message.requestId, ok: true, key: 'synthetic-desktop-test-key' } })), 0); };
    window.restoreGeminiTestBridge = () => { bridge.postMessage = post; bridge.addEventListener = add; bridge.removeEventListener = remove; };
  });
  const block = { id: 'ai-writing', type: 'content', variant: 'prose', props: {
    blockBackgroundColor: '#ffffff', body: 'Welcom to our parish — untouched.\nKeep this paragraph unchanged.',
    bodyRich: [
      { text: 'Welcom to ', tag: 'p', line: 1, size: 22, color: '#172033', lineHeight: 1.75 },
      { text: 'our parish', tag: 'p', line: 1, size: 22, color: '#1234aa', bold: true, href: '/visit', lineHeight: 1.75 },
      { text: ' — untouched.', tag: 'p', line: 1, size: 22, color: '#172033', lineHeight: 1.75 },
      { text: 'Keep this paragraph unchanged.', tag: 'p', line: 2, size: 18, color: '#172033' },
    ],
    section1Objects: [{ id: 'independent', type: 'text', text: 'Another welcom.', x: 10, y: 300, width: 50, height: 80, layer: 1 }],
  } };
  const fixture = { format: 'webstudio', schemaVersion: 2, projectId: `gemini-text-test-${Date.now()}`, config: { name: 'Gemini isolated test', blocks: [block], pages: [{ id: 'home', name: 'Home', path: '/', blocks: [block] }] }, assets: [] };
  await page.locator('[aria-label="Choose project file"]').setInputFiles({ name: 'gemini-test.webstudio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  const editor = page.locator('[data-rich-editor="body"]'); await editor.waitFor();
  await editor.getByText('Welcom to ', { exact: true }).waitFor();
  await page.bringToFront();
  await page.evaluate(() => document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  let requests = 0, mode = 'success';
  const endpoint = '**/v1beta/models/*:generateContent';
  await page.route(endpoint, async route => {
    requests++;
    const data = route.request().postDataJSON();
    const selected = JSON.parse(data.contents[0].parts[0].text).segments;
    const sentText = selected.map(segment => segment.text).join('');
    assert(!sentText.includes('Keep this paragraph') || sentText === 'Keep this paragraph unchanged.', 'Unselected paragraph is never sent');
    assert(!data.tools, 'No paid tools requested');
    assert(route.request().url().endsWith('/gemini-3.5-flash-lite:generateContent'));
    if (mode === 'quota') return route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
    if (mode === 'delay') await new Promise(resolve => setTimeout(resolve, 750));
    const segments = selected.map(segment => ({ id: segment.id, text: segment.text.replace('Welcom', 'Welcome').replace('welcom', 'welcome').replace('our parish', 'our parish community').replace('Keep this paragraph unchanged.', 'Keep this paragraph intact.') }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ segments }) }] } }] }) }).catch(() => {});
  });
  async function selectPassage(input = editor, whole = false) {
    await input.evaluate((element, whole) => {
      element.focus({ preventScroll: true });
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT), nodes = []; let node;
      while ((node = walker.nextNode())) if (node.textContent) nodes.push(node);
      const range = document.createRange();
      if (whole === 'last') range.selectNodeContents(element.lastElementChild);
      else if (whole === 'word') { range.setStart(nodes[0], 0); range.setEnd(nodes[0], 6); }
      else if (whole) range.selectNodeContents(element); else { range.setStart(nodes[0], 0); range.setEnd(nodes[1], nodes[1].textContent.length); }
      getSelection().removeAllRanges(); getSelection().addRange(range);
      element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 700, clientY: 300 }));
    }, whole);
    await page.getByRole('menuitem', { name: 'Help with selected text…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Gemini · Help with selected text' }); await dialog.waitFor(); return dialog;
  }
  async function allow(dialog) {
    await dialog.getByRole('checkbox').nth(0).check(); await dialog.getByRole('checkbox').nth(1).check();
  }
  let dialog = await selectPassage();
  assert(await dialog.getByRole('button', { name: 'Preview', exact: true }).isDisabled(), 'No consent means no request');
  const original = await editor.innerHTML();
  await allow(dialog); await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByLabel('Gemini text preview', { exact: true }).filter({ hasText: 'Welcome to our parish community' }).waitFor();
  assert.equal(await editor.innerHTML(), original, 'Preview does not alter the original');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await editor.innerHTML(), original, 'Cancel leaves original unchanged');
  dialog = await selectPassage(); await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByLabel('Gemini text preview', { exact: true }).filter({ hasText: 'Welcome to our parish community' }).waitFor();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await editor.getByText('our parish community', { exact: true }).waitFor();
  assert((await editor.textContent()).includes(' — untouched.Keep this paragraph unchanged.'), 'Unselected suffix and paragraph unchanged');
  assert.equal(await editor.locator('a[href="/visit"]').evaluate(element => element.style.fontWeight), 'bold');
  assert.equal(await editor.locator('a[href="/visit"]').evaluate(element => element.style.color), 'rgb(18, 52, 170)');
  assert.equal(await editor.locator('p').first().evaluate(element => element.style.lineHeight), '1.75');
  const bounds = await dialog.boundingBox(), viewport = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  assert(bounds && bounds.y >= 0 && bounds.x >= 0 && bounds.y + bounds.height <= viewport.h + 1 && bounds.x + bounds.width <= viewport.w + 1, 'Writing window fits viewport');
  await dialog.screenshot({ path: path.join(output, `${process.env.WEBSTUDIO_PLATFORM || 'desktop'}-preview.png`) });
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  await editor.getByText('Welcom to ', { exact: true }).waitFor();
  assert.equal(await editor.innerHTML(), original, 'Undo restores exact original rich text');
  // Paragraph-boundary and partial-word selections must not absorb adjacent content.
  dialog = await selectPassage(editor, 'last'); await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByLabel('Gemini text preview', { exact: true }).filter({ hasText: 'Keep this paragraph intact.' }).waitFor();
  const firstParagraphStyle = element => [element, ...element.querySelectorAll('*')].map(node => { const s = getComputedStyle(node); return { tag: node.tagName, text: node.textContent, href: node.getAttribute('href'), font: s.fontFamily, size: s.fontSize, color: s.color, weight: s.fontWeight, decoration: s.textDecorationLine, line: s.lineHeight, align: s.textAlign }; });
  const firstParagraph = await editor.locator('p').first().evaluate(firstParagraphStyle);
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.deepEqual(await editor.locator('p').first().evaluate(firstParagraphStyle), firstParagraph, 'Selecting paragraph 2 leaves paragraph 1 text, structure and appearance unchanged');
  assert.equal(await editor.locator('p').count(), 2, 'No nested or empty paragraphs inserted');
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); assert.equal(await editor.innerHTML(), original);
  dialog = await selectPassage(editor, 'word'); await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByLabel('Gemini text preview', { exact: true }).filter({ hasText: 'Welcome' }).waitFor();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(await editor.locator('a[href="/visit"]').textContent(), 'our parish', 'An unselected linked run is untouched');
  assert((await editor.textContent()).startsWith('Welcome to our parish — untouched.'));
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click(); assert.equal(await editor.innerHTML(), original);
  // Normal keyboard Undo/Redo must also work after closing the assistant.
  dialog = await selectPassage(); await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByLabel('Gemini text preview', { exact: true }).filter({ hasText: 'Welcome to our parish community' }).waitFor();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click(); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.keyboard.press('Control+z'); await editor.getByText('Welcom to ', { exact: true }).waitFor();
  assert.equal(await editor.innerHTML(), original, 'Ctrl+Z restores the original after closing');
  await page.keyboard.press('Control+y'); await editor.getByText('our parish community', { exact: true }).waitFor();
  await page.keyboard.press('Control+z'); await editor.getByText('Welcom to ', { exact: true }).waitFor();
  // Reject an obsolete preview instead of overwriting an intervening edit.
  dialog = await selectPassage(); await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByLabel('Gemini text preview', { exact: true }).filter({ hasText: 'Welcome to our parish community' }).waitFor();
  await editor.evaluate(element => { element.querySelector('span').textContent += 'intervening edit'; });
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'original text changed' }).waitFor();
  assert((await editor.textContent()).includes('intervening edit'), 'Stale Apply preserves intervening text');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await editor.evaluate((element, html) => { element.innerHTML = html; }, original);
  mode = 'quota'; dialog = await selectPassage();
  const beforeQuota = requests; await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'free quota' }).waitFor();
  assert.equal(requests, beforeQuota + 1, 'Quota error makes one request only');
  assert.equal(await editor.innerHTML(), original);
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
  mode = 'delay'; dialog = await selectPassage(); await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByRole('button', { name: 'Stop', exact: true }).click();
  await dialog.getByRole('button', { name: 'Preview', exact: true }).waitFor();
  assert(await dialog.getByRole('button', { name: 'Apply', exact: true }).isDisabled());
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  mode = 'success';
  const object = page.locator('[data-section-object="independent"]'); await object.dblclick();
  const independent = object.locator('[data-rich-editor]'); await independent.waitFor();
  await independent.evaluate(element => { element.focus(); const range = document.createRange(); range.selectNodeContents(element); range.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(range); });
  await page.keyboard.type(' Please join us.');
  dialog = await selectPassage(independent, true); await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  await dialog.getByLabel('Gemini text preview', { exact: true }).filter({ hasText: 'Another welcome. Please join us.' }).waitFor();
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(await independent.textContent(), 'Another welcome. Please join us.');
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await independent.textContent(), 'Another welcom. Please join us.', 'Undo retains typing done before opening AI');
  assert.equal(await editor.innerHTML(), original, 'Independent box changes do not change body');
  if (process.env.WEBSTUDIO_LIVE_GEMINI === '1') {
    await page.evaluate(() => window.restoreGeminiTestBridge());
    await page.unroute(endpoint);
    dialog = await selectPassage();
    await dialog.getByRole('textbox', { name: 'Gemini writing instruction' }).fill('Correct the spelling of Welcom to Welcome. Preserve the second segment exactly.');
    await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.waitForFunction(() => { const d = document.querySelector('dialog[open]'); return d?.querySelector('[role="alert"]') || d?.querySelector('[aria-label="Gemini text preview"]')?.textContent?.startsWith('Welcome'); }, null, { timeout: 100000 });
    const problem = await dialog.getByRole('alert').count() ? await dialog.getByRole('alert').textContent() : '';
    assert(!problem, 'Live Gemini request failed: ' + problem);
    assert((await dialog.getByLabel('Gemini text preview', { exact: true }).textContent()).startsWith('Welcome'), 'Real Gemini corrects synthetic spelling');
    assert.equal(await editor.innerHTML(), original, 'Live Preview does not edit page');
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
    assert((await editor.textContent()).startsWith('Welcome to '));
    await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
    assert.equal(await editor.innerHTML(), original, 'Real Gemini apply is undoable');
  }
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, `${process.env.WEBSTUDIO_PLATFORM || 'desktop'}-result.json`), JSON.stringify({ passed: true, mockRequests: requests, live: process.env.WEBSTUDIO_LIVE_GEMINI === '1', pageErrors: errors }));
  console.log('PASS: selected-text Preview, Cancel, Apply, exact Undo, formatting, links, quota, Stop, independent boxes' + (process.env.WEBSTUDIO_LIVE_GEMINI === '1' ? ', live Gemini request' : ''));
} finally { await browser.close(); }
