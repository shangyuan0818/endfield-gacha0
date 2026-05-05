// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildCrashDiagnostic,
  isLikelyFatalRuntimeError,
  markAppMounted,
  normalizeCrashError,
  renderAppCrashFallback,
} from '../appCrashFallback.js';

function installRoot() {
  document.body.innerHTML = '<div id="root"></div>';
  window.history.replaceState({}, '', '/dashboard?tab=stats');
  return document.getElementById('root');
}

describe('app crash fallback', () => {
  beforeEach(() => {
    installRoot();
  });

  it('normalizes module initialization errors and flags forwardRef crashes as fatal', () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'forwardRef')");

    expect(normalizeCrashError(error)).toMatchObject({
      name: 'TypeError',
      message: "Cannot read properties of undefined (reading 'forwardRef')",
    });
    expect(isLikelyFatalRuntimeError(error)).toBe(true);
  });

  it('renders a forced bootstrap fallback with diagnostic metadata', () => {
    const root = document.getElementById('root');
    const error = new Error('Failed to fetch dynamically imported module: /assets/index.js');

    const rendered = renderAppCrashFallback(error, {
      phase: 'bootstrap',
      force: true,
    });

    expect(rendered).toBe(true);
    expect(root.dataset.crashFallbackRendered).toBe('true');
    expect(root.textContent).toContain('构建资源加载失败');
    expect(root.textContent).toContain('Failed to fetch dynamically imported module');
    expect(root.textContent).toContain('/dashboard?tab=stats');
    expect(root.textContent).toContain('复制诊断信息');
  });

  it('does not replace a mounted app for non-fatal runtime errors', () => {
    const root = document.getElementById('root');
    root.textContent = '正常页面';
    markAppMounted();

    const rendered = renderAppCrashFallback(new Error('Minor widget warning'), {
      phase: 'runtime',
    });

    expect(rendered).toBe(false);
    expect(root.textContent).toBe('正常页面');
    expect(root.dataset.crashFallbackRendered).toBeUndefined();
  });

  it('can replace a mounted app for fatal dynamic chunk failures', () => {
    const root = document.getElementById('root');
    root.textContent = '正常页面';
    markAppMounted();

    const rendered = renderAppCrashFallback(new Error('Loading chunk charts-vendor failed'), {
      phase: 'runtime',
    });

    expect(rendered).toBe(true);
    expect(root.textContent).toContain('构建资源加载失败');
    expect(root.textContent).not.toBe('正常页面');
  });

  it('builds copyable diagnostics for rejected module load events', () => {
    const reason = new Error('Importing a module script failed: /assets/MobileApp.js');
    const diagnostic = buildCrashDiagnostic({
      type: 'unhandledrejection',
      reason,
    }, {
      phase: 'runtime',
    });

    expect(diagnostic).toMatchObject({
      name: 'Error',
      message: 'Importing a module script failed: /assets/MobileApp.js',
      phase: 'runtime',
      route: expect.stringContaining('/dashboard?tab=stats'),
      appVersion: expect.stringMatching(/^v\d+\.\d+\.\d+/),
      generatedAt: expect.any(String),
    });
    expect(isLikelyFatalRuntimeError({ reason })).toBe(true);
  });
});
