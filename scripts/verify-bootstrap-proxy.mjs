import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import bootstrapHandler from '../api/_routes/root/bootstrap.js';
import statsHandler from '../api/_routes/root/stats.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distRoot = path.join(projectRoot, 'dist');
const HOST = '127.0.0.1';
const PORT = 4175;

function loadEnvFile(filePath) {
  return fs.readFile(filePath, 'utf8')
    .then((content) => {
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .forEach((line) => {
          const separatorIndex = line.indexOf('=');
          const key = line.slice(0, separatorIndex).trim();
          const value = line.slice(separatorIndex + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        });
    })
    .catch(() => {});
}

async function ensureEnvLoaded() {
  await loadEnvFile(path.join(projectRoot, 'backend', '.env.local'));
  await loadEnvFile(path.join(projectRoot, 'backend', '.env'));
  await loadEnvFile(path.join(projectRoot, '.env.local'));
  await loadEnvFile(path.join(projectRoot, '.env'));
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function augmentResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (payload) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
    return res;
  };

  return res;
}

function augmentRequest(req) {
  const requestUrl = new URL(req.url, `http://${HOST}:${PORT}`);
  req.query = Object.fromEntries(requestUrl.searchParams.entries());
  req.path = requestUrl.pathname;
  return req;
}

function getContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
  if (filePath.endsWith('.ico')) return 'image/x-icon';
  return 'application/octet-stream';
}

async function serveStatic(res, requestPath) {
  let filePath = requestPath === '/' ? '/index.html' : requestPath;
  let resolvedPath = path.normalize(path.join(distRoot, filePath));

  if (!resolvedPath.startsWith(distRoot)) {
    sendJson(res, 403, { success: false, error: 'Forbidden' });
    return;
  }

  try {
    const file = await fs.readFile(resolvedPath);
    res.statusCode = 200;
    res.setHeader('Content-Type', getContentType(resolvedPath));
    res.end(file);
    return;
  } catch {
    // BrowserRouter fallback
  }

  const indexHtml = await fs.readFile(path.join(distRoot, 'index.html'));
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(indexHtml);
}

async function startTestServer() {
  await ensureEnvLoaded();

  const server = http.createServer(async (rawReq, rawRes) => {
    const req = augmentRequest(rawReq);
    const res = augmentResponse(rawRes);

    if (req.path === '/api/bootstrap') {
      await bootstrapHandler(req, res);
      return;
    }

    if (req.path === '/api/stats') {
      await statsHandler(req, res);
      return;
    }

    await serveStatic(res, req.path);
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });

  return server;
}

function summarizeSupabaseRequests(requestUrls) {
  return requestUrls
    .filter((url) => url.includes('lluvpuesaclljbiqacts.supabase.co'))
    .map((url) => {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`;
    });
}

async function verifyBootstrapFlow() {
  const server = await startTestServer();
  const browser = await chromium.launch({ headless: true });

  const requestUrls = [];
  const baseUrl = `http://${HOST}:${PORT}`;

  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.localStorage.setItem('lastCaptchaVerified', Date.now().toString());
    });

    const page = await context.newPage();
    page.on('request', (request) => {
      requestUrls.push(request.url());
    });

    const bootstrapResponse = await page.request.get(`${baseUrl}/api/bootstrap`);
    if (!bootstrapResponse.ok()) {
      throw new Error(`/api/bootstrap returned ${bootstrapResponse.status()}`);
    }

    const bootstrapPayload = await bootstrapResponse.json();
    const bootstrapData = bootstrapPayload?.data || {};

    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);
    await page.goto(`${baseUrl}/summary`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.goto(`${baseUrl}/simulator`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const bootstrapRequests = requestUrls.filter((url) => url.includes('/api/bootstrap'));
    const urgentRequests = requestUrls.filter((url) => url.includes('/api/stats?type=urgent'));
    const supabaseRequests = summarizeSupabaseRequests(requestUrls);

    const blockedSupabasePaths = supabaseRequests.filter((entry) => (
      entry.includes('/rest/v1/site_config')
      || entry.includes('/rpc/get_app_visible_pools')
      || entry.includes('/rpc/get_global_stats')
      || entry.includes('/rpc/get_character_ranking_stats')
    ));

    if (bootstrapRequests.length === 0) {
      throw new Error('browser did not request /api/bootstrap');
    }

    if (bootstrapPayload?.partial) {
      throw new Error('/api/bootstrap returned partial=true');
    }

    if (!bootstrapData.globalSummary) {
      throw new Error('/api/bootstrap did not include globalSummary');
    }

    if (!bootstrapData.characterRanking) {
      throw new Error('/api/bootstrap did not include characterRanking');
    }

    if (!Array.isArray(bootstrapData.pools) || bootstrapData.pools.length === 0) {
      throw new Error('/api/bootstrap did not include visible pools');
    }

    if (urgentRequests.length > 0) {
      throw new Error(`legacy urgent endpoint still requested: ${urgentRequests.join(', ')}`);
    }

    if (blockedSupabasePaths.length > 0) {
      throw new Error(`public reads still hit Supabase directly: ${blockedSupabasePaths.join(', ')}`);
    }

    return {
      bootstrapPartial: Boolean(bootstrapPayload?.partial),
      bootstrapPayload,
      bootstrapRequestCount: bootstrapRequests.length,
      supabaseRequests,
      samplePoolCount: bootstrapData.pools.length
    };
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

verifyBootstrapFlow()
  .then((result) => {
    console.log('[verify-bootstrap-proxy] PASS');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    console.error('[verify-bootstrap-proxy] FAIL');
    console.error(error);
    process.exitCode = 1;
  });
