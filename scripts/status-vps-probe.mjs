#!/usr/bin/env node
import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function readEnv(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function toStatus(ok, warning = false) {
  if (!ok) return 'warning';
  return warning ? 'notice' : 'ok';
}

function metric(id, label, value, unit, status = 'ok', summary = '') {
  return { id, label, value, unit, status, summary };
}

function check(id, label, status, summary = '', latencyMs = null) {
  return { id, label, status, summary, latencyMs };
}

async function runCommand(command, args = [], timeout = 5000) {
  try {
    const started = Date.now();
    const { stdout } = await execFileAsync(command, args, {
      timeout,
      windowsHide: true,
      maxBuffer: 512 * 1024,
    });
    return {
      ok: true,
      stdout: String(stdout || '').trim(),
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ok: false,
      stdout: '',
      latencyMs: null,
      error: error?.code || error?.message || 'command_failed',
    };
  }
}

async function checkHttp(id, label, url, timeout = 6000) {
  if (!url) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });
    return check(
      id,
      label,
      response.ok ? 'ok' : 'warning',
      response.ok ? `HTTP ${response.status}` : `HTTP ${response.status}`,
      Date.now() - started
    );
  } catch (error) {
    return check(id, label, 'warning', error?.name === 'AbortError' ? 'timeout' : 'request_failed', Date.now() - started);
  } finally {
    clearTimeout(timer);
  }
}

async function collectDockerChecks() {
  const names = readEnv('STATUS_PROBE_DOCKER_CONTAINERS')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!names.length) {
    return [];
  }

  const output = await runCommand('docker', ['ps', '--format', '{{.Names}}\t{{.Status}}'], 5000);
  if (!output.ok) {
    return [check('docker', 'Docker', 'warning', output.error || 'docker_unavailable')];
  }

  const lines = output.stdout.split('\n').map((line) => line.trim()).filter(Boolean);
  const statusMap = new Map(lines.map((line) => {
    const [name, status] = line.split('\t');
    return [name, status || 'unknown'];
  }));

  return names.map((name) => {
    const status = statusMap.get(name);
    return check(
      `docker-${name}`,
      `容器 ${name}`,
      status ? 'ok' : 'warning',
      status ? '运行中' : '未在 docker ps 中出现'
    );
  });
}

function collectSystemMetrics() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedPercent = totalMem > 0 ? Number((((totalMem - freeMem) / totalMem) * 100).toFixed(1)) : null;
  const load = os.loadavg?.()[0] ?? null;
  const cpuCount = os.cpus?.().length || 1;
  const loadPercent = load == null ? null : Number(((load / cpuCount) * 100).toFixed(1));

  return [
    metric('memory-used', '内存使用', usedPercent, '%', toStatus(usedPercent == null || usedPercent < 92, usedPercent != null && usedPercent >= 82)),
    metric('load-1m', '1 分钟负载', loadPercent, '%', toStatus(loadPercent == null || loadPercent < 120, loadPercent != null && loadPercent >= 90)),
    metric('uptime', '系统运行时间', Number((os.uptime() / 3600).toFixed(1)), 'h'),
  ];
}

async function collectDiskMetric() {
  const result = await runCommand('df', ['-P', '/'], 5000);
  if (!result.ok) {
    return metric('disk-used', '根分区使用', null, '%', 'unknown', 'df_unavailable');
  }
  const line = result.stdout.split('\n')[1] || '';
  const parts = line.trim().split(/\s+/);
  const raw = parts[4] || '';
  const used = Number(raw.replace('%', ''));
  return metric('disk-used', '根分区使用', Number.isFinite(used) ? used : null, '%', toStatus(!Number.isFinite(used) || used < 92, Number.isFinite(used) && used >= 82));
}

async function collectChecks() {
  const urls = [
    ['backend-health', '导入后端', readEnv('STATUS_PROBE_BACKEND_HEALTH_URL')],
    ['supabase-health', 'Supabase 网关', readEnv('STATUS_PROBE_SUPABASE_HEALTH_URL')],
    ['mail-health', '邮件服务面板', readEnv('STATUS_PROBE_MAIL_HEALTH_URL')],
  ];

  const httpChecks = (await Promise.all(urls.map(([id, label, url]) => checkHttp(id, label, url)))).filter(Boolean);
  const dockerChecks = await collectDockerChecks();
  return [
    check('host', 'VPS 主机', 'ok', os.hostname()),
    ...httpChecks,
    ...dockerChecks,
  ];
}

async function main() {
  const endpoint = readEnv('STATUS_PROBE_ENDPOINT', 'https://ef-gacha.mogujun.icu/api/status-probe');
  const token = readEnv('STATUS_PROBE_TOKEN');
  if (!token) {
    throw new Error('STATUS_PROBE_TOKEN is required');
  }

  const checks = await collectChecks();
  const metrics = [
    ...collectSystemMetrics(),
    await collectDiskMetric(),
  ];
  const hasWarning = checks.some((item) => item.status === 'warning') || metrics.some((item) => item.status === 'warning');
  const hasNotice = checks.some((item) => item.status === 'notice') || metrics.some((item) => item.status === 'notice');

  const payload = {
    probeId: readEnv('STATUS_PROBE_ID', os.hostname()),
    label: readEnv('STATUS_PROBE_LABEL', os.hostname()),
    region: readEnv('STATUS_PROBE_REGION', ''),
    status: hasWarning ? 'warning' : hasNotice ? 'notice' : 'ok',
    summary: hasWarning ? 'VPS 探针发现需要处理的项目。' : hasNotice ? 'VPS 探针存在提示项。' : 'VPS 探针运行正常。',
    reportedAt: new Date().toISOString(),
    version: 'status-vps-probe-v1',
    checks,
    metrics,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || `probe upload failed: HTTP ${response.status}`);
  }

  console.log(`STATUS probe uploaded: ${payload.probeId}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
