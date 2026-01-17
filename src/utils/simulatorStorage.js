/**
 * 模拟器状态持久化工具
 *
 * 管理模拟器状态的浏览器存储和导出
 */

const STORAGE_KEY = 'gacha_simulator_state';
const STORAGE_VERSION = '1.0';

/**
 * 保存模拟器状态到 localStorage
 * @param {string} poolType - 卡池类型
 * @param {Object} state - 模拟器状态
 */
export function saveSimulatorState(poolType, state) {
  try {
    const storageData = {
      version: STORAGE_VERSION,
      timestamp: Date.now(),
      poolType,
      state
    };
    localStorage.setItem(`${STORAGE_KEY}_${poolType}`, JSON.stringify(storageData));
    return true;
  } catch (error) {
    console.error('保存模拟器状态失败:', error);
    return false;
  }
}

/**
 * 从 localStorage 加载模拟器状态
 * @param {string} poolType - 卡池类型
 * @returns {Object|null} 模拟器状态或null
 */
export function loadSimulatorState(poolType) {
  try {
    const data = localStorage.getItem(`${STORAGE_KEY}_${poolType}`);
    if (!data) return null;

    const storageData = JSON.parse(data);

    // 版本检查
    if (storageData.version !== STORAGE_VERSION) {
      console.warn('存储版本不匹配，清除旧数据');
      clearSimulatorState(poolType);
      return null;
    }

    return storageData.state;
  } catch (error) {
    console.error('加载模拟器状态失败:', error);
    return null;
  }
}

/**
 * 清除指定卡池的存储数据
 * @param {string} poolType - 卡池类型
 */
export function clearSimulatorState(poolType) {
  try {
    localStorage.removeItem(`${STORAGE_KEY}_${poolType}`);
    return true;
  } catch (error) {
    console.error('清除模拟器状态失败:', error);
    return false;
  }
}

/**
 * 清除所有卡池的存储数据
 */
export function clearAllSimulatorStates() {
  const poolTypes = ['limited', 'weapon', 'standard'];
  poolTypes.forEach(type => clearSimulatorState(type));
}

/**
 * 将模拟器历史记录转换为可导入格式
 * @param {Array} pullHistory - 模拟器的抽卡历史
 * @param {string} poolId - 模拟池ID（sim_xxx格式）
 * @param {string} poolType - 卡池类型（limited/weapon/standard）
 * @returns {Array} 可导入的记录列表
 */
export function convertSimulatorHistoryToImportFormat(pullHistory, poolId, poolType) {
  if (!pullHistory || pullHistory.length === 0) {
    return [];
  }

  // 将卡池类型转换为导入系统需要的格式
  const poolTypeMap = {
    'limited': 'limited_character',
    'weapon': 'limited_weapon',
    'standard': 'standard'
  };
  const importPoolType = poolTypeMap[poolType] || 'limited_character';

  return pullHistory.map(record => ({
    pool: importPoolType,  // 使用标准卡池类型而非模拟池ID
    name: record.characterName || record.name || `${record.rarity}星角色`,
    rarity: record.rarity,
    timestamp: record.timestamp || Date.now(),
    isLimited: record.isUp || false  // 是否为限定角色（UP角色视为限定）
  }));
}

/**
 * 导出模拟器数据为JSON格式（可导入）
 * @param {Array} pullHistory - 模拟器的抽卡历史
 * @param {string} poolId - 模拟池ID
 * @param {string} poolType - 卡池类型（limited/weapon/standard）
 * @returns {string} JSON字符串
 */
export function exportSimulatorDataAsJSON(pullHistory, poolId, poolType) {
  const importData = convertSimulatorHistoryToImportFormat(pullHistory, poolId, poolType);
  return JSON.stringify(importData, null, 2);
}

/**
 * 导出模拟器数据为CSV格式（可导入）
 * @param {Array} pullHistory - 模拟器的抽卡历史
 * @param {string} poolId - 模拟池ID
 * @param {string} poolType - 卡池类型（limited/weapon/standard）
 * @returns {string} CSV字符串
 */
export function exportSimulatorDataAsCSV(pullHistory, poolId, poolType) {
  const importData = convertSimulatorHistoryToImportFormat(pullHistory, poolId, poolType);

  if (importData.length === 0) {
    return 'pool,name,rarity,timestamp,isLimited\n';
  }

  // CSV 表头
  const headers = ['pool', 'name', 'rarity', 'timestamp', 'isLimited'];
  let csv = headers.join(',') + '\n';

  // CSV 数据行
  importData.forEach(record => {
    const row = headers.map(header => {
      const value = record[header];
      // 处理包含逗号的字段，用双引号包裹
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    });
    csv += row.join(',') + '\n';
  });

  return csv;
}

/**
 * 下载模拟器数据（JSON或CSV格式）
 * @param {Array} pullHistory - 模拟器的抽卡历史
 * @param {string} poolId - 模拟池ID
 * @param {string} poolName - 卡池名称
 * @param {string} poolType - 卡池类型（limited/weapon/standard）
 * @param {string} format - 格式（'json' 或 'csv'）
 */
export function downloadSimulatorData(pullHistory, poolId, poolName, poolType, format = 'json') {
  let content, mimeType, extension;

  if (format === 'csv') {
    content = exportSimulatorDataAsCSV(pullHistory, poolId, poolType);
    mimeType = 'text/csv;charset=utf-8;';
    extension = 'csv';
  } else {
    content = exportSimulatorDataAsJSON(pullHistory, poolId, poolType);
    mimeType = 'application/json';
    extension = 'json';
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const sanitizedPoolName = poolName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
  const filename = `终末地模拟器_${sanitizedPoolName}_${timestamp}.${extension}`;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出模拟器分析报告为JSON
 * @param {Object} stats - 统计数据
 * @param {Object} pityInfo - 保底信息
 * @param {string} poolType - 卡池类型
 * @returns {string} JSON字符串
 */
export function exportAnalysisReport(stats, pityInfo, poolType) {
  const report = {
    exportTime: new Date().toISOString(),
    version: STORAGE_VERSION,
    poolType,
    summary: {
      totalPulls: stats.totalPulls,
      sixStarCount: stats.sixStarCount,
      fiveStarCount: stats.fiveStarCount,
      upSixStarCount: stats.upSixStarCount,
      sixStarRate: stats.sixStarRate,
      fiveStarRate: stats.fiveStarRate,
      upRate: stats.upRate,
      avgPullsPerSixStar: stats.avgPullsPerSixStar,
      expectedPulls: stats.expectedPulls
    },
    pityStatus: {
      sixStarPity: pityInfo.sixStar.current,
      fiveStarPity: pityInfo.fiveStar.current,
      guaranteedUpPity: pityInfo.guaranteedUp?.current || 0,
      isGuaranteedUp: pityInfo.guaranteedUp?.isActive || false
    },
    giftProgress: stats.gifts,
    hasReceivedInfoBook: stats.hasReceivedInfoBook,
    hasReceivedSelectGift: stats.hasReceivedSelectGift,
    sixStarHistory: stats.sixStarHistory.map(record => ({
      pullNumber: record.pullNumber,
      isUp: record.isUp,
      isLimited: record.isLimited,
      pityWhenPulled: record.pityWhenPulled,
      timestamp: record.timestamp
    }))
  };

  return JSON.stringify(report, null, 2);
}

/**
 * 下载JSON文件
 * @param {string} content - 文件内容
 * @param {string} filename - 文件名
 */
export function downloadJSON(content, filename) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 导出分析报告并下载
 * @param {Object} stats - 统计数据
 * @param {Object} pityInfo - 保底信息
 * @param {string} poolType - 卡池类型
 */
export function downloadAnalysisReport(stats, pityInfo, poolType) {
  const report = exportAnalysisReport(stats, pityInfo, poolType);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const poolName = poolType === 'limited' ? '限定池' : poolType === 'weapon' ? '武器池' : '常驻池';
  const filename = `终末地模拟器报告_${poolName}_${timestamp}.json`;

  downloadJSON(report, filename);
}

/**
 * 生成可分享的文本摘要
 * @param {Object} stats - 统计数据
 * @param {string} poolType - 卡池类型
 * @returns {string} 文本摘要
 */
export function generateShareText(stats, poolType) {
  const poolName = poolType === 'limited' ? '限定寻访' : poolType === 'weapon' ? '武器寻访' : '常驻寻访';

  let text = `【终末地 ${poolName} 模拟报告】\n\n`;
  text += `📊 总抽数: ${stats.totalPulls}\n`;
  text += `⭐ 6星数量: ${stats.sixStarCount} (${stats.sixStarRate}%)\n`;
  text += `⭐ 5星数量: ${stats.fiveStarCount} (${stats.fiveStarRate}%)\n`;

  if (poolType !== 'standard') {
    text += `🎯 UP 6星: ${stats.upSixStarCount} (不歪率: ${stats.upRate}%)\n`;
  }

  text += `📈 平均出货: ${stats.avgPullsPerSixStar} 抽/个\n`;
  text += `🎲 期望抽数: ${stats.expectedPulls} 抽\n\n`;

  // 赠送进度
  if (poolType === 'limited' && stats.gifts.count > 0) {
    text += `🎁 已领赠送: ${stats.gifts.count} 次 (每240抽)\n`;
  } else if (poolType === 'weapon') {
    text += `🎁 已领赠送: 常驻×${stats.gifts.standardCount} 限定×${stats.gifts.limitedCount}\n`;
  } else if (poolType === 'standard' && stats.hasReceivedSelectGift) {
    text += `🎁 已领自选6星 (300抽)\n`;
  }

  if (stats.hasReceivedInfoBook) {
    text += `📖 已获取情报书 (60抽)\n`;
  }

  text += `\n🔗 终末地抽卡分析器 - 模拟器功能`;

  return text;
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} 是否成功
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级方案
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch (fallbackError) {
      console.error('复制到剪贴板失败:', fallbackError);
      return false;
    }
  }
}

export default {
  saveSimulatorState,
  loadSimulatorState,
  clearSimulatorState,
  clearAllSimulatorStates,
  convertSimulatorHistoryToImportFormat,
  exportSimulatorDataAsJSON,
  exportSimulatorDataAsCSV,
  downloadSimulatorData,
  exportAnalysisReport,
  downloadJSON,
  downloadAnalysisReport,
  generateShareText,
  copyToClipboard
};
