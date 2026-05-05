import { APP_BUILD_INFO, APP_VERSION_LABEL } from '../constants/appMeta.js';

const FATAL_ERROR_PATTERNS = [
  'chunkloaderror',
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'loading chunk',
  'module script',
  'cannot read properties of undefined',
  "can't access property",
  'forwardref',
  '/assets/',
];

function toPlainText(value) {
  if (value == null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.message || value.name || 'Unknown error';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getEventReason(errorLike) {
  if (!errorLike) {
    return null;
  }

  if (typeof PromiseRejectionEvent !== 'undefined' && errorLike instanceof PromiseRejectionEvent) {
    return errorLike.reason;
  }

  if (Object.prototype.hasOwnProperty.call(errorLike, 'reason')) {
    return errorLike.reason;
  }

  return null;
}

function getEventError(errorLike) {
  if (!errorLike) {
    return null;
  }

  if (typeof ErrorEvent !== 'undefined' && errorLike instanceof ErrorEvent) {
    return errorLike.error;
  }

  if (Object.prototype.hasOwnProperty.call(errorLike, 'error')) {
    return errorLike.error;
  }

  return null;
}

export function normalizeCrashError(errorLike) {
  const reason = getEventReason(errorLike);
  const eventError = getEventError(errorLike);
  const source = reason || eventError || errorLike;
  const message = (
    errorLike?.message ||
    source?.message ||
    toPlainText(source) ||
    'Unknown runtime error'
  );

  return {
    name: source?.name || errorLike?.type || 'RuntimeError',
    message,
    stack: source?.stack || errorLike?.stack || null,
    filename: errorLike?.filename || source?.filename || null,
    lineno: errorLike?.lineno ?? source?.lineno ?? null,
    colno: errorLike?.colno ?? source?.colno ?? null,
  };
}

export function isLikelyFatalRuntimeError(errorLike) {
  const details = normalizeCrashError(errorLike);
  const haystack = [
    details.name,
    details.message,
    details.stack,
    details.filename,
  ].filter(Boolean).join('\n').toLowerCase();

  return FATAL_ERROR_PATTERNS.some(pattern => haystack.includes(pattern));
}

export function buildCrashDiagnostic(errorLike, extra = {}) {
  const details = normalizeCrashError(errorLike);
  return {
    ...details,
    phase: extra.phase || 'runtime',
    route: typeof window === 'undefined' ? null : window.location.href,
    userAgent: typeof navigator === 'undefined' ? null : navigator.userAgent,
    appVersion: APP_VERSION_LABEL,
    buildInfo: APP_BUILD_INFO,
    generatedAt: new Date().toISOString(),
  };
}

function appendText(parent, tagName, text, style = '') {
  const node = document.createElement(tagName);
  if (style) {
    node.style.cssText = style;
  }
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function createButton(label, variant = 'secondary') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  const base = [
    'border: 1px solid rgba(250, 204, 21, 0.45)',
    'border-radius: 0',
    'cursor: pointer',
    'font-size: 13px',
    'font-weight: 800',
    'letter-spacing: 0.04em',
    'padding: 10px 14px',
    'text-transform: uppercase',
    'transition: opacity 160ms ease, background 160ms ease',
  ];
  const primary = [
    'background: #facc15',
    'color: #050505',
  ];
  const secondary = [
    'background: rgba(250, 204, 21, 0.08)',
    'color: #facc15',
  ];
  button.style.cssText = [...base, ...(variant === 'primary' ? primary : secondary)].join(';');
  return button;
}

async function clearBrowserRuntimeCaches() {
  const tasks = [];

  if (typeof window !== 'undefined' && 'caches' in window) {
    tasks.push(
      window.caches.keys()
        .then(keys => Promise.all(keys.map(key => window.caches.delete(key))))
    );
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    tasks.push(
      navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations.map(registration => registration.unregister())))
    );
  }

  await Promise.allSettled(tasks);
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.cssText = 'position: fixed; left: -9999px; top: -9999px;';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
  return Promise.resolve();
}

function getCrashTitle(diagnostic) {
  const message = `${diagnostic.name}\n${diagnostic.message}`.toLowerCase();

  if (
    message.includes('chunkloaderror')
    || message.includes('loading chunk')
    || message.includes('dynamically imported module')
    || message.includes('module script')
  ) {
    return '构建资源加载失败';
  }

  if (message.includes('forwardref') || message.includes('cannot read properties')) {
    return '模块初始化失败';
  }

  if (diagnostic.phase === 'bootstrap') {
    return '应用启动失败';
  }

  return '运行时崩溃';
}

export function markAppMounted() {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.getElementById('root');
  if (root) {
    root.dataset.appMounted = 'true';
  }
}

export function renderAppCrashFallback(errorLike, options = {}) {
  if (typeof document === 'undefined') {
    return false;
  }

  const root = document.getElementById('root');
  if (!root || root.dataset.crashFallbackRendered === 'true') {
    return false;
  }

  const shouldRender = options.force
    || !root.dataset.appMounted
    || isLikelyFatalRuntimeError(errorLike);

  if (!shouldRender) {
    return false;
  }

  const diagnostic = buildCrashDiagnostic(errorLike, { phase: options.phase });
  root.dataset.crashFallbackRendered = 'true';
  root.replaceChildren();

  const page = document.createElement('main');
  page.style.cssText = [
    'min-height: 100vh',
    'background: radial-gradient(circle at 20% 0%, rgba(250, 204, 21, 0.16), transparent 32%), #050506',
    'color: #f4f4f5',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'padding: 32px 16px',
    'box-sizing: border-box',
    'font-family: HarmonyOS Sans SC, HarmonyOS Sans, Source Han Sans SC, Microsoft YaHei, sans-serif',
  ].join(';');

  const panel = document.createElement('section');
  panel.style.cssText = [
    'width: min(760px, 100%)',
    'background: rgba(24, 24, 27, 0.92)',
    'border: 1px solid rgba(250, 204, 21, 0.38)',
    'box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55)',
    'padding: 28px',
    'box-sizing: border-box',
  ].join(';');

  appendText(panel, 'p', 'ENDFIELD GACHA ANALYZER', [
    'color: #facc15',
    'font-size: 12px',
    'font-weight: 900',
    'letter-spacing: 0.32em',
    'margin: 0 0 12px',
  ].join(';'));

  appendText(panel, 'h1', getCrashTitle(diagnostic), [
    'font-size: clamp(28px, 6vw, 48px)',
    'line-height: 1',
    'margin: 0 0 12px',
    'font-weight: 900',
  ].join(';'));

  appendText(panel, 'p', '页面遇到了会阻断渲染的错误。下面是可复制给管理员的诊断信息；如果这是旧资源或缓存导致的，可以先尝试强制刷新资源。', [
    'color: #a1a1aa',
    'font-size: 14px',
    'line-height: 1.8',
    'margin: 0 0 22px',
  ].join(';'));

  const grid = document.createElement('dl');
  grid.style.cssText = [
    'display: grid',
    'grid-template-columns: minmax(120px, 180px) 1fr',
    'gap: 10px 16px',
    'background: rgba(5, 5, 6, 0.7)',
    'border: 1px solid rgba(113, 113, 122, 0.45)',
    'padding: 16px',
    'margin: 0 0 18px',
    'font-size: 12px',
    'line-height: 1.7',
  ].join(';');

  [
    ['错误信息', diagnostic.message],
    ['来源文件', diagnostic.filename || '未提供'],
    ['位置', diagnostic.lineno ? `${diagnostic.lineno}:${diagnostic.colno || 0}` : '未提供'],
    ['页面', diagnostic.route || '未提供'],
    ['版本', `${diagnostic.appVersion} / ${diagnostic.buildInfo}`],
    ['时间', diagnostic.generatedAt],
  ].forEach(([label, value]) => {
    appendText(grid, 'dt', label, 'color: #71717a; font-weight: 800;');
    appendText(grid, 'dd', value, 'color: #e4e4e7; margin: 0; word-break: break-all;');
  });

  panel.appendChild(grid);

  if (diagnostic.stack) {
    appendText(panel, 'pre', diagnostic.stack, [
      'max-height: 180px',
      'overflow: auto',
      'white-space: pre-wrap',
      'word-break: break-word',
      'background: #09090b',
      'border: 1px solid rgba(113, 113, 122, 0.35)',
      'color: #a1a1aa',
      'font-size: 11px',
      'line-height: 1.55',
      'padding: 14px',
      'margin: 0 0 18px',
    ].join(';'));
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px;';

  const reloadButton = createButton('刷新页面', 'primary');
  reloadButton.addEventListener('click', () => window.location.reload());

  const recoverButton = createButton('强制刷新资源');
  recoverButton.addEventListener('click', async () => {
    recoverButton.textContent = '处理中...';
    recoverButton.disabled = true;
    await clearBrowserRuntimeCaches();
    const url = new URL(window.location.href);
    url.searchParams.set('__sw_recover', String(Date.now()));
    window.location.replace(url.toString());
  });

  const copyButton = createButton('复制诊断信息');
  copyButton.addEventListener('click', async () => {
    await copyText(JSON.stringify(diagnostic, null, 2));
    copyButton.textContent = '已复制';
    window.setTimeout(() => {
      copyButton.textContent = '复制诊断信息';
    }, 1600);
  });

  actions.append(reloadButton, recoverButton, copyButton);
  panel.appendChild(actions);
  page.appendChild(panel);
  root.appendChild(page);

  return true;
}
