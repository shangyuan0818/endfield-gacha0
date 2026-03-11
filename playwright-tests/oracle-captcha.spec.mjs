import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

function findEdgeExecutable() {
  const candidates = [
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

const edgeExecutablePath = findEdgeExecutable();

test.use({
  browserName: 'chromium',
  launchOptions: edgeExecutablePath ? { executablePath: edgeExecutablePath } : {},
});

async function resetCaptchaSession(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('lastCaptchaVerified');
    localStorage.setItem('captchaModePreference', 'puzzle');
    localStorage.setItem('puzzleCaptchaDifficulty', '1');
  });
}

async function verifyPuzzleCaptchaLoaded(page, baseUrl) {
  const consoleErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await resetCaptchaSession(page);
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('验证切换')).toBeVisible({ timeout: 15000 });
  const syncLocator = page.getByText('同步拼图题库');
  try {
    await expect(syncLocator).toBeVisible({ timeout: 5000 });
    await expect(syncLocator).toBeHidden({ timeout: 20000 });
  } catch {
    await expect(syncLocator).toHaveCount(0, { timeout: 20000 });
  }

  await expect(page.getByText('ORACLE PUZZLE ACCESS')).toBeVisible({ timeout: 10000 });

  const puzzleHeader = page.locator('strong').filter({ hasText: /^#\d+$/ }).first();
  await expect(puzzleHeader).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: '换一题' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: /难度：简单/ })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: '显示数字' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: '前往游玩站' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('拼图模块')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/HINT (LOCKED|ONLINE)/)).toBeVisible({ timeout: 10000 });

  return {
    consoleErrors,
    puzzleLabel: await puzzleHeader.textContent(),
  };
}

test('desktop captcha loads a shared puzzle instead of hanging on sync', async ({ page }) => {
  const result = await verifyPuzzleCaptchaLoaded(page, `${baseUrl}/`);

  expect(result.consoleErrors.filter((entry) => !entry.includes('favicon.ico'))).toEqual([]);
  expect(result.puzzleLabel).toMatch(/^#\d+$/);
});

test('mobile captcha loads a shared puzzle instead of hanging on sync', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  const result = await verifyPuzzleCaptchaLoaded(page, `${baseUrl}/m`);

  expect(result.consoleErrors.filter((entry) => !entry.includes('favicon.ico'))).toEqual([]);
  expect(result.puzzleLabel).toMatch(/^#\d+$/);

  await context.close();
});
