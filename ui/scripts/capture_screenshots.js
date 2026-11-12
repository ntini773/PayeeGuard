import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.resolve(__dirname, '../screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function run() {
  console.log('Starting Vite server for screenshot capture...');
  const server = await createServer({
    configFile: path.resolve(__dirname, '../vite.config.ts'),
    server: { port: 5183 },
  });
  await server.listen();
  const baseUrl = 'http://localhost:5183';
  console.log(`Vite server listening at ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: '1440px', width: 1440, height: 900 },
    { name: '390px', width: 390, height: 844 },
  ];

  const routes = [
    { path: '/', name: 'landing' },
    { path: '/console', name: 'console-queue' },
    { path: '/how-it-works', name: 'how-it-works' },
    { path: '/schema', name: 'schema' },
  ];

  // 1. Capture base routes at 1440px and 390px
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });

    for (const route of routes) {
      await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600); // Allow fonts & transitions to settle

      // Check horizontal overflow at 390px
      if (vp.width === 390) {
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        console.log(`[Check 390px] Route ${route.path} horizontal scroll: ${hasHorizontalScroll ? 'FAIL (OVERFLOW)' : 'PASS (NO OVERFLOW)'}`);
      }

      const filePath = path.join(screenshotsDir, `${route.name}-${vp.name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`Saved screenshot: ${filePath}`);
    }

    await page.close();
  }

  // 2. Capture all 6 Case States on Case Detail view at 1440px and 390px
  const cases = [
    { id: 'chg_demo_0001', name: 'state-needs-review' },
    { id: 'chg_demo_0002', name: 'state-cooling-off' },
    { id: 'chg_demo_0003', name: 'state-rejected' },
    { id: 'chg_demo_0004', name: 'state-held-old-auth' },
    { id: 'chg_demo_0005', name: 'state-approved-active' },
    { id: 'chg_demo_0006', name: 'state-expired' },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(`${baseUrl}/console`, { waitUntil: 'networkidle' });

    for (const c of cases) {
      // Open case by clicking table row or dev button
      // Use dev button for exact state targeting
      const devToggle = page.locator('button:has-text("Developer Target State Views")');
      if (await devToggle.isVisible()) {
        await devToggle.click();
      }

      const stateBtn = page.locator(`button:has-text("${c.id}")`).or(page.locator(`button:has-text("${c.name.split('-')[1]}")`));
      // Click the table row containing the case ID
      const row = page.locator(`tr:has-text("${c.id}")`);
      if (await row.isVisible()) {
        await row.click();
      } else {
        // Fallback: click first matching button
        await page.locator(`button[class*="devBtn"]:has-text("${c.id}")`).or(page.locator(`text=${c.id}`)).first().click();
      }

      await page.waitForTimeout(500);

      // Check horizontal overflow
      if (vp.width === 390) {
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });
        console.log(`[Check 390px] Case ${c.id} (${c.name}) horizontal scroll: ${hasHorizontalScroll ? 'FAIL' : 'PASS'}`);
      }

      const filePath = path.join(screenshotsDir, `${c.name}-${vp.name}.png`);
      await page.screenshot({ path: filePath, fullPage: true });
      console.log(`Saved screenshot: ${filePath}`);

      // Go back to queue for next case
      const backBtn = page.locator('button:has-text("Back to Queue")');
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await page.waitForTimeout(300);
      }
    }

    await page.close();
  }

  // 3. Reduced Motion run (both toggle button and prefers-reduced-motion)
  console.log('Capturing reduced motion screenshots...');
  const rmPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });

  // Landing with reduced motion
  await rmPage.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await rmPage.waitForTimeout(400);
  await rmPage.screenshot({
    path: path.join(screenshotsDir, 'landing-reduced-motion-1440px.png'),
    fullPage: true,
  });

  // Needs review case with reduced motion
  await rmPage.goto(`${baseUrl}/console`, { waitUntil: 'networkidle' });
  const needsReviewRow = rmPage.locator('tr:has-text("chg_demo_0001")');
  if (await needsReviewRow.isVisible()) {
    await needsReviewRow.click();
    await rmPage.waitForTimeout(400);
  }
  await rmPage.screenshot({
    path: path.join(screenshotsDir, 'needs-review-reduced-motion-1440px.png'),
    fullPage: true,
  });

  await rmPage.close();
  await browser.close();
  await server.close();
  console.log('Screenshot capture complete!');
}

run().catch((err) => {
  console.error('Error capturing screenshots:', err);
  process.exit(1);
});
