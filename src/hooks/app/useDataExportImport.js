import { useState, useCallback } from 'react';
import { useHistoryStore, usePoolStore, useAuthStore } from '../../stores';
import { supabase } from '../../supabaseClient';
import { applyCloudDataToStores } from '../../utils/cloudDataSync.js';
import {
  buildExportContent,
  buildExportPayload
} from '../../utils/dataExport';
import {
  getHistoryImportDedupKey,
  validateAndNormalizeImportData
} from '../../utils/dataImport.js';
import {
  buildImportedGameAccountMetadataEntries,
  saveGameAccountMetadata
} from '../../utils/gameAccountMetadata.js';

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
  const switchPool = usePoolStore(state => state.switchPool);
  const switchGameAccount = usePoolStore(state => state.switchGameAccount);
  const history = useHistoryStore(state => state.history);
  const setHistory = useHistoryStore(state => state.setHistory);
  const setSyncing = useAuthStore(state => state.setSyncing);

  const { savePoolToCloud, saveHistoryToCloud, loadCloudData } = cloudSync;

  const [pendingImport, setPendingImport] = useState(null);

  const getRecordGameUid = useCallback((record) => (
    record?.gameUid || record?.game_uid || null
  ), []);

  const resolvePreferredImportedGameUid = useCallback((historyRecords, importedAccounts = []) => {
    const availableGameUids = [
      ...new Set(
        (Array.isArray(historyRecords) ? historyRecords : [])
          .map(getRecordGameUid)
          .filter(Boolean)
      )
    ];

    if (currentGameUid && availableGameUids.includes(currentGameUid)) {
      return currentGameUid;
    }

    const importedAccountUid = importedAccounts
      .map((account) => account?.gameUid || account?.hgUid || null)
      .find((value) => value && availableGameUids.includes(value));

    return importedAccountUid || availableGameUids[0] || null;
  }, [currentGameUid, getRecordGameUid]);

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

  const exportByFormat = useCallback((scopeOrOptions, formatId) => {
    const payload = buildPayload(scopeOrOptions);
    if (payload.history.length === 0) {
      showToast('所选条件下无数据可导出', 'warning');
      return;
    }

    const file = buildExportContent(formatId, payload);
    triggerFileDownload(file.content, file.mimeType, file.extension);
  }, [buildPayload, showToast, triggerFileDownload]);

  // 通用导出函数 - JSON
  const handleExportJSON = useCallback((scopeOrOptions) => {
    exportByFormat(scopeOrOptions, 'internal_json_v3');
  }, [exportByFormat]);

  // 通用导出函数 - CSV
  const handleExportCSV = useCallback((scopeOrOptions) => {
    exportByFormat(scopeOrOptions, 'internal_csv_flat');
  }, [exportByFormat]);

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

        const validation = validateAndNormalizeImportData(importedData, {
          existingPools: pools,
          currentUserId: user?.id || null
        });
        if (!validation.valid) {
          showToast(`数据验证失败：\n${validation.errors.slice(0, 3).join('\n')}`, 'error');
          return;
        }

        const willSyncToCloud = !!(user && supabase);

        setPendingImport({
          data: validation.normalizedData,
          willSyncToCloud,
          stats: validation.stats
        });

      } catch {
        showToast("导入失败：文件解析错误。请确保是合法的JSON文件。", 'error');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }, [pools, showToast, user]);

  // 确认导入
  const confirmImport = useCallback(async () => {
    if (!pendingImport) return;

    const { data: importedData, willSyncToCloud } = pendingImport;

    const newPools = [...(pools || [])];
    const existingPoolIds = new Set(newPools.map(pool => pool?.id).filter(Boolean));
    const addedPools = [];
    importedData.pools.forEach((impPool) => {
      if (!existingPoolIds.has(impPool.id)) {
        newPools.push(impPool);
        addedPools.push(impPool);
        existingPoolIds.add(impPool.id);
      }
    });

    const newHistory = [...history];
    const existingHistoryKeys = new Set(
      newHistory
        .map(getHistoryImportDedupKey)
        .filter(Boolean)
    );
    const addedHistory = [];

    importedData.history.forEach((impItem) => {
      const dedupKey = getHistoryImportDedupKey(impItem);
      if (!dedupKey || !existingHistoryKeys.has(dedupKey)) {
        newHistory.push(impItem);
        addedHistory.push(impItem);
        if (dedupKey) {
          existingHistoryKeys.add(dedupKey);
        }
      }
    });

    const importedAccounts = buildImportedGameAccountMetadataEntries({
      accounts: importedData.accounts || [],
      historyRecords: importedData.history || [],
      importedAt: importedData.importedAt,
      importSource: importedData.sourceFormatId || 'file_import'
    });

    importedAccounts.forEach((account) => {
      saveGameAccountMetadata(account);
    });

    const preferredImportedGameUid = resolvePreferredImportedGameUid(newHistory, importedAccounts);

    applyCloudDataToStores(
      { pools: newPools, history: newHistory },
      {
        setPools,
        switchPool,
        setHistory,
        preferredPoolId: currentPoolId,
        preferredGameUid: preferredImportedGameUid
      }
    );
    if (preferredImportedGameUid) {
      switchGameAccount(preferredImportedGameUid);
    }
    setPendingImport(null);

    if (willSyncToCloud && (addedPools.length > 0 || addedHistory.length > 0)) {
      setSyncing(true);
      try {
        for (const pool of addedPools) {
          // eslint-disable-next-line no-await-in-loop -- imported pools are synced sequentially so partial failures stay attributable
          await savePoolToCloud(pool);
        }
        const batchSize = 100;
        for (let i = 0; i < addedHistory.length; i += batchSize) {
          const batch = addedHistory.slice(i, i + batchSize);
          // eslint-disable-next-line no-await-in-loop -- imported history batches are intentionally serialized
          await saveHistoryToCloud(batch);
        }

        if (typeof loadCloudData === 'function' && user) {
          const refreshedCloudData = await loadCloudData(user);
          if (refreshedCloudData) {
            applyCloudDataToStores(refreshedCloudData, {
              setPools,
              switchPool,
              setHistory,
              preferredPoolId: currentPoolId,
              preferredGameUid: preferredImportedGameUid
            });
            if (preferredImportedGameUid) {
              switchGameAccount(preferredImportedGameUid);
            }
          }
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
  }, [pendingImport, pools, history, currentPoolId, loadCloudData, resolvePreferredImportedGameUid, savePoolToCloud, saveHistoryToCloud, setHistory, setPools, setSyncing, showToast, switchGameAccount, switchPool, user]);

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
