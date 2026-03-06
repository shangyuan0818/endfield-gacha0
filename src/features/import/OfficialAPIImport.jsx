/**
 * 终末地官网API导入组件 V2 (Technical Style)
 *
 * @version 1.1.0 - 添加请求队列状态显示
 * @date 2026-02-01
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Link,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Copy,
  ExternalLink,
  User,
  Shield,
  ArrowRight,
  Clock,
  Loader2
} from 'lucide-react';
import {
  fetchAccountsList,
  executeAuthChainForAccount,
  fetchAllGachaRecordsConcurrent,
  fetchAllGachaRecords,
  importAllRecordsFullyOnBackend,
  fetchImportQueueStatus,
  AuthChainError,
  RiskControlError,
  ServerConnectionError
} from '../../utils/endfieldAuthChain';
import {
  generateImportSummary,
  assignBatchIds,
  calculatePity
} from '../../utils/endfieldImportAdapter';
import { getGlobalQueue } from '../../utils/requestQueue';

const ImportStatus = {
  IDLE: 'idle',
  AUTHENTICATING: 'authenticating',
  ACCOUNT_SELECTION: 'account_selection',  // 新增：账号选择阶段
  FETCHING: 'fetching',
  PROCESSING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error'
};

/**
 * 进度条组件 (Fetching Phase)
 */
const FetchProgressBar = ({ progress, message }) => (
  <div className="w-full">
    <div className="flex justify-between items-center mb-1 text-[10px] font-mono uppercase text-slate-500 dark:text-zinc-500 transition-colors">
      <span className="flex items-center gap-2">
        <RefreshCw size={10} className="animate-spin text-amber-500 dark:text-yellow-500" />
        正在获取数据
      </span>
      <span>{progress}%</span>
    </div>
    <div className="h-1 w-full bg-slate-200 dark:bg-zinc-800 relative overflow-hidden transition-colors">
      <div
        className="h-full bg-amber-500 dark:bg-yellow-500 transition-all duration-300"
        style={{ width: `${progress}%` }}
      ></div>
    </div>
    <div className="mt-2 flex justify-between items-center text-xs font-mono">
      <span className="text-slate-600 dark:text-zinc-300 transition-colors">{message}</span>
    </div>
  </div>
);

/**
 * 请求队列状态显示组件
 */
const QueueStatusDisplay = ({ queueStatus, retryInfo }) => {
  if (!queueStatus && !retryInfo) return null;

  return (
    <div className="mt-3 p-3 bg-slate-100 dark:bg-zinc-800/70 border border-slate-300 dark:border-zinc-600 rounded transition-colors">
      <div className="flex items-start gap-2">
        <Clock size={14} className="text-amber-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          {/* 队列状态 */}
          {queueStatus && (
            <div className="text-xs font-mono">
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-700 dark:text-zinc-300 font-semibold">请求队列状态</span>
                {queueStatus.isProcessing && (
                  <Loader2 size={12} className="animate-spin text-amber-500 dark:text-yellow-500" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">队列长度:</span>
                  <span className="text-slate-700 dark:text-zinc-200 font-semibold">{queueStatus.queueLength}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">活动请求:</span>
                  <span className="text-slate-700 dark:text-zinc-200 font-semibold">{queueStatus.activeRequests || 0}</span>
                </div>
              </div>
              {queueStatus.oldestTaskAge > 0 && (
                <div className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">
                  最早任务等待: {Math.round(queueStatus.oldestTaskAge / 1000)}秒
                </div>
              )}
            </div>
          )}

          {/* 重试信息 */}
          {retryInfo && (
            <div className="text-xs font-mono border-t border-slate-300 dark:border-zinc-600 pt-2">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw size={12} className="text-orange-500 dark:text-orange-400" />
                <span className="text-slate-700 dark:text-zinc-300 font-semibold">正在重试</span>
              </div>
              <div className="text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-zinc-400">重试次数:</span>
                  <span className="text-orange-600 dark:text-orange-400 font-semibold">
                    {retryInfo.currentRetry}/{retryInfo.maxRetries}
                  </span>
                </div>
                {retryInfo.nextRetryIn && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-zinc-400">下次重试:</span>
                    <span className="text-slate-700 dark:text-zinc-200 font-semibold">
                      {Math.round(retryInfo.nextRetryIn / 1000)}秒后
                    </span>
                  </div>
                )}
                {retryInfo.reason && (
                  <div className="mt-1 text-orange-600 dark:text-orange-400">
                    原因: {retryInfo.reason}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function OfficialAPIImport({ onImportComplete, onBack: _onBack, onFetchStatusChange, userId }) {
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState(ImportStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [fetchedRecords, setFetchedRecords] = useState([]);
  const [importSummary, setImportSummary] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);
  const [autoDetected, setAutoDetected] = useState(false); // 是否自动识别了JSON

  // 多账号支持
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [appToken, setAppToken] = useState(null);  // 保存 appToken 用于后续请求

  // 🆕 请求队列状态
  const [queueStatus, setQueueStatus] = useState(null);
  const [retryInfo, setRetryInfo] = useState(null);

  // 通知父组件状态变化
  useEffect(() => {
    onFetchStatusChange?.(status);
  }, [status, onFetchStatusChange]);

  // 🆕 定时更新队列状态（从后端获取）
  useEffect(() => {
    if (status === ImportStatus.AUTHENTICATING || status === ImportStatus.FETCHING) {
      // 定时从后端获取队列状态
      const updateQueueStatus = async () => {
        try {
          const backendStatus = await fetchImportQueueStatus();
          setQueueStatus({
            queueLength: backendStatus.queueLength,
            activeRequests: backendStatus.isProcessing ? 1 : 0,
            isProcessing: backendStatus.isProcessing,
            oldestTaskAge: backendStatus.oldestTaskAge || 0,
            currentTaskMeta: backendStatus.currentTaskMeta
          });
        } catch (error) {
          console.warn('[OfficialAPIImport] 获取队列状态失败:', error);
        }
      };

      updateQueueStatus(); // 立即执行一次
      const interval = setInterval(updateQueueStatus, 2000); // 每2秒更新一次

      // 监听本地队列事件（用于重试信息）
      const queue = getGlobalQueue();
      const handleQueueEvent = (event, data) => {
        if (event === 'request:retry') {
          setRetryInfo({
            currentRetry: data.currentRetry,
            maxRetries: data.maxRetries,
            nextRetryIn: data.nextRetryIn,
            reason: data.reason
          });
          setStatusMessage(`网络不稳定，正在重试 (${data.currentRetry}/${data.maxRetries})...`);
        } else if (event === 'request:success' || event === 'request:error') {
          setRetryInfo(null);
        }
      };

      queue.addListener(handleQueueEvent);

      return () => {
        clearInterval(interval);
        queue.removeListener(handleQueueEvent);
      };
    } else {
      queueMicrotask(() => {
        setQueueStatus(null);
        setRetryInfo(null);
      });
    }
  }, [status]);

  const cancelRef = useRef(false);

  /**
   * 智能解析输入内容，支持：
   * 1. 直接粘贴24位token
   * 2. 粘贴完整JSON自动提取content字段
   */
  const parseTokenInput = useCallback((input) => {
    const trimmed = input.trim();
    if (!trimmed) return { token: '', fromJson: false };

    // 尝试解析JSON
    if (trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed);
        if (json?.data?.content) {
          return { token: json.data.content, fromJson: true };
        }
      } catch {
        // 不是有效JSON，继续当作普通文本处理
      }
    }

    return { token: trimmed, fromJson: false };
  }, []);

  /**
   * 处理输入变化，自动识别JSON
   */
  const handleInputChange = useCallback((e) => {
    const rawInput = e.target.value;
    const { token, fromJson } = parseTokenInput(rawInput);

    if (fromJson) {
      // 从JSON中提取了token，显示提取后的值
      setTokenInput(token);
      setAutoDetected(true);
    } else {
      // 普通输入
      setTokenInput(rawInput);
      setAutoDetected(false);
    }
  }, [parseTokenInput]);

  const validateToken = useCallback((token) => {
    const trimmed = token.trim();
    if (!trimmed) return { valid: false, error: '请输入Token' };

    if (trimmed.length !== 24) {
      return { valid: false, error: `Token长度错误：期望24位，实际${trimmed.length}位` };
    }
    // 允许 Base64 字符集（字母、数字、+、/、=）
    if (!/^[a-zA-Z0-9+/=]+$/.test(trimmed)) {
      return { valid: false, error: 'Token格式错误：包含不支持的字符' };
    }
    return { valid: true, token: trimmed };
  }, []);

  async function continueImportWithAccount(token, account) {
    try {
      setStatus(ImportStatus.FETCHING);
      setProgress(30);
      cancelRef.current = false;

      const resolvedUserInfo = {
        hgUid: account.uid,
        gameUid: account.gameUid,
        nickName: account.nickName,
        channelName: account.channelName,
        channelMasterId: account.channelMasterId,
        isOfficial: account.isOfficial
      };

      setUserInfo(resolvedUserInfo);

      if (userId) {
        const accountIndex = availableAccounts.findIndex(candidate =>
          candidate.uid === account.uid &&
          candidate.gameUid === account.gameUid &&
          candidate.channelMasterId === account.channelMasterId
        );

        const backendResult = await importAllRecordsFullyOnBackend(
          tokenInput.trim(),
          accountIndex >= 0 ? accountIndex : 0,
          userId,
          (update) => {
            if (cancelRef.current) return;
            setStatus(update.progress >= 80 ? ImportStatus.PROCESSING : ImportStatus.FETCHING);
            setProgress(update.progress || 0);
            setStatusMessage(update.message || '正在导入数据...');
          }
        );

        if (cancelRef.current) return;

        const finalUserInfo = {
          ...resolvedUserInfo,
          gameUid: backendResult?.account?.gameUid || resolvedUserInfo.gameUid,
          nickName: backendResult?.account?.nickName || resolvedUserInfo.nickName
        };

        if (onImportComplete) {
          onImportComplete({
            success: true,
            backendImported: true,
            summary: {
              total: backendResult?.totalRecords || 0,
              newRecords: backendResult?.newRecords || 0,
              duplicates: backendResult?.duplicates || 0,
              partialPools: backendResult?.partialPools || [],
              failedPools: backendResult?.failedPools || []
            },
            userInfo: finalUserInfo,
            result: backendResult
          });
          return;
        }

        setImportSummary({
          total: backendResult?.totalRecords || 0,
          byRarity: { 4: 0, 5: 0, 6: 0 },
          byPool: {},
          byPoolType: {},
          sixStars: [],
          fiveStars: [],
          partialPools: backendResult?.partialPools || [],
          failedPools: backendResult?.failedPools || []
        });
        setProgress(100);
        setStatus(ImportStatus.SUCCESS);
        setStatusMessage('后端导入完成');
        return;
      }

      // 阶段2：获取 u8_token
      setStatusMessage(`正在获取 ${account.channelName} 访问凭证...`);
      const authResult = await executeAuthChainForAccount(token, account, (msg) => {
        if (cancelRef.current) return;
        setStatusMessage(msg);
      });

      if (cancelRef.current) return;

      const { u8Token } = authResult;

      // 阶段3：获取抽卡记录
      setStatusMessage(`正在获取 ${account.channelName} 抽卡记录...`);
      setProgress(40);

      let records;
      try {
        records = await fetchAllGachaRecordsConcurrent(u8Token, account.serverId || '1', (msg) => {
          if (cancelRef.current) return;
          setStatusMessage(msg);
          if (msg.includes('限定角色')) setProgress(50);
          else if (msg.includes('常驻角色')) setProgress(60);
          else if (msg.includes('新手')) setProgress(70);
          else if (msg.includes('武器')) setProgress(80);
          else if (msg.includes('失败')) setProgress(85);
          else if (msg.includes('完成')) setProgress(90);
          else if (msg.includes('排队')) setProgress(35);
        }, {
          gameUid: account.gameUid,
          nickName: account.nickName
        });
      } catch {
        setStatusMessage('并发获取失败，切换到串行模式...');
        records = await fetchAllGachaRecords(u8Token, (msg) => {
          if (cancelRef.current) return;
          setStatusMessage(msg);
        });
      }

      if (cancelRef.current) return;

      setStatus(ImportStatus.PROCESSING);
      setProgress(95);
      setStatusMessage('正在处理数据...');

      const convertedRecords = records.map(record => {
        const poolType = record._poolType || 'unknown';
        return {
          name: record.charName || record.weaponName || '未知',
          character_name: record.charName || record.weaponName || '未知',
          item_id: record.charId || record.weaponId || '',
          rarity: record.rarity,
          timestamp: parseInt(record.gachaTs, 10),
          pool: poolType,
          pool_id: record.poolId,
          pool_name: record.poolName,
          isNew: record.isNew || false,
          isFree: record.isFree || false,
          isLimited: poolType === 'limited_character' || poolType === 'limited_weapon',
          seqId: record.seqId,
          recordType: record.charId ? 'character' : 'weapon'
        };
      });

      // Calculate Pity logic locally for preview
      const recordsByPool = {};
      convertedRecords.forEach(record => {
        if (!recordsByPool[record.pool]) recordsByPool[record.pool] = [];
        recordsByPool[record.pool].push(record);
      });

      let processedRecords = [];
      Object.entries(recordsByPool).forEach(([poolType, recs]) => {
        const withPity = calculatePity(recs, poolType);
        processedRecords.push(...withPity);
      });

      processedRecords = assignBatchIds(processedRecords);
      processedRecords.sort((a, b) => b.timestamp - a.timestamp);

      const summary = generateImportSummary(processedRecords);

      setFetchedRecords(processedRecords);
      setImportSummary(summary);
      setProgress(100);
      setStatus(ImportStatus.SUCCESS);
      setStatusMessage('数据准备就绪');

    } catch (err) {
      console.error('[OfficialAPIImport] 导入失败:', err);
      if (cancelRef.current) return;
      let errorMessage = err.message || 'Unknown Error';
      if (err instanceof ServerConnectionError) errorMessage = `服务器连接异常: ${err.message}`;
      else if (err instanceof RiskControlError) errorMessage = '触发频率限制，请稍候再试。';
      else if (err instanceof AuthChainError) errorMessage = `认证失败: ${err.message}`;

      setError(errorMessage);
      setStatus(ImportStatus.ERROR);
    }
  }

  const handleImport = async () => {
    const validation = validateToken(tokenInput);
    if (!validation.valid) {
      setError(validation.error);
      setStatus(ImportStatus.ERROR);
      return;
    }

    setStatus(ImportStatus.AUTHENTICATING);
    setProgress(0);
    setError(null);
    setFetchedRecords([]);
    setImportSummary(null);
    setUserInfo(null);
    setAvailableAccounts([]);
    setAppToken(null);
    cancelRef.current = false;

    try {
      setStatusMessage('正在验证token...');
      setProgress(10);

      const accountsResult = await fetchAccountsList(validation.token, (msg) => {
        if (cancelRef.current) return;
        setStatusMessage(msg);
        if (msg.includes('验证')) setProgress(10);
        else if (msg.includes('账号')) setProgress(20);
      });

      if (cancelRef.current) return;

      const { appToken: token, accounts } = accountsResult;
      setAppToken(token);
      setAvailableAccounts(accounts);

      if (accounts.length > 1) {
        setStatus(ImportStatus.ACCOUNT_SELECTION);
        setProgress(25);
        setStatusMessage('请选择要导入的账号');
        return;
      }

      await continueImportWithAccount(token, accounts[0]);
    } catch (err) {
      console.error('[OfficialAPIImport] 导入失败:', err);
      if (cancelRef.current) return;
      let errorMessage = err.message || 'Unknown Error';
      if (err instanceof ServerConnectionError) errorMessage = `服务器连接异常: ${err.message}`;
      else if (err instanceof RiskControlError) errorMessage = '触发频率限制，请稍候再试。';
      else if (err instanceof AuthChainError) errorMessage = `认证失败: ${err.message}`;

      setError(errorMessage);
      setStatus(ImportStatus.ERROR);
    }
  };

  /**
   * 选择账号后继续导入
   */
  const handleAccountSelect = async (account) => {
    await continueImportWithAccount(appToken, account);
  };

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    setStatus(ImportStatus.IDLE);
    setProgress(0);
    setStatusMessage('');
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (fetchedRecords.length === 0) return;
    if (onImportComplete) {
      onImportComplete({
        success: true,
        records: fetchedRecords,
        summary: importSummary,
        userInfo
      });
    }
  }, [fetchedRecords, importSummary, userInfo, onImportComplete]);

  const handleReset = useCallback(() => {
    setTokenInput('');
    setStatus(ImportStatus.IDLE);
    setProgress(0);
    setStatusMessage('');
    setFetchedRecords([]);
    setImportSummary(null);
    setUserInfo(null);
    setError(null);
    setAutoDetected(false);
    setAvailableAccounts([]);
    setAppToken(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* 状态指示器 & 指南 */}
      {status === ImportStatus.IDLE && (
        <div className="bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4 transition-colors">
          <h3 className="text-slate-800 dark:text-zinc-300 text-sm font-bold flex items-center gap-2 mb-4">
            <HelpCircle size={14} className="text-amber-600 dark:text-yellow-500" />
            快速指南
          </h3>
          
          <div className="space-y-4 pt-2 text-xs text-slate-500 dark:text-zinc-400 font-mono">
            <div className="flex gap-3">
              <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300">1</div>
              <div>
                <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1">登录官网并绑定</p>
                <p className="mb-1 text-slate-500 dark:text-zinc-500">官服与B服均需在此绑定终末地角色：</p>
                <a href="https://user.hypergryph.com/bindCharacters?game=endfield" target="_blank" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-1 underline">
                  user.hypergryph.com <ExternalLink size={10} />
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300">2</div>
              <div>
                <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1">获取数据内容</p>
                <p className="mb-1 text-slate-500 dark:text-zinc-500">在新标签页打开链接，建议复制页面显示的<span className="text-slate-700 dark:text-zinc-300">完整内容</span>，或仅复制 <span className="text-slate-700 dark:text-zinc-300">content</span> 字段的值：</p>
                <a href="https://web-api.hypergryph.com/account/info/hg" target="_blank" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-1 underline">
                  web-api.hypergryph.com <ExternalLink size={10} />
                </a>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300">3</div>
              <div>
                <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1">粘贴至下方</p>
                <p className="text-slate-500 dark:text-zinc-500 mb-2">将复制的内容粘贴在下方输入框中：</p>
                <div className="bg-slate-100 dark:bg-black/40 border border-zinc-200 dark:border-zinc-700 p-2 text-[10px] font-mono rounded-sm leading-relaxed transition-colors">
                  <span className="text-slate-500 dark:text-zinc-500">{'{'}</span><br/>
                  <span className="text-slate-500 dark:text-zinc-500 ml-2">"code": 0,</span><br/>
                  <span className="text-slate-500 dark:text-zinc-500 ml-2">"data": {'{'}</span><br/>
                  <span className="text-purple-600 dark:text-purple-400 ml-4">"content"</span><span className="text-slate-500 dark:text-zinc-500">: </span>
                  <span className="text-green-600 dark:text-green-400">"AbCdEf123456789012345678"</span><br/>
                  <span className="text-slate-500 dark:text-zinc-500 ml-2">{'}'}</span><span className="text-slate-400 dark:text-zinc-600 ml-2">// ← 复制引号内的24位字符</span><br/>
                  <span className="text-slate-500 dark:text-zinc-500">{'}'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 输入区域 */}
      {status === ImportStatus.IDLE && (
        <div className="space-y-4">
          <div className="relative">
            <label className="block text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-2">
              身份认证 Token
            </label>
            <input
              type="text"
              value={tokenInput}
              onChange={handleInputChange}
              className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-zinc-700 p-4 font-mono text-center text-lg text-slate-800 dark:text-white focus:border-amber-500 dark:focus:border-yellow-500 focus:outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-700"
              placeholder="粘贴24位Token或完整JSON"
            />
            <div className="absolute right-3 top-[38px] text-[10px] text-slate-400 dark:text-zinc-600 font-mono pointer-events-none">
              {tokenInput.trim().length} 字符
            </div>
          </div>

          {/* 自动识别提示 */}
          {autoDetected && tokenInput.length === 24 && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-500 font-mono bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30 px-3 py-2 transition-colors">
              <CheckCircle size={14} />
              <span>已从JSON中自动提取Token</span>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!tokenInput.trim()}
            className="w-full bg-amber-500 hover:bg-amber-600 dark:bg-yellow-500 dark:hover:bg-yellow-400 disabled:opacity-50 disabled:hover:bg-amber-500 dark:disabled:hover:bg-yellow-500 text-white dark:text-black font-bold py-3 text-sm tracking-wider transition-colors flex items-center justify-center gap-2 group"
          >
            开始导入
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}

      {/* Account Selection - 多账号选择界面 */}
      {status === ImportStatus.ACCOUNT_SELECTION && availableAccounts.length > 1 && (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 p-4 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-blue-700 dark:text-blue-400 font-bold text-sm">检测到多个游戏账号</span>
            </div>
            <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono mb-4">
              请选择要导入抽卡记录的账号：
            </p>

            <div className="space-y-2">
              {availableAccounts.map((account) => (
                <button
                  key={account.uid}
                  onClick={() => handleAccountSelect(account)}
                  className={`w-full p-3 border transition-all text-left flex items-center gap-3 ${
                    account.isOfficial
                      ? 'border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                      : 'border-pink-300 dark:border-pink-600 bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/30'
                  }`}
                >
                  <div className={`w-10 h-10 flex items-center justify-center ${
                    account.isOfficial
                      ? 'bg-amber-100 dark:bg-amber-800/50'
                      : 'bg-pink-100 dark:bg-pink-800/50'
                  }`}>
                    <User size={20} className={account.isOfficial ? 'text-amber-600 dark:text-amber-400' : 'text-pink-600 dark:text-pink-400'} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-white">{account.nickName}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 font-bold uppercase ${
                        account.isOfficial
                          ? 'bg-amber-500 dark:bg-amber-600 text-white'
                          : 'bg-pink-500 dark:bg-pink-600 text-white'
                      }`}>
                        {account.channelName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono mt-0.5">
                      UID: {account.gameUid} • Lv.{account.level}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-slate-400 dark:text-zinc-500" />
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleReset}
            className="w-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 text-xs font-mono uppercase tracking-widest transition-colors"
          >
            [ 取消并返回 ]
          </button>
        </div>
      )}

      {/* Fetching Progress */}
      {(status === ImportStatus.AUTHENTICATING || status === ImportStatus.FETCHING || status === ImportStatus.PROCESSING) && (
        <div className="py-8 px-4 border border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 transition-colors">
          <FetchProgressBar progress={progress} message={statusMessage} />

          {/* 🆕 队列状态显示 */}
          <QueueStatusDisplay queueStatus={queueStatus} retryInfo={retryInfo} />

          <button
            onClick={handleCancel}
            className="mt-6 w-full text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 text-xs font-mono uppercase tracking-widest transition-colors"
          >
            [ 取消操作 ]
          </button>
        </div>
      )}

      {/* Error State */}
      {status === ImportStatus.ERROR && (
        <div className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 p-4 flex gap-3 transition-colors">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500 shrink-0" />
            <div>
              <h4 className="text-red-600 dark:text-red-500 font-bold text-sm mb-1">导入失败</h4>
              <p className="text-slate-600 dark:text-zinc-400 text-xs font-mono">{error}</p>
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

      {/* Success Preview */}
      {status === ImportStatus.SUCCESS && importSummary && (
        <div className="space-y-6">
          {userInfo && (
            <div className="flex items-center gap-3 p-3 border border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 transition-colors">
              <div className={`w-10 h-10 flex items-center justify-center ${
                userInfo.isOfficial !== false
                  ? 'bg-amber-100 dark:bg-amber-800/50'
                  : 'bg-pink-100 dark:bg-pink-800/50'
              }`}>
                <User size={20} className={userInfo.isOfficial !== false ? 'text-amber-600 dark:text-amber-400' : 'text-pink-600 dark:text-pink-400'} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">{userInfo.nickName || 'Unknown User'}</span>
                  {userInfo.channelName && (
                    <span className={`text-[10px] px-1.5 py-0.5 font-bold uppercase ${
                      userInfo.isOfficial !== false
                        ? 'bg-amber-500 dark:bg-amber-600 text-white'
                        : 'bg-pink-500 dark:bg-pink-600 text-white'
                    }`}>
                      {userInfo.channelName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-500 font-mono">UID: {userInfo.gameUid || userInfo.hgUid}</p>
              </div>
            </div>
          )}

          <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-500/20 p-4 transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="text-green-600 dark:text-green-500" size={16} />
              <span className="text-green-600 dark:text-green-500 font-bold text-sm">数据获取成功</span>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
               {/* 总抽数 */}
               <div className="text-center bg-white dark:bg-zinc-900/50 p-2 border border-zinc-200 dark:border-zinc-800/50 transition-colors">
                  <div className="text-xs font-bold text-slate-400 dark:text-zinc-400">TOTAL</div>
                  <div className="text-lg font-mono text-slate-800 dark:text-white">{importSummary.total}</div>
               </div>
               
               {/* 稀有度统计 */}
               {['6', '5', '4'].map(rarity => (
                 <div key={rarity} className="text-center bg-white dark:bg-zinc-900/50 p-2 border border-zinc-200 dark:border-zinc-800/50 transition-colors">
                    <div className={`text-xs font-bold ${rarity === '6' ? 'text-amber-600 dark:text-yellow-500' : rarity === '5' ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {rarity}★
                    </div>
                    <div className="text-lg font-mono text-slate-700 dark:text-zinc-300">{importSummary.byRarity[rarity] || 0}</div>
                 </div>
               ))}
            </div>

            {/* 卡池分布 */}
            <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50 transition-colors">
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono uppercase mb-2">卡池分布</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(importSummary.byPoolType || importSummary.byPool).map(([pool, count]) => (
                  <span
                    key={pool}
                    className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 font-mono transition-colors"
                  >
                    {getPoolName(pool)}: <span className="text-slate-800 dark:text-white">{count}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* 6星列表 */}
            {importSummary.sixStars && importSummary.sixStars.length > 0 && (
              <div className="mt-4">
                <p className="text-[10px] text-amber-600/70 dark:text-yellow-500/70 font-mono uppercase mb-2">获得的6星</p>
                <div className="flex flex-wrap gap-2">
                  {importSummary.sixStars.map((record, index) => (
                    <span
                      key={index}
                      className="bg-amber-50 dark:bg-yellow-500/10 border border-amber-200 dark:border-yellow-500/20 px-2 py-1 text-xs text-amber-700 dark:text-yellow-500 font-bold transition-colors"
                    >
                      {record.name}
                      {record.isNew && <span className="ml-1 text-[10px] bg-amber-500 dark:bg-yellow-500 text-white dark:text-black px-1 rounded-sm">NEW</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleReset}
              className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-transparent hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-white font-bold py-3 text-sm tracking-wider transition-colors"
            >
              重新获取
            </button>
            <button
              onClick={handleConfirmImport}
              className="flex-1 bg-amber-500 hover:bg-amber-600 dark:bg-yellow-500 dark:hover:bg-yellow-400 text-white dark:text-black font-bold py-3 text-sm tracking-wider transition-colors"
            >
              确认并保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function getPoolName(poolType) {
  const nameMap = {
    'limited_character': '限定角色',
    'standard': '常驻',
    'beginner': '新手',
    'limited_weapon': '武器',
    'unknown': '未知'
  };
  return nameMap[poolType] || poolType;
}
