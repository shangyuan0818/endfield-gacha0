/**
 * 数据解析工具集
 *
 * 提供各种导入方式的数据解析和转换功能
 */

import { ValidationRules, createImportError, ImportErrorType } from './importTypes';
import { POOL_TYPES } from '../constants';

/**
 * 验证单条抽卡记录
 * @param {Object} record - 抽卡记录
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateRecord(record) {
  const errors = [];

  // 检查必需字段
  ValidationRules.requiredFields.forEach(field => {
    if (record[field] === undefined || record[field] === null) {
      errors.push(`缺少必需字段: ${field}`);
    }
  });

  // 验证稀有度
  if (record.rarity) {
    const [min, max] = ValidationRules.rarityRange;
    if (record.rarity < min || record.rarity > max) {
      errors.push(`稀有度无效: ${record.rarity}，应在 ${min}-${max} 之间`);
    }
  }

  // 验证时间戳
  if (record.timestamp) {
    const min = ValidationRules.timestampRange.min;
    const max = ValidationRules.timestampRange.max();
    if (record.timestamp < min || record.timestamp > max) {
      errors.push(`时间戳无效: ${new Date(record.timestamp).toLocaleString()}`);
    }
  }

  // 验证卡池ID
  if (record.pool && !ValidationRules.validPoolIds.includes(record.pool)) {
    errors.push(`卡池ID无效: ${record.pool}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 批量验证记录
 * @param {Array} records - 记录列表
 * @returns {{valid: boolean, validRecords: Array, invalidRecords: Array, summary: Object}}
 */
export function validateRecords(records) {
  const validRecords = [];
  const invalidRecords = [];

  records.forEach((record, index) => {
    const validation = validateRecord(record);
    if (validation.valid) {
      validRecords.push(record);
    } else {
      invalidRecords.push({
        index,
        record,
        errors: validation.errors
      });
    }
  });

  return {
    valid: invalidRecords.length === 0,
    validRecords,
    invalidRecords,
    summary: {
      total: records.length,
      valid: validRecords.length,
      invalid: invalidRecords.length,
      validRate: records.length > 0 ? (validRecords.length / records.length * 100).toFixed(2) : 0
    }
  };
}

/**
 * 去重记录（基于时间戳和名称）
 * @param {Array} records - 记录列表
 * @returns {Array} 去重后的记录
 */
export function deduplicateRecords(records) {
  const seen = new Set();
  return records.filter(record => {
    const key = `${record.timestamp}_${record.name}_${record.pool}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * 合并新旧记录
 * @param {Array} existingRecords - 现有记录
 * @param {Array} newRecords - 新记录
 * @returns {{merged: Array, newCount: number, duplicateCount: number}}
 */
export function mergeRecords(existingRecords, newRecords) {
  const existingKeys = new Set(
    existingRecords.map(r => `${r.timestamp}_${r.name}_${r.pool}`)
  );

  const uniqueNewRecords = [];
  let duplicateCount = 0;

  newRecords.forEach(record => {
    const key = `${record.timestamp}_${record.name}_${record.pool}`;
    if (!existingKeys.has(key)) {
      uniqueNewRecords.push(record);
      existingKeys.add(key);
    } else {
      duplicateCount++;
    }
  });

  // 按时间戳排序（最新的在前）
  const merged = [...existingRecords, ...uniqueNewRecords].sort(
    (a, b) => b.timestamp - a.timestamp
  );

  return {
    merged,
    newCount: uniqueNewRecords.length,
    duplicateCount
  };
}

/**
 * 按卡池分类统计
 * @param {Array} records - 记录列表
 * @returns {Object} 按卡池分类的统计
 */
export function groupByPool(records) {
  const grouped = {};

  records.forEach(record => {
    if (!grouped[record.pool]) {
      grouped[record.pool] = {
        count: 0,
        records: [],
        byRarity: {}
      };
    }

    grouped[record.pool].count++;
    grouped[record.pool].records.push(record);

    const rarity = record.rarity;
    if (!grouped[record.pool].byRarity[rarity]) {
      grouped[record.pool].byRarity[rarity] = 0;
    }
    grouped[record.pool].byRarity[rarity]++;
  });

  return grouped;
}

/**
 * 生成批次ID（用于十连分组）
 * @returns {string} UUID格式的批次ID
 */
export function generateBatchId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 为记录分配批次ID（基于时间戳相同分组）
 * @param {Array} records - 记录列表
 * @returns {Array} 带批次ID的记录列表
 */
export function assignBatchIds(records) {
  // 按时间戳分组
  const batches = {};

  records.forEach(record => {
    const ts = record.timestamp;
    if (!batches[ts]) {
      batches[ts] = {
        batchId: generateBatchId(),
        records: []
      };
    }
    batches[ts].records.push(record);
  });

  // 为每条记录添加批次ID
  return records.map(record => ({
    ...record,
    batchId: batches[record.timestamp].batchId
  }));
}

/**
 * 自动识别卡池类型（基于记录特征）
 * @param {Object} record - 记录对象
 * @param {Object} context - 上下文信息
 * @returns {string} 卡池ID
 */
export function autoDetectPoolType(record, context = {}) {
  // 如果记录中已有卡池信息，直接使用
  if (record.pool) {
    return record.pool;
  }

  // 基于角色名称或其他特征推断
  // 这里需要根据实际游戏数据调整
  const { name, isLimited, rarity } = record;

  // 临时逻辑：需要在游戏上线后根据实际数据完善
  if (isLimited) {
    // 武器通常名称包含特定关键词
    if (name && (name.includes('枪') || name.includes('剑') || name.includes('杖'))) {
      return POOL_TYPES.LIMITED_WEAPON;
    }
    return POOL_TYPES.LIMITED_CHARACTER;
  }

  return POOL_TYPES.STANDARD;
}

/**
 * 解析CSV格式数据
 * @param {string} csvText - CSV文本
 * @returns {Array} 解析后的记录列表
 */
export function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw createImportError(
      ImportErrorType.PARSE_ERROR,
      'CSV数据格式错误：至少需要表头和一条数据'
    );
  }

  const headers = lines[0].split(',').map(h => h.trim());
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) {
      console.warn(`第 ${i + 1} 行数据列数不匹配，跳过`);
      continue;
    }

    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index];
    });

    // 类型转换
    if (record.rarity) record.rarity = parseInt(record.rarity);
    if (record.timestamp) record.timestamp = parseInt(record.timestamp);
    if (record.isLimited) record.isLimited = record.isLimited === 'true';

    records.push(record);
  }

  return records;
}

/**
 * 解析JSON格式数据
 * @param {string} jsonText - JSON文本
 * @returns {Array} 解析后的记录列表
 */
export function parseJSON(jsonText) {
  try {
    const data = JSON.parse(jsonText);

    // 支持多种JSON格式
    if (Array.isArray(data)) {
      return data;
    } else if (data.records && Array.isArray(data.records)) {
      return data.records;
    } else if (data.data && Array.isArray(data.data)) {
      return data.data;
    }

    throw new Error('无法识别的JSON数据格式');
  } catch (error) {
    throw createImportError(
      ImportErrorType.PARSE_ERROR,
      `JSON解析失败: ${error.message}`,
      error
    );
  }
}

/**
 * 标准化记录格式（转换为统一格式）
 * @param {Object} rawRecord - 原始记录
 * @param {Object} mapping - 字段映射配置
 * @returns {Object} 标准化后的记录
 */
export function normalizeRecord(rawRecord, mapping = {}) {
  const normalized = {};

  // 默认映射规则
  const defaultMapping = {
    pool: ['pool', 'poolId', 'pool_id', 'gacha_type'],
    name: ['name', 'item_name', 'char_name', 'character'],
    rarity: ['rarity', 'star', 'rank'],
    isLimited: ['isLimited', 'is_limited', 'limited'],
    timestamp: ['timestamp', 'ts', 'time', 'pull_time'],
    pity: ['pity', 'pity_count', 'counter']
  };

  const finalMapping = { ...defaultMapping, ...mapping };

  // 遍历每个目标字段
  Object.keys(finalMapping).forEach(targetField => {
    const possibleFields = finalMapping[targetField];

    // 尝试从原始记录中找到对应字段
    for (const field of possibleFields) {
      if (rawRecord[field] !== undefined && rawRecord[field] !== null) {
        normalized[targetField] = rawRecord[field];
        break;
      }
    }
  });

  return normalized;
}

/**
 * 计算导入统计摘要
 * @param {Array} records - 记录列表
 * @returns {Object} 统计摘要
 */
export function calculateImportSummary(records) {
  const byPool = groupByPool(records);
  const byRarity = {};

  records.forEach(record => {
    const rarity = record.rarity;
    byRarity[rarity] = (byRarity[rarity] || 0) + 1;
  });

  return {
    total: records.length,
    byPool: Object.keys(byPool).reduce((acc, poolId) => {
      acc[poolId] = byPool[poolId].count;
      return acc;
    }, {}),
    byRarity,
    timeRange: records.length > 0 ? {
      earliest: Math.min(...records.map(r => r.timestamp)),
      latest: Math.max(...records.map(r => r.timestamp))
    } : null
  };
}

/**
 * 导出所有解析函数
 */
export default {
  validateRecord,
  validateRecords,
  deduplicateRecords,
  mergeRecords,
  groupByPool,
  generateBatchId,
  assignBatchIds,
  autoDetectPoolType,
  parseCSV,
  parseJSON,
  normalizeRecord,
  calculateImportSummary
};
