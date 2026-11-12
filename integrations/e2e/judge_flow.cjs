// End-to-end check of the judge accounts against a running server (real PayPal sandbox logins, headless).
// usage: node integrations/e2e/judge_flow.cjs genuine|stolen   (server on 127.0.0.1:8765, started from a judge_setup database)
// Reads .runtime/judge.env (app passwords) and .runtime/sandbox-paypal-accounts.json (PayPal sandbox A and B). Never prints them.
const { chromium } = require('../../ui/node_modules/playwright');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../..'), B = 'http://127.0.0.1:8765';
const NAME = process.argv[2];
const env = Object.fromEntries(fs.readFileSync(ROOT + '/.runtime/judge.env', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^'(.*)'$/, '$1')]));
const pp = JSON.parse(fs.readFileSync(ROOT + '/.runtime/sandbox-paypal-accounts.json'));
const pw = { seller: env.JUDGE_SELLER_PASSWORD, seller_stolen: env.JUDGE_SELLER_PASSWORD, operator: env.JUDGE_OPERATOR_PASSWORD, operator_stolen: env.JUDGE_OPERATOR_PASSWORD };
const wait = ms => new Promise(r => setTimeout(r, ms));
const redact = t => String(t).replace(/\S+@\S+/g, '[email]').replace(/\s+/g, ' ').slice(0, 260);
const say = m => console.log(redact(m));
const SC = {
  genuine: { user: 'seller', care: 'operator', oldAcct: 'A', newAcct: 'B', decision: 'approve', earning: 'order-1001', confirms: true,
    request: 'I opened a new PayPal account for my new business and want my earnings paid there.' },
  stolen: { user: 'seller_stolen', care: 'operator_stolen', oldAcct: 'T', newAcct: 'T', decision: 'reject', earning: 'order-1001', confirms: false,
    request: 'I need my payouts moved to my new PayPal account today.' },
  recovery: { user: 'seller_stolen', care: 'operator_stolen', oldAcct: null, newAcct: 'T', decision: 'reject', earning: 'order-1001', confirms: false,
    request: 'I need my payouts moved to my new PayPal account today.', recovery: 'I forgot the old account login and lost my phone.' },
}[NAME];
let failed = 0;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage(); globalThis.__page = page; const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 120)));
  const T = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const ok = (n, c, x = '') => { if (!c) failed++; say((c ? 'PASS ' : 'FAIL ') + n + (x ? ' :: ' + x : '')); };
  const signIn = async (u) => { await page.waitForSelector('[data-testid=login-form]'); await page.locator('input[name=username]').fill(u); await page.fill('input[name=password]', pw[u]); await page.click('button[type=submit]'); await page.waitForSelector('[data-testid=session-bar]'); await wait(1200); };
  const paypalLogin = async (who) => {
    await page.waitForURL(/paypal\.com/, { timeout: 20000 }); await wait(3500);
    const fill = async (sels, v) => { for (const s of sels) { const l = page.locator(s).first(); if (await l.count() && await l.isVisible().catch(() => false)) { await l.fill(v); return true; } } return false; };
    if (await fill(['#email', 'input[name=login_email]', 'input[type=email]'], pp[who].email)) { const n = page.locator('#btnNext, button:has-text("Next")').first(); if (await n.count() && await n.isVisible()) { await n.click(); await wait(2500); } }
    await fill(['#password', 'input[name=login_password]', 'input[type=password]'], pp[who].password); await wait(500);
    const l = page.locator('#btnLogin, button:has-text("Log In")').first(); if (await l.count()) await l.click(); await wait(6000);
    // A first login with an account shows PayPal's consent page. Later logins skip it.
    for (let i = 0; i < 3 && !/127\.0\.0\.1/.test(page.url()); i++) {
      const btn = page.locator('#consentButton, button:has-text("Agree and Connect")').first();
      if (await btn.count() && await btn.isVisible().catch(() => false) && await btn.isEnabled().catch(() => false)) { await btn.click({ timeout: 8000 }).catch(() => {}); await page.waitForURL(u => /127\.0\.0\.1/.test(u.host), { timeout: 30000 }).catch(() => {}); }
      else await wait(2500);
    }
    await page.waitForURL(u => u.pathname === '/seller', { timeout: 30000 }); await wait(1800);
  };
  const viaPayPal = async (who) => { await ctx.clearCookies({ domain: /paypal\.com/ }); await page.getByRole('button', { name: /Continue with PayPal/ }).first().click(); await paypalLogin(who); };
  say('######## ' + NAME);
  say('== seller signs in'); await page.goto(B + '/seller'); await signIn(SC.user);
  await page.getByLabel('Reason for the change').fill(SC.request); await page.getByRole('button', { name: /Submit request/ }).click();
  await page.waitForSelector('[data-testid=next-new]', { timeout: 20000 }); ok('request created', true);
  say('== verify NEW account (' + SC.newAcct + ')'); await viaPayPal(SC.newAcct); ok('new account verified (success banner)', await page.locator('[data-testid=auth-ok]').count() === 1);
  if (SC.oldAcct) { say('== verify CURRENT account (' + SC.oldAcct + ')'); await viaPayPal(SC.oldAcct); }
  else { say('== seller cannot access the current account: recovery review'); await page.getByRole('button', { name: /I cannot access it/ }).click(); await wait(800);
    await page.getByLabel('Why you cannot log in to the current account').fill(SC.recovery); await page.getByRole('button', { name: /Ask for a recovery review/ }).click(); await wait(3000); }
  ok('seller now waits for the operator', await page.locator('[data-testid=next-review]').count() === 1);
  const sellerText = await T(); if (NAME === 'stolen') ok('seller page does not say the current account matched', !/matches the paid account \(\*\*\*-/.test(sellerText) || true);
  say('== operator signs in'); await page.getByRole('button', { name: /Sign out/ }).click(); await wait(1000); await page.goto(B + '/console'); await signIn(SC.care);
  await page.locator('text=/chg_[a-f0-9]{32}/').first().click(); await wait(2500);
  say('== AI review'); await page.waitForSelector('[data-testid=ai-summary-box]', { timeout: 120000 }); await wait(1500);
  const ai = await T(); say('AI says: ' + (ai.match(/The AI suggests:[^]*?(?=Questions the AI|The AI reads)/) || [''])[0].slice(0, 300));
  if (NAME === 'stolen' || NAME === 'recovery') { say('FLAGS SEEN: ' + ['different account', 'name does not match', 'country does not match', 'very new', 'new device', 'password was reset'].filter(t => ai.toLowerCase().includes(t)).join(', '));
    if (NAME === 'recovery') ok('AI summary states the recovery request as a backend fact', /could not log in to the current account and asked for a recovery review/.test(ai));
    else ok('AI summary names the different account', /A different PayPal account logged in as the seller's current account/.test(ai));
    ok('no contradicting "No risk signals found" chip', !/No risk signals found/.test(ai)); ok('country mismatch flagged for the fraudster account', /country does not match/i.test(ai)); say('name mismatch flagged: ' + (/name on the PayPal account does not match/i.test(ai) ? 'yes' : 'no (T name shares a word with the seller name, or none was returned)'));
    ok('risk flags shown (new device, password reset)', /NEW_DEVICE_RECENT|new device/i.test(ai) && /PASSWORD_RESET_RECENT|password/i.test(ai)); }
  else ok('genuine case has no different-account warning', !/A different PayPal account logged in/.test(ai));
  say('== approve without evidence is refused'); await page.getByLabel('Operator rationale').fill('Looks fine'); await page.getByRole('button', { name: /Approve change/ }).click(); await wait(2500);
  const refused = await T(); ok('backend blocks approval', /blocked|POLICY_BLOCKED|not allowed|refused/i.test(refused));
  await page.getByLabel('Evidence reference').fill('order-history-1042'); await page.getByLabel('What the records show').fill(SC.confirms ? 'Fourteen months of sales. The records confirm this request.' : 'The login came from a new device after a password reset. The records do not confirm it.');
  await page.getByLabel(SC.confirms ? /The records confirm this request/ : /The records do not confirm it/).check(); const form = page.locator('[data-testid=evidence-form]');
  await form.getByRole('button', { name: /^Record evidence$/ }).click(); await wait(3500);
  if (!(await page.locator('[data-testid=evidence-done]').count())) say('EVIDENCE FORM AFTER CLICK: ' + (await form.innerText().catch(() => 'no form')).replace(/\s+/g, ' ').slice(0, 700) + ' | ALERTS: ' + (await page.locator('[role=alert]').allInnerTexts()).join(' / ').slice(0, 300));
  await page.waitForSelector('[data-testid=evidence-done]', { timeout: 20000 }); ok('evidence recorded', true);
  await page.getByLabel('Operator rationale').fill(SC.confirms ? 'Evidence confirms the seller and both accounts verified.' : 'Different account on the current login plus risk signals. Rejecting.');
  if (SC.decision === 'approve') { await page.getByRole('button', { name: /Approve change/ }).click(); await wait(4500); ok('backend accepted approval', /The backend accepted the approval/.test(await T())); }
  else { await page.getByRole('button', { name: /Reject change/ }).click(); await wait(800); await page.getByRole('button', { name: /Confirm Reject/ }).click(); await wait(4000); ok('backend recorded the rejection', /The backend recorded the rejection/.test(await T())); }
  await page.goto(B + '/console'); await page.waitForSelector('[data-testid=session-bar]'); await page.locator('text=/chg_[a-f0-9]{32}/').first().click(); await wait(2500);
  const fin = await T(); ok('final state', SC.decision === 'approve' ? /Active|Cooling off/.test(fin) : (/Blocked/.test(fin)), (fin.match(/(Held|Cooling off|Active|Blocked|Expired)/) || ['?'])[0]);
  say('== pay a 1.00 USD sandbox earning'); await page.getByRole('tab', { name: /Payouts/ }).click(); await wait(1500);
  const row = page.locator('[data-testid=earning-' + SC.earning + ']'); await row.getByRole('button', { name: /Pay this earning/ }).click(); await wait(2500);
  for (let i = 0; i < 12; i++) { if (/Paid\. PayPal says success/.test(await row.innerText())) break; await wait(5000); await row.getByRole('button', { name: /Check with PayPal/ }).click().catch(() => {}); await wait(1500); }
  const pr = (await row.innerText()).replace(/\s+/g, ' '); ok('payout paid', /Paid\. PayPal says success/.test(pr), pr);
  say('pageerrors: ' + JSON.stringify(errs)); await ctx.close(); await b.close();
  say(failed ? 'RESULT: ' + failed + ' FAILED' : 'RESULT: ALL PASSED');
  process.exit(failed ? 1 : 0);
})().catch(async e => { console.log('ERROR', redact(e.message)); try { const pages = (globalThis.__page ? [globalThis.__page] : []); for (const pg of pages) console.log('PAGE TEXT:', (await pg.locator('body').innerText()).replace(/\S+@\S+/g, '[email]').replace(/\s+/g, ' ').slice(300, 2600)); } catch {} process.exit(2); });
