/**
 * 终末地认证链工具
 *
 * 通过 Vercel 代理实现四层 Token 认证链
 * 从 24 位初始 token 自动获取 u8_token
 *
 * 认证流程：
 * 1. 用户登录鹰角官网获取 24 位 token
 * 2. grant: 24位token → app_token
 * 3. bindings: app_token → hgUid
 * 4. u8token: hgUid + app_token → u8_token
 * 5. records: u8_token → 抽卡记录
 *
 * @version 1.1.0 - 添加请求队列和重试机制
 * @date 2026-02-01
 */

import { queuedFetch } from './requestQueue.js';

// API 代理地址
// 支持通过环境变量配置外部后端服务器
const PROXY_BASE = import.meta.env.VITE_PROXY_URL 
  ? `${import.meta.env.VITE_PROXY_URL.replace(/\/+$/, '')}/api/hg-proxy`  // 自动去除末尾斜杠
  : '/api/hg-proxy';

// 调试：打印当前使用的代理地址
console.log('[AuthChain] VITE_PROXY_URL:', import.meta.env.VITE_PROXY_URL);
console.log('[AuthChain] PROXY_BASE:', PROXY_BASE);

// 卡池类型
export const POOL_TYPES = {
  CHARACTER: {
    SPECIAL: 'E_CharacterGachaPoolType_Special',   // 限定池（特许寻访）
    STANDARD: 'E_CharacterGachaPoolType_Standard', // 常驻池（基础寻访）
    BEGINNER: 'E_CharacterGachaPoolType_Beginner'  // 新手池（启程寻访）
  }
};

/**
 * 认证链错误
 */
export class AuthChainError extends Error {
  constructor(message, step, data = null) {
    super(message);
    this.name = 'AuthChainError';
    this.step = step;
    this.data = data;
  }
}

/**
 * 风控错误
 */
export class RiskControlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RiskControlError';
  }
}

/**
 * 服务器连接错误
 */
export class ServerConnectionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ServerConnectionError';
  }
}

/**
 * 网络连接错误（用户友好提示）
 */
export class NetworkConnectionError extends Error {
  constructor(originalMessage) {
    const friendlyMessage =
      '网络连接失败，请尝试以下方法：\n' +
      '• 检查网络连接是否正常\n' +
      '• 如果使用公司/学校网络，可能被防火墙拦截，请尝试使用手机热点\n' +
      '• 尝试更换网络环境后重试\n' +
      '• 刷新页面后重试';
    super(friendlyMessage);
    this.name = 'NetworkConnectionError';
    this.originalMessage = originalMessage;
  }
}

/**
 * 安全解析 JSON 响应
 * @param {Response} response - fetch 响应对象
 * @param {string} context - 上下文描述（用于错误信息）
 * @returns {Promise<object>}
 */
async function safeParseJSON(response, context = 'API') {
  // 检查响应状态
  if (!response.ok && response.status === 0) {
    throw new ServerConnectionError(
      '无法连接到代理服务器，请确认你已经接入单独维护的私有代理服务'
    );
  }

  // 获取响应文本
  const text = await response.text();

  // 检查是否为空响应
  if (!text || text.trim() === '') {
    throw new ServerConnectionError(
      `${context}返回空响应，请检查私有代理服务是否正常运行`
    );
  }

  // 尝试解析 JSON
  try {
    return JSON.parse(text);
  } catch {
    // JSON 解析失败
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new ServerConnectionError(
        `${context}返回了 HTML 页面而非 JSON，可能是私有代理未启动或路由配置错误`
      );
    }
    throw new ServerConnectionError(
      `${context}返回了无效的 JSON 数据，请检查私有代理服务状态。原始响应: ${text.substring(0, 100)}...`
    );
  }
}

/**
 * 步骤2: 使用 24 位 token 换取 app_token
 * @param {string} initialToken - 24位初始token
 * @returns {Promise<{appToken: string, uid: string}>}
 */
export async function grantAppToken(initialToken) {
  // 🔧 修复：使用请求队列和重试机制
  const response = await queuedFetch(`${PROXY_BASE}?action=grant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token: initialToken })
  }, {
    priority: 1, // 高优先级（认证链第一步）
    maxRetries: 3,
    timeout: 30000
  });

  const result = await safeParseJSON(response, 'Grant API');

  if (result.riskControl) {
    throw new RiskControlError(result.error);
  }

  if (!result.success) {
    throw new AuthChainError(result.error || 'Grant failed', 'grant', result);
  }

  return result.data;
}

/**
 * 步骤3: 获取绑定列表（获取 hgUid 和 gameUid）
 * @param {string} appToken - app_token
 * @returns {Promise<{hgUid: string, gameUid: string, nickName: string, bindingList: Array}>}
 */
export async function fetchBindingList(appToken) {
  // 🔧 修复：使用请求队列和重试机制
  const response = await queuedFetch(`${PROXY_BASE}?action=bindings&appToken=${encodeURIComponent(appToken)}`, {
    method: 'GET'
  }, {
    priority: 2, // 认证链第二步
    maxRetries: 3,
    timeout: 30000
  });

  const result = await safeParseJSON(response, 'Bindings API');

  if (result.riskControl) {
    throw new RiskControlError(result.error);
  }

  if (!result.success) {
    throw new AuthChainError(result.error || 'Bindings failed', 'bindings', result);
  }

  return result.data;
}

/**
 * 步骤4: 获取 u8_token
 * @param {string} hgUid - 游戏 UID
 * @param {string} appToken - app_token
 * @returns {Promise<{u8Token: string, uid: string}>}
 */
export async function fetchU8Token(hgUid, appToken) {
  // 🔧 修复：使用请求队列和重试机制
  const response = await queuedFetch(`${PROXY_BASE}?action=u8token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ uid: hgUid, appToken })
  }, {
    priority: 3, // 认证链第三步
    maxRetries: 3,
    timeout: 30000
  });

  const result = await safeParseJSON(response, 'U8Token API');

  if (result.riskControl) {
    throw new RiskControlError(result.error);
  }

  if (!result.success) {
    throw new AuthChainError(result.error || 'U8Token failed', 'u8token', result);
  }

  return result.data;
}

/**
 * 步骤5: 获取抽卡记录（单页）
 * @param {string} u8Token - u8_token
 * @param {object} options - 请求选项
 * @param {string} options.type - 记录类型 'char' | 'weapon'
 * @param {string} [options.poolType] - 卡池类型（角色池需要）
 * @param {string} [options.seqId] - 分页标记
 * @param {string} [options.serverId] - 服务器ID
 * @returns {Promise<{list: Array, hasMore: boolean}>}
 */
export async function fetchRecordsPage(u8Token, options = {}) {
  const { type = 'char', poolType, seqId, serverId = '1' } = options;

  const params = new URLSearchParams({
    action: 'records',
    u8Token,
    type,
    serverId
  });

  if (poolType) {
    params.append('poolType', poolType);
  }
  if (seqId) {
    params.append('seqId', seqId);
  }

  // 🔧 修复：使用请求队列和重试机制
  const response = await queuedFetch(`${PROXY_BASE}?${params.toString()}`, {
    method: 'GET'
  }, {
    priority: 5, // 数据获取优先级较低
    maxRetries: 3,
    timeout: 30000
  });

  const result = await safeParseJSON(response, 'Records API');

  if (result.riskControl) {
    throw new RiskControlError(result.error);
  }

  if (!result.success) {
    throw new AuthChainError(result.error || 'Records failed', 'records', result);
  }

  return result.data;
}

/**
 * 获取某个卡池的全部记录（自动分页）
 * @param {string} u8Token - u8_token
 * @param {object} options - 请求选项
 * @param {Function} [onProgress] - 进度回调
 * @returns {Promise<Array>} 全部记录
 */
export async function fetchAllPoolRecords(u8Token, options = {}, onProgress) {
  const allRecords = [];
  let hasMore = true;
  let lastSeqId = null;
  let page = 0;

  while (hasMore) {
    page++;
    if (onProgress) {
      onProgress(`第${page}页，已获取${allRecords.length}条记录...`);
    }

    const result = await fetchRecordsPage(u8Token, {
      ...options,
      seqId: lastSeqId
    });

    const records = result.list || [];
    allRecords.push(...records);

    hasMore = result.hasMore;
    if (records.length > 0) {
      lastSeqId = records[records.length - 1].seqId;
    }

    // 如果还有更多，添加延迟防止风控
    if (hasMore) {
      await delay(800 + Math.random() * 700);
    }
  }

  return allRecords;
}

/**
 * 执行完整认证链（阶段1：获取账号列表）
 * @param {string} initialToken - 24位初始token
 * @param {Function} [onProgress] - 进度回调
 * @returns {Promise<{appToken: string, accounts: Array}>}
 */
export async function fetchAccountsList(initialToken, onProgress) {
  // 步骤1: Grant - 获取 app_token
  if (onProgress) onProgress('正在验证token...');
  const grantResult = await grantAppToken(initialToken);
  const { appToken } = grantResult;

  if (!appToken) {
    throw new AuthChainError('未能获取 app_token', 'grant');
  }

  // 步骤2: Bindings - 获取绑定列表
  if (onProgress) onProgress('正在获取账号信息...');
  await delay(1000 + Math.random() * 500);
  const bindingResult = await fetchBindingList(appToken);
  const { accounts } = bindingResult;

  if (!accounts || accounts.length === 0) {
    throw new AuthChainError('未找到终末地账号绑定', 'bindings');
  }

  return {
    appToken,
    accounts  // 返回所有绑定账号列表
  };
}

/**
 * 执行完整认证链（阶段2：为选定账号获取 u8_token）
 * @param {string} appToken - app_token
 * @param {object} selectedAccount - 选定的账号
 * @param {Function} [onProgress] - 进度回调
 * @returns {Promise<{u8Token: string, account: object}>}
 */
export async function executeAuthChainForAccount(appToken, selectedAccount, onProgress) {
  if (!selectedAccount?.uid) {
    throw new AuthChainError('未选择账号', 'u8token');
  }

  // 获取 u8_token
  if (onProgress) onProgress(`正在获取 ${selectedAccount.channelName} 访问凭证...`);
  await delay(1000 + Math.random() * 500);
  const u8Result = await fetchU8Token(selectedAccount.uid, appToken);
  const { u8Token } = u8Result;

  if (!u8Token) {
    throw new AuthChainError('未能获取 u8_token', 'u8token');
  }

  return {
    u8Token,
    account: selectedAccount
  };
}

/**
 * 执行完整认证链（向后兼容：自动选择第一个账号）
 * @param {string} initialToken - 24位初始token
 * @param {Function} [onProgress] - 进度回调
 * @param {object} [selectedAccount] - 可选：指定账号，不传则使用第一个
 * @returns {Promise<{u8Token: string, hgUid: string, gameUid: string, nickName: string}>}
 */
export async function executeAuthChain(initialToken, onProgress, selectedAccount = null) {
  // 步骤1: Grant - 获取 app_token
  if (onProgress) onProgress('正在验证token...');
  const grantResult = await grantAppToken(initialToken);
  const { appToken } = grantResult;

  if (!appToken) {
    throw new AuthChainError('未能获取 app_token', 'grant');
  }

  // 步骤2: Bindings - 获取绑定列表和 hgUid、gameUid
  if (onProgress) onProgress('正在获取账号信息...');
  await delay(1000 + Math.random() * 500);
  const bindingResult = await fetchBindingList(appToken);

  // 如果指定了账号，使用指定的；否则使用默认的
  const account = selectedAccount || bindingResult.accounts?.[0] || {
    uid: bindingResult.hgUid,
    gameUid: bindingResult.gameUid,
    nickName: bindingResult.nickName,
    channelName: bindingResult.channelName,
    channelMasterId: bindingResult.channelMasterId,
    isOfficial: bindingResult.isOfficial,
    serverId: bindingResult.serverId
  };

  const { uid: hgUid, gameUid, nickName, channelName, channelMasterId, isOfficial } = account;

  if (!hgUid) {
    throw new AuthChainError('未找到终末地账号绑定', 'bindings');
  }

  // 步骤3: U8Token - 获取 u8_token
  if (onProgress) onProgress(`正在获取 ${channelName || '账号'} 访问凭证...`);
  await delay(1000 + Math.random() * 500);
  const u8Result = await fetchU8Token(hgUid, appToken);
  const { u8Token } = u8Result;

  if (!u8Token) {
    throw new AuthChainError('未能获取 u8_token', 'u8token');
  }

  return {
    u8Token,
    hgUid,
    gameUid,  // 游戏内角色 UID（1开头的十位数）
    nickName,
    channelName,
    channelMasterId,
    isOfficial,
    appToken,
    // 返回完整账号列表（用于 UI）
    accounts: bindingResult.accounts
  };
}

/**
 * 轮询任务状态直到完成
 * @param {string} taskId - 任务ID
 * @param {Function} [onProgress] - 进度回调
 * @param {number} [maxWaitTime] - 最大等待时间（毫秒）
 * @returns {Promise<Object>} 任务结果
 */
async function pollTaskUntilComplete(taskId, onProgress, maxWaitTime = 300000) {
  const startTime = Date.now();
  const pollInterval = 2000; // 每2秒轮询一次

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await fetch(`${PROXY_BASE}?action=task-status&taskId=${encodeURIComponent(taskId)}`);
      const result = await safeParseJSON(response, 'Task Status API');

      if (!result.success) {
        throw new AuthChainError(result.error || 'Failed to get task status', 'task-status', result);
      }

      const status = result.data;

      if (status.status === 'completed') {
        // 任务完成，返回结果
        return status.result;
      }

      if (status.status === 'failed') {
        throw new AuthChainError(status.error || 'Task failed', 'task-failed', status);
      }

      // 任务仍在排队或处理中
      if (status.status === 'pending') {
        if (onProgress) onProgress(`排队中... 前面还有 ${status.position} 个任务`);
      } else if (status.status === 'processing') {
        if (onProgress) onProgress('正在获取抽卡记录...');
      }

      // 等待后继续轮询
      await delay(pollInterval);
    } catch (error) {
      // 网络错误，等待后重试
      console.warn('[pollTaskUntilComplete] 轮询失败，重试中...', error.message);
      await delay(pollInterval);
    }
  }

  throw new AuthChainError('等待超时，请稍后重试', 'task-timeout');
}

/**
 * 获取后端导入队列状态
 * @returns {Promise<Object>} 队列状态
 */
export async function fetchImportQueueStatus() {
  try {
    const response = await fetch(`${PROXY_BASE}?action=queue-status`);
    const result = await safeParseJSON(response, 'Queue Status API');

    if (!result.success) {
      return { queueLength: 0, isProcessing: false };
    }

    return result.data;
  } catch (error) {
    console.warn('[fetchImportQueueStatus] 获取队列状态失败:', error.message);
    return { queueLength: 0, isProcessing: false };
  }
}

export async function fetchFullImportStatus(taskId) {
  const response = await fetch(`${PROXY_BASE}?action=import-status&taskId=${encodeURIComponent(taskId)}`);
  const result = await safeParseJSON(response, 'Import Status API');

  if (!result.success) {
    throw new AuthChainError(result.error || 'Import status failed', 'import-status', result);
  }

  return result.data;
}

async function pollFullImportUntilComplete(taskId, onProgress, maxWaitTime = 300000) {
  const startTime = Date.now();
  const pollInterval = 2000;

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const task = await fetchFullImportStatus(taskId);

      if (onProgress) {
        onProgress({
          status: task.status,
          progress: task.progress || 0,
          message: task.message || '正在导入...'
        });
      }

      if (task.status === 'completed') {
        return task.result;
      }

      if (task.status === 'failed') {
        throw new AuthChainError(task.error || 'Import failed', 'import-full', task);
      }

      await delay(pollInterval);
    } catch (error) {
      if (error instanceof AuthChainError) {
        throw error;
      }

      console.warn('[pollFullImportUntilComplete] 轮询失败，重试中...', error.message);
      await delay(pollInterval);
    }
  }

  throw new AuthChainError('等待导入超时，请稍后重试', 'import-timeout');
}

export async function importAllRecordsFullyOnBackend(initialToken, accountIndex, userId, onProgress) {
  if (!userId) {
    throw new AuthChainError('请先登录后再导入数据', 'import-full');
  }

  if (onProgress) {
    onProgress({
      status: 'pending',
      progress: 5,
      message: '正在提交导入任务...'
    });
  }

  const response = await queuedFetch(`${PROXY_BASE}?action=import-full`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: initialToken,
      accountIndex,
      userId
    })
  }, {
    priority: 4,
    maxRetries: 1,
    timeout: 30000
  });

  const result = await safeParseJSON(response, 'Full Import API');

  if (result.riskControl) {
    throw new RiskControlError(result.error);
  }

  if (!result.success) {
    throw new AuthChainError(result.error || 'Full import failed', 'import-full', result);
  }

  return pollFullImportUntilComplete(result.taskId, onProgress);
}

/**
 * 获取全部抽卡记录（所有卡池）- 并发版本
 * 同时请求角色池和武器池，减少总耗时
 * 使用后端队列确保同时只有一个导入任务执行
 * @param {string} u8Token - u8_token
 * @param {string} serverId - 服务器ID
 * @param {Function} [onProgress] - 进度回调
 * @param {Object} [metadata] - 元数据（用于队列显示）
 * @returns {Promise<Array>} 全部记录
 */
export async function fetchAllGachaRecordsConcurrent(u8Token, serverId = '1', onProgress, metadata = {}) {
  if (onProgress) onProgress('正在提交导入请求...');

  // 🔧 修复：使用批量并发 API + 请求队列和重试机制
  const response = await queuedFetch(`${PROXY_BASE}?action=records-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      u8Token,
      serverId,
      pools: [
        { type: 'char', poolType: POOL_TYPES.CHARACTER.SPECIAL },   // 限定角色池
        { type: 'char', poolType: POOL_TYPES.CHARACTER.STANDARD },  // 常驻角色池
        { type: 'char', poolType: POOL_TYPES.CHARACTER.BEGINNER },  // 新手池
        { type: 'weapon' }  // 武器池
      ],
      // 传递元数据用于队列显示
      gameUid: metadata.gameUid,
      nickName: metadata.nickName
    })
  }, {
    priority: 4, // 批量请求优先级
    maxRetries: 3,
    timeout: 120000 // 批量请求超时时间更长（考虑排队时间）
  });

  const result = await safeParseJSON(response, 'Records Batch API');

  if (result.riskControl) {
    throw new RiskControlError(result.error);
  }

  if (!result.success) {
    throw new AuthChainError(result.error || 'Batch records failed', 'records-batch', result);
  }

  // 检查是否被放入队列（需要轮询等待）
  if (result.queued) {
    if (result.position > 1) {
      if (onProgress) onProgress(`导入请求已加入队列，前面还有 ${result.position - 1} 个任务...`);
    } else {
      if (onProgress) onProgress('正在获取抽卡记录...');
    }

    // 轮询等待任务完成
    const taskResult = await pollTaskUntilComplete(result.taskId, onProgress);

    // 使用任务结果继续处理
    return processRecordsBatchResult({ success: true, data: taskResult }, onProgress);
  }

  // 直接返回结果（没有排队）
  if (onProgress) onProgress('正在获取抽卡记录...');
  return processRecordsBatchResult(result, onProgress);
}

/**
 * 处理 records-batch 结果
 * @param {Object} result - API 响应结果
 * @param {Function} [onProgress] - 进度回调
 * @returns {Array} 处理后的记录数组
 */
function processRecordsBatchResult(result, onProgress) {
  // 处理所有卡池结果
  const allRecords = [];
  const poolTypeMap = {
    [POOL_TYPES.CHARACTER.SPECIAL]: 'limited_character',
    [POOL_TYPES.CHARACTER.STANDARD]: 'standard',
    [POOL_TYPES.CHARACTER.BEGINNER]: 'beginner',
    'weapon': 'limited_weapon',
    'undefined': 'limited_weapon'  // 武器池没有 poolType
  };

  result.data.results.forEach(poolResult => {
    // 武器池的 poolType 是 undefined，需要通过 type 判断
    let poolType;
    if (poolResult.type === 'weapon') {
      poolType = 'limited_weapon';
    } else {
      poolType = poolTypeMap[poolResult.poolType] || 'unknown';
    }
    const records = poolResult.records.map(r => ({ ...r, _poolType: poolType }));
    allRecords.push(...records);
  });

  // 检查是否有失败的卡池
  const failedPools = result.data.failed || [];
  if (failedPools.length > 0) {
    const failedNames = failedPools.map(f => {
      if (f.type === 'weapon') return '武器池';
      if (f.poolType?.includes('Special')) return '限定角色池';
      if (f.poolType?.includes('Standard')) return '常驻角色池';
      if (f.poolType?.includes('Beginner')) return '新手池';
      return f.type || '未知卡池';
    }).join('、');

    if (onProgress) onProgress(`部分卡池获取失败: ${failedNames}，已获取 ${allRecords.length} 条记录`);

    // 如果有记录则继续，但标记警告
    console.warn('[fetchAllGachaRecordsConcurrent] 部分卡池失败:', failedPools);
  } else {
    if (onProgress) onProgress(`全部记录获取完成，共 ${allRecords.length} 条`);
  }

  return allRecords;
}

/**
 * 获取全部抽卡记录（所有卡池）- 串行版本（备用）
 * @param {string} u8Token - u8_token
 * @param {Function} [onProgress] - 进度回调
 * @returns {Promise<Array>} 全部记录
 */
export async function fetchAllGachaRecords(u8Token, onProgress) {
  const allRecords = [];

  // 1. 限定角色池（特许寻访）
  if (onProgress) onProgress('正在获取限定角色池记录...');
  const specialRecords = await fetchAllPoolRecords(u8Token, {
    type: 'char',
    poolType: POOL_TYPES.CHARACTER.SPECIAL
  }, onProgress);
  allRecords.push(...specialRecords.map(r => ({ ...r, _poolType: 'limited_character' })));

  // 2. 常驻角色池（基础寻访）
  if (onProgress) onProgress('正在获取常驻角色池记录...');
  await delay(1500 + Math.random() * 1000);
  const standardRecords = await fetchAllPoolRecords(u8Token, {
    type: 'char',
    poolType: POOL_TYPES.CHARACTER.STANDARD
  }, onProgress);
  allRecords.push(...standardRecords.map(r => ({ ...r, _poolType: 'standard' })));

  // 3. 新手池（启程寻访）
  if (onProgress) onProgress('正在获取新手池记录...');
  await delay(1500 + Math.random() * 1000);
  const beginnerRecords = await fetchAllPoolRecords(u8Token, {
    type: 'char',
    poolType: POOL_TYPES.CHARACTER.BEGINNER
  }, onProgress);
  allRecords.push(...beginnerRecords.map(r => ({ ...r, _poolType: 'beginner' })));

  // 4. 武器池
  if (onProgress) onProgress('正在获取武器池记录...');
  await delay(2000 + Math.random() * 1000);
  const weaponRecords = await fetchAllPoolRecords(u8Token, {
    type: 'weapon'
  }, onProgress);
  allRecords.push(...weaponRecords.map(r => ({ ...r, _poolType: 'limited_weapon' })));

  return allRecords;
}

/**
 * 一键获取全部抽卡记录（使用并发优化）
 * @param {string} initialToken - 24位初始token
 * @param {Function} [onProgress] - 进度回调
 * @param {object} [selectedAccount] - 可选：指定账号，不传则使用第一个
 * @returns {Promise<{records: Array, userInfo: object, accounts: Array}>}
 */
export async function importAllRecords(initialToken, onProgress, selectedAccount = null) {
  // 执行认证链
  const authResult = await executeAuthChain(initialToken, onProgress, selectedAccount);
  const { u8Token, hgUid, gameUid, nickName, channelName, channelMasterId, isOfficial, accounts } = authResult;

  // 获取全部记录（使用并发版本）
  if (onProgress) onProgress(`认证成功，开始获取 ${channelName || '账号'} 抽卡记录...`);
  await delay(1000);

  let records;
  try {
    // 优先使用并发版本
    records = await fetchAllGachaRecordsConcurrent(u8Token, '1', onProgress);
  } catch {
    // 如果并发失败，回退到串行版本
    if (onProgress) onProgress('并发获取失败，切换到串行模式...');
    records = await fetchAllGachaRecords(u8Token, onProgress);
  }

  return {
    records,
    userInfo: {
      hgUid,           // 鹰角内部UID（认证用）
      gameUid,         // 游戏内角色UID（存储用，1开头的十位数）
      nickName,
      channelName,     // 渠道名称（官服/B服）
      channelMasterId, // 渠道ID：1=官服，2=B服
      isOfficial       // 是否官服
    },
    accounts  // 返回所有可用账号列表
  };
}

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  POOL_TYPES,
  AuthChainError,
  RiskControlError,
  ServerConnectionError,
  grantAppToken,
  fetchBindingList,
  fetchU8Token,
  fetchRecordsPage,
  fetchAllPoolRecords,
  fetchAccountsList,
  executeAuthChainForAccount,
  executeAuthChain,
  fetchAllGachaRecords,
  fetchAllGachaRecordsConcurrent,
  fetchFullImportStatus,
  fetchImportQueueStatus,
  importAllRecordsFullyOnBackend,
  importAllRecords
};
