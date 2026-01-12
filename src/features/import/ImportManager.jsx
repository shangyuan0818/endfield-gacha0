/**
 * 导入管理器主组件
 *
 * 提供多种导入方式的统一入口
 */

import { useState, useCallback } from 'react';
import { X, Upload, FileText, Link, HelpCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { ImportMethod, ImportStatus } from '../../utils/importTypes';
import {
  parseCSV,
  parseJSON,
  validateRecords,
  deduplicateRecords,
  normalizeRecord,
  assignBatchIds,
  autoDetectPoolType,
  calculateImportSummary
} from '../../utils/importParsers';
import { usePoolStore, useHistoryStore } from '../../stores';

/**
 * ImportManager 组件
 */
export default function ImportManager({ isOpen, onClose, onImportComplete }) {
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [importStatus, setImportStatus] = useState(ImportStatus.IDLE);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  // 批量粘贴相关状态
  const [pasteText, setPasteText] = useState('');
  const [parsedRecords, setParsedRecords] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [suggestedPools, setSuggestedPools] = useState([]);

  // 从 stores 获取数据
  const pools = usePoolStore(state => state.pools);
  const history = useHistoryStore(state => state.history);
  const addPulls = useHistoryStore(state => state.addPulls);
  const createPool = usePoolStore(state => state.createPool);

  // 导入方式配置
  const importMethods = [
    {
      id: ImportMethod.OFFICIAL_API,
      name: '官网API导入',
      description: '登录官网后自动获取抽卡历史',
      icon: Link,
      status: 'coming_soon', // 'available', 'coming_soon', 'disabled'
      badge: '开服后开放',
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      hoverBg: 'hover:bg-blue-500/20'
    },
    {
      id: ImportMethod.SCREENSHOT_OCR,
      name: '截图识别',
      description: '上传游戏截图，自动识别抽卡记录',
      icon: Upload,
      status: 'coming_soon',
      badge: '开发中',
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      hoverBg: 'hover:bg-purple-500/20'
    },
    {
      id: ImportMethod.MANUAL_PASTE,
      name: '批量粘贴',
      description: '手动输入或粘贴抽卡数据（CSV/JSON格式）',
      icon: FileText,
      status: 'available',
      badge: '推荐',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      hoverBg: 'hover:bg-yellow-500/20'
    }
  ];

  // 处理方法选择
  const handleMethodSelect = useCallback((method) => {
    if (method.status === 'disabled') return;

    if (method.status === 'coming_soon') {
      alert(`${method.name}功能即将推出，敬请期待！\n\n当前推荐使用「批量粘贴」功能。`);
      return;
    }

    setSelectedMethod(method.id);
  }, []);

  // 重置状态
  const handleReset = useCallback(() => {
    setSelectedMethod(null);
    setImportStatus(ImportStatus.IDLE);
    setProgress(0);
    setStatusMessage('');
    setImportResult(null);
    setPasteText('');
    setParsedRecords(null);
    setValidationResult(null);
    setSuggestedPools([]);
  }, []);

  // 关闭弹窗
  const handleClose = useCallback(() => {
    if (importStatus === ImportStatus.FETCHING || importStatus === ImportStatus.PARSING) {
      if (!confirm('导入正在进行中，确定要关闭吗?')) {
        return;
      }
    }
    handleReset();
    onClose();
  }, [importStatus, handleReset, onClose]);

  /**
   * 分析卡池类型并生成建议
   */
  const analyzePools = useCallback((records) => {
    const poolMap = new Map();

    records.forEach(record => {
      const poolType = record.pool || autoDetectPoolType(record);

      if (!poolMap.has(poolType)) {
        // 添加类型检查：确保 pools 是数组
        const poolsArray = Array.isArray(pools) ? pools : [];

        // 检查是否存在该类型的卡池（不是检查 id，而是检查 type！）
        const hasPoolOfType = poolsArray.some(p => p.type === poolType);

        poolMap.set(poolType, {
          poolId: poolType,  // 这里存的是类型字符串
          count: 0,
          needCreate: !hasPoolOfType
        });
      }

      poolMap.get(poolType).count++;
    });

    return Array.from(poolMap.values());
  }, [pools]);  // 添加 pools 依赖

  /**
   * 解析粘贴的文本数据
   */
  const handleParse = useCallback(async () => {
    if (!pasteText.trim()) {
      alert('请粘贴数据后再解析');
      return;
    }

    setImportStatus(ImportStatus.PARSING);
    setProgress(10);
    setStatusMessage('正在解析数据...');

    try {
      let rawRecords = [];
      const trimmed = pasteText.trim();

      // 1. 自动检测格式（JSON优先，失败则尝试CSV）
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        // JSON格式
        try {
          rawRecords = parseJSON(trimmed);
          setStatusMessage('✓ 识别为JSON格式');
        } catch (e) {
          throw new Error(`JSON解析失败: ${e.message}`);
        }
      } else {
        // CSV格式
        try {
          rawRecords = parseCSV(trimmed);
          setStatusMessage('✓ 识别为CSV格式');
        } catch (e) {
          throw new Error(`CSV解析失败: ${e.message}`);
        }
      }

      setProgress(30);
      setStatusMessage('正在标准化数据...');

      // 2. 标准化记录格式
      const normalizedRecords = rawRecords.map(record => normalizeRecord(record));

      setProgress(50);
      setStatusMessage('正在验证数据...');

      // 3. 验证数据
      const validation = validateRecords(normalizedRecords);
      setValidationResult(validation);

      if (validation.invalidRecords.length > 0) {
        console.warn(`发现 ${validation.invalidRecords.length} 条无效记录:`, validation.invalidRecords);
      }

      setProgress(70);
      setStatusMessage('正在去重...');

      // 4. 去重
      const deduplicated = deduplicateRecords(validation.validRecords);

      setProgress(80);
      setStatusMessage('正在分配批次ID...');

      // 5. 分配批次ID
      const recordsWithBatch = assignBatchIds(deduplicated);

      setProgress(90);
      setStatusMessage('正在分析卡池类型...');

      // 6. 分析卡池类型和生成建议
      const poolSuggestions = analyzePools(recordsWithBatch);
      setSuggestedPools(poolSuggestions);

      setProgress(100);
      setStatusMessage('✓ 解析完成');
      setParsedRecords(recordsWithBatch);
      setImportStatus(ImportStatus.SUCCESS);

    } catch (error) {
      console.error('[ImportManager] 解析失败:', error);
      setImportStatus(ImportStatus.ERROR);
      setStatusMessage(error.message || '解析失败，请检查数据格式');
      setProgress(0);
    }
  }, [pasteText, analyzePools]);  // 添加 analyzePools 依赖

  /**
   * 执行导入
   */
  const handleImport = useCallback(async () => {
    if (!parsedRecords || parsedRecords.length === 0) {
      alert('没有可导入的数据');
      return;
    }

    setImportStatus(ImportStatus.FETCHING);
    setProgress(0);
    setStatusMessage('正在导入...');

    try {
      // 1. 获取当前的 pools 列表
      const currentPools = usePoolStore.getState().pools;
      console.log('[ImportManager] 当前卡池列表:', currentPools);

      // 2. 构建 poolType -> poolId 的映射表（每个类型取第一个匹配的卡池）
      const poolTypeToIdMap = {};
      currentPools.forEach(pool => {
        if (pool.type && !poolTypeToIdMap[pool.type]) {
          poolTypeToIdMap[pool.type] = pool.id;
        }
      });
      console.log('[ImportManager] 卡池类型映射:', poolTypeToIdMap);

      // 3. 检查并创建缺失的卡池
      const poolsNeedCreate = suggestedPools.filter(p => p.needCreate);

      if (poolsNeedCreate.length > 0) {
        setStatusMessage(`正在创建 ${poolsNeedCreate.length} 个卡池...`);

        for (const suggestion of poolsNeedCreate) {
          const poolName = getPoolDisplayName(suggestion.poolId);
          const newPool = createPool({
            name: poolName,
            type: suggestion.poolId,
            created_at: new Date().toISOString()
          });

          // 更新映射表
          if (!poolTypeToIdMap[suggestion.poolId]) {
            poolTypeToIdMap[suggestion.poolId] = newPool.id;
          }
          console.log('[ImportManager] 创建新卡池:', newPool);
        }
      }

      setProgress(30);
      setStatusMessage('正在检查重复记录...');

      // 4. 查重逻辑：基于 timestamp + name + poolType（不是poolId！）
      const poolsArray = Array.isArray(currentPools) ? currentPools : [];
      const existingKeys = new Set(
        history.map(h => {
          // 从 poolId 反查 poolType
          const pool = poolsArray.find(p => p.id === h.poolId);
          const poolType = pool?.type || h.poolId;
          return `${h.timestamp}_${h.name}_${poolType}`;
        })
      );
      console.log('[ImportManager] 现有记录key数量:', existingKeys.size);

      const newRecords = parsedRecords.filter(record => {
        const key = `${record.timestamp}_${record.name}_${record.pool}`;
        const isDuplicate = existingKeys.has(key);
        if (isDuplicate) {
          console.log('[ImportManager] 跳过重复记录:', key);
        }
        return !isDuplicate;
      });

      const duplicateCount = parsedRecords.length - newRecords.length;
      console.log('[ImportManager] 新记录数:', newRecords.length, '重复:', duplicateCount);

      setProgress(60);
      setStatusMessage(`正在保存 ${newRecords.length} 条新记录...`);

      // 5. 转换为 history 格式并保存
      const historyRecords = newRecords.map(record => {
        // 映射 record.pool (类型字符串) 到实际的 poolId
        const actualPoolId = poolTypeToIdMap[record.pool] || record.pool;

        return {
          id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          poolId: actualPoolId,  // 使用映射后的真实卡池ID
          name: record.name,
          rarity: record.rarity,
          timestamp: record.timestamp,
          batchId: record.batchId,
          isLimited: record.isLimited,
          pity: record.pity || 0,
          isStandard: !record.isLimited,
          character_name: record.name,  // 添加角色名称字段
          created_at: new Date().toISOString()
        };
      });

      console.log('[ImportManager] 保存的记录示例:', historyRecords.slice(0, 3));
      addPulls(historyRecords);

      setProgress(100);
      setStatusMessage('✓ 导入完成');

      // 6. 生成导入结果
      const result = {
        success: true,
        records: historyRecords,
        summary: {
          total: parsedRecords.length,
          newRecords: newRecords.length,
          duplicates: duplicateCount,
          byPool: calculateImportSummary(newRecords).byPool
        }
      };

      setImportResult(result);
      setImportStatus(ImportStatus.SUCCESS);

      // 通知父组件
      if (onImportComplete) {
        onImportComplete(result);
      }

    } catch (error) {
      console.error('[ImportManager] 导入失败:', error);
      setImportStatus(ImportStatus.ERROR);
      setStatusMessage(error.message || '导入失败');
      setProgress(0);
    }
  }, [parsedRecords, suggestedPools, history, createPool, addPulls, onImportComplete]);

  /**
   * 获取卡池显示名称
   */
  const getPoolDisplayName = (poolId) => {
    const nameMap = {
      'limited_character': '限定角色池',
      'limited_weapon': '限定武器池',
      'standard': '常驻池'
    };
    return nameMap[poolId] || poolId;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-yellow-400/20 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="sticky top-0 bg-zinc-900 border-b border-yellow-400/20 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-yellow-400" />
            <h2 className="text-xl font-bold text-white">游戏数据导入</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="p-2 hover:bg-yellow-400/10 transition-colors text-yellow-400"
              title="导入指南"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-red-500/10 transition-colors text-red-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* 导入指南（可折叠） */}
          {showGuide && (
            <div className="mb-6 bg-blue-500/5 border border-blue-400/20 p-4">
              <h3 className="text-blue-400 font-bold mb-2">📖 导入指南</h3>
              <div className="text-gray-300 text-sm space-y-2">
                <p><strong className="text-yellow-400">官网API导入：</strong>一键导入所有历史记录（游戏上线后开放）</p>
                <p><strong className="text-yellow-400">截图识别：</strong>上传游戏内抽卡记录截图，自动识别（开发中）</p>
                <p><strong className="text-yellow-400">批量粘贴：</strong>手动输入数据，支持CSV和JSON格式</p>
              </div>
            </div>
          )}

          {/* 方法选择 */}
          {!selectedMethod && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <p className="text-gray-400">请选择导入方式</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {importMethods.map((method) => {
                  const Icon = method.icon;
                  const isDisabled = method.status === 'disabled';
                  const isComingSoon = method.status === 'coming_soon';

                  return (
                    <button
                      key={method.id}
                      onClick={() => handleMethodSelect(method)}
                      disabled={isDisabled}
                      className={`
                        relative p-6 border transition-all text-left
                        ${method.bgColor} ${method.hoverBg}
                        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        ${isComingSoon ? 'border-gray-600' : `border-${method.color.split('-')[1]}-400/30`}
                      `}
                    >
                      {/* 状态标签 */}
                      {method.badge && (
                        <div className={`
                          absolute top-2 right-2 px-2 py-1 text-xs font-bold
                          ${isComingSoon ? 'bg-gray-600 text-gray-300' : 'bg-yellow-400 text-black'}
                        `}>
                          {method.badge}
                        </div>
                      )}

                      {/* 图标 */}
                      <div className={`mb-4 ${method.color}`}>
                        <Icon className="w-12 h-12" />
                      </div>

                      {/* 标题 */}
                      <h3 className="text-white font-bold text-lg mb-2">
                        {method.name}
                      </h3>

                      {/* 描述 */}
                      <p className="text-gray-400 text-sm">
                        {method.description}
                      </p>

                      {/* 即将推出提示 */}
                      {isComingSoon && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <p className="text-gray-500 text-xs">
                            点击查看详情
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 注意事项 */}
              <div className="mt-6 bg-yellow-400/5 border border-yellow-400/20 p-4">
                <p className="text-yellow-400 text-sm">
                  <strong>💡 提示：</strong>
                  导入的数据将会与现有数据合并，不会覆盖已有记录。
                </p>
              </div>
            </div>
          )}

          {/* 导入进度 */}
          {selectedMethod && importStatus !== ImportStatus.IDLE && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">
                  {importMethods.find(m => m.id === selectedMethod)?.name}
                </h3>
                <button
                  onClick={handleReset}
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  返回选择
                </button>
              </div>

              {/* 进度条 */}
              <div className="bg-zinc-800 h-2 overflow-hidden">
                <div
                  className="h-full bg-yellow-400 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* 状态信息 */}
              <div className="text-center">
                <p className="text-gray-300">{statusMessage}</p>
                {progress > 0 && (
                  <p className="text-gray-500 text-sm mt-1">{progress}%</p>
                )}
              </div>

              {/* 导入结果 */}
              {importResult && importStatus === ImportStatus.SUCCESS && (
                <div className="bg-green-500/10 border border-green-400/30 p-4 mt-4">
                  <h4 className="text-green-400 font-bold mb-2">✓ 导入成功！</h4>
                  <div className="text-gray-300 text-sm space-y-1">
                    <p>总记录数: {importResult.summary?.total || 0}</p>
                    <p>新增记录: {importResult.summary?.newRecords || 0}</p>
                    <p>重复跳过: {importResult.summary?.duplicates || 0}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (onImportComplete) {
                        onImportComplete(importResult);
                      }
                      handleClose();
                    }}
                    className="mt-4 w-full bg-yellow-400 text-black font-bold py-2 hover:bg-yellow-500 transition-colors"
                  >
                    确认导入
                  </button>
                </div>
              )}

              {/* 错误信息 */}
              {importStatus === ImportStatus.ERROR && (
                <div className="bg-red-500/10 border border-red-400/30 p-4 mt-4">
                  <h4 className="text-red-400 font-bold mb-2">✗ 导入失败</h4>
                  <p className="text-gray-300 text-sm">{statusMessage}</p>
                  <button
                    onClick={handleReset}
                    className="mt-4 w-full bg-gray-700 text-white font-bold py-2 hover:bg-gray-600 transition-colors"
                  >
                    重新选择
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 批量粘贴表单 */}
          {selectedMethod === ImportMethod.MANUAL_PASTE && importStatus === ImportStatus.IDLE && !parsedRecords && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">批量粘贴数据</h3>
                <button
                  onClick={handleReset}
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  返回选择
                </button>
              </div>

              <div className="bg-zinc-800 border border-yellow-400/20 p-4">
                <p className="text-yellow-400 text-sm mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  支持格式：CSV 或 JSON
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  className="w-full h-64 bg-zinc-900 text-white border border-gray-600 p-3 font-mono text-sm resize-none focus:outline-none focus:border-yellow-400"
                  placeholder={`请粘贴抽卡数据...

CSV格式示例：
pool,name,rarity,timestamp,isLimited
limited_character,莱万汀,6,1737360000000,true
limited_character,伊冯,5,1737360010000,false

JSON格式示例：
[
  {
    "pool": "limited_character",
    "name": "莱万汀",
    "rarity": 6,
    "timestamp": 1737360000000,
    "isLimited": true
  }
]`}
                />
              </div>

              <button
                className="w-full bg-yellow-400 text-black font-bold py-3 hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleParse}
                disabled={!pasteText.trim()}
              >
                解析并预览
              </button>
            </div>
          )}

          {/* 解析预览 */}
          {selectedMethod === ImportMethod.MANUAL_PASTE && parsedRecords && importStatus === ImportStatus.SUCCESS && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold">导入预览</h3>
                <button
                  onClick={handleReset}
                  className="text-gray-400 hover:text-white transition-colors text-sm"
                >
                  重新粘贴
                </button>
              </div>

              {/* 验证结果 */}
              {validationResult && (
                <div className={`border p-4 ${
                  validationResult.valid
                    ? 'bg-green-500/10 border-green-400/30'
                    : 'bg-yellow-500/10 border-yellow-400/30'
                }`}>
                  <div className="flex items-start gap-2">
                    {validationResult.valid ? (
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className={`font-bold mb-2 ${
                        validationResult.valid ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        数据验证结果
                      </h4>
                      <div className="text-sm text-gray-300 space-y-1">
                        <p>总记录数: {validationResult.summary.total}</p>
                        <p>有效记录: {validationResult.summary.valid}</p>
                        {validationResult.summary.invalid > 0 && (
                          <p className="text-yellow-400">
                            无效记录: {validationResult.summary.invalid} ({validationResult.summary.validRate}% 有效)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 卡池建议 */}
              {suggestedPools.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-400/30 p-4">
                  <h4 className="text-blue-400 font-bold mb-3 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    卡池分析
                  </h4>
                  <div className="space-y-2">
                    {suggestedPools.map(pool => (
                      <div key={pool.poolId} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">
                          {getPoolDisplayName(pool.poolId)}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400">{pool.count} 条记录</span>
                          {pool.needCreate ? (
                            <span className="text-yellow-400 text-xs bg-yellow-400/10 px-2 py-1">
                              将自动创建
                            </span>
                          ) : (
                            <span className="text-green-400 text-xs bg-green-400/10 px-2 py-1">
                              ✓ 已存在
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 导入按钮 */}
              <button
                className="w-full bg-yellow-400 text-black font-bold py-3 hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
                onClick={handleImport}
              >
                <Upload className="w-5 h-5" />
                确认导入 ({parsedRecords.length} 条记录)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
