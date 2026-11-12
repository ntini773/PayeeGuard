/** Local, anonymous route-transition checks. No API writes or credentials. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = new URL(process.env.PAYEEGUARD_UI_URL ?? 'http://127.0.0.1:5175');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
let checks = 0;
const pass = label => { checks++; console.log(`PASS: ${label}`); };
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/**', route => route.request().method() === 'GET' ? route.continue() : route.abort());
await page.addInitScript(() => {
  window.transitionCount = 0;
  if (document.startViewTransition) {
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = (...args) => {
      window.transitionCount++;
      return original(...args);
    };
  }
});
const nav = path => page.locator(`#primary-navigation a[href="${path}"]`);
try {
  // A cold chunk is deliberately held. Hover should request it before clicking.
  let release, requested;
  const hold = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { requested = resolve; });
  await page.route('**/components/seller/SellerPage.tsx*', async route => {
    requested();
    await hold;
    await route.continue();
  });
  await page.goto(base.href);
  await page.getByRole('heading', { name: 'A new account. Not a free pass.' }).waitFor();
  await nav('/seller').hover();
  await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(Error('Hover did not preload seller route')), 10000))]);
  pass('hover preloads a destination before navigation');
  await nav('/seller').click();
  await page.getByRole('status', { name: 'Loading page', exact: true }).waitFor();
  assert(await page.getByRole('heading', { name: 'A new account. Not a free pass.' }).isVisible());
  assert.equal(await page.getByText('Preparing your view…', { exact: true }).count(), 0);
  pass('cold navigation retains the current page instead of flashing a fallback');
  release();
  await page.getByRole('heading', { name: 'Seller sign-in', exact: true }).waitFor();
  await page.waitForFunction(() => window.transitionCount > 0);
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement, '::view-transition-new(route-content)').animationDuration), '0.22s');
  pass('menu navigation invokes the short page crossfade');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
  assert((await page.evaluate(() => scrollY)) <= 4);
  pass('navigation preserves focus and resets scroll');

  await nav('/console').focus();
  await nav('/console').click();
  await page.getByRole('heading', { name: 'Marketplace operator sign-in', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.workspace), 'operator');
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.transitionCount);
  await page.locator('header').getByRole('button', { name: 'Reduce motion', exact: true }).click();
  await nav('/seller').click();
  await page.getByRole('heading', { name: 'Seller sign-in', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.transitionCount), before);
  pass('manual reduced motion skips the crossfade');
  await page.locator('header').getByRole('button', { name: 'Enable animations', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.documentElement.classList.contains('reduced-motion'));
  await nav('/console').click();
  await page.getByRole('heading', { name: 'Marketplace operator sign-in', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.transitionCount), before);
  pass('OS reduced motion also skips the crossfade');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !document.documentElement.classList.contains('reduced-motion'));
  await nav('/seller').click();
  await nav('/').click();
  await nav('/console').click();
  await page.getByRole('heading', { name: 'Marketplace operator sign-in', exact: true }).waitFor();
  await page.waitForTimeout(350);
  assert.equal(new URL(page.url()).pathname, '/console');
  assert.equal(await page.locator('#primary-navigation a[aria-current="page"]').textContent(), 'Operator');
  assert.equal(await page.locator('#main-content [data-testid="login-form"]').count(), 1);
  pass('rapid navigation settles on the latest destination with one live form');
  await page.goBack();
  await page.getByRole('heading', { name: 'A new account. Not a free pass.' }).waitFor();
  pass('browser Back still restores the previous route');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await nav('/seller').click();
  await page.getByRole('heading', { name: 'Seller sign-in', exact: true }).waitFor();
  assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  pass('mobile menu closes cleanly without horizontal overflow');
  assert.deepEqual(errors, []);
  pass('no uncaught browser errors');
  console.log(`\n${checks} navigation checks passed; no login or PayPal call performed.`);
} finally {
  await browser.close();
}
