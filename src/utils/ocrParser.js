/**
 * OCR 结果解析器
 *
 * 将 OCR 识别的原始数据转换为标准抽卡记录格式
 */

import {
  normalizeRecord,
  autoDetectPoolType,
  generateBatchId
} from './importParsers';
import { createImportError, ImportErrorType } from './importTypes';

/**
 * 解析 OCR 识别结果
 * @param {Object} ocrResult - OCR 服务返回的结果
 * @param {Object} options - 解析选项
 * @returns {Array} 标准化的抽卡记录列表
 */
export function parseOcrResult(ocrResult, options = {}) {
  const {
    autoCorrect = true,
    autoDetectPool = true,
    defaultPool = 'standard'
  } = options;

  if (!ocrResult.success || !ocrResult.records) {
    throw createImportError(
      ImportErrorType.PARSE_ERROR,
      'OCR 结果格式错误'
    );
  }

  const records = ocrResult.records.map(ocrRecord => {
    // 基础字段映射
    let record = {
      name: ocrRecord.name,
      rarity: ocrRecord.rarity,
      confidence: ocrRecord.confidence,
      originalText: ocrRecord.original_text
    };

    // 自动识别卡池类型
    if (autoDetectPool) {
      record.pool = autoDetectPoolType(record, options);
    } else {
      record.pool = defaultPool;
    }

    // 添加时间戳（当前时间 - 用户后续可以手动调整）
    record.timestamp = Date.now();

    // 初始化保底计数（需要后续计算）
    record.pity = 0;

    // 判断是否限定（根据稀有度和名称）
    record.isLimited = ocrRecord.isLimited || false;

    return record;
  });

  return records;
}

/**
 * 批量解析多张图片的 OCR 结果
 * @param {Object} batchOcrResult - 批量 OCR 服务返回的结果
 * @param {Object} options - 解析选项
 * @returns {{allRecords: Array, byImage: Array, summary: Object}}
 */
export function parseBatchOcrResult(batchOcrResult, options = {}) {
  if (!batchOcrResult.success || !batchOcrResult.results) {
    throw createImportError(
      ImportErrorType.PARSE_ERROR,
      '批量 OCR 结果格式错误'
    );
  }

  const byImage = [];
  const allRecords = [];
  let totalRecords = 0;
  let failedImages = 0;

  batchOcrResult.results.forEach((result, index) => {
    if (result.success) {
      const records = parseOcrResult(
        { success: true, records: result.records },
        options
      );

      // 为同一张图片的记录分配相同的批次ID
      const batchId = generateBatchId();
      const recordsWithBatch = records.map(r => ({ ...r, batchId }));

      byImage.push({
        imageIndex: result.image_index || index,
        success: true,
        records: recordsWithBatch,
        count: recordsWithBatch.length
      });

      allRecords.push(...recordsWithBatch);
      totalRecords += recordsWithBatch.length;
    } else {
      byImage.push({
        imageIndex: result.image_index || index,
        success: false,
        error: result.error
      });
      failedImages++;
    }
  });

  return {
    allRecords,
    byImage,
    summary: {
      totalImages: batchOcrResult.results.length,
      successImages: batchOcrResult.results.length - failedImages,
      failedImages,
      totalRecords,
      processingTime: batchOcrResult.processing_time
    }
  };
}

/**
 * 后处理：计算保底进度
 * @param {Array} records - 记录列表（按时间排序）
 * @returns {Array} 带保底进度的记录列表
 */
export function calculatePityForOcrRecords(records) {
  // 按卡池分组
  const byPool = {};

  records.forEach(record => {
    if (!byPool[record.pool]) {
      byPool[record.pool] = [];
    }
    byPool[record.pool].push(record);
  });

  // 为每个卡池计算保底
  Object.keys(byPool).forEach(poolId => {
    const poolRecords = byPool[poolId];

    // 按时间戳排序（从旧到新）
    poolRecords.sort((a, b) => a.timestamp - b.timestamp);

    let pityCount = 0;

    poolRecords.forEach(record => {
      pityCount++;
      record.pity = pityCount;

      // 如果出了6星，重置保底
      if (record.rarity === 6) {
        pityCount = 0;
      }
    });
  });

  return records;
}

/**
 * 校正识别错误
 * @param {Array} records - 记录列表
 * @param {Object} corrections - 用户提供的校正信息
 * @returns {Array} 校正后的记录列表
 */
export function correctOcrRecords(records, corrections) {
  return records.map((record, index) => {
    if (corrections[index]) {
      return {
        ...record,
        ...corrections[index],
        corrected: true
      };
    }
    return record;
  });
}

/**
 * 过滤低置信度记录
 * @param {Array} records - 记录列表
 * @param {number} threshold - 置信度阈值（0-1）
 * @returns {{filtered: Array, removed: Array}}
 */
export function filterLowConfidenceRecords(records, threshold = 0.8) {
  const filtered = [];
  const removed = [];

  records.forEach(record => {
    if (record.confidence >= threshold) {
      filtered.push(record);
    } else {
      removed.push(record);
    }
  });

  return { filtered, removed };
}

/**
 * 从图片文件名推测时间
 * @param {string} filename - 文件名
 * @returns {number|null} 时间戳或 null
 */
export function inferTimestampFromFilename(filename) {
  // 尝试从文件名中提取时间信息
  // 常见格式：
  // - Screenshot_20260122_143000.png
  // - gacha_2026-01-22_14-30-00.jpg
  // - 抽卡记录_20260122.png

  const patterns = [
    /(\d{8})_(\d{6})/,           // 20260122_143000
    /(\d{4})-(\d{2})-(\d{2})[-_](\d{2})[-:](\d{2})[-:](\d{2})/, // 2026-01-22-14-30-00
    /(\d{8})/                     // 20260122
  ];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match) {
      try {
        if (match[1].length === 8) {
          // YYYYMMDD 格式
          const year = match[1].substring(0, 4);
          const month = match[1].substring(4, 6);
          const day = match[1].substring(6, 8);
          const hour = match[2] ? match[2].substring(0, 2) : '00';
          const minute = match[2] ? match[2].substring(2, 4) : '00';
          const second = match[2] ? match[2].substring(4, 6) : '00';

          const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
          return date.getTime();
        } else if (match.length >= 4) {
          // YYYY-MM-DD 格式
          const date = new Date(
            match[1],
            parseInt(match[2]) - 1,
            match[3],
            match[4] || 0,
            match[5] || 0,
            match[6] || 0
          );
          return date.getTime();
        }
      } catch (e) {
        console.warn('无法解析文件名中的时间:', filename);
      }
    }
  }

  return null;
}

/**
 * 为 OCR 记录分配时间戳（根据文件名或用户输入）
 * @param {Array} records - 记录列表
 * @param {Object} options - 选项
 * @param {string} options.filename - 文件名
 * @param {number} options.timestamp - 用户指定的时间戳
 * @returns {Array} 带时间戳的记录列表
 */
export function assignTimestampsToOcrRecords(records, options = {}) {
  let timestamp;

  if (options.timestamp) {
    // 用户指定的时间戳
    timestamp = options.timestamp;
  } else if (options.filename) {
    // 从文件名推测
    timestamp = inferTimestampFromFilename(options.filename);
  }

  // 如果仍然没有时间戳，使用当前时间
  if (!timestamp) {
    timestamp = Date.now();
  }

  return records.map((record, index) => ({
    ...record,
    // 同一批记录使用相同时间戳
    // 如果需要区分，可以加上微小的偏移
    timestamp: timestamp + index
  }));
}

/**
 * 生成 OCR 解析报告
 * @param {Array} records - 解析后的记录列表
 * @param {Object} rawOcrResult - 原始 OCR 结果
 * @returns {Object} 解析报告
 */
export function generateOcrParseReport(records, rawOcrResult) {
  const byRarity = {};
  const byConfidence = { high: 0, medium: 0, low: 0 };

  records.forEach(record => {
    // 按稀有度统计
    byRarity[record.rarity] = (byRarity[record.rarity] || 0) + 1;

    // 按置信度统计
    if (record.confidence >= 0.9) {
      byConfidence.high++;
    } else if (record.confidence >= 0.7) {
      byConfidence.medium++;
    } else {
      byConfidence.low++;
    }
  });

  return {
    totalRecords: records.length,
    byRarity,
    byConfidence,
    averageConfidence: (
      records.reduce((sum, r) => sum + r.confidence, 0) / records.length
    ).toFixed(3),
    needsReview: records.filter(r => r.confidence < 0.8).length,
    processingTime: rawOcrResult.processing_time
  };
}

export default {
  parseOcrResult,
  parseBatchOcrResult,
  calculatePityForOcrRecords,
  correctOcrRecords,
  filterLowConfidenceRecords,
  inferTimestampFromFilename,
  assignTimestampsToOcrRecords,
  generateOcrParseReport
};
