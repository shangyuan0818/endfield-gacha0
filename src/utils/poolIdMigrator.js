/**
 * @file poolIdMigrator.js
 * @description 卡池ID迁移工具 - 将旧时间戳ID迁移到语义化ID
 * @date 2026-01-11
 * @feat FEAT-007 卡池详情系统重构 - 卡池ID迁移
 */

import { supabase } from '../supabaseClient';
import {
  generateSemanticPoolId,
  isLegacyPoolId,
  isSemanticPoolId
} from './poolIdGenerator';

/**
 * 迁移结果统计
 * @typedef {Object} MigrationResult
 * @property {number} total - 总池数
 * @property {number} migrated - 已迁移数
 * @property {number} skipped - 跳过数（已是新ID）
 * @property {number} failed - 失败数
 * @property {Array<Object>} errors - 错误详情
 * @property {Array<Object>} mapping - ID映射表 [{oldId, newId, poolName}]
 */

/**
 * 批量迁移卡池ID（前端LocalStorage版本）
 *
 * @param {Array<Object>} pools - 旧卡池列表
 * @param {string} userId - 当前用户ID
 * @param {Object} options - 迁移选项
 * @param {boolean} [options.dryRun=false] - 是否为模拟运行（不实际修改数据）
 * @param {Function} [options.onProgress] - 进度回调 (current, total, poolName)
 * @returns {Promise<MigrationResult>} 迁移结果
 */
export async function migratePoolIds(pools, userId, options = {}) {
  const { dryRun = false, onProgress } = options;

  const result = {
    total: pools.length,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    mapping: []
  };

  if (!userId) {
    result.errors.push({ message: '用户未登录，无法迁移' });
    return result;
  }

  const migratedPools = [];
  const idMapping = new Map(); // oldId -> newId

  for (let i = 0; i < pools.length; i++) {
    const pool = pools[i];

    // 进度回调
    if (onProgress) {
      onProgress(i + 1, pools.length, pool.name);
    }

    try {
      // 1. 跳过已迁移的池
      if (!isLegacyPoolId(pool.id)) {
        result.skipped++;
        migratedPools.push(pool);
        continue;
      }

      // 2. 生成新ID
      const newId = generateSemanticPoolId(pool, userId, migratedPools);

      // 3. 记录映射关系
      idMapping.set(pool.id, newId);
      result.mapping.push({
        oldId: pool.id,
        newId: newId,
        poolName: pool.name
      });

      // 4. 创建迁移后的池对象
      const migratedPool = {
        ...pool,
        id: newId,
        legacy_pool_id: pool.id, // 保留旧ID
        updated_at: new Date().toISOString()
      };

      migratedPools.push(migratedPool);
      result.migrated++;

    } catch (error) {
      console.error(`迁移卡池 ${pool.name} 失败:`, error);
      result.failed++;
      result.errors.push({
        poolId: pool.id,
        poolName: pool.name,
        error: error.message
      });

      // 失败时保留原池
      migratedPools.push(pool);
    }
  }

  // 返回结果
  return {
    ...result,
    pools: dryRun ? pools : migratedPools, // 干跑模式不返回迁移后的数据
    idMapping: Object.fromEntries(idMapping)
  };
}

/**
 * 更新历史记录中的 pool_id 引用
 *
 * @param {Array<Object>} history - 历史记录列表
 * @param {Object} idMapping - ID映射表 {oldId: newId}
 * @returns {Array<Object>} 更新后的历史记录
 */
export function updateHistoryPoolIds(history, idMapping) {
  return history.map(record => {
    const oldPoolId = record.poolId;
    const newPoolId = idMapping[oldPoolId];

    if (newPoolId) {
      return {
        ...record,
        poolId: newPoolId,
        legacy_pool_id: oldPoolId, // 保留旧ID
        updated_at: new Date().toISOString()
      };
    }

    return record; // 未找到映射时保持原样
  });
}

/**
 * 迁移Supabase云端数据
 *
 * @param {string} userId - 用户ID
 * @param {Object} options - 迁移选项
 * @param {boolean} [options.dryRun=false] - 是否为模拟运行
 * @param {Function} [options.onProgress] - 进度回调
 * @returns {Promise<MigrationResult>} 迁移结果
 */
export async function migrateCloudPoolIds(userId, options = {}) {
  const { dryRun = false, onProgress } = options;

  if (!supabase) {
    throw new Error('Supabase 未配置');
  }

  const result = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    mapping: []
  };

  try {
    // 1. 从云端加载卡池数据
    const { data: pools, error: fetchError } = await supabase
      .from('pools')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');

    if (fetchError) {
      throw new Error(`加载云端数据失败: ${fetchError.message}`);
    }

    if (!pools || pools.length === 0) {
      return result;
    }

    result.total = pools.length;

    // 2. 执行迁移
    const migratedPools = [];
    const idMapping = new Map();

    for (let i = 0; i < pools.length; i++) {
      const pool = pools[i];

      if (onProgress) {
        onProgress(i + 1, pools.length, pool.name);
      }

      // 跳过已迁移的池（检查 pool_id 是否为旧格式）
      if (!isLegacyPoolId(pool.pool_id)) {
        result.skipped++;
        continue;
      }

      try {
        // 生成新ID（使用 pool_id 而非 id）
        const poolData = {
          name: pool.name,
          type: pool.type
        };
        const newId = generateSemanticPoolId(poolData, userId, migratedPools);

        idMapping.set(pool.pool_id, newId);
        result.mapping.push({
          oldId: pool.pool_id,
          newId: newId,
          poolName: pool.name
        });

        if (!dryRun) {
          // 调用数据库迁移函数
          const { error: migrateError } = await supabase.rpc('migrate_pool_id', {
            old_id: pool.pool_id,
            new_id: newId,
            user_uuid: userId
          });

          if (migrateError) {
            throw new Error(migrateError.message);
          }
        }

        migratedPools.push({
          ...pool,
          pool_id: newId,
          legacy_pool_id: pool.pool_id
        });

        result.migrated++;

      } catch (error) {
        console.error(`迁移云端卡池 ${pool.name} 失败:`, error);
        result.failed++;
        result.errors.push({
          poolId: pool.pool_id,
          poolName: pool.name,
          error: error.message
        });
      }
    }

    return {
      ...result,
      idMapping: Object.fromEntries(idMapping)
    };

  } catch (error) {
    result.errors.push({ message: error.message });
    return result;
  }
}

/**
 * 完整迁移流程（本地 + 云端）
 *
 * @param {Object} params - 迁移参数
 * @param {Array<Object>} params.localPools - 本地卡池列表
 * @param {Array<Object>} params.localHistory - 本地历史记录
 * @param {string} params.userId - 用户ID
 * @param {Object} [params.options] - 迁移选项
 * @param {boolean} [params.options.dryRun=false] - 是否模拟运行
 * @param {boolean} [params.options.migrateCloud=true] - 是否迁移云端
 * @param {Function} [params.options.onProgress] - 进度回调
 * @returns {Promise<Object>} 迁移结果 { local: MigrationResult, cloud: MigrationResult }
 */
export async function migrateAllData(params) {
  const {
    localPools,
    localHistory,
    userId,
    options = {}
  } = params;

  const {
    dryRun = false,
    migrateCloud = true,
    onProgress
  } = options;

  const result = {
    local: null,
    cloud: null,
    success: false
  };

  try {
    // 1. 迁移本地卡池
    if (onProgress) {
      onProgress({ stage: 'local_pools', progress: 0, message: '正在迁移本地卡池...' });
    }

    const localResult = await migratePoolIds(localPools, userId, {
      dryRun,
      onProgress: (current, total, poolName) => {
        if (onProgress) {
          onProgress({
            stage: 'local_pools',
            progress: Math.floor((current / total) * 100),
            message: `正在迁移: ${poolName}`
          });
        }
      }
    });

    result.local = localResult;

    // 2. 更新本地历史记录
    if (!dryRun && localResult.migrated > 0) {
      if (onProgress) {
        onProgress({ stage: 'local_history', progress: 0, message: '正在更新历史记录...' });
      }

      const updatedHistory = updateHistoryPoolIds(localHistory, localResult.idMapping);
      result.local.updatedHistory = updatedHistory;
    }

    // 3. 迁移云端数据（可选）
    if (migrateCloud && supabase) {
      if (onProgress) {
        onProgress({ stage: 'cloud', progress: 0, message: '正在迁移云端数据...' });
      }

      const cloudResult = await migrateCloudPoolIds(userId, {
        dryRun,
        onProgress: (current, total, poolName) => {
          if (onProgress) {
            onProgress({
              stage: 'cloud',
              progress: Math.floor((current / total) * 100),
              message: `正在迁移云端: ${poolName}`
            });
          }
        }
      });

      result.cloud = cloudResult;
    }

    // 4. 完成
    result.success = result.local.failed === 0 && (!result.cloud || result.cloud.failed === 0);

    if (onProgress) {
      onProgress({
        stage: 'complete',
        progress: 100,
        message: result.success ? '迁移完成' : '迁移完成（部分失败）'
      });
    }

    return result;

  } catch (error) {
    console.error('迁移失败:', error);
    return {
      ...result,
      success: false,
      error: error.message
    };
  }
}

/**
 * 验证迁移结果
 *
 * @param {Array<Object>} originalPools - 原始卡池列表
 * @param {Array<Object>} migratedPools - 迁移后的卡池列表
 * @param {Object} idMapping - ID映射表
 * @returns {Object} 验证结果
 */
export function validateMigration(originalPools, migratedPools, idMapping) {
  const validation = {
    valid: true,
    errors: [],
    warnings: []
  };

  // 1. 检查数量是否一致
  if (originalPools.length !== migratedPools.length) {
    validation.valid = false;
    validation.errors.push({
      type: 'COUNT_MISMATCH',
      message: `卡池数量不匹配: 原始${originalPools.length}个，迁移后${migratedPools.length}个`
    });
  }

  // 2. 检查每个池是否正确映射
  originalPools.forEach(original => {
    const expectedNewId = idMapping[original.id];
    if (!expectedNewId) {
      validation.warnings.push({
        type: 'NO_MAPPING',
        poolId: original.id,
        message: `卡池 ${original.name} 未找到映射关系`
      });
      return;
    }

    const migrated = migratedPools.find(p => p.id === expectedNewId);
    if (!migrated) {
      validation.valid = false;
      validation.errors.push({
        type: 'POOL_NOT_FOUND',
        poolId: original.id,
        newId: expectedNewId,
        message: `迁移后的卡池未找到: ${original.name}`
      });
      return;
    }

    // 检查关键字段是否保持一致
    if (migrated.name !== original.name) {
      validation.errors.push({
        type: 'NAME_MISMATCH',
        poolId: original.id,
        message: `卡池名称不一致: "${original.name}" -> "${migrated.name}"`
      });
    }

    if (migrated.type !== original.type) {
      validation.errors.push({
        type: 'TYPE_MISMATCH',
        poolId: original.id,
        message: `卡池类型不一致: ${original.type} -> ${migrated.type}`
      });
    }

    // 检查是否保留了旧ID
    if (migrated.legacy_pool_id !== original.id) {
      validation.warnings.push({
        type: 'LEGACY_ID_MISSING',
        poolId: original.id,
        message: `未正确保存旧ID: ${original.name}`
      });
    }
  });

  // 3. 检查新ID格式
  migratedPools.forEach(pool => {
    if (isLegacyPoolId(pool.id)) {
      validation.warnings.push({
        type: 'STILL_LEGACY_ID',
        poolId: pool.id,
        message: `卡池仍为旧ID格式: ${pool.name}`
      });
    }

    if (!isSemanticPoolId(pool.id) && !isLegacyPoolId(pool.id)) {
      validation.errors.push({
        type: 'INVALID_ID_FORMAT',
        poolId: pool.id,
        message: `卡池ID格式不正确: ${pool.name}`
      });
    }
  });

  return validation;
}

/**
 * 生成迁移报告（Markdown格式）
 *
 * @param {Object} migrationResult - 迁移结果
 * @returns {string} Markdown报告
 */
export function generateMigrationReport(migrationResult) {
  const { local, cloud, success } = migrationResult;

  let report = '# 卡池ID迁移报告\n\n';
  report += `**迁移时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
  report += `**总体状态**: ${success ? '✅ 成功' : '⚠️ 部分失败'}\n\n`;

  // 本地迁移统计
  if (local) {
    report += '## 本地数据迁移\n\n';
    report += `- 总卡池数: ${local.total}\n`;
    report += `- 成功迁移: ${local.migrated}\n`;
    report += `- 跳过（已是新ID）: ${local.skipped}\n`;
    report += `- 失败: ${local.failed}\n\n`;

    if (local.mapping.length > 0) {
      report += '### ID映射表\n\n';
      report += '| 原ID | 新ID | 卡池名称 |\n';
      report += '|------|------|----------|\n';
      local.mapping.forEach(m => {
        report += `| ${m.oldId} | ${m.newId} | ${m.poolName} |\n`;
      });
      report += '\n';
    }

    if (local.errors.length > 0) {
      report += '### 错误详情\n\n';
      local.errors.forEach(err => {
        report += `- **${err.poolName || '未知'}**: ${err.error}\n`;
      });
      report += '\n';
    }
  }

  // 云端迁移统计
  if (cloud) {
    report += '## 云端数据迁移\n\n';
    report += `- 总卡池数: ${cloud.total}\n`;
    report += `- 成功迁移: ${cloud.migrated}\n`;
    report += `- 跳过: ${cloud.skipped}\n`;
    report += `- 失败: ${cloud.failed}\n\n`;

    if (cloud.errors.length > 0) {
      report += '### 错误详情\n\n';
      cloud.errors.forEach(err => {
        report += `- **${err.poolName || '未知'}**: ${err.error}\n`;
      });
      report += '\n';
    }
  }

  report += '---\n';
  report += '*建议保留此报告6个月，以便回溯旧ID*\n';

  return report;
}

// 开发环境下暴露到 window（方便调试）
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.__poolIdMigrator = {
    migratePoolIds,
    updateHistoryPoolIds,
    migrateCloudPoolIds,
    migrateAllData,
    validateMigration,
    generateMigrationReport
  };
}
