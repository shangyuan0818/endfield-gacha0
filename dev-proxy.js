/**
 * 本地开发代理服务器
 *
 * 用于开发环境下代理鹰角 API 请求
 * 解决浏览器 CORS 限制问题
 *
 * 使用方法:
 *   1. npm run dev (启动 Vite)
 *   2. node dev-proxy.js (启动代理服务器)
 *   3. 访问 http://localhost:5173
 *
 * @version 1.1.0 - 添加请求队列和重试机制
 * @date 2026-02-01
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';
import { globalRequestQueue } from './backend/requestQueue.js';

const PORT = 3001;

// API 端点配置
const ENDPOINTS = {
  GRANT: 'https://as.hypergryph.com/user/oauth2/v2/grant',
  BINDINGS: 'https://binding-api-account-prod.hypergryph.com/account/binding/v1/binding_list',
  U8TOKEN: 'https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid',
  RECORDS_CHAR: 'https://ef-webview.hypergryph.com/api/record/char',
  RECORDS_WEAPON: 'https://ef-webview.hypergryph.com/api/record/weapon'
};

const ENDFIELD_APP_CODE = 'be36d44aa36bfb5b';

/**
 * 发起 HTTPS 请求（带请求队列和重试机制）
 * @param {string} url - 请求 URL
 * @param {Object} options - 请求选项
 * @param {*} body - 请求体
 * @param {Object} queueOptions - 队列选项
 * @returns {Promise<Object>}
 */
function httpsRequest(url, options, body = null, queueOptions = {}) {
  // 将请求包装在队列中
  return globalRequestQueue.enqueue(
    () => httpsRequestInternal(url, options, body),
    {
      label: `${options.method || 'GET'} ${url}`,
      priority: queueOptions.priority || 10,
      maxRetries: queueOptions.maxRetries !== undefined ? queueOptions.maxRetries : 3,
      timeout: queueOptions.timeout || 30000
    }
  );
}

/**
 * 内部 HTTPS 请求实现（不带队列）
 * @private
 */
function httpsRequestInternal(url, options, body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...options.headers
      }
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      // 为网络错误添加更详细的信息
      error.isNetworkError = true;
      reject(error);
    });

    // 添加请求超时
    req.setTimeout(30000, () => {
      req.destroy();
      const timeoutError = new Error('Request timeout after 30000ms');
      timeoutError.code = 'ETIMEDOUT';
      reject(timeoutError);
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

/**
 * 随机延迟
 */
function delay(min, max) {
  return new Promise(resolve =>
    setTimeout(resolve, Math.random() * (max - min) + min)
  );
}

/**
 * 检查是否触发风控（与 Vercel 版本保持一致）
 */
function checkRiskControl(data) {
  if (!data) return false;

  // 检查常见的风控响应
  if (typeof data === 'string' && data.includes('404')) {
    return true;
  }

  // 检查特定的错误码
  const riskCodes = [429, 403, 401];
  if (riskCodes.includes(data.code) || riskCodes.includes(data.status)) {
    return true;
  }

  // 检查错误消息
  const riskMessages = ['risk', 'control', '风控', '频繁', 'too many', 'rate limit'];
  const msg = (data.msg || data.message || '').toLowerCase();
  return riskMessages.some(keyword => msg.includes(keyword));
}

/**
 * 处理 grant 请求
 */
async function handleGrant(body, res) {
  const { token } = body;

  if (!token || token.length !== 24) {
    return sendJSON(res, 400, {
      success: false,
      error: `Token格式错误：期望24位，实际${token?.length || 0}位`
    });
  }

  try {
    const response = await httpsRequest(ENDPOINTS.GRANT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      type: 1,
      appCode: ENDFIELD_APP_CODE,
      token: token
    });

    // 检查风控
    if (checkRiskControl(response.data)) {
      return sendJSON(res, 429, {
        success: false,
        error: '触发风控，请稍后重试',
        riskControl: true
      });
    }

    if (response.data.status !== 0 && response.data.code !== 0) {
      return sendJSON(res, 400, {
        success: false,
        error: response.data.msg || `Grant failed: status=${response.data.status}`,
        data: response.data
      });
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        appToken: response.data.data?.token,
        uid: response.data.data?.uid
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

/**
 * 处理 bindings 请求
 */
async function handleBindings(query, res) {
  const { appToken } = query;

  if (!appToken) {
    return sendJSON(res, 400, { success: false, error: 'Missing appToken' });
  }

  await delay(800, 1500);

  try {
    const url = `${ENDPOINTS.BINDINGS}?token=${encodeURIComponent(appToken)}&appCode=endfield`;
    console.log('[Proxy] Bindings URL:', url);

    const response = await httpsRequest(url, { method: 'GET' });
    console.log('[Proxy] Bindings Response:', JSON.stringify(response.data, null, 2));

    // 检查风控
    if (checkRiskControl(response.data)) {
      return sendJSON(res, 429, {
        success: false,
        error: '触发风控，请稍后重试',
        riskControl: true
      });
    }

    // 检查响应格式
    if (typeof response.data === 'string') {
      return sendJSON(res, 500, {
        success: false,
        error: '响应格式错误（非JSON）',
        rawResponse: response.data.substring(0, 500)
      });
    }

    if (response.data.code !== 0 && response.data.status !== 0) {
      return sendJSON(res, 400, {
        success: false,
        error: response.data.msg || response.data.message || `Bindings failed: code=${response.data.code}, status=${response.data.status}`,
        data: response.data
      });
    }

    const bindings = response.data.data?.list || [];
    const endfieldApp = bindings.find(b => b.appCode === 'endfield');

    if (!endfieldApp) {
      return sendJSON(res, 404, {
        success: false,
        error: '未找到终末地应用绑定',
        apps: bindings.map(b => ({ appCode: b.appCode, appName: b.appName }))
      });
    }

    // 获取绑定账号列表
    const bindingList = endfieldApp.bindingList || [];
    if (bindingList.length === 0) {
      return sendJSON(res, 404, {
        success: false,
        error: '终末地账号未绑定任何角色'
      });
    }

    // 构建完整的账号列表（支持多账号选择）
    const accounts = bindingList.map(b => {
      const role = b.roles?.[0];
      return {
        uid: b.uid,                          // 鹰角内部 UID（用于认证链）
        isOfficial: b.isOfficial,            // 是否官服
        channelMasterId: b.channelMasterId,  // 渠道ID：1=官服，2=B服
        channelName: b.channelName,          // 渠道名称
        gameUid: role?.roleId || null,       // 游戏内角色 UID
        nickName: role?.nickName || b.channelName || '未知',
        serverId: role?.serverId || '1',
        level: role?.level || 0,
        // 如果有多个角色
        roles: b.roles?.map(r => ({
          roleId: r.roleId,
          nickName: r.nickName,
          serverId: r.serverId,
          level: r.level
        })) || []
      };
    });

    // 默认选择第一个账号（向后兼容）
    const defaultAccount = accounts[0];

    sendJSON(res, 200, {
      success: true,
      data: {
        // 默认账号信息（向后兼容）
        hgUid: defaultAccount.uid,
        gameUid: defaultAccount.gameUid,
        nickName: defaultAccount.nickName,
        channelName: defaultAccount.channelName,
        channelMasterId: defaultAccount.channelMasterId,
        isOfficial: defaultAccount.isOfficial,
        serverId: defaultAccount.serverId,
        level: defaultAccount.level,
        // 完整账号列表（用于多账号选择）
        accounts: accounts,
        // 旧格式兼容
        bindingList: bindingList.map(b => ({
          uid: b.uid,
          channelName: b.channelName,
          isOfficial: b.isOfficial,
          channelMasterId: b.channelMasterId,
          roles: b.roles?.map(r => ({
            roleId: r.roleId,
            nickName: r.nickName,
            serverId: r.serverId,
            level: r.level
          }))
        }))
      }
    });
  } catch (error) {
    console.error('[Proxy] Bindings Error:', error);
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

/**
 * 处理 u8token 请求
 */
async function handleU8Token(body, res) {
  const { uid, appToken } = body;
  console.log('[Proxy] U8Token body:', { uid, appToken: appToken?.substring(0, 20) + '...' });

  if (!uid || !appToken) {
    return sendJSON(res, 400, { success: false, error: 'Missing uid or appToken' });
  }

  await delay(800, 1500);

  try {
    const requestBody = {
      uid: uid,
      token: appToken
    };
    console.log('[Proxy] U8Token Request:', JSON.stringify(requestBody, null, 2));

    const response = await httpsRequest(ENDPOINTS.U8TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, requestBody);

    console.log('[Proxy] U8Token Response:', JSON.stringify(response.data, null, 2));

    // 检查风控
    if (checkRiskControl(response.data)) {
      return sendJSON(res, 429, {
        success: false,
        error: '触发风控，请稍后重试',
        riskControl: true
      });
    }

    // 检查响应格式
    if (typeof response.data === 'string') {
      return sendJSON(res, 500, {
        success: false,
        error: '响应格式错误（非JSON）',
        rawResponse: response.data.substring(0, 500)
      });
    }

    if (response.data.code !== 0 && response.data.status !== 0) {
      return sendJSON(res, 400, {
        success: false,
        error: response.data.msg || response.data.message || `U8Token failed: code=${response.data.code}, status=${response.data.status}`,
        data: response.data
      });
    }

    // 检查是否有 token
    const u8Token = response.data.data?.token;
    if (!u8Token) {
      return sendJSON(res, 400, {
        success: false,
        error: '未能获取 u8_token',
        data: response.data
      });
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        u8Token: u8Token,
        uid: response.data.data?.uid
      }
    });
  } catch (error) {
    console.error('[Proxy] U8Token Error:', error);
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

/**
 * 内部函数：获取单个卡池的全部记录（自动分页）
 */
async function fetchRecordsInternal(u8Token, type, poolType, serverId = '1') {
  const allRecords = [];
  let seqId = null;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 50;

  while (hasMore && pageCount < maxPages) {
    await delay(500, 1000);

    const params = new URLSearchParams({
      token: u8Token,
      server_id: serverId,
      lang: 'zh-cn'
    });

    if (poolType) params.append('pool_type', poolType);
    if (seqId) params.append('seq_id', seqId);

    const endpoint = type === 'weapon' ? ENDPOINTS.RECORDS_WEAPON : ENDPOINTS.RECORDS_CHAR;
    const url = `${endpoint}?${params.toString()}`;

    // 使用静默模式，不输出每个请求的成功日志
    const response = await httpsRequest(url, { method: 'GET' }, null, { silent: true });

    // 检查风控（与 Vercel 版本保持一致）
    if (checkRiskControl(response.data)) {
      throw new Error('触发风控，请稍后重试');
    }

    if (typeof response.data === 'string' && response.data.includes('404')) {
      throw new Error('触发风控（404响应），请等待几分钟后重试');
    }

    if (response.data.code !== 0) {
      throw new Error(response.data.msg || `Records failed: code=${response.data.code}`);
    }

    const list = response.data.data?.list || [];
    allRecords.push(...list);

    hasMore = response.data.data?.hasMore || false;
    if (hasMore && list.length > 0) {
      seqId = list[list.length - 1].seqId || list[list.length - 1].seq_id;
    }

    pageCount++;
  }

  return {
    type,
    poolType,
    records: allRecords,
    totalPages: pageCount
  };
}

/**
 * 处理 records-batch 请求（并发获取多个卡池）
 */
async function handleRecordsBatch(body, res) {
  const { u8Token, serverId, pools } = body;

  if (!u8Token) {
    return sendJSON(res, 400, { success: false, error: 'Missing u8Token' });
  }

  if (!pools || !Array.isArray(pools) || pools.length === 0) {
    return sendJSON(res, 400, { success: false, error: 'Missing or invalid pools array' });
  }

  // 限制并发数量（4个卡池：限定、常驻、新手、武器）
  const maxConcurrent = 4;
  if (pools.length > maxConcurrent) {
    return sendJSON(res, 400, {
      success: false,
      error: `Too many pools. Maximum ${maxConcurrent} concurrent requests allowed.`
    });
  }

  try {
    console.log(`[Proxy] Records-batch 开始: ${pools.length} 个卡池并发获取`);

    const results = await Promise.allSettled(
      pools.map(pool =>
        fetchRecordsInternal(u8Token, pool.type, pool.poolType, serverId || '1')
      )
    );

    const successResults = [];
    const failedResults = [];
    let totalRecords = 0;
    const poolSummary = [];

    results.forEach((result, index) => {
      const pool = pools[index];
      if (result.status === 'fulfilled') {
        successResults.push(result.value);
        totalRecords += result.value.records.length;
        poolSummary.push(`${pool.poolType || pool.type}(${result.value.records.length}条/${result.value.totalPages}页)`);
      } else {
        failedResults.push({
          type: pool.type,
          poolType: pool.poolType,
          error: result.reason?.message || 'Unknown error'
        });
        poolSummary.push(`${pool.poolType || pool.type}(失败)`);
      }
    });

    console.log(`[Proxy] Records-batch 完成: ${poolSummary.join(', ')} | 总计 ${totalRecords} 条记录`);

    sendJSON(res, 200, {
      success: true,
      data: {
        results: successResults,
        totalRecords,
        failed: failedResults.length > 0 ? failedResults : undefined
      }
    });
  } catch (error) {
    console.error('[Proxy] Records-batch Error:', error);
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

/**
 * 处理 records 请求
 */
async function handleRecords(query, res) {
  const { u8Token, type, poolType, seqId, serverId } = query;

  if (!u8Token) {
    return sendJSON(res, 400, { success: false, error: 'Missing u8Token' });
  }

  await delay(800, 1500);

  try {
    const params = new URLSearchParams({
      token: u8Token,
      server_id: serverId || '1',
      lang: 'zh-cn'
    });

    if (poolType) params.append('pool_type', poolType);
    if (seqId) params.append('seq_id', seqId);

    const endpoint = type === 'weapon' ? ENDPOINTS.RECORDS_WEAPON : ENDPOINTS.RECORDS_CHAR;
    const url = `${endpoint}?${params.toString()}`;

    const response = await httpsRequest(url, { method: 'GET' });

    // 检查风控（与 Vercel 版本保持一致）
    if (checkRiskControl(response.data)) {
      return sendJSON(res, 429, {
        success: false,
        error: '触发风控，请稍后重试',
        riskControl: true
      });
    }

    // 检查风控（404响应）
    if (typeof response.data === 'string' && response.data.includes('404')) {
      return sendJSON(res, 429, {
        success: false,
        error: '触发风控（404响应），请等待几分钟后重试',
        riskControl: true
      });
    }

    if (response.data.code !== 0) {
      return sendJSON(res, 400, {
        success: false,
        error: response.data.msg || `Records failed: code=${response.data.code}`,
        data: response.data
      });
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        list: response.data.data?.list || [],
        hasMore: response.data.data?.hasMore || false
      }
    });
  } catch (error) {
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

/**
 * 发送 JSON 响应
 */
function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

/**
 * 解析请求体
 */
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * 解析查询参数
 */
function parseQuery(url) {
  const query = {};
  const searchParams = new URL(url, 'http://localhost').searchParams;
  for (const [key, value] of searchParams) {
    query[key] = value;
  }
  return query;
}

// 创建服务器
const server = http.createServer(async (req, res) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // 只处理 /api/hg-proxy 路径
  if (!req.url.startsWith('/api/hg-proxy')) {
    return sendJSON(res, 404, { error: 'Not found' });
  }

  const query = parseQuery(req.url);
  const { action } = query;

  console.log(`[Proxy] ${req.method} ${req.url} action=${action}`);

  try {
    switch (action) {
      case 'grant':
        const grantBody = await parseBody(req);
        await handleGrant(grantBody, res);
        break;
      case 'bindings':
        await handleBindings(query, res);
        break;
      case 'u8token':
        const u8Body = await parseBody(req);
        await handleU8Token(u8Body, res);
        break;
      case 'records':
        await handleRecords(query, res);
        break;
      case 'records-batch':
        const batchBody = await parseBody(req);
        await handleRecordsBatch(batchBody, res);
        break;
      default:
        sendJSON(res, 400, {
          success: false,
          error: 'Invalid action. Valid: grant, bindings, u8token, records, records-batch'
        });
    }
  } catch (error) {
    console.error('[Proxy] Error:', error);
    sendJSON(res, 500, { success: false, error: error.message });
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('  鹰角 API 本地代理服务器');
  console.log('='.repeat(60));
  console.log(`  地址: http://localhost:${PORT}`);
  console.log('  状态: 运行中');
  console.log('');
  console.log('  支持的 API:');
  console.log('    POST /api/hg-proxy?action=grant');
  console.log('    GET  /api/hg-proxy?action=bindings&appToken=xxx');
  console.log('    POST /api/hg-proxy?action=u8token');
  console.log('    GET  /api/hg-proxy?action=records&u8Token=xxx');
  console.log('    POST /api/hg-proxy?action=records-batch (并发批量获取)');
  console.log('');
  console.log('  按 Ctrl+C 停止服务器');
  console.log('='.repeat(60));
  console.log('');
});
