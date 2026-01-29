/**
 * 鹰角 API 代理
 *
 * 代理鹰角官方 API 请求，处理 CORS 问题
 * 用于实现四层 Token 认证链
 *
 * @version 1.1.0 - 增加并发读取支持
 * @date 2026-01-27
 */

// API 端点配置
const ENDPOINTS = {
  // 步骤2: 换取 app_token
  GRANT: 'https://as.hypergryph.com/user/oauth2/v2/grant',

  // 步骤3: 获取绑定列表
  BINDINGS: 'https://binding-api-account-prod.hypergryph.com/account/binding/v1/binding_list',

  // 步骤4: 获取 u8_token
  U8TOKEN: 'https://binding-api-account-prod.hypergryph.com/account/binding/v1/u8_token_by_uid',

  // 步骤5: 获取抽卡记录
  RECORDS_CHAR: 'https://ef-webview.hypergryph.com/api/record/char',
  RECORDS_WEAPON: 'https://ef-webview.hypergryph.com/api/record/weapon'
};

// Endfield 的 appCode
const ENDFIELD_APP_CODE = 'be36d44aa36bfb5b';

/**
 * 随机延迟（风控处理）
 */
function randomDelay(min, max) {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
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

  // 如果 msg 是 "OK" 但 code 不为 0，说明是业务错误
  if (msg === 'OK' && code !== 0) {
    return `${context}失败 (错误码: ${code})，请检查Token是否有效`;
  }

  return msg || `${context}失败 (错误码: ${code})`;
}

/**
 * 主处理函数
 */
export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    switch (action) {
      case 'grant':
        return await handleGrant(req, res);
      case 'bindings':
        return await handleBindings(req, res);
      case 'u8token':
        return await handleU8Token(req, res);
      case 'records':
        return await handleRecords(req, res);
      case 'records-batch':
        // 新增：批量并发获取多个卡池的记录
        return await handleRecordsBatch(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Valid actions: grant, bindings, u8token, records, records-batch'
        });
    }
  } catch (error) {
    console.error('[hg-proxy] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}

/**
 * 步骤2: 使用初始token换取app_token
 * POST /api/hg-proxy?action=grant
 * Body: { token: "24位初始token" }
 */
async function handleGrant(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { token } = req.body || {};

  if (!token) {
    return res.status(400).json({ success: false, error: 'Missing token' });
  }

  // 验证 token 格式（24位，允许 Base64 字符）
  if (token.length !== 24) {
    return res.status(400).json({
      success: false,
      error: `Token格式错误：期望24位，实际${token.length}位`
    });
  }
  
  // 验证字符集（字母、数字、+、/、=）
  if (!/^[a-zA-Z0-9+/=]+$/.test(token)) {
    return res.status(400).json({
      success: false,
      error: 'Token格式错误：包含不支持的字符'
    });
  }

  const response = await fetch(ENDPOINTS.GRANT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: JSON.stringify({
      type: 1,
      appCode: ENDFIELD_APP_CODE,
      token: token
    })
  });

  const data = await response.json();

  // 检查风控
  if (checkRiskControl(data)) {
    return res.status(429).json({
      success: false,
      error: '触发风控，请稍后重试',
      riskControl: true
    });
  }

  if (data.status !== 0 && data.code !== 0) {
    const errorMsg = getErrorMessage(data.code, data.msg, 'Token验证');
    console.error('[hg-proxy] Grant failed:', {
      code: data.code,
      status: data.status,
      msg: data.msg,
      friendlyMsg: errorMsg
    });
    return res.status(400).json({
      success: false,
      error: errorMsg,
      details: {
        code: data.code,
        status: data.status,
        originalMessage: data.msg
      }
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      appToken: data.data?.token,
      uid: data.data?.uid
    }
  });
}

/**
 * 步骤3: 获取绑定列表
 * GET /api/hg-proxy?action=bindings&appToken=xxx
 */
async function handleBindings(req, res) {
  const { appToken } = req.query;

  if (!appToken) {
    return res.status(400).json({ success: false, error: 'Missing appToken' });
  }

  // 添加随机延迟
  await randomDelay(800, 1500);

  const url = `${ENDPOINTS.BINDINGS}?token=${encodeURIComponent(appToken)}&appCode=endfield`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const data = await response.json();

  // 检查风控
  if (checkRiskControl(data)) {
    return res.status(429).json({
      success: false,
      error: '触发风控，请稍后重试',
      riskControl: true
    });
  }

  if (data.code !== 0 && data.status !== 0) {
    const errorMsg = getErrorMessage(data.code, data.msg, '获取账号列表');
    console.error('[hg-proxy] Bindings failed:', {
      code: data.code,
      status: data.status,
      msg: data.msg,
      friendlyMsg: errorMsg
    });
    return res.status(400).json({
      success: false,
      error: errorMsg,
      details: {
        code: data.code,
        status: data.status,
        originalMessage: data.msg
      }
    });
  }

  // 提取 Endfield 绑定信息
  const bindings = data.data?.list || [];
  const endfieldApp = bindings.find(b => b.appCode === 'endfield');

  if (!endfieldApp) {
    return res.status(404).json({
      success: false,
      error: '未找到终末地应用绑定',
      apps: bindings.map(b => ({ appCode: b.appCode, appName: b.appName }))
    });
  }

  // 获取绑定账号列表
  const bindingList = endfieldApp.bindingList || [];
  if (bindingList.length === 0) {
    return res.status(404).json({
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

  return res.status(200).json({
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
}

/**
 * 步骤4: 获取 u8_token
 * POST /api/hg-proxy?action=u8token
 * Body: { uid, appToken }
 */
async function handleU8Token(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { uid, appToken } = req.body || {};

  if (!uid || !appToken) {
    return res.status(400).json({ success: false, error: 'Missing uid or appToken' });
  }

  // 添加随机延迟
  await randomDelay(800, 1500);

  const response = await fetch(ENDPOINTS.U8TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: JSON.stringify({
      uid: uid,
      token: appToken
    })
  });

  const data = await response.json();

  // 检查风控
  if (checkRiskControl(data)) {
    return res.status(429).json({
      success: false,
      error: '触发风控，请稍后重试',
      riskControl: true
    });
  }

  // 兼容两种响应格式：优先检查 status，其次检查 code
  const hasError = (data.status !== undefined && data.status !== 0) ||
                   (data.code !== undefined && data.code !== 0);

  if (hasError) {
    const errorCode = data.code !== undefined ? data.code : data.status;
    const errorMsg = getErrorMessage(errorCode, data.msg, '获取访问凭证');
    console.error('[hg-proxy] U8Token failed:', {
      code: data.code,
      status: data.status,
      msg: data.msg,
      uid: uid?.substring(0, 8) + '...',
      errorCode,
      friendlyMsg: errorMsg
    });
    return res.status(400).json({
      success: false,
      error: errorMsg,
      details: {
        code: data.code,
        status: data.status,
        originalMessage: data.msg,
        hint: errorCode === 1 ? 'Token可能已过期或账号不匹配，请重新获取24位Token' : undefined
      }
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      u8Token: data.data?.token,
      uid: data.data?.uid
    }
  });
}

/**
 * 步骤5: 获取抽卡记录
 * GET /api/hg-proxy?action=records&u8Token=xxx&type=char|weapon&poolType=xxx&seqId=xxx
 */
async function handleRecords(req, res) {
  const { u8Token, type, poolType, seqId, serverId } = req.query;

  if (!u8Token) {
    return res.status(400).json({ success: false, error: 'Missing u8Token' });
  }

  // 添加随机延迟（防风控）
  await randomDelay(800, 1500);

  // 构建请求参数
  const params = new URLSearchParams({
    token: u8Token,
    server_id: serverId || '1',
    lang: 'zh-cn'
  });

  if (poolType) {
    params.append('pool_type', poolType);
  }
  if (seqId) {
    params.append('seq_id', seqId);
  }

  // 选择端点
  const endpoint = type === 'weapon' ? ENDPOINTS.RECORDS_WEAPON : ENDPOINTS.RECORDS_CHAR;
  const url = `${endpoint}?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    }
  });

  // 检查是否是风控页面（404 page not found）
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    if (text.includes('404 page not found') || text.includes('404')) {
      return res.status(429).json({
        success: false,
        error: '触发风控（404响应），请等待几分钟后重试',
        riskControl: true
      });
    }
    return res.status(500).json({
      success: false,
      error: `非JSON响应: ${text.substring(0, 200)}`
    });
  }

  const data = await response.json();

  // 检查风控
  if (checkRiskControl(data)) {
    return res.status(429).json({
      success: false,
      error: '触发风控，请稍后重试',
      riskControl: true
    });
  }

  if (data.code !== 0) {
    const errorMsg = getErrorMessage(data.code, data.msg, '获取抽卡记录');
    console.error('[hg-proxy] Records failed:', {
      code: data.code,
      msg: data.msg,
      type,
      poolType,
      friendlyMsg: errorMsg
    });
    return res.status(400).json({
      success: false,
      error: errorMsg,
      details: {
        code: data.code,
        originalMessage: data.msg
      }
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      list: data.data?.list || [],
      hasMore: data.data?.hasMore || false
    }
  });
}

/**
 * 检查是否触发风控
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
 * 内部函数：获取单个卡池的记录（不发送响应）
 */
async function fetchRecordsInternal(u8Token, type, poolType, serverId = '1') {
  const allRecords = [];
  let seqId = null;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 50; // 防止无限循环

  while (hasMore && pageCount < maxPages) {
    // 添加随机延迟（防风控）- 并发时稍微增加延迟
    await randomDelay(500, 1000);

    // 构建请求参数
    const params = new URLSearchParams({
      token: u8Token,
      server_id: serverId,
      lang: 'zh-cn'
    });

    if (poolType) {
      params.append('pool_type', poolType);
    }
    if (seqId) {
      params.append('seq_id', seqId);
    }

    // 选择端点
    const endpoint = type === 'weapon' ? ENDPOINTS.RECORDS_WEAPON : ENDPOINTS.RECORDS_CHAR;
    const url = `${endpoint}?${params.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    // 检查是否是风控页面
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      if (text.includes('404')) {
        throw new Error('触发风控（404响应），请等待几分钟后重试');
      }
      throw new Error(`非JSON响应: ${text.substring(0, 100)}`);
    }

    const data = await response.json();

    if (checkRiskControl(data)) {
      throw new Error('触发风控，请稍后重试');
    }

    if (data.code !== 0) {
      throw new Error(data.msg || `Records failed: code=${data.code}`);
    }

    const list = data.data?.list || [];
    allRecords.push(...list);

    // 检查是否有更多数据
    hasMore = data.data?.hasMore || false;
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
 * 批量并发获取多个卡池的记录
 * POST /api/hg-proxy?action=records-batch
 * Body: {
 *   u8Token: string,
 *   serverId?: string,
 *   pools: [{ type: 'char'|'weapon', poolType?: string }]
 * }
 *
 * 特点：
 * - 同时请求角色池和武器池
 * - 每个卡池类型内部串行分页，不同类型间并发
 * - 适当的延迟控制，降低风控风险
 */
async function handleRecordsBatch(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { u8Token, serverId, pools } = req.body || {};
  const startTime = Date.now();

  console.log('[hg-proxy] Records-batch 开始:', {
    poolsCount: pools?.length,
    serverId,
    hasU8Token: !!u8Token
  });

  if (!u8Token) {
    return res.status(400).json({ success: false, error: 'Missing u8Token' });
  }

  if (!pools || !Array.isArray(pools) || pools.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing or invalid pools array' });
  }

  // 限制并发数量（4个卡池：限定、常驻、新手、武器）
  const maxConcurrent = 4;
  if (pools.length > maxConcurrent) {
    return res.status(400).json({
      success: false,
      error: `Too many pools. Maximum ${maxConcurrent} concurrent requests allowed.`
    });
  }

  try {
    console.log('[hg-proxy] 开始并发获取', pools.length, '个卡池');

    // 并发获取所有卡池数据
    const results = await Promise.allSettled(
      pools.map(pool =>
        fetchRecordsInternal(u8Token, pool.type, pool.poolType, serverId || '1')
      )
    );

    // 处理结果
    const successResults = [];
    const failedResults = [];
    let totalRecords = 0;

    results.forEach((result, index) => {
      const pool = pools[index];
      if (result.status === 'fulfilled') {
        successResults.push(result.value);
        totalRecords += result.value.records.length;
        console.log(`[hg-proxy] 卡池 ${pool.poolType || pool.type}: ${result.value.records.length} 条记录, ${result.value.totalPages} 页`);
      } else {
        failedResults.push({
          type: pool.type,
          poolType: pool.poolType,
          error: result.reason?.message || 'Unknown error'
        });
        console.log(`[hg-proxy] 卡池 ${pool.poolType || pool.type}: 失败 - ${result.reason?.message}`);
      }
    });

    const elapsedTime = Date.now() - startTime;
    console.log(`[hg-proxy] Records-batch 完成: 共 ${totalRecords} 条记录, 耗时 ${elapsedTime}ms`);

    // 如果全部失败
    if (successResults.length === 0) {
      return res.status(500).json({
        success: false,
        error: '所有卡池请求均失败',
        failed: failedResults
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        results: successResults,
        totalRecords,
        failed: failedResults.length > 0 ? failedResults : undefined,
        _debug: { elapsedMs: elapsedTime }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || 'Batch request failed'
    });
  }
}
