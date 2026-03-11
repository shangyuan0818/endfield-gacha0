import { useState, useCallback } from 'react';
import { useHistoryStore, usePoolStore, useAuthStore } from '../../stores';
import { supabase } from '../../supabaseClient';
import {
  buildExportCsvContent,
  buildExportJsonContent,
  buildExportPayload
} from '../../utils/dataExport';

/**
 * 数据导入导出 Hook
 */
export function useDataExportImport({
  showToast,
  cloudSync
}) {
  const user = useAuthStore(state => state.user);
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const currentGameUid = usePoolStore(state => state.currentGameUid);
  const setPools = usePoolStore(state => state.setPools);
  const history = useHistoryStore(state => state.history);
  const setHistory = useHistoryStore(state => state.setHistory);
  const setSyncing = useAuthStore(state => state.setSyncing);

  const { savePoolToCloud, saveHistoryToCloud } = cloudSync;

  const [pendingImport, setPendingImport] = useState(null);

  // 数据导入验证函数
  const validateImportData = useCallback((data) => {
    const errors = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['无效的数据格式'] };
    }

    if (!Array.isArray(data.pools)) {
      errors.push('缺少 pools 字段或格式错误');
    }

    if (!Array.isArray(data.history)) {
      errors.push('缺少 history 字段或格式错误');
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const validPoolIds = new Set();
    data.pools.forEach((pool, idx) => {
      if (!pool.id || typeof pool.id !== 'string') {
        errors.push(`卡池 #${idx + 1}: 缺少有效的 id`);
      } else {
        validPoolIds.add(pool.id);
      }

      if (!pool.name || typeof pool.name !== 'string') {
        errors.push(`卡池 #${idx + 1}: 缺少名称 (name)`);
      }

      if (!pool.type || !['limited', 'standard', 'weapon'].includes(pool.type)) {
        errors.push(`卡池 #${idx + 1}: 无效的类型 (type)，应为 limited/standard/weapon`);
      }
    });

    const historyIds = new Set();
    data.history.forEach((record, idx) => {
      if (!record.id || typeof record.id !== 'string') {
        errors.push(`记录 #${idx + 1}: 缺少有效的 id`);
      } else {
        if (historyIds.has(record.id)) {
          errors.push(`记录 #${idx + 1}: id 重复 (${record.id})`);
        }
        historyIds.add(record.id);
      }

      if (!record.pool_id || typeof record.pool_id !== 'string') {
        errors.push(`记录 #${idx + 1}: 缺少 pool_id`);
      } else if (!validPoolIds.has(record.pool_id) && !(pools || []).some(p => p.id === record.pool_id)) {
        errors.push(`记录 #${idx + 1}: pool_id (${record.pool_id}) 引用的卡池不存在`);
      }

      if (!record.rarity || typeof record.rarity !== 'number' || record.rarity < 3 || record.rarity > 6) {
        errors.push(`记录 #${idx + 1}: rarity 应为 3-6 的数字`);
      }

      if (!record.item_name || typeof record.item_name !== 'string') {
        errors.push(`记录 #${idx + 1}: 缺少 item_name`);
      }
    });

    const maxErrors = 10;
    if (errors.length > maxErrors) {
      const totalErrors = errors.length;
      errors.length = maxErrors;
      errors.push(`... 还有 ${totalErrors - maxErrors} 个错误`);
    }

    return {
      valid: errors.length === 0,
      errors,
      stats: {
        poolCount: data.pools.length,
        historyCount: data.history.length
      }
    };
  }, [pools]);

  const triggerFileDownload = useCallback((content, mimeType, extension) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const timeStr = `${now.getFullYear().toString().slice(-2)}-${pad(now.getMonth()+1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    link.download = `endfield-gacha-export-${timeStr}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const buildPayload = useCallback((options) => buildExportPayload({
    history,
    pools: Array.isArray(pools) ? pools : [],
    currentPoolId,
    currentGameUid,
    currentUserId: user?.id || null,
    options
  }), [currentGameUid, currentPoolId, history, pools, user?.id]);

  // 通用导出函数 - JSON
  const handleExportJSON = useCallback((scopeOrOptions) => {
    const payload = buildPayload(scopeOrOptions);
    if (payload.history.length === 0) {
      showToast('所选条件下无数据可导出', 'warning');
      return;
    }

    triggerFileDownload(
      buildExportJsonContent(payload),
      'application/json',
      'json'
    );
  }, [buildPayload, showToast, triggerFileDownload]);

  // 通用导出函数 - CSV
  const handleExportCSV = useCallback((scopeOrOptions) => {
    const payload = buildPayload(scopeOrOptions);
    if (payload.history.length === 0) {
      showToast('所选条件下无数据可导出', 'warning');
      return;
    }

    triggerFileDownload(
      buildExportCsvContent(payload),
      'text/csv;charset=utf-8;',
      'csv'
    );
  }, [buildPayload, showToast, triggerFileDownload]);

  // 导入文件处理
  const handleImportFile = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast("文件过大，最大支持 10MB", 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);

        const validation = validateImportData(importedData);
        if (!validation.valid) {
          showToast(`数据验证失败：\n${validation.errors.slice(0, 3).join('\n')}`, 'error');
          return;
        }

        const willSyncToCloud = !!(user && supabase);

        setPendingImport({
          data: importedData,
          willSyncToCloud,
          stats: validation.stats
        });

      } catch {
        showToast("导入失败：文件解析错误。请确保是合法的JSON文件。", 'error');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }, [showToast, user, validateImportData]);

  // 确认导入
  const confirmImport = useCallback(async () => {
    if (!pendingImport) return;

    const { data: importedData, willSyncToCloud } = pendingImport;

    const newPools = [...(pools || [])];
    const addedPools = [];
    importedData.pools.forEach(impPool => {
      if (!newPools.some(p => p.id === impPool.id)) {
        newPools.push(impPool);
        addedPools.push(impPool);
      }
    });

    const newHistory = [...history];
    const existingIds = new Set(newHistory.map(h => h.id));
    const addedHistory = [];

    importedData.history.forEach(impItem => {
      if (!existingIds.has(impItem.id)) {
        newHistory.push(impItem);
        addedHistory.push(impItem);
      }
    });

    setPools(newPools);
    setHistory(newHistory);
    setPendingImport(null);

    if (willSyncToCloud && (addedPools.length > 0 || addedHistory.length > 0)) {
      setSyncing(true);
      try {
        for (const pool of addedPools) {
          await savePoolToCloud(pool);
        }
        const batchSize = 100;
        for (let i = 0; i < addedHistory.length; i += batchSize) {
          const batch = addedHistory.slice(i, i + batchSize);
          await saveHistoryToCloud(batch);
        }
        showToast(`导入完成！新增了 ${addedHistory.length} 条记录，已同步到云端。`, 'success', '导入成功');
      } catch (syncError) {
        showToast(`新增了 ${addedHistory.length} 条记录，但云端同步失败: ${syncError.message}`, 'warning', '部分成功');
      } finally {
        setSyncing(false);
      }
    } else {
      showToast(`导入完成！新增了 ${addedHistory.length} 条记录。`, 'success', '导入成功');
    }
  }, [pendingImport, pools, history, setPools, setHistory, setSyncing, savePoolToCloud, saveHistoryToCloud, showToast]);

  return {
    pendingImport,
    setPendingImport,
    handleExportJSON,
    handleExportCSV,
    handleImportFile,
    confirmImport
  };
}

export default useDataExportImport;
