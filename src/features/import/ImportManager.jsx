import { useState, useCallback } from 'react';
import { Save, RefreshCw, HelpCircle, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthStore, useHistoryStore, usePoolStore } from '../../stores';
import { supabase } from '../../supabaseClient';
import {
  buildImportedGameAccountMetadataEntries,
  getHistoryRecordGameUid,
  saveGameAccountMetadata
} from '../../utils/gameAccountMetadata.js';
import { applyCloudDataToStores } from '../../utils/cloudDataSync.js';
import { useCloudSync } from '../../hooks';
import { upsertHistory, upsertPools } from '../../services/cloudWriteService.js';
import {
  filterImportedHistoryRecords,
  prepareOfficialImportPersistenceData,
} from './importPersistence.js';
import OfficialAPIImport from './OfficialAPIImport';

/**
 * 导入状态枚举
 */
const ImportStatus = {
  IDLE: 'idle',
  SAVING: 'saving',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * 导入进度条组件 (Technical Style)
 */
const ImportProgressBar = ({ progress, status, message }) => {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1 text-[10px] font-mono uppercase text-slate-500 dark:text-zinc-500 transition-colors">
        <span className="flex items-center gap-2">
          {status === ImportStatus.SAVING ? (
            <>
              <Save size={10} className="animate-pulse text-blue-600 dark:text-blue-500" />
              正在保存到云端
            </>
          ) : (
            <>
              <RefreshCw size={10} className="animate-spin text-amber-500 dark:text-yellow-500" />
              处理中
            </>
          )}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-200 dark:bg-zinc-800 relative overflow-hidden transition-colors">
        <div 
          className={`h-full transition-all duration-300 ${status === ImportStatus.SAVING ? 'bg-blue-600 dark:bg-blue-500' : 'bg-amber-500 dark:bg-yellow-500'}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="mt-1 text-xs text-slate-500 dark:text-zinc-400 font-mono text-center transition-colors">
        {message}
      </div>
    </div>
  );
};

/**
 * ImportManager 组件 V3
 */
export default function ImportManager({ isOpen, onClose, onImportComplete }) {
  const [importStatus, setImportStatus] = useState(ImportStatus.IDLE);
  const [importResult, setImportResult] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [errorMessage, setErrorMessage] = useState('');
  const [fetchStatus, setFetchStatus] = useState('idle'); // 追踪子组件的获取状态

  // 从 stores 获取数据
  const user = useAuthStore(state => state.user);
  const pools = usePoolStore(state => state.pools);
  const currentPoolId = usePoolStore(state => state.currentPoolId);
  const setPools = usePoolStore(state => state.setPools);
  const switchPool = usePoolStore(state => state.switchPool);
  const switchGameAccount = usePoolStore(state => state.switchGameAccount);
  const setHistory = useHistoryStore(state => state.setHistory);
  const { loadCloudData } = useCloudSync({ showToast: () => {} });

  // 处理子组件的获取状态变化
  const handleFetchStatusChange = useCallback((status) => {
    setFetchStatus(status);
  }, []);

  const persistImportedAccountMetadata = useCallback(({
    accounts,
    historyRecords,
    importedAt,
    importSource
  }) => {
    const metadataEntries = buildImportedGameAccountMetadataEntries({
      accounts,
      historyRecords,
      importedAt,
      importSource
    });

    metadataEntries.forEach((entry) => {
      saveGameAccountMetadata(entry);
    });
  }, []);

  /**
   * 直接保存卡池到 Supabase
   * 修改为：首次创建，后续不更新（避免多账号导入时覆盖）
   */
  const savePoolsToServer = useCallback(async (poolEntries) => {
    if (!supabase || !user || poolEntries.length === 0) return;
    await upsertPools(supabase, poolEntries, user.id);
  }, [user]);

  /**
   * 直接保存历史记录到 Supabase
   */
  const saveHistoryToServer = useCallback(async (records) => {
    if (!supabase || !user || records.length === 0) return;

    const batchSize = 100;
    let savedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await upsertHistory(supabase, batch, user.id);
      savedCount += batch.length;
      setSaveProgress({ current: savedCount, total: records.length });
    }
  }, [user]);

  /**
   * 从服务器查询已存在的记录（用于去重）
   * 使用 game_uid + pool_id + seq_id 组合作为唯一标识
   * 注意：seqId 是每个卡池独立的序列号，不同卡池可能有相同的 seqId
   */
  const getExistingSeqIds = useCallback(async (gameUid) => {
    if (!supabase || !user) return new Set();

    let query = supabase
      .from('history')
      .select('seq_id, game_uid, pool_id')
      .eq('user_id', user.id)
      .not('seq_id', 'is', null);

    // 如果指定了 gameUid，只查询该账号的记录
    if (gameUid) {
      query = query.eq('game_uid', gameUid);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[ImportManager] 查询已有记录失败:', error);
      return new Set();
    }

    // 返回 game_uid:pool_id:seq_id 组合的 Set（包含 pool_id 以区分不同卡池）
    return new Set(data.map(r => `${r.game_uid || 'unknown'}:${r.pool_id || 'unknown'}:${r.seq_id}`));
  }, [user]);

  /**
   * 处理 API 导入完成
   */
  const handleAPIImportComplete = useCallback(async (result) => {
    if (!result?.success) {
      setImportStatus(ImportStatus.ERROR);
      setErrorMessage(result?.error || '导入失败');
      return;
    }

    if (result.backendImported) {
      const importedAt = new Date().toISOString();
      const importedGameUid = result.userInfo?.gameUid || result.userInfo?.hgUid || null;

      if (result.userInfo) {
        saveGameAccountMetadata(result.userInfo);
      }

      try {
        const refreshedCloudData = await loadCloudData(user);
        applyCloudDataToStores(refreshedCloudData, {
          setPools,
          switchPool,
          setHistory,
          preferredPoolId: currentPoolId,
          preferredGameUid: importedGameUid
        });

        if (importedGameUid) {
          switchGameAccount(importedGameUid);
        }

        const refreshedHistory = Array.isArray(refreshedCloudData?.history)
          ? refreshedCloudData.history
          : [];
        const importedHistoryRecords = importedGameUid
          ? refreshedHistory.filter((record) => getHistoryRecordGameUid(record) === importedGameUid)
          : refreshedHistory;

        persistImportedAccountMetadata({
          accounts: result.userInfo ? [result.userInfo] : [],
          historyRecords: importedHistoryRecords,
          importedAt,
          importSource: 'official_api'
        });
      } catch (refreshError) {
        console.error('[ImportManager] 刷新导入后的云端数据失败:', refreshError);
        persistImportedAccountMetadata({
          accounts: result.userInfo ? [result.userInfo] : [],
          historyRecords: [],
          importedAt,
          importSource: 'official_api'
        });
      }

      setImportResult(result);
      setImportStatus(ImportStatus.SUCCESS);
      setSaveProgress({
        current: result.summary?.newRecords || 0,
        total: result.summary?.total || 0
      });
      return;
    }

    if (!result.records || result.records.length === 0) {
      setImportStatus(ImportStatus.ERROR);
      setErrorMessage('没有获取到任何记录');
      return;
    }

    if (!user) {
      setImportStatus(ImportStatus.ERROR);
      setErrorMessage('请先登录后再导入数据');
      return;
    }

    try {
      const importedAt = new Date().toISOString();
      setImportStatus(ImportStatus.SAVING);
      setSaveProgress({ current: 0, total: result.records.length });
      if (result.userInfo) {
        saveGameAccountMetadata(result.userInfo);
      }

      const {
        currentGameUid,
        poolEntries,
        historyRecords,
      } = await prepareOfficialImportPersistenceData({
        supabase,
        records: result.records,
        userInfo: result.userInfo,
        pools,
      });

      // 1. 保存卡池到服务器
      await savePoolsToServer(poolEntries);

      // 2. 从服务器获取已存在的记录进行去重（基于 game_uid + pool_id + seq_id）
      const existingSeqIds = await getExistingSeqIds(currentGameUid);
      const { newRecords, duplicateCount } = filterImportedHistoryRecords(historyRecords, existingSeqIds);

      // 3. 保存新记录到服务器
      if (newRecords.length > 0) {
        await saveHistoryToServer(newRecords);
      } else {
        // 即使没有新记录，也展示短暂的保存状态，提升体验
        setSaveProgress({ current: historyRecords.length, total: historyRecords.length });
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // 4. 设置导入结果
      const finalResult = {
        success: true,
        records: newRecords,
        summary: {
          total: historyRecords.length,
          newRecords: newRecords.length,
          duplicates: duplicateCount,
          ...result.summary
        },
        userInfo: result.userInfo
      };

      const refreshedCloudData = await loadCloudData(user);
      applyCloudDataToStores(refreshedCloudData, {
        setPools,
        switchPool,
        setHistory,
        preferredPoolId: currentPoolId,
        preferredGameUid: currentGameUid
      });

      if (currentGameUid) {
        switchGameAccount(currentGameUid);
      }

      persistImportedAccountMetadata({
        accounts: result.userInfo ? [result.userInfo] : [],
        historyRecords,
        importedAt,
        importSource: 'official_api'
      });

      setImportResult(finalResult);
      setImportStatus(ImportStatus.SUCCESS);

    } catch (error) {
      console.error('[ImportManager] 保存数据失败:', error);
      setImportStatus(ImportStatus.ERROR);
      setErrorMessage(error.message || '保存数据失败');
    }
  }, [currentPoolId, getExistingSeqIds, loadCloudData, persistImportedAccountMetadata, pools, saveHistoryToServer, savePoolsToServer, setHistory, setPools, switchGameAccount, switchPool, user]);

  const handleReset = useCallback(() => {
    setImportStatus(ImportStatus.IDLE);
    setImportResult(null);
    setErrorMessage('');
    setSaveProgress({ current: 0, total: 0 });
    setFetchStatus('idle');
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const handleViewImportedData = useCallback(() => {
    if (importResult?.userInfo?.gameUid || importResult?.userInfo?.hgUid) {
      switchGameAccount(importResult.userInfo.gameUid || importResult.userInfo.hgUid);
    }

    if (typeof onImportComplete === 'function') {
      onImportComplete(importResult);
    }

    handleClose();
  }, [handleClose, importResult, onImportComplete, switchGameAccount]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-colors">
      <div className="bg-white dark:bg-zinc-900 border-l-4 border-l-amber-500 dark:border-l-yellow-500 border-y border-r border-zinc-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative transition-colors">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between z-10 transition-colors">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wider">导入抽卡记录</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-yellow-500 transition-colors"
              title="帮助"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              disabled={importStatus === ImportStatus.SAVING}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Steps Indicator (Always Visible) */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 transition-colors">
           <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wide">
              {/* 步骤1：等待输入token时亮起 */}
              <div className={`flex items-center gap-2 ${
                importStatus === ImportStatus.IDLE && fetchStatus === 'idle'
                  ? 'text-amber-600 dark:text-yellow-500'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}>
                 <span className="w-5 h-5 flex items-center justify-center border border-current">1</span>
                 <span>登录获取Token</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-zinc-800 flex-1 mx-4"></div>
              {/* 步骤2：正在获取数据时亮起 */}
              <div className={`flex items-center gap-2 ${
                ['authenticating', 'fetching', 'processing', 'success'].includes(fetchStatus) && importStatus === ImportStatus.IDLE
                  ? 'text-amber-600 dark:text-yellow-500'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}>
                 <span className="w-5 h-5 flex items-center justify-center border border-current">2</span>
                 <span>获取数据</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-zinc-800 flex-1 mx-4"></div>
              {/* 步骤3：保存中或成功时亮起 */}
              <div className={`flex items-center gap-2 ${
                importStatus === ImportStatus.SAVING || importStatus === ImportStatus.SUCCESS
                  ? 'text-amber-600 dark:text-yellow-500'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}>
                 <span className="w-5 h-5 flex items-center justify-center border border-current">3</span>
                 <span>保存同步</span>
              </div>
           </div>
        </div>

        <div className="p-6">
          {/* 未登录提示 */}
          {!user && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 p-4 transition-colors">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-500 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold">需要登录</span>
              </div>
              <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono">
                请先登录账号以启用云端同步功能。
              </p>
            </div>
          )}

          {/* 导入说明 */}
          {showGuide && (
            <div className="mb-6 bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-slate-600 dark:text-zinc-400 space-y-2 font-mono transition-colors">
              <h3 className="text-slate-800 dark:text-zinc-300 font-bold mb-2 flex items-center gap-2">
                <HelpCircle size={14}/> 使用指南
              </h3>
              <p>1. 登录鹰角网络通行证。</p>
              <p>2. 获取专用的访问 Token。</p>
              <p>3. 系统将自动获取并在本地处理数据，最后加密上传至您的云端存档。</p>
            </div>
          )}

          {/* 保存阶段进度 */}
          {importStatus === ImportStatus.SAVING && (
            <div className="space-y-4 py-8">
              <ImportProgressBar 
                progress={(saveProgress.current / saveProgress.total) * 100} 
                status={ImportStatus.SAVING}
                message={`正在保存记录: ${saveProgress.current} / ${saveProgress.total}`}
              />
            </div>
          )}

          {/* 导入成功 */}
          {importStatus === ImportStatus.SUCCESS && importResult && (
            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 p-6 text-center transition-colors">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center text-green-600 dark:text-green-500">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">导入完成</h3>
                <p className="text-slate-500 dark:text-zinc-500 text-xs font-mono uppercase">数据已成功同步至云端</p>
              </div>

              {/* 统计网格 */}
              <div className="grid grid-cols-3 gap-1">
                <div className="bg-slate-100 dark:bg-zinc-800 p-4 text-center transition-colors">
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono uppercase">总数</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">{importResult.summary?.total || 0}</p>
                </div>
                <div className="bg-slate-100 dark:bg-zinc-800 p-4 text-center transition-colors">
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono uppercase">新增</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-500 mt-1">{importResult.summary?.newRecords || 0}</p>
                </div>
                <div className="bg-slate-100 dark:bg-zinc-800 p-4 text-center transition-colors">
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono uppercase">跳过</p>
                  <p className="text-xl font-bold text-slate-500 dark:text-zinc-500 mt-1">{importResult.summary?.duplicates || 0}</p>
                </div>
              </div>

              {((importResult.summary?.partialPools?.length || 0) > 0 || (importResult.summary?.failedPools?.length || 0) > 0) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-4 space-y-2 transition-colors">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">部分卡池未完整获取</p>
                      <p className="text-slate-600 dark:text-zinc-500 text-xs mt-1">
                        已导入能获取到的记录，但仍建议稍后重试一次官方导入以补齐遗漏数据。
                      </p>
                    </div>
                  </div>

                  {(importResult.summary?.partialPools || []).map(pool => (
                    <div key={`partial-${pool.poolType || pool.type}`} className="text-xs font-mono text-slate-600 dark:text-zinc-400">
                      部分成功: {pool.poolType || pool.type} · {pool.records || 0} 条 · {pool.error || 'partial'}
                    </div>
                  ))}

                  {(importResult.summary?.failedPools || []).map(pool => (
                    <div key={`failed-${pool.poolType || pool.type}`} className="text-xs font-mono text-red-600 dark:text-red-400">
                      获取失败: {pool.poolType || pool.type} · {pool.error || 'failed'}
                    </div>
                  ))}
                </div>
              )}

              {/* 结果提示 */}
              {importResult.summary?.newRecords > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-4 flex items-start gap-3 transition-colors">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">新数据已同步到当前会话</p>
                    <p className="text-slate-600 dark:text-zinc-500 text-xs mt-1">点击下方按钮可直接跳转到卡池详情页查看，无需刷新整页。</p>
                  </div>
                </div>
              )}

              {/* 按钮组 */}
              <div className="flex gap-4">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
                >
                  继续导入
                </button>
                {importResult.summary?.newRecords > 0 ? (
                  <button
                    onClick={handleViewImportedData}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 dark:bg-yellow-500 dark:hover:bg-yellow-400 text-white dark:text-black font-bold py-3 text-sm tracking-wider transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    查看已导入数据
                  </button>
                ) : (
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-600 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
                  >
                    关闭
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 导入错误 */}
          {importStatus === ImportStatus.ERROR && (
            <div className="space-y-4 py-6">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 p-4 flex items-start gap-3 transition-colors">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 mt-0.5" />
                <div>
                  <h4 className="text-red-600 dark:text-red-500 font-bold mb-1">导入失败</h4>
                  <p className="text-slate-600 dark:text-zinc-400 text-sm font-mono break-all">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
              >
                重试
              </button>
            </div>
          )}

          {/* 官网 API 导入子组件 */}
          {importStatus === ImportStatus.IDLE && user && (
            <OfficialAPIImport
              onImportComplete={handleAPIImportComplete}
              onBack={handleClose}
              onFetchStatusChange={handleFetchStatusChange}
              userId={user.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
