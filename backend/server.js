/**
 * 鹰角 API 代理服务器（独立部署版本）
 *
 * 可部署到 Railway, Render, Fly.io 或任何支持 Node.js 的平台
 *
 * 环境变量:
 *   PORT - 服务器端口（默认 3001）
 *   ALLOWED_ORIGINS - 允许的跨域来源，逗号分隔（默认 *）
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = process.env.PORT || 3001;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

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
 * 发起 HTTPS 请求
 */
function httpsRequest(url, options, body = null) {
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

    req.on('error', reject);

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
 * 检查是否触发风控
 */
function checkRiskControl(data) {
  if (!data) return false;

  if (typeof data === 'string' && data.includes('404')) {
    return true;
  }

  const riskCodes = [429, 403, 401];
  if (riskCodes.includes(data.code) || riskCodes.includes(data.status)) {
    return true;
  }

  const riskMessages = ['risk', 'control', '风控', '频繁', 'too many', 'rate limit'];
  const msg = (data.msg || data.message || '').toLowerCase();
  return riskMessages.some(keyword => msg.includes(keyword));
}

/**
 * 将鹰角 API 错误码转换为用户友好的错误信息
 */
function getErrorMessage(code, msg, context = '') {
  const errorMap = {
    1: 'Token已过期或账号信息不匹配，请重新获取Token',
    401: 'Token无效，请重新登录鹰角官网获取',
    403: '访问被拒绝，请检查账号状态',
    429: '请求过于频繁，请稍后再试'
  };

  const friendlyMsg = errorMap[code];
  if (friendlyMsg) {
    return friendlyMsg;
  }

  if (msg === 'OK' && code !== 0) {
    return `${context}失败 (错误码: ${code})，请检查Token是否有效`;
  }

  return msg || `${context}失败 (错误码: ${code})`;
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

    if (checkRiskControl(response.data)) {
      return sendJSON(res, 429, {
        success: false,
        error: '触发风控，请稍后重试',
        riskControl: true
      });
    }

    if (response.data.status !== 0 && response.data.code !== 0) {
      const errorMsg = getErrorMessage(response.data.code, response.data.msg, 'Token验证');
      return sendJSON(res, 400, {
        success: false,
        error: errorMsg,
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
    console.error('[Server] Grant Error:', error);
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
    const response = await httpsRequest(url, { method: 'GET' });

    if (checkRiskControl(response.data)) {
      return sendJSON(res, 429, {
        success: false,
        error: '触发风控，请稍后重试',
        riskControl: true
      });
    }

    if (typeof response.data === 'string') {
      return sendJSON(res, 500, {
        success: false,
        error: '响应格式错误（非JSON）',
        rawResponse: response.data.substring(0, 500)
      });
    }

    if (response.data.code !== 0 && response.data.status !== 0) {
      const errorMsg = getErrorMessage(response.data.code, response.data.msg, '获取账号列表');
      return sendJSON(res, 400, {
        success: false,
        error: errorMsg,
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

    const bindingList = endfieldApp.bindingList || [];
    if (bindingList.length === 0) {
      return sendJSON(res, 404, {
        success: false,
        error: '终末地账号未绑定任何角色'
      });
    }

    const accounts = bindingList.map(b => {
      const role = b.roles?.[0];
      return {
        uid: b.uid,
        isOfficial: b.isOfficial,
        channelMasterId: b.channelMasterId,
        channelName: b.channelName,
        gameUid: role?.roleId || null,
        nickName: role?.nickName || b.channelName || '未知',
        serverId: role?.serverId || '1',
        level: role?.level || 0,
        roles: b.roles?.map(r => ({
          roleId: r.roleId,
          nickName: r.nickName,
          serverId: r.serverId,
          level: r.level
        })) || []
      };
    });

    const defaultAccount = accounts[0];

    sendJSON(res, 200, {
      success: true,
      data: {
        hgUid: defaultAccount.uid,
        gameUid: defaultAccount.gameUid,
        nickName: defaultAccount.nickName,
        channelName: defaultAccount.channelName,
        channelMasterId: defaultAccount.channelMasterId,
        isOfficial: defaultAccount.isOfficial,
        serverId: defaultAccount.serverId,
        level: defaultAccount.level,
        accounts: accounts,
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
    console.error('[Server] Bindings Error:', error);
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

/**
 * 处理 u8token 请求
 */
async function handleU8Token(body, res) {
  const { uid, appToken } = body;

  if (!uid || !appToken) {
    return sendJSON(res, 400, { success: false, error: 'Missing uid or appToken' });
  }

  await delay(800, 1500);

  try {
    const response = await httpsRequest(ENDPOINTS.U8TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { uid, token: appToken });

    if (checkRiskControl(response.data)) {
      return sendJSON(res, 429, {
        success: false,
        error: '触发风控，请稍后重试',
        riskControl: true
      });
    }

    if (typeof response.data === 'string') {
      return sendJSON(res, 500, {
        success: false,
        error: '响应格式错误（非JSON）',
        rawResponse: response.data.substring(0, 500)
      });
    }

    // 使用 OR 逻辑检查错误（与 Vercel 版本一致）
    const hasError = (response.data.status !== undefined && response.data.status !== 0) ||
                     (response.data.code !== undefined && response.data.code !== 0);

    if (hasError) {
      const errorCode = response.data.code !== undefined ? response.data.code : response.data.status;
      const errorMsg = getErrorMessage(errorCode, response.data.msg, '获取访问凭证');
      return sendJSON(res, 400, {
        success: false,
        error: errorMsg,
        data: response.data
      });
    }

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
    console.error('[Server] U8Token Error:', error);
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

    const response = await httpsRequest(url, { method: 'GET' });

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
  const startTime = Date.now();

  console.log('[Server] Records-batch 开始:', {
    poolsCount: pools?.length,
    serverId,
    hasU8Token: !!u8Token
  });

  if (!u8Token) {
    return sendJSON(res, 400, { success: false, error: 'Missing u8Token' });
  }

  if (!pools || !Array.isArray(pools) || pools.length === 0) {
    return sendJSON(res, 400, { success: false, error: 'Missing or invalid pools array' });
  }

  const maxConcurrent = 4;
  if (pools.length > maxConcurrent) {
    return sendJSON(res, 400, {
      success: false,
      error: `Too many pools. Maximum ${maxConcurrent} concurrent requests allowed.`
    });
  }

  try {
    console.log('[Server] 开始并发获取', pools.length, '个卡池');

    const results = await Promise.allSettled(
      pools.map(pool =>
        fetchRecordsInternal(u8Token, pool.type, pool.poolType, serverId || '1')
      )
    );

    const successResults = [];
    const failedResults = [];
    let totalRecords = 0;

    results.forEach((result, index) => {
      const pool = pools[index];
      if (result.status === 'fulfilled') {
        successResults.push(result.value);
        totalRecords += result.value.records.length;
        console.log(`[Server] 卡池 ${pool.poolType || pool.type}: ${result.value.records.length} 条记录, ${result.value.totalPages} 页`);
      } else {
        failedResults.push({
          type: pool.type,
          poolType: pool.poolType,
          error: result.reason?.message || 'Unknown error'
        });
        console.log(`[Server] 卡池 ${pool.poolType || pool.type}: 失败 - ${result.reason?.message}`);
      }
    });

    const elapsedTime = Date.now() - startTime;
    console.log(`[Server] Records-batch 完成: 共 ${totalRecords} 条记录, 耗时 ${elapsedTime}ms`);

    if (successResults.length === 0) {
      return sendJSON(res, 500, {
        success: false,
        error: '所有卡池请求均失败',
        failed: failedResults
      });
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        results: successResults,
        totalRecords,
        failed: failedResults.length > 0 ? failedResults : undefined,
        _debug: { elapsedMs: elapsedTime }
      }
    });
  } catch (error) {
    console.error('[Server] Records-batch Error:', error);
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

/**
 * 处理 records 请求（单页）
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

    if (checkRiskControl(response.data)) {
      return sendJSON(res, 429, {
        success: false,
        error: '触发风控，请稍后重试',
        riskControl: true
      });
    }

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
    console.error('[Server] Records Error:', error);
    sendJSON(res, 500, { success: false, error: error.message });
  }
}

/**
 * 获取 CORS 允许的 Origin
 */
function getCorsOrigin(reqOrigin) {
  if (ALLOWED_ORIGINS === '*') {
    return '*';
  }
  
  // 解析允许的来源列表（去除末尾斜杠）
  const allowedList = ALLOWED_ORIGINS.split(',').map(o => o.trim().replace(/\/$/, ''));
  
  // 检查请求来源是否在允许列表中（去除末尾斜杠后比较）
  const cleanReqOrigin = (reqOrigin || '').replace(/\/$/, '');
  if (allowedList.includes(cleanReqOrigin)) {
    return cleanReqOrigin;
  }
  
  // 如果不匹配，返回第一个允许的来源
  return allowedList[0] || '*';
}

// 存储当前请求的 origin（用于 CORS）
let currentRequestOrigin = '';

/**
 * 发送 JSON 响应
 */
function sendJSON(res, status, data) {
  const origin = getCorsOrigin(currentRequestOrigin);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
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
  // 保存请求来源用于 CORS
  currentRequestOrigin = req.headers.origin || '';
  
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    const origin = getCorsOrigin(currentRequestOrigin);
    res.writeHead(200, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // 健康检查
  if (req.url === '/health' || req.url === '/') {
    return sendJSON(res, 200, {
      status: 'ok',
      service: 'hg-proxy',
      timestamp: new Date().toISOString()
    });
  }

  // 只处理 /api/hg-proxy 路径
  if (!req.url.startsWith('/api/hg-proxy')) {
    return sendJSON(res, 404, { error: 'Not found' });
  }

  const query = parseQuery(req.url);
  const { action } = query;

  console.log(`[Server] ${req.method} ${req.url} action=${action}`);

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
    console.error('[Server] Error:', error);
    sendJSON(res, 500, { success: false, error: error.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('='.repeat(60));
  console.log('  鹰角 API 代理服务器（独立部署版本）');
  console.log('='.repeat(60));
  console.log(`  端口: ${PORT}`);
  console.log(`  允许来源: ${ALLOWED_ORIGINS}`);
  console.log('  状态: 运行中');
  console.log('');
  console.log('  API 端点:');
  console.log('    POST /api/hg-proxy?action=grant');
  console.log('    GET  /api/hg-proxy?action=bindings&appToken=xxx');
  console.log('    POST /api/hg-proxy?action=u8token');
  console.log('    GET  /api/hg-proxy?action=records&u8Token=xxx');
  console.log('    POST /api/hg-proxy?action=records-batch');
  console.log('');
  console.log('  健康检查: GET /health');
  console.log('='.repeat(60));
  console.log('');
});
