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

async function waitForPuzzle(page, expectedPath) {
  const consoleErrors = [];
  const requestLog = [];
  const responseLog = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/rest/v1/puzzles')) {
      requestLog.push(url);
    }
  });

  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/rest/v1/puzzles')) {
      responseLog.push(`${response.status()} ${url}`);
    }
  });

  await page.addInitScript(() => {
    localStorage.removeItem('lastCaptchaVerified');
    localStorage.setItem('captchaModePreference', 'puzzle');
    localStorage.setItem('puzzleCaptchaDifficulty', '1');
  });

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173';
  await page.goto(`${baseUrl}${expectedPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.textContent.includes('验证切换'), null, {
    timeout: 15000,
  });
  await page.waitForFunction(() => document.body.textContent.includes('同步拼图题库'), null, {
    timeout: 15000,
  });
  await page.waitForFunction(() => !document.body.textContent.includes('同步拼图题库'), null, {
    timeout: 20000,
  });
  await page.waitForFunction(() => /#\d+/.test(document.body.textContent), null, {
    timeout: 10000,
  });

  const bodyText = await page.locator('body').innerText();
  assert(/#\d+/.test(bodyText), '未渲染出拼图题号');
  assert(bodyText.includes('ORACLE PUZZLE ACCESS'), '未渲染 demo 顶部标题');
  assert(bodyText.includes('换一题'), '未渲染拼图操作按钮');
  assert(bodyText.includes('难度：简单'), '未渲染难度切换按钮');
  assert(bodyText.includes('显示数字'), '未渲染约束切换按钮');
  assert(bodyText.includes('前往游玩站'), '未渲染游玩站跳转按钮');
  assert(bodyText.includes('拼图模块'), '未渲染右侧拼图模块卡');
  assert(bodyText.includes('HINT LOCKED') || bodyText.includes('HINT ONLINE'), '未渲染左侧提示卡');
  assert(requestLog.length > 0, '未观察到拼图题库请求发出');
  assert(responseLog.some((entry) => entry.startsWith('200 ')), '未观察到拼图题库 200 响应');

  const appErrors = consoleErrors.filter((entry) => !entry.includes('favicon.ico'));
  assert(appErrors.length === 0, `控制台存在错误: ${appErrors.join(' | ')}`);

  return {
    requestLog,
    responseLog,
    matchedPuzzle: bodyText.match(/#\d+/)?.[0] ?? '',
  };
}

async function run() {
  const executablePath = findEdgeExecutable();
  const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });

  try {
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    });
    const desktopPage = await desktopContext.newPage();
    const desktop = await waitForPuzzle(desktopPage, '/');
    await desktopContext.close();

    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    const mobile = await waitForPuzzle(mobilePage, '/m');
    await mobileContext.close();

    console.log(JSON.stringify({
      desktop,
      mobile,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
