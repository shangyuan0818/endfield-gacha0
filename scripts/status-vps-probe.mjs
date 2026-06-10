#!/usr/bin/env node
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
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

function round(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function bytesToGiB(value) {
  const number = Number(value);
  return Number.isFinite(number) ? round(number / 1024 / 1024 / 1024, 2) : null;
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

async function readText(path) {
  try {
    return await fs.readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function parseKeyValueLines(content) {
  const result = {};
  String(content || '').split('\n').forEach((line) => {
    const match = line.match(/^([^:]+):\s*(.+)$/);
    if (match) result[match[1].trim()] = match[2].trim();
  });
  return result;
}

async function readCpuSnapshot() {
  const stat = await readText('/proc/stat');
  const line = stat.split('\n').find((item) => item.startsWith('cpu '));
  if (!line) return null;
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  if (parts.length < 4 || parts.some((value) => !Number.isFinite(value))) return null;
  const idle = parts[3] + (parts[4] || 0);
  const total = parts.reduce((sum, value) => sum + value, 0);
  return { idle, total };
}

async function collectCpuUsagePercent() {
  const first = await readCpuSnapshot();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const second = await readCpuSnapshot();
  if (!first || !second) return null;
  const idleDelta = second.idle - first.idle;
  const totalDelta = second.total - first.total;
  if (totalDelta <= 0) return null;
  return round(((totalDelta - idleDelta) / totalDelta) * 100, 2);
}

async function collectMemoryInfo() {
  const info = parseKeyValueLines(await readText('/proc/meminfo'));
  const toBytes = (key) => {
    const match = String(info[key] || '').match(/(\d+)/);
    return match ? Number(match[1]) * 1024 : null;
  };
  const total = toBytes('MemTotal') || os.totalmem();
  const available = toBytes('MemAvailable') || os.freemem();
  const swapTotal = toBytes('SwapTotal') || 0;
  const swapFree = toBytes('SwapFree') || 0;
  const used = Math.max(0, total - available);
  const swapUsed = Math.max(0, swapTotal - swapFree);
  return {
    total,
    used,
    available,
    usedPercent: total > 0 ? round((used / total) * 100, 2) : null,
    swapTotal,
    swapUsed,
    swapUsedPercent: swapTotal > 0 ? round((swapUsed / swapTotal) * 100, 2) : 0,
  };
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

async function collectSystemMetrics() {
  const memory = await collectMemoryInfo();
  const cpuUsage = await collectCpuUsagePercent();
  const load = os.loadavg?.()[0] ?? null;
  const cpuCount = os.cpus?.().length || 1;
  const loadPercent = load == null ? null : Number(((load / cpuCount) * 100).toFixed(1));

  return [
    metric('cpu-used', 'CPU 使用', cpuUsage, '%', toStatus(cpuUsage == null || cpuUsage < 95, cpuUsage != null && cpuUsage >= 80)),
    metric('memory-used', '内存使用', memory.usedPercent, '%', toStatus(memory.usedPercent == null || memory.usedPercent < 92, memory.usedPercent != null && memory.usedPercent >= 82), `${bytesToGiB(memory.used)} / ${bytesToGiB(memory.total)} GiB`),
    metric('memory-used-bytes', '内存已用', memory.used, 'B'),
    metric('memory-total-bytes', '内存总量', memory.total, 'B'),
    metric('swap-used', '虚拟内存', memory.swapUsedPercent, '%', toStatus(memory.swapUsedPercent == null || memory.swapUsedPercent < 90, memory.swapUsedPercent != null && memory.swapUsedPercent >= 70), memory.swapTotal ? `${bytesToGiB(memory.swapUsed)} / ${bytesToGiB(memory.swapTotal)} GiB` : 'no swap'),
    metric('load-1m', '1 分钟负载', loadPercent, '%', toStatus(loadPercent == null || loadPercent < 120, loadPercent != null && loadPercent >= 90)),
    metric('uptime', '系统运行时间', Number((os.uptime() / 3600).toFixed(1)), 'h'),
  ];
}

async function collectDiskMetrics() {
  const result = await runCommand('df', ['-P', '/'], 5000);
  if (!result.ok) {
    return [metric('disk-used', '根分区使用', null, '%', 'unknown', 'df_unavailable')];
  }
  const line = result.stdout.split('\n')[1] || '';
  const parts = line.trim().split(/\s+/);
  const raw = parts[4] || '';
  const used = Number(raw.replace('%', ''));
  const usedKb = Number(parts[2]);
  const totalKb = Number(parts[1]);
  return [
    metric('disk-used', '根分区使用', Number.isFinite(used) ? used : null, '%', toStatus(!Number.isFinite(used) || used < 92, Number.isFinite(used) && used >= 82), Number.isFinite(usedKb) && Number.isFinite(totalKb) ? `${bytesToGiB(usedKb * 1024)} / ${bytesToGiB(totalKb * 1024)} GiB` : ''),
    metric('disk-used-bytes', '根分区已用', Number.isFinite(usedKb) ? usedKb * 1024 : null, 'B'),
    metric('disk-total-bytes', '根分区总量', Number.isFinite(totalKb) ? totalKb * 1024 : null, 'B'),
  ];
}

async function readNetworkCounters() {
  const content = await readText('/proc/net/dev');
  const rows = String(content || '').split('\n').slice(2);
  let rx = 0;
  let tx = 0;
  for (const row of rows) {
    const [namePart, dataPart] = row.split(':');
    const name = String(namePart || '').trim();
    if (!name || name === 'lo' || !dataPart) continue;
    const values = dataPart.trim().split(/\s+/).map(Number);
    if (values.length >= 16) {
      rx += Number.isFinite(values[0]) ? values[0] : 0;
      tx += Number.isFinite(values[8]) ? values[8] : 0;
    }
  }
  return { rx, tx };
}

async function collectNetworkMetrics() {
  const first = await readNetworkCounters();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const second = await readNetworkCounters();
  const rxPerSecond = Math.max(0, second.rx - first.rx);
  const txPerSecond = Math.max(0, second.tx - first.tx);
  return [
    metric('network-rx-bps', '下载', rxPerSecond, 'B/s'),
    metric('network-tx-bps', '上传', txPerSecond, 'B/s'),
    metric('network-rx-total', '累计下载', second.rx, 'B'),
    metric('network-tx-total', '累计上传', second.tx, 'B'),
  ];
}

async function collectProcessMetric() {
  const result = await runCommand('ps', ['-e', '--no-headers'], 5000);
  if (!result.ok) {
    return metric('process-count', '进程数', null, '', 'unknown', 'ps_unavailable');
  }
  const count = result.stdout.split('\n').map((line) => line.trim()).filter(Boolean).length;
  return metric('process-count', '进程数', count, '', toStatus(count < 800, count >= 500));
}

async function collectConnectionMetrics() {
  const result = await runCommand('ss', ['-tun'], 5000);
  if (!result.ok) {
    return [
      metric('tcp-connections', 'TCP 连接', null, '', 'unknown', 'ss_unavailable'),
      metric('udp-connections', 'UDP 连接', null, '', 'unknown', 'ss_unavailable'),
    ];
  }
  const lines = result.stdout.split('\n').slice(1);
  const tcp = lines.filter((line) => line.trim().toLowerCase().startsWith('tcp')).length;
  const udp = lines.filter((line) => line.trim().toLowerCase().startsWith('udp')).length;
  return [
    metric('tcp-connections', 'TCP 连接', tcp, ''),
    metric('udp-connections', 'UDP 连接', udp, ''),
  ];
}

function collectSystemInfo() {
  const cpus = os.cpus?.() || [];
  const bootTimeMs = Date.now() - os.uptime() * 1000;
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpuModel: cpus[0]?.model || '',
    cpuCores: cpus.length || 1,
    uptimeSeconds: Math.round(os.uptime()),
    bootTime: new Date(bootTimeMs).toISOString(),
    totalMemoryBytes: os.totalmem(),
  };
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
  const [systemMetrics, diskMetrics, networkMetrics, processMetric, connectionMetrics] = await Promise.all([
    collectSystemMetrics(),
    collectDiskMetrics(),
    collectNetworkMetrics(),
    collectProcessMetric(),
    collectConnectionMetrics(),
  ]);
  const metrics = [
    ...systemMetrics,
    ...diskMetrics,
    ...networkMetrics,
    processMetric,
    ...connectionMetrics,
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
    version: 'status-vps-probe-v2',
    system: collectSystemInfo(),
    tags: readEnv('STATUS_PROBE_TAGS')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
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
