// Checks the dashboard assistants in the default mode (small-model picker) for the seller and the care team.
// usage: node integrations/e2e/dashboard_assistant.cjs   (server on 127.0.0.1:8765 started from a judge_setup database)
const { chromium } = require('../../ui/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), B = process.env.BASE || 'http://127.0.0.1:8765';
const env = Object.fromEntries(fs.readFileSync(ROOT + '/.runtime/judge.env', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^'(.*)'$/, '$1')]));
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0; const ok = (n, c, x = '') => { if (!c) failed++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : '')); };
(async () => {
  const b = await chromium.launch();
  for (const [who, pw, url, question, bar] of [['seller', env.JUDGE_SELLER_PASSWORD, '/seller', 'show last 2 days revenue', true], ['operator', env.JUDGE_OPERATOR_PASSWORD, '/console', 'show risk flags in the last 4 days', false]]) {
    const page = await (await b.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();
    await page.goto(B + url); await page.locator('input[name=username]').fill(who); await page.fill('input[name=password]', pw); await page.click('button[type=submit]'); await page.waitForSelector('[data-testid=session-bar]'); await wait(1500);
    if (who === 'operator') { await page.getByRole('button', { name: 'Dashboard' }).click(); await wait(4000); } else await page.waitForSelector('[data-testid=seller-dashboard]', { timeout: 30000 });
    const dash = page.locator('[data-testid=studio-dashboard]'); await dash.first().waitFor({ timeout: 30000 });
    // the Studio AI Assistant chat
    const t0 = Date.now(); await page.getByTestId('open-ai-assistant').click(); await wait(2500);
    const input = dash.getByLabel('Message input'); await input.click(); await input.fill(question); await dash.getByLabel('Send message').click();
    let ans = ''; try { await page.waitForFunction(() => /Done:|could not answer|couldn.t/i.test(document.querySelector('[data-testid=studio-dashboard]')?.innerText || ''), null, { timeout: 60000 }); ans = (await dash.innerText()).match(/Done:[^\n]*|[^\n]*could not answer[^\n]*/i)?.[0] || ''; } catch { ans = 'TIMEOUT'; }
    ok(who + ' Studio chat answered "' + question + '"', /^Done:/.test(ans), ((Date.now() - t0) / 1000).toFixed(1) + 's ' + ans.slice(0, 90));
    await page.getByTestId('open-ai-assistant').click().catch(() => {});
    if (bar) { const ask = page.getByLabel('Ask the dashboard'); await ask.fill('Show my earnings for the last 2 days'); await page.keyboard.press('Enter'); try { await page.waitForFunction(() => /Done:/.test(document.querySelector('[data-testid=ask-note]')?.innerText || ''), null, { timeout: 40000 }); ok(who + ' Ask box answered', true); } catch { ok(who + ' Ask box answered', false); } }
    await page.context().close();
  }
  await b.close(); console.log(failed ? 'RESULT: ' + failed + ' FAILED' : 'RESULT: ALL PASSED'); process.exit(failed ? 1 : 0);
})().catch(e => { console.log('ERROR', String(e.message).slice(0, 200)); process.exit(2); });
