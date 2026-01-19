/**
 * 明日方舟导入适配器
 *
 * 参考实现，演示如何使用官网API导入抽卡记录
 * 可作为终末地适配器的开发模板
 */

import {
  ImportAdapter,
  ImportStatus,
  createImportError,
  ImportErrorType
} from '../importTypes';
import {
  validateRecords,
  mergeRecords,
  normalizeRecord,
  calculateImportSummary,
  assignBatchIds
} from '../importParsers';

/**
 * 明日方舟官网API端点
 */
const ARK_API = {
  // 认证端点
  AUTH_OFFICIAL: 'https://web-api.hypergryph.com/account/info/hg',
  AUTH_BILIBILI: 'https://web-api.hypergryph.com/account/info/ak-b',

  // 数据端点
  GACHA_OFFICIAL: 'https://ak.hypergryph.com/user/api/inquiry/gacha',

  // 渠道ID
  CHANNEL_OFFICIAL: '1',
  CHANNEL_BILIBILI: '2'
};

/**
 * 明日方舟导入适配器类
 */
export class ArkImportAdapter extends ImportAdapter {
  constructor() {
    super();
    this.token = null;
    this.channelId = ARK_API.CHANNEL_OFFICIAL;
    this.cancelled = false;
    this.config = null;
  }

  /**
   * 初始化适配器
   * @param {Object} config - 配置对象
   * @param {string} config.token - 认证token
   * @param {string} [config.channelId] - 渠道ID
   */
  async initialize(config) {
    this.config = config;
    this.token = config.token;
    this.channelId = config.channelId || ARK_API.CHANNEL_OFFICIAL;
    this.cancelled = false;
  }

  /**
   * 验证token有效性
   */
  async validate() {
    if (!this.token) {
      return {
        valid: false,
        message: '请提供认证token'
      };
    }

    try {
      // 尝试获取第一页数据来验证token
      const url = `${ARK_API.GACHA_OFFICIAL}?channelId=${this.channelId}&page=1&token=${encodeURIComponent(this.token)}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === 0) {
        return { valid: true };
      } else if (data.code === 3000) {
        return {
          valid: false,
          message: 'Token已过期或无效，请重新登录官网获取'
        };
      } else {
        return {
          valid: false,
          message: `验证失败: ${data.msg || '未知错误'}`
        };
      }
    } catch (error) {
      return {
        valid: false,
        message: `网络错误: ${error.message}`
      };
    }
  }

  /**
   * 执行数据导入
   * @param {Function} onProgress - 进度回调
   */
  async import(onProgress) {
    try {
      // 初始化进度
      onProgress({
        status: ImportStatus.INITIALIZING,
        percentage: 0,
        message: '正在初始化...'
      });

      // 获取现有数据（用于增量导入）
      const existingRecords = this.config.existingRecords || [];
      const lastTimestamp = existingRecords.length > 0
        ? Math.max(...existingRecords.map(r => r.timestamp))
        : 0;

      // 开始获取数据
      onProgress({
        status: ImportStatus.FETCHING,
        percentage: 10,
        message: '正在获取抽卡记录...'
      });

      const records = await this.fetchAllRecords(lastTimestamp, onProgress);

      if (this.cancelled) {
        return {
          success: false,
          records: [],
          summary: {},
          error: '导入已取消'
        };
      }

      // 解析数据
      onProgress({
        status: ImportStatus.PARSING,
        percentage: 70,
        message: '正在解析数据...'
      });

      const parsedRecords = this.parseRecords(records);

      // 验证数据
      onProgress({
        status: ImportStatus.VALIDATING,
        percentage: 80,
        message: '正在验证数据...'
      });

      const validation = validateRecords(parsedRecords);
      if (!validation.valid) {
        console.warn('部分记录验证失败:', validation.invalidRecords);
      }

      // 合并数据
      const mergeResult = mergeRecords(existingRecords, validation.validRecords);

      // 添加批次ID
      const finalRecords = assignBatchIds(mergeResult.merged);

      // 生成统计摘要
      const summary = {
        ...calculateImportSummary(finalRecords),
        newRecords: mergeResult.newCount,
        duplicates: mergeResult.duplicateCount
      };

      onProgress({
        status: ImportStatus.SUCCESS,
        percentage: 100,
        message: '导入完成！'
      });

      return {
        success: true,
        records: finalRecords,
        summary,
        warnings: validation.invalidRecords.length > 0
          ? [`${validation.invalidRecords.length} 条记录验证失败已跳过`]
          : []
      };

    } catch (error) {
      const importError = createImportError(
        ImportErrorType.UNKNOWN,
        error.message,
        error
      );

      onProgress({
        status: ImportStatus.ERROR,
        percentage: 0,
        message: `导入失败: ${error.message}`
      });

      return {
        success: false,
        records: [],
        summary: {},
        error: importError.message
      };
    }
  }

  /**
   * 获取所有分页数据
   * @param {number} lastTimestamp - 上次导入的最后时间戳
   * @param {Function} onProgress - 进度回调
   * @private
   */
  async fetchAllRecords(lastTimestamp, onProgress) {
    const allRecords = [];
    let currentPage = 1;
    let totalPages = 1;
    let shouldContinue = true;

    while (currentPage <= totalPages && shouldContinue && !this.cancelled) {
      try {
        const url = `${ARK_API.GACHA_OFFICIAL}?channelId=${this.channelId}&page=${currentPage}&token=${encodeURIComponent(this.token)}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.code !== 0) {
          throw new Error(data.msg || `API错误码: ${data.code}`);
        }

        // 更新总页数
        totalPages = data.data.pagination.total;

        // 添加当前页数据
        const pageRecords = data.data.list || [];
        allRecords.push(...pageRecords);

        // 检查是否需要继续（增量导入优化）
        if (pageRecords.length > 0 && lastTimestamp > 0) {
          const oldestInPage = Math.min(...pageRecords.map(r => r.ts));
          if (oldestInPage < lastTimestamp) {
            console.log('检测到已导入的数据，停止获取');
            shouldContinue = false;
          }
        }

        // 更新进度
        const progress = Math.floor(10 + (currentPage / totalPages) * 60);
        onProgress({
          status: ImportStatus.FETCHING,
          percentage: progress,
          message: `正在获取第 ${currentPage}/${totalPages} 页...`,
          currentPage,
          totalPages,
          processedCount: allRecords.length
        });

        currentPage++;

        // 添加延迟避免请求过快
        if (currentPage <= totalPages) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

      } catch (error) {
        console.error(`获取第 ${currentPage} 页失败:`, error);
        throw error;
      }
    }

    return allRecords;
  }

  /**
   * 解析原始API数据为标准格式
   * @param {Array} rawRecords - 原始记录
   * @private
   */
  parseRecords(rawRecords) {
    return rawRecords.map(raw => {
      // 明日方舟API字段映射
      const normalized = normalizeRecord(raw, {
        pool: ['pool'],
        name: ['chars', 'name'],
        timestamp: ['ts']
      });

      // 解析chars数组（明日方舟的记录格式）
      if (raw.chars && Array.isArray(raw.chars)) {
        // chars是一个数组，包含本次抽卡的所有角色
        return raw.chars.map(char => ({
          pool: raw.pool || 'unknown',
          name: char.name || char.charId,
          rarity: char.rarity || this.inferRarity(char),
          isLimited: char.isNew || false,
          timestamp: raw.ts,
          pity: 0 // 明日方舟API不提供保底计数
        }));
      }

      // 如果不是数组格式，返回单条记录
      return [{
        ...normalized,
        rarity: normalized.rarity || 3,
        isLimited: false,
        pity: 0
      }];
    }).flat(); // 展平数组
  }

  /**
   * 推断稀有度（如果API未提供）
   * @param {Object} char - 角色对象
   * @private
   */
  inferRarity(char) {
    // 根据isNew、itemId等字段推断
    // 这里是示例逻辑，实际需要根据API数据调整
    if (char.isNew) return 6;
    return 3;
  }

  /**
   * 取消导入
   */
  async cancel() {
    this.cancelled = true;
  }

  /**
   * 清理资源
   */
  async cleanup() {
    this.token = null;
    this.config = null;
  }
}

/**
 * 辅助函数：从浏览器cookie中提取token
 * （需要在浏览器环境中使用）
 */
export function extractTokenFromCookies() {
  if (typeof document === 'undefined') {
    throw new Error('此函数只能在浏览器环境中使用');
  }

  // 明日方舟token存储在cookie中
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === '_ga_token' || name === 'token') {
      return decodeURIComponent(value);
    }
  }

  return null;
}

export default ArkImportAdapter;
