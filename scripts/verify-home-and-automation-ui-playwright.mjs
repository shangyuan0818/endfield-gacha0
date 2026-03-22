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

function createBootstrapPayload() {
  return {
    success: true,
    partial: false,
    data: {
      siteConfig: {},
      pools: [],
      globalSummary: null,
      characterRanking: null,
    },
  };
}

function createStatsPayload() {
  return {
    success: true,
    data: {
      globalSummary: null,
      characterRanking: null,
    },
  };
}

function createGameAnnouncementsPayload() {
  return {
    records: [
      {
        source_id: 'game-001',
        title: '游戏公告校验样例一',
        summary: '用于验证首页折叠区',
        content: '<p>游戏公告正文一</p>',
        published_at: '2026-03-22T08:00:00.000Z',
        source_url: 'https://example.com/game-001',
      },
      {
        source_id: 'game-002',
        title: '游戏公告校验样例二',
        summary: '用于验证移动端折叠区',
        content: '<p>游戏公告正文二</p>',
        published_at: '2026-03-22T09:00:00.000Z',
        source_url: 'https://example.com/game-002',
      },
    ],
  };
}

function createAutomationRuns() {
  return [
    {
      id: 'run-official-001',
      job_id: 'official-announcements',
      job_label: '官方公告同步',
      trigger_type: 'manual',
      status: 'success',
      dry_run: true,
      source_tag: 'mock-source',
      source_url: 'https://example.com/official-feed',
      summary: {
        current: 1,
        incoming: 2,
        added: 1,
        updated: 1,
        unchanged: 0,
        removed: 0,
      },
      top_changed_fields: [
        { field: 'title', count: 1 },
        { field: 'summary', count: 1 },
      ],
      preview: {
        added: [
          {
            key: '6004',
            next: {
              title: '自动公告 B',
              version: 'mock-v2',
              published_at: '2026-03-22T08:00:00.000Z',
              source_url: 'https://example.com/6004',
              is_active: true,
            },
          },
        ],
        updated: [
          {
            key: '6003',
            changedFields: ['title'],
            current: { title: '自动公告 A-旧' },
            next: { title: '自动公告 A-新' },
          },
        ],
        removed: [],
      },
      review_bundle: {
        review: {
          status: 'pending_manual_review',
          requiresApproval: true,
          approvalMode: 'manual-review',
          appliedSourceIds: [],
          blockedSourceIds: [],
        },
        snapshots: {
          incoming: [
            {
              source_id: '6003',
              title: '自动公告 A',
              summary: '摘要 A',
              content: '<p>公告 A 正文</p>',
              version: 'mock-v1',
              published_at: '2026-03-21T08:00:00.000Z',
              source_url: 'https://example.com/6003',
              is_active: true,
            },
            {
              source_id: '6004',
              title: '自动公告 B',
              summary: '摘要 B',
              content: '<p>公告 B 正文</p>',
              version: 'mock-v2',
              published_at: '2026-03-22T08:00:00.000Z',
              source_url: 'https://example.com/6004',
              is_active: true,
            },
          ],
        },
      },
      error_message: null,
      started_at: '2026-03-22T10:00:00.000Z',
      finished_at: '2026-03-22T10:00:02.000Z',
      created_at: '2026-03-22T10:00:02.000Z',
      updated_at: '2026-03-22T10:00:02.000Z',
    },
    {
      id: 'run-pool-001',
      job_id: 'pool-schedule',
      job_label: '卡池轮换同步',
      trigger_type: 'manual',
      status: 'success',
      dry_run: true,
      source_tag: 'mock-source',
      source_url: 'https://example.com/pool-feed',
      summary: {
        current: 2,
        incoming: 2,
        added: 1,
        updated: 1,
        unchanged: 0,
        removed: 0,
      },
      top_changed_fields: [
        { field: 'start_time', count: 1 },
        { field: 'featured_characters', count: 1 },
      ],
      preview: {
        added: [],
        updated: [
          {
            key: 'limited-luoqian',
            changedFields: ['start_time', 'featured_characters'],
            current: { name: '狼珀' },
            next: { name: '狼珀' },
          },
        ],
        removed: [],
      },
      review_bundle: {
        review: {
          status: 'pending_manual_review',
          requiresApproval: true,
          approvalMode: 'manual-review',
          appliedPoolIds: [],
          blockedPoolIds: ['limited-luoqian'],
        },
        snapshots: {
          incoming: [
            {
              pool_id: 'limited-luoqian',
              name: '狼珀',
              type: 'limited',
              start_time: '2026-03-29T04:00:00.000Z',
              end_time: '2026-04-15T04:00:00.000Z',
              up_character: '洛茜',
              featured_character_names: ['洛茜', '汤汤'],
              featured_characters: ['char_tangtang'],
            },
          ],
        },
      },
      error_message: null,
      started_at: '2026-03-22T09:00:00.000Z',
      finished_at: '2026-03-22T09:00:01.000Z',
      created_at: '2026-03-22T09:00:01.000Z',
      updated_at: '2026-03-22T09:00:01.000Z',
    },
  ];
}

function createSiteAnnouncements() {
  return [
    {
      id: 'site-announcement-1',
      title: '欢迎使用抽卡分析器',
      content: '站点公告正文',
      version: '3.5.0',
      is_active: true,
      priority: 1,
      created_at: '2026-03-20T00:00:00.000Z',
      updated_at: '2026-03-20T00:00:00.000Z',
    },
  ];
}

function createAdminProfiles() {
  return [
    {
      id: 'super_admin_user',
      username: 'superadmin',
      email: 'superadmin@example.com',
      role: 'super_admin',
      created_at: '2026-03-20T00:00:00.000Z',
      updated_at: '2026-03-20T00:00:00.000Z',
      last_seen_at: '2026-03-22T10:00:00.000Z',
    },
  ];
}

function createFakeSession() {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600 * 24 * 30,
    expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 30,
    token_type: 'bearer',
    user: {
      id: 'super_admin_user',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'superadmin@example.com',
      user_metadata: {
        username: 'superadmin',
      },
    },
  };
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

function filterRelevantConsoleErrors(entries) {
  return entries.filter((entry) => !entry.includes('favicon.ico'));
}

async function installSharedMocks(page) {
  const bootstrapPayload = createBootstrapPayload();
  const statsPayload = createStatsPayload();
  const gameAnnouncementsPayload = createGameAnnouncementsPayload();

  await page.route('**/api/bootstrap**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(bootstrapPayload),
    });
  });

  await page.route('**/api/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statsPayload),
    });
  });

  await page.route('**/api/automation-feed?job=official-announcements', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(gameAnnouncementsPayload),
    });
  });
}

async function verifyHomeGameAnnouncements(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  const consoleErrors = getConsoleCollector(page);

  await page.addInitScript(() => {
    localStorage.setItem('lastCaptchaVerified', Date.now().toString());
    localStorage.removeItem('gacha_home_game_announcements_collapsed');
  });
  await installSharedMocks(page);

  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  const desktopGameAnnouncementToggle = page.getByRole('button', { name: /游戏公告.*默认折叠展示/ }).first();
  const desktopGameAnnouncementContent = desktopGameAnnouncementToggle.locator('xpath=following-sibling::div[1]');
  await desktopGameAnnouncementToggle.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(1200);

  const desktopCollapsedHeight = await desktopGameAnnouncementContent.evaluate((node) => node.getBoundingClientRect().height);
  assert.equal(
    desktopCollapsedHeight < 5,
    true,
    '桌面端首页初始状态下，游戏公告正文应保持折叠',
  );

  await desktopGameAnnouncementToggle.click();
  await page.waitForFunction((element) => element.getBoundingClientRect().height > 20, await desktopGameAnnouncementContent.elementHandle(), {
    timeout: 5000,
  });
  await page.getByText('游戏公告校验样例一').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByText('游戏公告正文一').waitFor({ state: 'visible', timeout: 5000 });
  await page.getByRole('link', { name: /查看官方原文/ }).first().waitFor({ state: 'visible', timeout: 5000 });

  const mobilePage = await context.newPage();
  const mobileConsoleErrors = getConsoleCollector(mobilePage);
  await mobilePage.setViewportSize({ width: 430, height: 932 });
  await mobilePage.addInitScript(() => {
    localStorage.setItem('lastCaptchaVerified', Date.now().toString());
    localStorage.removeItem('gacha_home_game_announcements_collapsed');
  });
  await installSharedMocks(mobilePage);

  await mobilePage.goto(`${baseUrl}/m`, { waitUntil: 'domcontentloaded' });
  const mobileGameAnnouncementToggle = mobilePage.getByRole('button', { name: /游戏公告.*默认折叠/ }).first();
  const mobileGameAnnouncementContent = mobileGameAnnouncementToggle.locator('xpath=following-sibling::div[1]');
  await mobileGameAnnouncementToggle.waitFor({ state: 'visible', timeout: 15000 });
  await mobilePage.waitForTimeout(1200);

  const mobileCollapsedHeight = await mobileGameAnnouncementContent.evaluate((node) => node.getBoundingClientRect().height);
  assert.equal(
    mobileCollapsedHeight < 5,
    true,
    '移动端首页初始状态下，游戏公告正文应保持折叠',
  );

  await mobileGameAnnouncementToggle.click();
  await mobilePage.waitForFunction((element) => element.getBoundingClientRect().height > 20, await mobileGameAnnouncementContent.elementHandle(), {
    timeout: 5000,
  });
  await mobilePage.getByText('游戏公告校验样例一').waitFor({ state: 'visible', timeout: 5000 });
  await mobilePage.getByText('游戏公告正文一').waitFor({ state: 'visible', timeout: 5000 });

  const desktopErrors = filterRelevantConsoleErrors(consoleErrors);
  const mobileErrors = filterRelevantConsoleErrors(mobileConsoleErrors);
  assert.deepEqual(desktopErrors, [], `桌面端首页控制台存在错误: ${desktopErrors.join(' | ')}`);
  assert.deepEqual(mobileErrors, [], `移动端首页控制台存在错误: ${mobileErrors.join(' | ')}`);

  await context.close();
}

async function verifyAutomationPanel(browser, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  const consoleErrors = getConsoleCollector(page);
  const fakeSession = createFakeSession();
  const adminProfiles = createAdminProfiles();
  const siteAnnouncements = createSiteAnnouncements();
  let automationRuns = createAutomationRuns();

  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });

  await page.addInitScript((session) => {
    localStorage.setItem('lastCaptchaVerified', Date.now().toString());

    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function patchedGetItem(key) {
      if (typeof key === 'string' && /^sb-.*-auth-token$/.test(key)) {
        return JSON.stringify(session);
      }

      return originalGetItem.call(this, key);
    };
  }, fakeSession);

  await installSharedMocks(page);

  await page.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: fakeSession.user.id,
        email: fakeSession.user.email,
        role: 'authenticated',
      }),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.includes('/rest/v1/profiles')) {
      const select = url.searchParams.get('select') || '';

      if (select === 'role') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ role: 'super_admin' }]),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(adminProfiles),
      });
      return;
    }

    if (url.pathname.includes('/rest/v1/announcements')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(siteAnnouncements),
      });
      return;
    }

    if (url.pathname.includes('/rest/v1/account_recovery_requests')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (url.pathname.includes('/rest/v1/ops_automation_runs')) {
      const jobFilter = url.searchParams.get('job_id');
      const rows = jobFilter && jobFilter.startsWith('eq.')
        ? automationRuns.filter((item) => item.job_id === jobFilter.slice(3))
        : automationRuns;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(rows),
      });
      return;
    }

    if (url.pathname.includes('/rest/v1/tickets') && request.method() === 'HEAD') {
      await route.fulfill({
        status: 200,
        headers: {
          'content-range': '0-0/0',
          'range-unit': 'items',
        },
        body: '',
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/admin-ops-automation**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const action = requestUrl.searchParams.get('action');

    if (action === 'run') {
      const newRun = {
        ...automationRuns[0],
        id: 'run-official-002',
        created_at: '2026-03-22T11:00:00.000Z',
        updated_at: '2026-03-22T11:00:00.000Z',
        started_at: '2026-03-22T11:00:00.000Z',
        finished_at: '2026-03-22T11:00:01.000Z',
        summary: {
          current: 2,
          incoming: 2,
          added: 0,
          updated: 1,
          unchanged: 1,
          removed: 0,
        },
        review_bundle: {
          ...automationRuns[0].review_bundle,
          review: {
            ...automationRuns[0].review_bundle.review,
            appliedSourceIds: [],
          },
        },
      };

      automationRuns = [newRun, ...automationRuns];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          dryRun: true,
          triggerType: 'manual',
          results: [
            {
              jobId: 'official-announcements',
              status: 'success',
              runId: 'run-official-002',
            },
          ],
        }),
      });
      return;
    }

    if (action === 'apply-official-announcements') {
      const body = route.request().postDataJSON();
      const selectedSourceIds = Array.isArray(body?.sourceIds) ? body.sourceIds : [];

      automationRuns = automationRuns.map((run) => (
        run.id === body?.runId
          ? {
            ...run,
            review_bundle: {
              ...run.review_bundle,
              review: {
                ...run.review_bundle.review,
                status: 'applied',
                appliedSourceIds: selectedSourceIds,
              },
            },
          }
          : run
      ));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          runId: body?.runId,
          review_status: 'applied',
          applied_source_ids: selectedSourceIds,
          blocked_source_ids: [],
          outstanding_source_ids: [],
          plan: {
            summary: {
              requested: selectedSourceIds.length,
              applicable: selectedSourceIds.length,
              blocked: 0,
            },
            requested_source_ids: selectedSourceIds,
            blocked_records: [],
            already_applied_records: [],
          },
        }),
      });
      return;
    }

    if (action === 'apply-pool-schedule') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          runId: 'run-pool-001',
          review_status: 'partially_applied',
          applied_pool_ids: [],
          blocked_pool_ids: ['limited-luoqian'],
          outstanding_pool_ids: ['limited-luoqian'],
          plan: {
            summary: {
              requested: 1,
              applicable: 0,
              blocked: 1,
            },
            requested_pool_ids: ['limited-luoqian'],
            blocked_records: [
              {
                pool_id: 'limited-luoqian',
                name: '狼珀',
                issues: [
                  {
                    code: 'unresolved_featured_characters',
                    message: '以下名称未完成规范 ID 映射：洛茜',
                  },
                ],
              },
            ],
            already_applied_records: [],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: `Unexpected admin action: ${action || 'missing'}`,
      }),
    });
  });

  await page.goto(`${baseUrl}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: '超级管理员控制台' }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: '运营自动化' }).click();

  await page.getByText('官方公告同步').first().waitFor({ state: 'visible', timeout: 10000 });
  assert.equal(
    await page.getByText('待人工审核').count() >= 1,
    true,
    '自动化面板应显示待人工审核状态',
  );

  const officialRunCardsBefore = await page.getByText('官方公告同步').count();
  await page.getByRole('button', { name: '手动 dry-run' }).click();
  await page.waitForFunction((expectedCount) => {
    return Array.from(document.querySelectorAll('button')).filter((node) => node.textContent?.includes('官方公告同步')).length >= expectedCount;
  }, officialRunCardsBefore + 1, {
    timeout: 10000,
  });

  await page.getByRole('button', { name: '全选待发布' }).click();
  await page.locator('textarea').fill('浏览器校验：发布官方公告');
  await page.getByRole('button', { name: /发布选中（2）/ }).click();
  await page.getByText('已全部发布').first().waitFor({ state: 'visible', timeout: 10000 });
  await page.getByText('已发布').first().waitFor({ state: 'visible', timeout: 10000 });

  await page.getByText('卡池轮换同步').first().click();
  await page.getByText('需人工修订').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByText('UP：洛茜').waitFor({ state: 'visible', timeout: 10000 });

  const appErrors = filterRelevantConsoleErrors(consoleErrors);
  assert.deepEqual(appErrors, [], `自动化管理面板控制台存在错误: ${appErrors.join(' | ')}`);

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
    await verifyHomeGameAnnouncements(browser, baseUrl);
    await verifyAutomationPanel(browser, baseUrl);
    console.log('HOME/AUTOMATION UI Playwright verification passed');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
