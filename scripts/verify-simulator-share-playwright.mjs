import assert from 'node:assert/strict';
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

function getConsoleCollector(page) {
  const consoleErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  return consoleErrors;
}

async function waitForSimulatorReady(page, baseUrl) {
  await page.goto(`${baseUrl}/simulator`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.textContent.includes('累计资源'), null, {
    timeout: 20000,
  });
  await page.getByRole('button', { name: /分享/ }).waitFor({
    state: 'visible',
    timeout: 10000,
  });
}

async function verifyDownloadFallback(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const consoleErrors = getConsoleCollector(page);

  await page.addInitScript(() => {
    localStorage.setItem('lastCaptchaVerified', Date.now().toString());
    localStorage.setItem('simulator_skipAnimation', 'true');

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: undefined,
    });

    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: undefined,
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__lastCopiedText = text;
        },
      },
    });
  });

  await waitForSimulatorReady(page, baseUrl);
  await page.getByRole('button', { name: /分享/ }).click();
  await page.getByRole('button', { name: '下载分享卡 PNG' }).waitFor({
    state: 'visible',
    timeout: 5000,
  });
  await page.getByRole('button', { name: '复制分享文本' }).waitFor({
    state: 'visible',
    timeout: 5000,
  });

  const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
  await page.getByRole('button', { name: '下载分享卡 PNG' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  assert.ok(download.suggestedFilename().endsWith('.png'), '分享卡下载文件必须为 PNG');
  assert.ok(downloadPath, '分享卡下载必须生成实际文件');

  await page.getByRole('button', { name: /分享/ }).click();
  await page.getByRole('button', { name: '复制分享文本' }).click();
  await page.waitForFunction(() => typeof window.__lastCopiedText === 'string' && window.__lastCopiedText.length > 0, null, {
    timeout: 5000,
  });
  const copiedText = await page.evaluate(() => window.__lastCopiedText);

  assert.match(copiedText, /已脱敏分享卡/);
  assert.match(copiedText, /不含账号、UID、时间戳与资源明细/);
  assert.equal(/UID:\s*\d+/.test(copiedText), false, '分享文本不应包含 UID');

  const appErrors = consoleErrors.filter((entry) => !entry.includes('favicon.ico'));
  assert.deepEqual(appErrors, [], `分享下载 fallback 路径存在控制台错误: ${appErrors.join(' | ')}`);

  await context.close();
}

async function verifyNativeShare(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  const consoleErrors = getConsoleCollector(page);

  await page.addInitScript(() => {
    localStorage.setItem('lastCaptchaVerified', Date.now().toString());
    localStorage.setItem('simulator_skipAnimation', 'true');

    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (payload) => {
        window.__sharedPayload = {
          title: payload.title,
          text: payload.text,
          files: Array.isArray(payload.files)
            ? payload.files.map((file) => ({
              name: file.name,
              type: file.type,
              size: file.size,
            }))
            : [],
        };
      },
    });

    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: (payload) => Array.isArray(payload?.files) && payload.files.length > 0,
    });
  });

  await waitForSimulatorReady(page, baseUrl);
  await page.getByRole('button', { name: /分享/ }).click();
  await page.getByRole('button', { name: '系统分享图片' }).waitFor({
    state: 'visible',
    timeout: 5000,
  });
  await page.getByRole('button', { name: '系统分享图片' }).click();
  await page.waitForFunction(() => window.__sharedPayload?.files?.length === 1, null, {
    timeout: 10000,
  });

  const sharedPayload = await page.evaluate(() => window.__sharedPayload);
  assert.equal(sharedPayload.files.length, 1, '系统分享必须附带 1 个图片文件');
  assert.ok(sharedPayload.files[0].name.endsWith('.png'), '系统分享文件必须为 PNG');
  assert.match(sharedPayload.text, /已脱敏分享卡/);
  assert.equal(/UID:\s*\d+/.test(sharedPayload.text), false, '系统分享文本不应包含真实 UID');

  const appErrors = consoleErrors.filter((entry) => !entry.includes('favicon.ico'));
  assert.deepEqual(appErrors, [], `系统分享路径存在控制台错误: ${appErrors.join(' | ')}`);

  await context.close();
}

async function run() {
  const executablePath = findEdgeExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';

  try {
    await verifyDownloadFallback(browser, baseUrl);
    await verifyNativeShare(browser, baseUrl);
    console.log('FEAT-003 simulator share Playwright verification passed');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
