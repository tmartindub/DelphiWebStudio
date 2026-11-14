// Run against a desktop build started with an isolated WebView2 profile and a CDP port.
// WEBSTUDIO_PLAYWRIGHT is the installed Playwright module; WEBSTUDIO_TEST_CDP is its loopback URL.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.WEBSTUDIO_PLAYWRIGHT || 'playwright');
const assert = (value, message) => { if (!value) throw new Error(message); };
assert(/^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.WEBSTUDIO_TEST_CDP || ''), 'Use an isolated local desktop test target.');
const browser = await chromium.connectOverCDP(process.env.WEBSTUDIO_TEST_CDP);
try {
  const page = browser.contexts()[0].pages().find(item => item.url().startsWith('https://webstudio.local/'));
  assert(page, 'Desktop editor was not found.');
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('https://webstudio.local/index.html');
  await page.evaluate(() => {
    const existing = JSON.parse(localStorage.getItem('openpage-projects') || '{"state":{"projects":[]}}').state.projects;
    if (existing.some(project => project.id !== 'gallery-position-fixture')) throw new Error('Refusing to replace non-test projects.');
    const images = Array.from({ length: 49 }, (_, i) => ({
      src: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#dce8f3"/><text x="20" y="55" fill="#172033" font-size="20">Photo ${i + 1}</text></svg>`)}`,
      alt: `Photo ${i + 1}`, caption: `Caption ${i + 1}`,
    }));
    const block = { id: 'position-gallery', type: 'gallery', variant: 'responsive', props: { title: 'Position check', images } };
    const config = { name: 'Gallery position check', blocks: [block], pages: [{ id: 'home', name: 'Home', path: '/', blocks: [block] }] };
    localStorage.setItem('openpage-projects', JSON.stringify({ state: { projects: [{ id: 'gallery-position-fixture', name: 'Gallery position check', status: 'draft', updatedAt: 'Just now', blockCount: 1, config }] }, version: 0 }));
    localStorage.setItem('openpage-config', JSON.stringify({ state: { config, activePageId: 'home' }, version: 2 }));
  });
  await page.reload();
  await page.getByText('Gallery position check', { exact: true }).click();
  await page.locator('[data-gallery-position="49"]').waitFor();
  assert(await page.locator('[data-gallery-position]').count() === 49, 'Editor should show all position numbers.');
  await page.locator('[data-ws-item-field="images"][data-ws-item-index="48"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Properties', exact: true }).click();
  const input = page.getByRole('spinbutton', { name: 'Photo 49 position', exact: true });
  await input.fill('50');
  await input.press('Enter');
  assert(!(await input.evaluate(element => element.validity.valid)), 'Position above the photo count should be rejected.');
  await input.fill('10');
  await input.press('Enter');
  await page.getByRole('spinbutton', { name: 'Photo 10 position', exact: true }).waitFor();
  const order = () => page.locator('[data-ws-item-field="images"] img').evaluateAll(images => images.map(image => image.alt));
  assert((await order())[9] === 'Photo 49' && (await order())[10] === 'Photo 10', 'Last photo should be inserted at 10 and shift the following photos.');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('openpage-projects')).state.projects[0].config.pages[0].blocks[0].props.images);
  assert(stored[9].alt === 'Photo 49' && stored[9].caption === 'Caption 49', 'Moved photo and caption should persist together.');
  await page.getByRole('spinbutton', { name: 'Photo 10 position', exact: true }).fill('1');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Photo 1 position', exact: true }).waitFor();
  assert((await order())[0] === 'Photo 49', 'Moving to the first position should work.');
  await page.getByRole('spinbutton', { name: 'Photo 1 position', exact: true }).fill('49');
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Photo 49 position', exact: true }).waitFor();
  assert((await order())[48] === 'Photo 49', 'Moving to the last position should work.');
  await page.getByRole('button', { name: 'Close settings', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle preview mode', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-gallery-position]').length === 0);
  assert((await order()).length === 49, 'Preview should retain every photo without position labels.');
  assert(errors.length === 0, errors.join('\n'));
  console.log('PASS: desktop photo 49 → 10 → 1 → 49, invalid position rejected, caption retained, editor numbering and clean Preview.');
} finally {
  await browser.close();
}
