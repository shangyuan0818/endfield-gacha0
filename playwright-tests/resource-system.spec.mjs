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

async function bypassCaptcha(page) {
  await page.addInitScript(() => {
    localStorage.setItem('lastCaptchaVerified', Date.now().toString());
    localStorage.setItem('simulator_skipAnimation', 'true');
  });
}

function buildSimulatorScope(gameUid = null) {
  return `u:guest|g:${encodeURIComponent(gameUid || 'all')}`;
}

function buildScopedResourceSettings(gameUid, settings) {
  return [
    `gacha_simulator_resource_settings__${buildSimulatorScope(gameUid)}`,
    JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      settings
    })
  ];
}

test('simulator renders current resources, compact ledger, and persisted resource adjustments', async ({ page }) => {
  await bypassCaptcha(page);
  await page.goto(`${baseUrl}/simulator`, { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('累计资源')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('继承账号')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTitle('增加嵌晶玉')).toBeVisible({ timeout: 10000 });
  const adjustJadeButton = page.locator('button[title*="修改嵌晶玉"]');
  await expect(adjustJadeButton).toBeVisible({ timeout: 10000 });

  await page.getByTitle('增加嵌晶玉').click();
  await page.locator('input[type="number"]').fill('1000');
  await page.getByRole('button', { name: /^增加$/ }).click();
  await expect(page.getByText('51,000')).toBeVisible({ timeout: 5000 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('累计资源')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('51,000')).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => page.locator('img[src*="warfarin.wiki"]').count(), {
    timeout: 10000
  }).toBeGreaterThanOrEqual(3);
});

test('summary renders global and per-pool resource summary panels', async ({ page }) => {
  await bypassCaptcha(page);
  await page.goto(`${baseUrl}/summary`, { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('全卡池资源统计')).toBeVisible({ timeout: 25000 });
  await expect(page.getByText('角色池资源统计')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('武器池资源统计')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/总消耗\s*嵌晶玉/).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/衍质源石\s*等价/).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/共获得\s*武库配额/).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/总消耗\s*武库配额/).first()).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => page.locator('img[src*="warfarin.wiki"]').count(), {
    timeout: 10000
  }).toBeGreaterThanOrEqual(4);
});

test('simulator prompts for originite conversion before a ten-pull when jade is insufficient', async ({ page }) => {
  await bypassCaptcha(page);
  await page.goto(`${baseUrl}/simulator`, { waitUntil: 'domcontentloaded' });

  const adjustJadeButton = page.locator('button[title*="修改嵌晶玉"]');
  await expect(adjustJadeButton).toBeVisible({ timeout: 10000 });
  await adjustJadeButton.click();
  await page.locator('input[type="number"]').fill('0');
  await page.getByRole('button', { name: /^设为$/ }).click();

  await page.getByRole('button', { name: /十连寻访/ }).click();
  await expect(page.getByText('确认源石换玉')).toBeVisible({ timeout: 5000 });
  await expect(page.getByText(/67/)).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('今日访问不再提示')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: '继续寻访' }).click();
  await expect(page.getByText('寻访结果')).toBeVisible({ timeout: 10000 });
});

test('simulator reset clears the cumulative resource ledger for the cleared pools', async ({ page }) => {
  await bypassCaptcha(page);
  await page.goto(`${baseUrl}/simulator`, { waitUntil: 'domcontentloaded' });

  const adjustJadeButton = page.locator('button[title*="修改嵌晶玉"]');
  await expect(adjustJadeButton).toBeVisible({ timeout: 10000 });
  await adjustJadeButton.click();
  await page.locator('input[type="number"]').fill('5000');
  await page.getByRole('button', { name: /^设为$/ }).click();

  const jadeSpentChip = page.getByText('耗玉').locator('..');
  await expect(jadeSpentChip).toContainText('0', { timeout: 10000 });

  await expect(page.getByRole('button', { name: /十连寻访/ })).toBeEnabled({ timeout: 20000 });
  await page.getByRole('button', { name: /十连寻访/ }).click();
  await expect(page.getByText('寻访结果')).toBeVisible({ timeout: 10000 });
  await expect(jadeSpentChip).toContainText('5,000', { timeout: 10000 });

  await page.getByRole('button', { name: /^重置$/ }).click();
  await expect(page.getByText('重置模拟器')).toBeVisible({ timeout: 5000 });
  await page.getByRole('button', { name: '确认重置' }).click();
  await expect(jadeSpentChip).toContainText('0', { timeout: 10000 });
});

test('simulator reloads account-scoped resource settings when current game uid changes', async ({ page }) => {
  const [scopeAKey, scopeAValue] = buildScopedResourceSettings('uid-a', {
    baseJade: 12345,
    baseOriginite: 11,
    baseArsenalQuota: 2222
  });
  const [scopeBKey, scopeBValue] = buildScopedResourceSettings('uid-b', {
    baseJade: 67890,
    baseOriginite: 22,
    baseArsenalQuota: 3333
  });

  await page.addInitScript(({ keyA, valueA, keyB, valueB }) => {
    localStorage.setItem('lastCaptchaVerified', Date.now().toString());
    localStorage.setItem('simulator_skipAnimation', 'true');
    if (!localStorage.getItem('gacha_current_game_uid')) {
      localStorage.setItem('gacha_current_game_uid', 'uid-a');
    }
    localStorage.setItem(keyA, valueA);
    localStorage.setItem(keyB, valueB);
  }, {
    keyA: scopeAKey,
    valueA: scopeAValue,
    keyB: scopeBKey,
    valueB: scopeBValue
  });

  await page.goto(`${baseUrl}/simulator`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('累计资源')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('12,345')).toBeVisible({ timeout: 10000 });

  await page.evaluate(() => {
    localStorage.setItem('gacha_current_game_uid', 'uid-b');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('累计资源')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('67,890')).toBeVisible({ timeout: 10000 });

  await page.evaluate(() => {
    localStorage.setItem('gacha_current_game_uid', 'uid-a');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('累计资源')).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('12,345')).toBeVisible({ timeout: 10000 });
});
