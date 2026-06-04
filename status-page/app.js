/* global window, document, fetch */

const config = window.STATUS_PAGE_CONFIG || {};
const endpoint = String(config.endpoint || 'https://ef-gacha.mogujun.icu/api/site-status').trim();
const homeUrl = String(config.homeUrl || 'https://ef-gacha.mogujun.icu/').trim();

const levelLabels = {
  ok: '运行正常',
  notice: '提示',
  warning: '需要关注',
  unknown: '无法确认',
};

function getElement(id) {
  return document.getElementById(id);
}

function formatDateTime(value) {
  if (!value) return '未知';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

function normalizeLevel(level) {
  return ['ok', 'notice', 'warning', 'unknown'].includes(level) ? level : 'unknown';
}

function setOverall(status) {
  const overall = status?.overall || {};
  const level = normalizeLevel(overall.level);
  const dot = document.querySelector('#overall-card .status-dot');
  dot.className = `status-dot status-${level}`;
  getElement('overall-label').textContent = overall.label || levelLabels[level];
  getElement('overall-time').textContent = `最近检查：${formatDateTime(status?.generatedAt || status?.meta?.generatedAt)}`;
  getElement('checked-at').textContent = formatDateTime(status?.generatedAt || status?.meta?.generatedAt);
  getElement('affected-count').textContent = String(overall.affectedCount || status?.incidents?.length || 0);
  getElement('cache-version').textContent = status?.meta?.cacheVersion || '0';
}

function renderServices(services = []) {
  const list = getElement('service-list');
  list.textContent = '';

  services.forEach((service) => {
    const level = normalizeLevel(service.status);
    const card = document.createElement('article');
    card.className = 'service-card';
    card.innerHTML = `
      <div class="service-title">
        <span class="status-dot status-${level}"></span>
        <h2></h2>
        <span class="badge badge-${level}"></span>
      </div>
      <p class="service-summary"></p>
      <p class="service-detail"></p>
      <div class="meta-line"></div>
    `;

    card.querySelector('h2').textContent = service.label || service.id || '未命名服务';
    card.querySelector('.badge').textContent = levelLabels[level];
    card.querySelector('.service-summary').textContent = service.summary || '暂无摘要。';
    const detail = card.querySelector('.service-detail');
    if (service.detail) {
      detail.textContent = service.detail;
    } else {
      detail.remove();
    }

    const meta = card.querySelector('.meta-line');
    const checked = document.createElement('span');
    checked.textContent = `检查：${formatDateTime(service.checkedAt)}`;
    meta.append(checked);
    if (service.updatedAt) {
      const updated = document.createElement('span');
      updated.textContent = `更新：${formatDateTime(service.updatedAt)}`;
      meta.append(updated);
    }

    list.append(card);
  });
}

function renderIncidents(incidents = []) {
  const list = getElement('incident-list');
  list.textContent = '';

  if (!incidents.length) {
    list.textContent = '当前没有公开故障记录。';
    return;
  }

  incidents.forEach((incident) => {
    const item = document.createElement('div');
    item.className = 'incident-item';
    const title = document.createElement('strong');
    title.textContent = incident.label || incident.serviceId || '受影响服务';
    const body = document.createElement('p');
    body.textContent = incident.summary || '该服务需要关注。';
    item.append(title, body);
    list.append(item);
  });
}

function setError(error) {
  const card = getElement('error-card');
  if (!error) {
    card.hidden = true;
    getElement('error-message').textContent = '';
    return;
  }
  card.hidden = false;
  getElement('error-message').textContent = error.message || '状态接口没有正常响应。';
}

async function loadStatus() {
  const button = getElement('refresh-button');
  button.disabled = true;
  button.textContent = '刷新中...';
  setError(null);

  try {
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.success !== true) {
      throw new Error(payload?.error || `状态接口返回 ${response.status}`);
    }
    const status = {
      ...(payload.data || {}),
      meta: payload.meta || {},
    };
    setOverall(status);
    renderServices(status.services || []);
    renderIncidents(status.incidents || []);
  } catch (error) {
    setError(error);
  } finally {
    button.disabled = false;
    button.textContent = '刷新';
  }
}

getElement('home-link').href = homeUrl;
getElement('endpoint-label').textContent = `公开状态接口：${endpoint}`;
getElement('refresh-button').addEventListener('click', loadStatus);
loadStatus();
