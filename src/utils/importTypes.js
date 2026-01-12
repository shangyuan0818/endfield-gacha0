/**
 * 导入模块统一数据类型定义
 *
 * 本文件定义了所有导入方式共用的数据结构和接口
 */

/**
 * 导入方式枚举
 */
export const ImportMethod = {
  OFFICIAL_API: 'official_api',      // 方案A: 官网API接口导入
  GAME_PAGE: 'game_page',            // 方案B1: 游戏页面数据抓取
  SCREENSHOT_OCR: 'screenshot_ocr',  // 方案B2: 截图OCR识别
  MANUAL_PASTE: 'manual_paste'       // 现有: 手动批量粘贴
};

/**
 * 导入状态枚举
 */
export const ImportStatus = {
  IDLE: 'idle',                      // 空闲
  INITIALIZING: 'initializing',      // 初始化中
  FETCHING: 'fetching',              // 获取数据中
  PARSING: 'parsing',                // 解析数据中
  VALIDATING: 'validating',          // 验证数据中
  SUCCESS: 'success',                // 成功
  ERROR: 'error',                    // 错误
  CANCELLED: 'cancelled'             // 已取消
};

/**
 * 统一的抽卡记录数据结构
 *
 * @typedef {Object} GachaRecord
 * @property {string} pool - 卡池ID
 * @property {string} name - 角色/武器名称
 * @property {number} rarity - 稀有度 (3-6)
 * @property {boolean} isLimited - 是否限定
 * @property {number} timestamp - 时间戳
 * @property {number} pity - 当前保底计数
 * @property {string} [batchId] - 批次ID（十连）
 */

/**
 * 导入结果数据结构
 *
 * @typedef {Object} ImportResult
 * @property {boolean} success - 是否成功
 * @property {GachaRecord[]} records - 抽卡记录列表
 * @property {Object} summary - 统计摘要
 * @property {number} summary.total - 总记录数
 * @property {number} summary.newRecords - 新增记录数
 * @property {number} summary.duplicates - 重复记录数
 * @property {Object} summary.byPool - 按卡池分类统计
 * @property {string} [error] - 错误信息
 * @property {Array} [warnings] - 警告信息列表
 */

/**
 * 导入进度数据结构
 *
 * @typedef {Object} ImportProgress
 * @property {ImportStatus} status - 当前状态
 * @property {number} percentage - 进度百分比 (0-100)
 * @property {string} message - 当前状态描述
 * @property {number} currentPage - 当前页数（API导入）
 * @property {number} totalPages - 总页数（API导入）
 * @property {number} processedCount - 已处理记录数
 */

/**
 * 导入配置
 *
 * @typedef {Object} ImportConfig
 * @property {ImportMethod} method - 导入方式
 * @property {boolean} mergeExisting - 是否与现有数据合并
 * @property {boolean} autoDetectPool - 是否自动识别卡池类型
 * @property {boolean} validateData - 是否验证数据完整性
 * @property {number} [retryCount] - 失败重试次数（API导入）
 * @property {number} [timeout] - 超时时间（毫秒）
 */

/**
 * API凭证数据结构（方案A）
 *
 * @typedef {Object} ApiCredentials
 * @property {string} token - 认证token
 * @property {string} channelId - 渠道ID
 * @property {string} [uid] - 用户ID
 */

/**
 * OCR配置（方案B2）
 *
 * @typedef {Object} OcrConfig
 * @property {string} language - 识别语言（chi_sim/eng）
 * @property {number} confidenceThreshold - 置信度阈值 (0-1)
 * @property {boolean} autoCorrect - 是否自动校正
 * @property {Object} [imagePreprocess] - 图像预处理选项
 */

/**
 * 导入适配器接口
 * 所有导入方式的适配器都需要实现这个接口
 */
export class ImportAdapter {
  /**
   * 初始化适配器
   * @param {ImportConfig} config - 导入配置
   * @returns {Promise<void>}
   */
  async initialize(config) {
    throw new Error('initialize() must be implemented');
  }

  /**
   * 验证导入条件
   * @returns {Promise<{valid: boolean, message?: string}>}
   */
  async validate() {
    throw new Error('validate() must be implemented');
  }

  /**
   * 执行数据导入
   * @param {Function} onProgress - 进度回调函数
   * @returns {Promise<ImportResult>}
   */
  async import(onProgress) {
    throw new Error('import() must be implemented');
  }

  /**
   * 取消导入
   * @returns {Promise<void>}
   */
  async cancel() {
    throw new Error('cancel() must be implemented');
  }

  /**
   * 清理资源
   * @returns {Promise<void>}
   */
  async cleanup() {
    // 可选实现
  }
}

/**
 * 数据验证规则
 */
export const ValidationRules = {
  // 必需字段
  requiredFields: ['pool', 'name', 'rarity', 'timestamp'],

  // 稀有度范围
  rarityRange: [3, 6],

  // 时间戳范围（放宽验证，允许测试数据）
  timestampRange: {
    min: new Date('2020-01-01').getTime(), // 宽松的下限（2020年后）
    max: () => Date.now() + 365 * 24 * 60 * 60 * 1000 // 允许未来1年内的时间戳
  },

  // 卡池ID白名单
  validPoolIds: [
    'limited_character',
    'limited_weapon',
    'standard'
  ]
};

/**
 * 错误类型枚举
 */
export const ImportErrorType = {
  NETWORK_ERROR: 'network_error',           // 网络错误
  AUTH_ERROR: 'auth_error',                 // 认证失败
  INVALID_TOKEN: 'invalid_token',           // Token无效
  INVALID_DATA: 'invalid_data',             // 数据格式错误
  PARSE_ERROR: 'parse_error',               // 解析错误
  VALIDATION_ERROR: 'validation_error',     // 验证错误
  OCR_ERROR: 'ocr_error',                   // OCR识别错误
  TIMEOUT: 'timeout',                       // 超时
  CANCELLED: 'cancelled',                   // 用户取消
  UNKNOWN: 'unknown'                        // 未知错误
};

/**
 * 创建标准化的错误对象
 * @param {ImportErrorType} type - 错误类型
 * @param {string} message - 错误信息
 * @param {Error} [originalError] - 原始错误对象
 * @returns {Object}
 */
export function createImportError(type, message, originalError = null) {
  return {
    type,
    message,
    timestamp: Date.now(),
    originalError: originalError ? {
      name: originalError.name,
      message: originalError.message,
      stack: originalError.stack
    } : null
  };
}

/**
 * 导出所有类型定义
 */
export default {
  ImportMethod,
  ImportStatus,
  ValidationRules,
  ImportErrorType,
  ImportAdapter,
  createImportError
};
