import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DOCS_DIR = path.resolve(__dirname, '../docs/archive/ui-checks');
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });
}

async function run() {
  console.log('--- Starting Vite Preview Server ---');
  const server = spawn('npm', ['run', 'preview', '--', '--port', '4173'], {
    cwd: __dirname,
    stdio: 'pipe',
  });

  server.stdout.on('data', (d) => process.stdout.write(d));
  server.stderr.on('data', (d) => process.stderr.write(d));

  // Wait for preview server to be ready
  await new Promise((r) => setTimeout(r, 2500));

  console.log('--- Launching Chromium ---');
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 960 },
  });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  await page.goto('http://localhost:4173', { waitUntil: 'networkidle' });

  // Payer ID security regex: full unmasked PayPal payer ID pattern
  // Should never see full unmasked format in DOM or text
  const checkFullPayerIdLeak = async (stateName) => {
    const pageContent = await page.content();
    // Test if any raw unmasked PAYER ID like PAYER-12345678 or PAYER-ABCDEFGH appears
    const match = pageContent.match(/PAYER-[A-Z0-9]{5,}/g);
    if (match) {
      console.error(`[SECURITY FAILURE in ${stateName}] Full Payer ID exposed:`, match);
      throw new Error(`Security violation: Full Payer ID exposed in ${stateName}: ${match.join(', ')}`);
    }
  };

  // 1. Empty Queue State
  console.log('Capturing: state-empty-queue.png');
  await page.click('button:has-text("State: Empty Queue")');
  await page.waitForTimeout(500);
  await checkFullPayerIdLeak('empty-queue');
  await page.screenshot({ path: path.join(DOCS_DIR, 'state-empty-queue.png'), fullPage: true });

  // 2. State: Held
  console.log('Capturing: state-held.png');
  await page.click('button:has-text("State: Held")');
  await page.waitForSelector('#case-detail-pane');
  await page.waitForTimeout(500);
  await checkFullPayerIdLeak('held');
  await page.screenshot({ path: path.join(DOCS_DIR, 'state-held.png'), fullPage: true });

  // 3. State: Cooling-Off
  console.log('Capturing: state-cooling-off.png');
  await page.click('button:has-text("State: Cooling-Off")');
  await page.waitForSelector('#case-detail-pane');
  await page.waitForTimeout(500);
  await checkFullPayerIdLeak('cooling-off');
  await page.screenshot({ path: path.join(DOCS_DIR, 'state-cooling-off.png'), fullPage: true });

  // 4. State: Needs Review
  console.log('Capturing: state-needs-review.png');
  await page.click('button:has-text("State: Needs Review")');
  await page.waitForSelector('#case-detail-pane');
  await page.waitForTimeout(500);
  await checkFullPayerIdLeak('needs-review');
  await page.screenshot({ path: path.join(DOCS_DIR, 'state-needs-review.png'), fullPage: true });

  // 5. State: Approved
  console.log('Capturing: state-approved.png');
  await page.click('button:has-text("State: Approved")');
  await page.waitForSelector('#case-detail-pane');
  await page.waitForTimeout(500);
  await checkFullPayerIdLeak('approved');
  await page.screenshot({ path: path.join(DOCS_DIR, 'state-approved.png'), fullPage: true });

  // 6. State: Rejected
  console.log('Capturing: state-rejected.png');
  await page.click('button:has-text("State: Rejected")');
  await page.waitForSelector('#case-detail-pane');
  await page.waitForTimeout(500);
  await checkFullPayerIdLeak('rejected');

  // Hard Rule Check: Ensure Approve button is NOT rendered in rejected state!
  const approveBtn = await page.$('button:has-text("Approve Destination Change")');
  if (approveBtn) {
    throw new Error('SECURITY VIOLATION: Approve button was rendered for a REJECTED policy decision!');
  }
  await page.screenshot({ path: path.join(DOCS_DIR, 'state-rejected.png'), fullPage: true });

  // 7. State: Error (Expired)
  console.log('Capturing: state-error.png');
  await page.click('button:has-text("State: Error (Expired)")');
  await page.waitForSelector('#case-detail-pane');
  await page.waitForTimeout(500);
  await checkFullPayerIdLeak('error');
  await page.screenshot({ path: path.join(DOCS_DIR, 'state-error.png'), fullPage: true });

  // 8. Test Keyboard Navigation & Focus
  console.log('Checking keyboard focus indicators...');
  await page.click('button:has-text("← Back to Queue")');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
  console.log('Focused element after Tab:', focusedElement);

  await browser.close();
  server.kill();

  if (consoleErrors.length > 0) {
    console.warn('Console warnings/errors recorded:', consoleErrors);
    const criticalErrors = consoleErrors.filter((e) => !e.includes('favicon'));
    if (criticalErrors.length > 0) {
      throw new Error(`Critical console errors occurred: ${criticalErrors.join('\n')}`);
    }
  }

  console.log('✅ All 7 target states verified and saved to docs/archive/ui-checks/ successfully!');
}

run().catch((err) => {
  console.error('E2E run failed:', err);
  process.exit(1);
});
