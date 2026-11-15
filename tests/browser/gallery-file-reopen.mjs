// Verify a ZIP opened through the real Windows file picker in an isolated desktop profile.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import JSZip from 'jszip';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
const assert = (value, message) => { if (!value) throw new Error(message); };
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.WEBSTUDIO_TEST_CDP || ''), 'Use an isolated local desktop test target.');
const filename = resolve(process.argv[2]);
const zip = await JSZip.loadAsync(await readFile(filename));
const saved = JSON.parse(await zip.file('project.webstudio.json').async('string'));
const expected = saved.config.pages[0].blocks[0].props.images;
assert(expected.length === 44 && new Set(expected.map(photo => photo.id)).size === 44, 'Saved ZIP should contain all 44 unique photo records.');
const browser = await chromium.connectOverCDP(process.env.WEBSTUDIO_TEST_CDP);
try {
  const page = browser.contexts()[0].pages().find(item => item.url().startsWith('https://webstudio.local/'));
  assert(page, 'Desktop editor was not found.');
  if (await page.getByRole('button', { name: 'Toggle preview mode', exact: true }).getAttribute('aria-pressed') === 'true') await page.getByRole('button', { name: 'Toggle preview mode', exact: true }).click();
  await page.locator('[data-gallery-position="44"]').waitFor();
  const reopened = await page.evaluate(() => JSON.parse(localStorage.getItem('openpage-config')).state.config.pages[0].blocks[0].props.images);
  assert(JSON.stringify(reopened) === JSON.stringify(expected), 'Native saved ZIP must reopen with identical photo identity, metadata and order.');
  await page.locator(`[data-ws-gallery-photo-id="${expected[43].id}"]`).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Properties', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Photo 44 position', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Delete photo 44', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-gallery-position]').length === 43);
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.keyboard.press('Control+z');
  await page.locator(`[data-ws-gallery-photo-id="${expected[43].id}"]`).waitFor();
  console.log('PASS: desktop-saved ZIP reopened with all identities, metadata and order intact; the last added photo remains deletable and Undo restores it.');
} finally { await browser.close(); }
