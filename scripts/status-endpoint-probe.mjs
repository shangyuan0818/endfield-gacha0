#!/usr/bin/env node

function readEnv(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function readTargets() {
  const raw = readEnv('STATUS_ENDPOINT_PROBE_TARGETS') || readEnv('STATUS_ENDPOINT_TARGETS');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return raw
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((url) => ({ url }));
  }
}

async function main() {
  const endpoint = readEnv('STATUS_ENDPOINT_PROBE_URL', 'https://ef-gacha.mogujun.icu/api/status-endpoint-probe');
  const token = readEnv('STATUS_ENDPOINT_PROBE_TOKEN') || readEnv('STATUS_PROBE_TOKEN') || readEnv('STATUS_ADMIN_TOKEN');
  if (!token) {
    throw new Error('STATUS_ENDPOINT_PROBE_TOKEN or STATUS_PROBE_TOKEN is required');
  }

  const targets = readTargets();
  const response = await fetch(endpoint, {
    method: targets ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(targets ? { 'Content-Type': 'application/json' } : {}),
    },
    body: targets ? JSON.stringify({ targets }) : undefined,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.error || `endpoint probe failed: HTTP ${response.status}`);
  }

  const services = Array.isArray(result.data?.services) ? result.data.services : [];
  const warningCount = services.filter((service) => service.status === 'warning').length;
  console.log(`STATUS endpoint probe uploaded: ${services.length} target(s), ${warningCount} warning(s)`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
