import fs from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright';

function findEdgeExecutable() {
  const candidates = [
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function preparePage(page) {
  await page.addInitScript(() => {
    localStorage.setItem('lastCaptchaVerified', Date.now().toString());
    localStorage.setItem('simulator_skipAnimation', 'true');
  });
}

async function verifySimulatorPage(page, baseUrl) {
  const consoleErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await preparePage(page);
  await page.goto(`${baseUrl}/simulator`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.textContent.includes('累计资源'), null, {
    timeout: 20000,
  });
  await page.getByRole('button', { name: /继承当前账号/ }).waitFor({
    state: 'visible',
    timeout: 10000,
  });
  await page.getByTitle('增加嵌晶玉').waitFor({
    state: 'visible',
    timeout: 10000,
  });

  const bodyText = await page.locator('body').innerText();
  assert(bodyText.includes('累计资源'), '模拟器未渲染累计资源面板');
  assert(bodyText.includes('嵌晶玉'), '模拟器未渲染嵌晶玉资源文案');
  assert(bodyText.includes('衍质源石'), '模拟器未渲染衍质源石资源文案');
  assert(bodyText.includes('武库配额'), '模拟器未渲染武库配额资源文案');
  const iconCount = await page.locator('img[src*="warfarin.wiki"]').count();
  assert(iconCount >= 3, '模拟器资源图标未正确渲染');

  await page.getByTitle('增加嵌晶玉').click();
  await page.locator('input[type="number"]').fill('1000');
  await page.getByRole('button', { name: /^增加$/ }).click();
  await page.waitForFunction(() => document.body.textContent.includes('51,000'), null, {
    timeout: 5000,
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.textContent.includes('累计资源'), null, {
    timeout: 20000,
  });
  await page.waitForFunction(() => document.body.textContent.includes('51,000'), null, {
    timeout: 10000,
  });

  await page.locator('button[title*="修改嵌晶玉"]').click();
  await page.locator('input[type="number"]').fill('0');
  await page.getByRole('button', { name: /^设为$/ }).click();

  await page.getByRole('button', { name: /十连寻访/ }).click();
  await page.getByText('确认源石换玉').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByText('今日访问不再提示').waitFor({ state: 'visible', timeout: 5000 });
  const promptBody = await page.locator('body').innerText();
  assert(promptBody.includes('67'), '站内源石换玉弹窗未展示正确的源石数量');
  await page.getByRole('button', { name: '继续寻访' }).click();
  await page.waitForFunction(() => document.body.textContent.includes('寻访结果'), null, {
    timeout: 10000,
  });

  const appErrors = consoleErrors.filter((entry) => !entry.includes('favicon.ico'));
  assert(appErrors.length === 0, `模拟器页面控制台存在错误: ${appErrors.join(' | ')}`);

  return {
    iconCount,
    persistedJadeBalance: 51000,
  };
}

async function verifySummaryPage(page, baseUrl) {
  const consoleErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await preparePage(page);
  await page.goto(`${baseUrl}/summary`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.textContent.includes('全卡池资源统计'), null, {
    timeout: 25000,
  });

  await page.getByText('全卡池资源统计').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByText('角色池资源统计').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByText('武器池资源统计').waitFor({ state: 'visible', timeout: 10000 });

  const jadeSpentCount = await page.getByText(/总消耗\s*嵌晶玉/).count();
  const originiteCount = await page.getByText(/衍质源石\s*等价/).count();
  const arsenalGainedCount = await page.getByText(/共获得\s*武库配额/).count();
  const arsenalSpentCount = await page.getByText(/总消耗\s*武库配额/).count();
  assert(jadeSpentCount >= 1, '统计页未渲染嵌晶玉消耗');
  assert(originiteCount >= 1, '统计页未渲染源石等价');
  assert(arsenalGainedCount >= 1, '统计页未渲染武库配额获得');
  assert(arsenalSpentCount >= 1, '统计页未渲染武库配额消耗');

  const iconCount = await page.locator('img[src*="warfarin.wiki"]').count();
  assert(iconCount >= 4, '统计页资源图标未正确渲染');

  const appErrors = consoleErrors.filter((entry) => !entry.includes('favicon.ico'));
  assert(appErrors.length === 0, `统计页控制台存在错误: ${appErrors.join(' | ')}`);

  return {
    iconCount,
  };
}

async function verifyScopedSimulatorStorage(page, baseUrl) {
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
  await page.waitForFunction(() => document.body.textContent.includes('累计资源'), null, {
    timeout: 20000,
  });
  await page.waitForFunction(() => document.body.textContent.includes('12,345'), null, {
    timeout: 10000,
  });

  await page.evaluate(() => {
    localStorage.setItem('gacha_current_game_uid', 'uid-b');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.textContent.includes('累计资源'), null, {
    timeout: 20000,
  });
  await page.waitForFunction(() => document.body.textContent.includes('67,890'), null, {
    timeout: 10000,
  });

  await page.evaluate(() => {
    localStorage.setItem('gacha_current_game_uid', 'uid-a');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.textContent.includes('累计资源'), null, {
    timeout: 20000,
  });
  await page.waitForFunction(() => document.body.textContent.includes('12,345'), null, {
    timeout: 10000,
  });

  return {
    uidAJade: 12345,
    uidBJade: 67890,
  };
}

async function run() {
  const executablePath = findEdgeExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

  try {
    const simulatorContext = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    });
    const simulatorPage = await simulatorContext.newPage();
    const simulator = await verifySimulatorPage(simulatorPage, baseUrl);
    await simulatorContext.close();

    const summaryContext = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    });
    const summaryPage = await summaryContext.newPage();
    const summary = await verifySummaryPage(summaryPage, baseUrl);
    await summaryContext.close();

    const scopedContext = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    });
    const scopedPage = await scopedContext.newPage();
    const scopedStorage = await verifyScopedSimulatorStorage(scopedPage, baseUrl);
    await scopedContext.close();

    console.log(JSON.stringify({
      simulator,
      summary,
      scopedStorage,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
