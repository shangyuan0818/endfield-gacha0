import { fetchWithTimeout } from '../supabaseRequest.js';
import { getSupabaseAccessToken } from '../authFetchService.js';

export async function loadSiteHealth() {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/admin?route=site-health', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }, {
    label: 'admin-site-health',
    timeoutMs: 45000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '站点健康状态读取失败');
  }

  return result.health || null;
}

export async function drainMailOutbox() {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/admin?route=mail-outbox-drain', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ source: 'admin-mail-status-panel' }),
  }, {
    label: 'admin-mail-outbox-drain',
    timeoutMs: 120000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || result?.result?.code || '邮件队列处理失败');
  }

  return result.result || null;
}

export async function sendMailSmokeTest({ recipientEmail, locale = 'zh-CN' } = {}) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/admin?route=mail-smoke-test', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipientEmail,
      locale,
    }),
  }, {
    label: 'admin-mail-smoke-test',
    timeoutMs: 120000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || result?.result?.code || '测试邮件发送失败');
  }

  return result.result || null;
}

export async function sendAdminAlertMail({ summary, secondary, locale = 'zh-CN' } = {}) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/admin?route=mail-alert', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      secondary,
      locale,
    }),
  }, {
    label: 'admin-mail-alert',
    timeoutMs: 45000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || result?.mailNotification?.code || '管理员告警邮件入队失败');
  }

  return result.mailNotification || null;
}

export async function updateMailRuntimeConfig(payload = {}) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/admin?route=mail-runtime-config', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, {
    label: 'admin-mail-runtime-config',
    timeoutMs: 45000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '邮件运行期开关保存失败');
  }

  return result.runtime || null;
}

export async function updateMailBudgetConfig(payload = {}) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error('当前登录已失效，请重新登录后重试');
  }

  const response = await fetchWithTimeout('/api/admin?route=mail-budget-config', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, {
    label: 'admin-mail-budget-config',
    timeoutMs: 45000,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || '邮件预算配置保存失败');
  }

  return result.updated || [];
}

export default {
  drainMailOutbox,
  loadSiteHealth,
  sendAdminAlertMail,
  sendMailSmokeTest,
  updateMailBudgetConfig,
  updateMailRuntimeConfig,
};
