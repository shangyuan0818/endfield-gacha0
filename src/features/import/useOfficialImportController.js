import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AuthChainError,
  RiskControlError,
  ServerConnectionError,
  executeAuthChainForAccount,
  fetchAccountsList,
  fetchAllGachaRecords,
  fetchAllGachaRecordsConcurrent,
  fetchImportQueueStatus,
  importAllRecordsFullyOnBackend
} from '../../utils/endfieldAuthChain';
import { assignBatchIds, calculatePity, generateImportSummary } from '../../utils/endfieldImportAdapter';
import { buildGameAccountServerTag } from '../../utils/gameAccountMetadata';
import { getGlobalQueue } from '../../utils/requestQueue';
import { ImportStatus } from './importShared';

function normalizeImportError(err) {
  let errorMessage = err.message || 'Unknown Error';

  if (err instanceof ServerConnectionError) {
    errorMessage = `服务器连接异常: ${err.message}`;
  } else if (err instanceof RiskControlError) {
    errorMessage = '触发频率限制，请稍候再试。';
  } else if (err instanceof AuthChainError) {
    errorMessage = `认证失败: ${err.message}`;
  }

  return errorMessage;
}

function looksLikeTokenInvalidError(message) {
  const normalized = String(message || '').toLowerCase();
  return (
    normalized.includes('token is invalid') ||
    normalized.includes('token无效') ||
    normalized.includes('请检查token是否有效') ||
    normalized.includes('未能获取 u8_token') ||
    normalized.includes('未能获取 app_token') ||
    normalized.includes('当前请求走的是') ||
    normalized.includes('请切换到')
  );
}

function getAlternateSource(source) {
  return source === 'intl' ? 'cn' : 'intl';
}

function getSourceDisplayName(source) {
  return source === 'intl' ? '国际服' : '国服';
}

function parseTokenInput(input) {
  const trimmed = input.trim();
  if (!trimmed) return { token: '', fromJson: false };

  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed);
      if (json?.data?.content) {
        return { token: json.data.content, fromJson: true };
      }
    } catch {
      // 不是有效 JSON，继续作为普通文本处理
    }
  }

  return { token: trimmed, fromJson: false };
}

function validateToken(token) {
  const trimmed = token.trim();
  if (!trimmed) return { valid: false, error: '请输入Token' };

  if (trimmed.length !== 24) {
    return { valid: false, error: `Token长度错误：期望24位，实际${trimmed.length}位` };
  }

  if (!/^[a-zA-Z0-9+/=]+$/.test(trimmed)) {
    return { valid: false, error: 'Token格式错误：包含不支持的字符' };
  }

  return { valid: true, token: trimmed };
}

function buildPreviewRecords(records, serverId) {
  const resolvedServerId = String(serverId || '1');
  const convertedRecords = records.map((record) => {
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
      recordType: record.charId ? 'character' : 'weapon',
      serverId: resolvedServerId,
      serverRegion: resolvedServerId === '1' ? '国服' : 'intl',
    };
  });

  const recordsByPool = {};
  convertedRecords.forEach((record) => {
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
  return processedRecords;
}

export function useOfficialImportController({ onImportComplete, onFetchStatusChange, onSourceSwitch, userId, source = 'cn' }) {
  const [tokenInput, setTokenInput] = useState('');
  const [status, setStatus] = useState(ImportStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [fetchedRecords, setFetchedRecords] = useState([]);
  const [importSummary, setImportSummary] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [error, setError] = useState(null);
  const [autoDetected, setAutoDetected] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [appToken, setAppToken] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [retryInfo, setRetryInfo] = useState(null);
  const [sourceSwitchInfo, setSourceSwitchInfo] = useState(null);
  const cancelRef = useRef(false);
  const switchTimerRef = useRef(null);

  useEffect(() => {
    onFetchStatusChange?.(status);
  }, [onFetchStatusChange, status]);

  useEffect(() => {
    return () => {
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (status !== ImportStatus.AUTHENTICATING && status !== ImportStatus.FETCHING) {
      queueMicrotask(() => {
        setQueueStatus(null);
        setRetryInfo(null);
      });
      return undefined;
    }

    const updateQueueStatus = async () => {
      try {
        const backendStatus = await fetchImportQueueStatus(source);
        setQueueStatus({
          queueLength: backendStatus.queueLength,
          activeRequests: backendStatus.isProcessing ? 1 : 0,
          isProcessing: backendStatus.isProcessing,
          oldestTaskAge: backendStatus.oldestTaskAge || 0,
          currentTaskMeta: backendStatus.currentTaskMeta
        });
      } catch (queueError) {
        // eslint-disable-next-line no-console
        console.warn('[OfficialAPIImport] 获取队列状态失败:', queueError);
      }
    };

    updateQueueStatus();
    const interval = setInterval(updateQueueStatus, 2000);

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
        return;
      }

      if (event === 'request:success' || event === 'request:error') {
        setRetryInfo(null);
      }
    };

    queue.addListener(handleQueueEvent);
    return () => {
      clearInterval(interval);
      queue.removeListener(handleQueueEvent);
    };
  }, [source, status]);

  const handleInputChange = useCallback((event) => {
    const rawInput = event.target.value;
    const { token, fromJson } = parseTokenInput(rawInput);

    if (fromJson) {
      setTokenInput(token);
      setAutoDetected(true);
      return;
    }

    setTokenInput(rawInput);
    setAutoDetected(false);
  }, []);

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
    setSourceSwitchInfo(null);
    if (switchTimerRef.current) {
      clearTimeout(switchTimerRef.current);
      switchTimerRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    cancelRef.current = true;
    setStatus(ImportStatus.IDLE);
    setProgress(0);
    setStatusMessage('');
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (fetchedRecords.length === 0 || !onImportComplete) return;

    onImportComplete({
      success: true,
      records: fetchedRecords,
      summary: importSummary,
      userInfo
    });
  }, [fetchedRecords, importSummary, onImportComplete, userInfo]);

  const continueImportWithAccount = useCallback(async (token, account) => {
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
        serverId: account.serverId,
        isOfficial: account.isOfficial,
        source,
        serverTag: account.serverTag || buildGameAccountServerTag(account)
      };

      setUserInfo(resolvedUserInfo);

      if (userId) {
        const accountIndex = availableAccounts.findIndex((candidate) =>
          candidate.uid === account.uid &&
          candidate.gameUid === account.gameUid &&
          candidate.channelMasterId === account.channelMasterId &&
          String(candidate.serverId || '') === String(account.serverId || '')
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
          },
          source
        );

        if (cancelRef.current) return;

        const finalUserInfo = {
          ...resolvedUserInfo,
          gameUid: backendResult?.account?.gameUid || resolvedUserInfo.gameUid,
          nickName: backendResult?.account?.nickName || resolvedUserInfo.nickName,
          serverId: backendResult?.account?.serverId || resolvedUserInfo.serverId
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

      setStatusMessage(`正在获取 ${account.channelName} 访问凭证...`);
      const authResult = await executeAuthChainForAccount(token, account, (message) => {
        if (!cancelRef.current) {
          setStatusMessage(message);
        }
      }, source);

      if (cancelRef.current) return;

      const { u8Token } = authResult;
      setStatusMessage(`正在获取 ${account.channelName} 抽卡记录...`);
      setProgress(40);

      let records;
      try {
        records = await fetchAllGachaRecordsConcurrent(
          u8Token,
          account.serverId || '1',
          (message) => {
            if (cancelRef.current) return;
            setStatusMessage(message);
            if (message.includes('限定角色')) setProgress(50);
            else if (message.includes('常驻角色')) setProgress(60);
            else if (message.includes('新手')) setProgress(70);
            else if (message.includes('武器')) setProgress(80);
            else if (message.includes('失败')) setProgress(85);
            else if (message.includes('完成')) setProgress(90);
            else if (message.includes('排队')) setProgress(35);
          },
          {
            gameUid: account.gameUid,
            nickName: account.nickName
          },
          source
        );
      } catch {
        setStatusMessage('并发获取失败，切换到串行模式...');
        records = await fetchAllGachaRecords(u8Token, (message) => {
          if (!cancelRef.current) {
            setStatusMessage(message);
          }
        }, source, account.serverId || '1');
      }

      if (cancelRef.current) return;

      setStatus(ImportStatus.PROCESSING);
      setProgress(95);
      setStatusMessage('正在处理数据...');

      const processedRecords = buildPreviewRecords(records, account.serverId);
      const summary = generateImportSummary(processedRecords);

      setFetchedRecords(processedRecords);
      setImportSummary(summary);
      setProgress(100);
      setStatus(ImportStatus.SUCCESS);
      setStatusMessage('数据准备就绪');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[OfficialAPIImport] 导入失败:', err);
      if (cancelRef.current) return;
      setError(normalizeImportError(err));
      setStatus(ImportStatus.ERROR);
    }
  }, [availableAccounts, onImportComplete, source, tokenInput, userId]);

  const tryFetchAccountsWithSource = useCallback(async (token, targetSource) => {
    return fetchAccountsList(token, (message) => {
      if (cancelRef.current) return;
      setStatusMessage(message);
      if (message.includes('验证')) setProgress(10);
      else if (message.includes('账号')) setProgress(20);
    }, targetSource);
  }, []);

  const handleImport = useCallback(async () => {
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
    setSourceSwitchInfo(null);
    cancelRef.current = false;

    let effectiveSource = source;
    let accountsResult;

    try {
      setStatusMessage('正在验证token...');
      setProgress(10);

      accountsResult = await tryFetchAccountsWithSource(validation.token, source);
    } catch (firstErr) {
      if (cancelRef.current) return;

      const shouldTryAlternate = looksLikeTokenInvalidError(firstErr.message);
      if (!shouldTryAlternate) {
        // eslint-disable-next-line no-console
        console.error('[OfficialAPIImport] 导入失败:', firstErr);
        setError(normalizeImportError(firstErr));
        setStatus(ImportStatus.ERROR);
        return;
      }

      const altSource = getAlternateSource(source);
      const altName = getSourceDisplayName(altSource);
      const curName = getSourceDisplayName(source);

      setSourceSwitchInfo({ from: source, to: altSource, countdown: 3 });
      setStatusMessage(`${curName}验证失败，检测到可能是${altName} Token，3 秒后自动切换...`);
      setProgress(5);

      try {
        await new Promise((resolve, reject) => {
          let remaining = 3;
          const tick = () => {
            remaining--;
            if (cancelRef.current) {
              reject(new Error('cancelled'));
              return;
            }
            setSourceSwitchInfo(prev => prev ? { ...prev, countdown: remaining } : null);
            setStatusMessage(`${curName}验证失败，检测到可能是${altName} Token，${remaining} 秒后自动切换...`);
            if (remaining <= 0) {
              resolve();
            } else {
              switchTimerRef.current = setTimeout(tick, 1000);
            }
          };
          switchTimerRef.current = setTimeout(tick, 1000);
        });
      } catch {
        return;
      }

      if (cancelRef.current) return;

      setStatusMessage(`已切换到${altName}，正在重新验证...`);
      setProgress(10);
      effectiveSource = altSource;

      try {
        accountsResult = await tryFetchAccountsWithSource(validation.token, altSource);
        onSourceSwitch?.(altSource);
        setSourceSwitchInfo(null);
      } catch (secondErr) {
        // eslint-disable-next-line no-console
        console.error('[OfficialAPIImport] 双服验证均失败:', secondErr);
        if (cancelRef.current) return;
        setSourceSwitchInfo(null);
        setError(`${curName}和${altName}验证均失败，请确认 Token 是否有效。\n${curName}: ${normalizeImportError(firstErr)}\n${altName}: ${normalizeImportError(secondErr)}`);
        setStatus(ImportStatus.ERROR);
        return;
      }
    }

    if (cancelRef.current || !accountsResult) return;

    try {
      const { appToken: nextAppToken, accounts } = accountsResult;
      const normalizedAccounts = accounts.map((account) => ({
        ...account,
        source: effectiveSource,
        serverTag: buildGameAccountServerTag(account)
      }));
      setAppToken(nextAppToken);
      setAvailableAccounts(normalizedAccounts);

      if (normalizedAccounts.length > 1) {
        setStatus(ImportStatus.ACCOUNT_SELECTION);
        setProgress(25);
        setStatusMessage('请选择要导入的账号');
        return;
      }

      await continueImportWithAccount(nextAppToken, normalizedAccounts[0]);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[OfficialAPIImport] 导入失败:', err);
      if (cancelRef.current) return;
      setError(normalizeImportError(err));
      setStatus(ImportStatus.ERROR);
    }
  }, [continueImportWithAccount, onSourceSwitch, source, tokenInput, tryFetchAccountsWithSource]);

  const handleAccountSelect = useCallback(async (account) => {
    await continueImportWithAccount(appToken, account);
  }, [appToken, continueImportWithAccount]);

  return {
    tokenInput,
    status,
    progress,
    statusMessage,
    importSummary,
    userInfo,
    error,
    autoDetected,
    availableAccounts,
    queueStatus,
    retryInfo,
    sourceSwitchInfo,
    handleInputChange,
    handleImport,
    handleAccountSelect,
    handleCancel,
    handleConfirmImport,
    handleReset,
  };
}
