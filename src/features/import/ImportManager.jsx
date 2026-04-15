import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import { getPoolName } from './importShared.js';
import { useI18n } from '../../i18n/index.js';
import appLogger from '../../utils/appLogger.js';

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
const ImportProgressBar = ({ progress, status, message, t }) => {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1 text-[10px] font-mono uppercase text-slate-500 dark:text-zinc-500 transition-colors">
        <span className="flex items-center gap-2">
          {status === ImportStatus.SAVING ? (
            <>
              <Save size={10} className="animate-pulse text-blue-600 dark:text-blue-500" />
              {t('import.progress.saving')}
            </>
          ) : (
            <>
              <RefreshCw size={10} className="animate-spin text-amber-500 dark:text-yellow-500" />
              {t('import.progress.processing')}
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
  const { t, formatNumber } = useI18n();
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
      // eslint-disable-next-line no-await-in-loop -- history batches must be persisted in order so progress and retry boundaries stay deterministic
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
      appLogger.error('[ImportManager] 查询已有记录失败:', error);
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
      setErrorMessage(result?.error || t('import.errorTitle'));
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
        appLogger.error('[ImportManager] 刷新导入后的云端数据失败:', refreshError);
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
      setErrorMessage(t('import.noRecords'));
      return;
    }

    if (!user) {
      setImportStatus(ImportStatus.ERROR);
      setErrorMessage(t('import.loginFirst'));
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
      appLogger.error('[ImportManager] 保存数据失败:', error);
      setImportStatus(ImportStatus.ERROR);
      setErrorMessage(error.message || t('import.errorTitle'));
    }
  }, [currentPoolId, getExistingSeqIds, loadCloudData, persistImportedAccountMetadata, pools, saveHistoryToServer, savePoolsToServer, setHistory, setPools, switchGameAccount, switchPool, t, user]);

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

  const modal = (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/20 p-4 py-6 backdrop-blur-sm transition-colors dark:bg-black/80">
      <div className="relative my-auto w-full max-w-2xl border-l-4 border-l-amber-500 border-y border-r border-zinc-200 bg-white shadow-2xl transition-colors dark:border-l-yellow-500 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header */}
        <div className="sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between z-10 transition-colors">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-wider">{t('import.title')}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-yellow-500 transition-colors"
              title={t('header.helpTitle')}
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
                 <span>{t('import.step.token')}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-zinc-800 flex-1 mx-4"></div>
              {/* 步骤2：正在获取数据时亮起 */}
              <div className={`flex items-center gap-2 ${
                ['authenticating', 'fetching', 'processing', 'success'].includes(fetchStatus) && importStatus === ImportStatus.IDLE
                  ? 'text-amber-600 dark:text-yellow-500'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}>
                 <span className="w-5 h-5 flex items-center justify-center border border-current">2</span>
                 <span>{t('import.step.fetch')}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-zinc-800 flex-1 mx-4"></div>
              {/* 步骤3：保存中或成功时亮起 */}
              <div className={`flex items-center gap-2 ${
                importStatus === ImportStatus.SAVING || importStatus === ImportStatus.SUCCESS
                  ? 'text-amber-600 dark:text-yellow-500'
                  : 'text-slate-400 dark:text-zinc-500'
              }`}>
                 <span className="w-5 h-5 flex items-center justify-center border border-current">3</span>
                 <span>{t('import.step.save')}</span>
              </div>
           </div>
        </div>

        <div className="p-6">
          {/* 未登录提示 */}
          {!user && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 p-4 transition-colors">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-500 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold">{t('import.needLogin')}</span>
              </div>
              <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono">
                {t('import.needLoginDesc')}
              </p>
            </div>
          )}

          {/* 导入说明 */}
          {showGuide && (
            <div className="mb-6 bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-slate-600 dark:text-zinc-400 space-y-2 font-mono transition-colors">
              <h3 className="text-slate-800 dark:text-zinc-300 font-bold mb-2 flex items-center gap-2">
                <HelpCircle size={14}/> {t('import.guideTitle')}
              </h3>
              <p>{t('import.guideStep1')}</p>
              <p>{t('import.guideStep2')}</p>
              <p>{t('import.guideStep3')}</p>
            </div>
          )}

          {/* 保存阶段进度 */}
          {importStatus === ImportStatus.SAVING && (
            <div className="space-y-4 py-8">
              <ImportProgressBar 
                progress={saveProgress.total > 0 ? (saveProgress.current / saveProgress.total) * 100 : 0}
                status={ImportStatus.SAVING}
                message={t('import.progress.saveMessage', { current: saveProgress.current, total: saveProgress.total })}
                t={t}
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
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">{t('import.complete')}</h3>
                <p className="text-slate-500 dark:text-zinc-500 text-xs font-mono uppercase">{t('import.completeDesc')}</p>
              </div>

              {/* 统计网格 */}
              <div className="grid grid-cols-3 gap-1">
                <div className="bg-slate-100 dark:bg-zinc-800 p-4 text-center transition-colors">
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono uppercase">{t('import.summary.total')}</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white mt-1">{formatNumber(importResult.summary?.total || 0)}</p>
                </div>
                <div className="bg-slate-100 dark:bg-zinc-800 p-4 text-center transition-colors">
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono uppercase">{t('import.summary.new')}</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-500 mt-1">{formatNumber(importResult.summary?.newRecords || 0)}</p>
                </div>
                <div className="bg-slate-100 dark:bg-zinc-800 p-4 text-center transition-colors">
                  <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono uppercase">{t('import.summary.skipped')}</p>
                  <p className="text-xl font-bold text-slate-500 dark:text-zinc-500 mt-1">{formatNumber(importResult.summary?.duplicates || 0)}</p>
                </div>
              </div>

              {((importResult.summary?.partialPools?.length || 0) > 0 || (importResult.summary?.failedPools?.length || 0) > 0) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-4 space-y-2 transition-colors">
                  <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                      <div>
                      <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">{t('import.partialTitle')}</p>
                      <p className="text-slate-600 dark:text-zinc-500 text-xs mt-1">
                        {t('import.partialDesc')}
                      </p>
                    </div>
                  </div>

                  {(importResult.summary?.partialPools || []).map(pool => (
                    <div key={`partial-${pool.poolType || pool.type}`} className="text-xs font-mono text-slate-600 dark:text-zinc-400">
                      {t('import.partialSuccess')}: {getPoolName(pool.poolType || pool.type, t)} · {pool.records || 0} · {pool.error || t('import.partialFallback')}
                    </div>
                  ))}

                  {(importResult.summary?.failedPools || []).map(pool => (
                    <div key={`failed-${pool.poolType || pool.type}`} className="text-xs font-mono text-red-600 dark:text-red-400">
                      {t('import.partialFailed')}: {getPoolName(pool.poolType || pool.type, t)} · {pool.error || t('import.failedFallback')}
                    </div>
                  ))}
                </div>
              )}

              {/* 结果提示 */}
              {importResult.summary?.newRecords > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 p-4 flex items-start gap-3 transition-colors">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">{t('import.newDataSynced')}</p>
                    <p className="text-slate-600 dark:text-zinc-500 text-xs mt-1">{t('import.newDataSyncedDesc')}</p>
                  </div>
                </div>
              )}

              {/* 按钮组 */}
              <div className="flex gap-4">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
                >
                  {t('import.continue')}
                </button>
                {importResult.summary?.newRecords > 0 ? (
                  <button
                    onClick={handleViewImportedData}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 dark:bg-yellow-500 dark:hover:bg-yellow-400 text-white dark:text-black font-bold py-3 text-sm tracking-wider transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {t('import.viewData')}
                  </button>
                ) : (
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-600 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
                  >
                    {t('common.close')}
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
                  <h4 className="text-red-600 dark:text-red-500 font-bold mb-1">{t('import.errorTitle')}</h4>
                  <p className="text-slate-600 dark:text-zinc-400 text-sm font-mono break-all">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
              >
                {t('common.retry')}
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

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modal, document.body);
  }

  return modal;
}
