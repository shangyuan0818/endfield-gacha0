import { useState, useCallback } from 'react';
import { Save, RefreshCw, HelpCircle, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthStore, usePoolStore } from '../../stores';
import { supabase } from '../../supabaseClient';
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
      <div className="flex justify-between items-center mb-1 text-[10px] font-mono uppercase text-zinc-500">
        <span className="flex items-center gap-2">
          {status === ImportStatus.SAVING ? (
            <>
              <Save size={10} className="animate-pulse text-blue-500" />
              正在保存到云端
            </>
          ) : (
            <>
              <RefreshCw size={10} className="animate-spin text-yellow-500" />
              处理中
            </>
          )}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 relative overflow-hidden">
        <div 
          className={`h-full transition-all duration-300 ${status === ImportStatus.SAVING ? 'bg-blue-500' : 'bg-yellow-500'}`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="mt-1 text-xs text-zinc-400 font-mono text-center">
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

  // 处理子组件的获取状态变化
  const handleFetchStatusChange = useCallback((status) => {
    setFetchStatus(status);
  }, []);

  /**
   * 直接保存卡池到 Supabase
   */
  const savePoolsToServer = useCallback(async (poolInfos) => {
    if (!supabase || !user || poolInfos.length === 0) return;

    const poolsToSave = poolInfos.map(info => ({
      user_id: user.id,
      pool_id: info.poolId,
      name: info.poolName || info.poolId,
      type: getPoolTypeFromId(info.poolId),
      locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('pools')
      .upsert(poolsToSave, { onConflict: 'user_id,pool_id' });

    if (error) {
      console.error('[ImportManager] 保存卡池失败:', error);
      throw error;
    }

    console.log('[ImportManager] 卡池保存成功:', poolsToSave.length);
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

      // 在每批内进行去重
      const seenIds = new Set();
      const uniqueBatch = batch.filter(r => {
        const recordId = typeof r.id === 'number' ? r.id : parseInt(r.id, 10) || Date.now();
        if (seenIds.has(recordId)) return false;
        seenIds.add(recordId);
        return true;
      });

      const recordsToSave = uniqueBatch.map(r => ({
        user_id: user.id,
        record_id: typeof r.id === 'number' ? r.id : parseInt(r.id, 10) || Date.now(),
        pool_id: String(r.poolId),
        rarity: typeof r.rarity === 'number' ? r.rarity : parseInt(r.rarity, 10) || 4,
        is_standard: Boolean(r.isStandard),
        special_type: null,
        character_name: r.character_name || r.name || null,
        item_name: r.name || r.character_name || null,
        batch_id: r.batchId || null,
        seq_id: r.seqId || null,
        pity: typeof r.pity === 'number' ? r.pity : (parseInt(r.pity, 10) || 0),
        is_new: Boolean(r.isNew),
        is_free: Boolean(r.isFree),
        game_uid: r.gameUid || null,
        timestamp: typeof r.timestamp === 'number'
          ? new Date(r.timestamp).toISOString()
          : new Date(r.timestamp).toISOString(),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('history')
        .upsert(recordsToSave, { onConflict: 'user_id,record_id' });

      if (error) {
        console.error('[ImportManager] 保存历史记录失败:', error);
        throw error;
      }

      savedCount += uniqueBatch.length;
      setSaveProgress({ current: savedCount, total: records.length });
    }
  }, [user]);

  /**
   * 从服务器查询已存在的 seqId（用于去重）
   */
  const getExistingSeqIds = useCallback(async () => {
    if (!supabase || !user) return new Set();

    const { data, error } = await supabase
      .from('history')
      .select('seq_id')
      .eq('user_id', user.id)
      .not('seq_id', 'is', null);

    if (error) {
      console.error('[ImportManager] 查询已有记录失败:', error);
      return new Set();
    }

    return new Set(data.map(r => r.seq_id));
  }, [user]);

  /**
   * 处理 API 导入完成
   */
  const handleAPIImportComplete = useCallback(async (result) => {
    if (!result.success || !result.records || result.records.length === 0) {
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
      setImportStatus(ImportStatus.SAVING);
      setSaveProgress({ current: 0, total: result.records.length });

      // 1. 收集所有涉及的卡池信息
      const poolInfos = [];
      const seenPools = new Set();

      result.records.forEach(record => {
        const poolId = record.pool_id;
        if (poolId && !seenPools.has(poolId)) {
          seenPools.add(poolId);
          poolInfos.push({
            poolId: poolId,
            poolName: record.pool_name
          });
        }
      });

      // 2. 保存卡池到服务器
      await savePoolsToServer(poolInfos);

      // 2.1 构建 poolId -> UP角色 的映射
      const poolUpCharacterMap = new Map();
      pools.forEach(pool => {
        if (pool.up_character) {
          if (pool.pool_id) poolUpCharacterMap.set(pool.pool_id, pool.up_character);
          poolUpCharacterMap.set(pool.id, pool.up_character);
        }
      });

      // 3. 转换记录格式
      const historyRecords = result.records.map((record, index) => {
        const poolHash = simpleStringHash(record.pool_id || 'unknown');
        const seqNum = record.seqId ? parseInt(record.seqId, 10) : index;
        const numericId = poolHash * 10000000 + seqNum;

        let isStandard = false;
        if (record.rarity === 6) {
          if (!record.isLimited) {
            isStandard = true;
          } else {
            const upCharacter = poolUpCharacterMap.get(record.pool_id);
            const characterName = record.name || '';
            if (upCharacter) {
              isStandard = !characterName.includes(upCharacter) && !upCharacter.includes(characterName);
            } else {
              isStandard = false;
            }
          }
        }

        return {
          id: numericId,
          poolId: record.pool_id,
          name: record.name,
          character_name: record.name,
          rarity: record.rarity,
          isStandard: isStandard,
          isLimited: record.isLimited,
          batchId: record.batchId,
          seqId: record.seqId,
          pity: typeof record.pity === 'number' ? record.pity : 0,
          isNew: record.isNew || false,
          isFree: record.isFree || false,
          gameUid: result.userInfo?.gameUid || result.userInfo?.hgUid || null,
          timestamp: record.timestamp,
          created_at: new Date().toISOString()
        };
      });

      // 4. 从服务器获取已存在的 seqId 进行去重
      const existingSeqIds = await getExistingSeqIds();
      const newRecords = historyRecords.filter(record => {
        if (record.seqId && existingSeqIds.has(record.seqId)) return false;
        return true;
      });

      const duplicateCount = historyRecords.length - newRecords.length;

      // 5. 保存新记录到服务器
      if (newRecords.length > 0) {
        await saveHistoryToServer(newRecords);
      } else {
        // 即使没有新记录，也展示短暂的保存状态，提升体验
        setSaveProgress({ current: historyRecords.length, total: historyRecords.length });
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // 6. 设置导入结果
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

      setImportResult(finalResult);
      setImportStatus(ImportStatus.SUCCESS);

      if (onImportComplete) {
        onImportComplete(finalResult);
      }

    } catch (error) {
      console.error('[ImportManager] 保存数据失败:', error);
      setImportStatus(ImportStatus.ERROR);
      setErrorMessage(error.message || '保存数据失败');
    }
  }, [user, savePoolsToServer, saveHistoryToServer, getExistingSeqIds, onImportComplete, pools]);

  const handleReset = useCallback(() => {
    setImportStatus(ImportStatus.IDLE);
    setImportResult(null);
    setErrorMessage('');
    setSaveProgress({ current: 0, total: 0 });
    setFetchStatus('idle');
  }, []);

  /**
   * 刷新页面并跳转到卡池详情
   */
  const handleRefreshAndNavigate = useCallback(() => {
    // 保存目标页面到 sessionStorage，刷新后自动跳转
    sessionStorage.setItem('redirect_after_import', 'dashboard');
    window.location.reload();
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 border-l-4 border-l-yellow-500 border-y border-r border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900/95 backdrop-blur border-b border-zinc-800 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">导入抽卡记录</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              disabled={importStatus === ImportStatus.SAVING}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Steps Indicator (Always Visible) */}
        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
           <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wide">
              {/* 步骤1：等待输入token时亮起 */}
              <div className={`flex items-center gap-2 ${
                importStatus === ImportStatus.IDLE && fetchStatus === 'idle'
                  ? 'text-yellow-500'
                  : 'text-zinc-500'
              }`}>
                 <span className="w-5 h-5 flex items-center justify-center border border-current">1</span>
                 <span>登录获取Token</span>
              </div>
              <div className="h-px bg-zinc-800 flex-1 mx-4"></div>
              {/* 步骤2：正在获取数据时亮起 */}
              <div className={`flex items-center gap-2 ${
                ['authenticating', 'fetching', 'processing', 'success'].includes(fetchStatus) && importStatus === ImportStatus.IDLE
                  ? 'text-yellow-500'
                  : 'text-zinc-500'
              }`}>
                 <span className="w-5 h-5 flex items-center justify-center border border-current">2</span>
                 <span>获取数据</span>
              </div>
              <div className="h-px bg-zinc-800 flex-1 mx-4"></div>
              {/* 步骤3：保存中或成功时亮起 */}
              <div className={`flex items-center gap-2 ${
                importStatus === ImportStatus.SAVING || importStatus === ImportStatus.SUCCESS
                  ? 'text-yellow-500'
                  : 'text-zinc-500'
              }`}>
                 <span className="w-5 h-5 flex items-center justify-center border border-current">3</span>
                 <span>保存同步</span>
              </div>
           </div>
        </div>

        <div className="p-6">
          {/* 未登录提示 */}
          {!user && (
            <div className="mb-6 bg-red-900/20 border border-red-900/50 p-4">
              <div className="flex items-center gap-2 text-red-500 mb-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold">需要登录</span>
              </div>
              <p className="text-zinc-400 text-xs font-mono">
                请先登录账号以启用云端同步功能。
              </p>
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
              <div className="bg-green-900/10 border border-green-900/30 p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center text-green-500">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-1">导入完成</h3>
                <p className="text-zinc-500 text-xs font-mono uppercase">数据已成功同步至云端</p>
              </div>

              {/* 统计网格 */}
              <div className="grid grid-cols-3 gap-1">
                <div className="bg-zinc-800 p-4 text-center">
                  <p className="text-xs text-zinc-500 font-mono uppercase">总数</p>
                  <p className="text-xl font-bold text-white mt-1">{importResult.summary?.total || 0}</p>
                </div>
                <div className="bg-zinc-800 p-4 text-center">
                  <p className="text-xs text-zinc-500 font-mono uppercase">新增</p>
                  <p className="text-xl font-bold text-green-500 mt-1">{importResult.summary?.newRecords || 0}</p>
                </div>
                <div className="bg-zinc-800 p-4 text-center">
                  <p className="text-xs text-zinc-500 font-mono uppercase">跳过</p>
                  <p className="text-xl font-bold text-zinc-500 mt-1">{importResult.summary?.duplicates || 0}</p>
                </div>
              </div>

              {/* 刷新提示 */}
              {importResult.summary?.newRecords > 0 && (
                <div className="bg-amber-900/20 border border-amber-700/50 p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-amber-400 text-sm font-medium">需要刷新页面以显示新数据</p>
                    <p className="text-zinc-500 text-xs mt-1">点击下方按钮刷新页面，将自动跳转到卡池详情页查看您的抽卡记录。</p>
                  </div>
                </div>
              )}

              {/* 按钮组 */}
              <div className="flex gap-4">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 text-sm tracking-wider transition-colors"
                >
                  继续导入
                </button>
                {importResult.summary?.newRecords > 0 ? (
                  <button
                    onClick={handleRefreshAndNavigate}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 text-sm tracking-wider transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    刷新并查看数据
                  </button>
                ) : (
                  <button
                    onClick={handleClose}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white font-bold py-3 text-sm tracking-wider transition-colors"
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
              <div className="bg-red-900/20 border border-red-500/30 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="text-red-500 font-bold mb-1">导入失败</h4>
                  <p className="text-zinc-400 text-sm font-mono break-all">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={handleReset}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 text-sm tracking-wider transition-colors"
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
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 根据 poolId 推断卡池类型 (辅助函数)
 */
function getPoolTypeFromId(poolId) {
  if (!poolId) return 'standard';
  const prefix = poolId.split('_')[0].toLowerCase();
  const typeMap = {
    'special': 'limited',
    'standard': 'standard',
    'beginner': 'beginner',
    'weponbox': 'weapon',
    'weaponbox': 'weapon'
  };
  return typeMap[prefix] || 'standard';
}

function simpleStringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 1000);
}