import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const server = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4174',
    '--strictPort',
  ],
  { windowsHide: true, stdio: 'pipe' },
);
let browser;
try {
  const url = 'http://127.0.0.1:4174/Spatium/';
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url)).ok) break;
    } catch {
      /* Wait for the local test server. */
    }
    if (i === 99 || server.exitCode !== null)
      throw new Error('Production test server did not start.');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.getByRole('link', { name: 'Open Personal' }).click();
  assert.equal(
    await page
      .locator('.canvas')
      .evaluate((el) => getComputedStyle(el).position),
    'relative',
  );
  await page.getByRole('button', { name: 'Create item', exact: true }).click();
  await page.getByRole('button', { name: 'Task', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Task title', exact: true })
    .fill('Available offline');
  await page
    .getByRole('textbox', { name: 'Task title', exact: true })
    .press('Enter');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForTimeout(700);
  // The first installation controls subsequent navigations in prompt-update mode.
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await page.reload();
  await page
    .locator('.taskTitle')
    .filter({ hasText: 'Available offline' })
    .waitFor();
  assert.deepEqual(errors, []);
  process.stdout.write(
    'Production CSS, hash route, IndexedDB reload and offline service worker: PASS\n',
  );
} finally {
  await browser?.close();
  server.kill();
}
