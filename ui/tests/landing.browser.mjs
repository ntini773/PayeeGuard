/** Public-page acceptance checks. Never signs in or sends a mutating API request. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = new URL(process.env.PAYEEGUARD_UI_URL ?? 'http://127.0.0.1:8765');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Use a local demo server.');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const blockedWrites = [];
const apiRequests = [];
let passed = 0;
const pass = (name) => { passed++; console.log(`PASS: ${name}`); };
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('request', (request) => {
  if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.method());
});
await page.route('**/api/**', (route) => {
  const method = route.request().method();
  if (method !== 'GET') {
    blockedWrites.push(method);
    return route.abort();
  }
  return route.continue();
});
const home = async () => {
  await page.goto(base.href);
  await page.getByRole('heading', { name: 'A new account. Not a free pass.' }).waitFor();
};
const selectedStep = () => page.locator('button[aria-label^="Illustrate"][aria-pressed="true"]');
const waitForStep = async (step) => {
  await page.locator(`button[aria-label="Illustrate ${step} step"][aria-pressed="true"]`).waitFor();
};

try {
  await home();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    pass(`layout fits ${width}px`);
  }

  const examples = [
    ['A compromised session', 'Change held', 'Account A'],
    ['Lost account access', 'Recovery review', 'Account A'],
    ['Approved, still waiting', 'Cooling off', 'Account A'],
    ['A completed change', 'New destination active', 'Account B'],
  ];
  for (const [label, status, account] of examples) {
    await page.getByRole('button', { name: new RegExp(label) }).click();
    const text = await page.locator('[aria-live="polite"]').innerText();
    assert(text.includes(status) && text.includes(account), label);
    assert.equal(await page.locator('[aria-label="Illustrative scenarios"] [aria-pressed="true"]').count(), 1);
    pass(`scenario: ${label}`);
  }
  assert.equal(apiRequests.length, 0, 'Illustrations must not call the API.');
  pass('scenario selection makes zero API requests');

  // Start below the walkthrough: this reproduces the queued scroll/click race.
  for (const step of ['request', 'verify', 'wait', 'activate', 'request']) {
    await page.getByRole('button', { name: `Illustrate ${step} step`, exact: true }).click();
    await waitForStep(step);
    await page.waitForTimeout(850); // Allow the native smooth scroll to settle.
    assert.equal(await selectedStep().getAttribute('aria-label'), `Illustrate ${step} step`);
    pass(`desktop walkthrough keeps ${step} selected after scrolling`);
  }
  // Ordinary scrolling must continue to drive the illustration in both directions.
  for (const [index, step] of [[3, 'activate'], [0, 'request']]) {
    await page.locator(`[data-chapter="${index}"]`).evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await waitForStep(step);
    pass(`walkthrough follows scroll: ${step}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const step of ['activate', 'request', 'verify', 'wait']) {
    await page.getByRole('button', { name: `Illustrate ${step} step`, exact: true }).click();
    await waitForStep(step);
    await page.waitForTimeout(150);
    assert.equal(await selectedStep().getAttribute('aria-label'), `Illustrate ${step} step`);
  }
  pass('all mobile walkthrough controls remain selectable');

  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Overview');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'navigation-toggle');
  pass('mobile menu opens, focuses a link, and restores focus on Escape');

  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.locator('#primary-navigation a[href="/seller"]').click();
  await page.getByRole('heading', { name: 'Seller sign-in', exact: true }).waitFor();
  assert.equal(await page.locator('#navigation-toggle').getAttribute('aria-expanded'), 'false');
  // Verify the user's view, with a 4px browser rendering tolerance at the top.
  const arrival = await page.evaluate(() => ({
    y: scrollY,
    heading: document.querySelector('h1').getBoundingClientRect().toJSON(),
    headerBottom: document.querySelector('header').getBoundingClientRect().bottom,
    viewportHeight: innerHeight,
  }));
  assert(arrival.y <= 4, `Previous page scroll was retained: ${arrival.y}`);
  assert(arrival.heading.top >= arrival.headerBottom - 1 && arrival.heading.bottom < arrival.viewportHeight,
    'The destination heading must be fully visible below the navigation.');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
  pass('seller navigation closes the menu, resets scroll, and focuses main');

  await page.getByRole('link', { name: 'PayeeGuard home', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('header').getByRole('button', { name: 'Reduce motion', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.classList.contains('reduced-motion'));
  assert.equal(await page.locator('[class*="liveBeam"]').evaluate((el) => getComputedStyle(el).animationName), 'none');
  assert.equal(await page.locator('[data-reveal]').evaluateAll((nodes) => nodes.filter((e) => getComputedStyle(e).opacity === '0').length), 0);
  await page.reload();
  await page.locator('header').getByRole('button', { name: 'Enable animations', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('payeeguard_reduced_motion')), 'true');
  pass('reduced motion stops the beam, reveals content, and survives reload');

  await page.locator('header').getByRole('button', { name: 'Enable animations', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const systemButton = page.locator('header').getByRole('button', { name: 'Motion reduced by your device preference', exact: true });
  await systemButton.waitFor();
  assert.equal(await systemButton.isDisabled(), true);
  assert.equal(await page.locator('[class*="liveBeam"]').evaluate((el) => getComputedStyle(el).animationName), 'none');
  assert.equal(await page.locator('[data-reveal]').evaluateAll((nodes) => nodes.filter((e) => getComputedStyle(e).opacity === '0').length), 0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('header').getByRole('button', { name: 'Reduce motion', exact: true }).waitFor();
  pass('OS reduced-motion changes are respected without hiding content');

  await page.getByRole('link', { name: 'See the boundary', exact: true }).click();
  await page.waitForFunction(() => location.hash === '#the-boundary' && scrollY > 100);
  pass('the boundary link scrolls to its in-page section');
  await page.getByRole('link', { name: 'PayeeGuard home', exact: true }).click();
  await page.waitForFunction(() => scrollY <= 4 && location.hash === '');
  pass('same-page home navigation returns to the top');
  await page.locator('header').getByRole('link', { name: 'Open console', exact: true }).click();
  await page.getByRole('heading', { name: 'Marketplace operator sign-in', exact: true }).waitFor();
  assert(await page.evaluate(() => scrollY <= 4), 'Operator view must open at the top.');
  pass('operator navigation preserves the existing sign-in page');

  assert.deepEqual(blockedWrites, [], 'A public-page check attempted an API mutation.');
  assert.deepEqual(pageErrors, [], 'Uncaught browser errors.');
  pass('no API mutations or uncaught browser errors');
  console.log(`\n${passed} browser checks passed. No login or PayPal call was performed.`);
} finally {
  await browser.close();
}
