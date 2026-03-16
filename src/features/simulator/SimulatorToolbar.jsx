import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Download, Plus, RefreshCw, Share2, User } from 'lucide-react';
import { useHistoryStore } from '../../stores';
import { RESOURCE_ICON_URLS, RESOURCE_LABELS } from '../../utils/resourceEconomy';
import PoolGroupCardRail from '../../components/pool/PoolGroupCardRail';
import { buildPoolSelectorGroups } from '../../utils/poolSelectorDisplay';

function formatCompactMetric(value) {
  const numericValue = Number(value) || 0;
  const absoluteValue = Math.abs(numericValue);
  const formatter = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 1
  });

  if (absoluteValue >= 100000000) {
    return `${(numericValue / 100000000).toFixed(1).replace(/\.0$/, '')}亿`;
  }

  if (absoluteValue >= 10000) {
    return `${(numericValue / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  }

  return formatter.format(numericValue);
}

function CumulativeChip({ icon, label, value }) {
  const fullValue = new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2
  }).format(Number(value || 0));

  return (
    <div className="flex items-center gap-2 px-2.5 py-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900/70 min-w-0">
      <img src={icon} alt={label} className="w-5 h-5 object-contain shrink-0" loading="lazy" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold">{label}</div>
        <div className="text-xs sm:text-sm font-mono font-bold text-slate-700 dark:text-zinc-200" title={fullValue}>
          {formatCompactMetric(value)}
        </div>
      </div>
    </div>
  );
}

function ResourceChip({
  activeEditor,
  exchangeRate,
  onAdjustResourceAmount,
  onOpenEditor,
  onCloseEditor,
  originiteBalance,
  resourceKey,
  value
}) {
  const editor = activeEditor?.resourceKey === resourceKey ? activeEditor : null;
  const label = RESOURCE_LABELS[resourceKey];
  const numericInput = Math.max(0, Math.floor(Number(editor?.value) || 0));
  const canConvertOriginite = resourceKey === 'jade' && editor?.mode === 'add' && numericInput > 0 && numericInput <= originiteBalance;
  const editTitle = `点击直接修改${label}数量`;
  const addTitle = resourceKey === 'jade' ? '源石换玉 / 增加嵌晶玉' : `增加${label}`;
  const editorTitle = resourceKey === 'jade' && editor?.mode === 'add' ? '源石换玉 / 增加嵌晶玉' : editor?.mode === 'add' ? `增加${label}` : `设为${label}`;

  return (
    <div className="relative min-w-[180px]">
      <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 min-w-0">
        <img src={RESOURCE_ICON_URLS[resourceKey]} alt={label} className="w-7 h-7 object-contain shrink-0" loading="lazy" />
        <button
          type="button"
          onClick={() => onOpenEditor(resourceKey, 'set', value)}
          className="min-w-0 flex-1 text-left font-mono font-bold text-slate-700 dark:text-zinc-200 hover:text-endfield-yellow transition-colors"
          title={editTitle}
        >
          <span className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500">{label}</span>
          <span className="block text-sm sm:text-base leading-tight break-all">{Number(value || 0).toLocaleString()}</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenEditor(resourceKey, 'add', '')}
          className="w-7 h-7 shrink-0 flex items-center justify-center border border-zinc-300 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-endfield-yellow hover:border-endfield-yellow transition-colors"
          title={addTitle}
        >
          <Plus size={14} />
        </button>
      </div>

      {editor && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg p-3 z-30">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-bold mb-2">
            {editorTitle}
          </div>
          <input
            type="number"
            min="0"
            step="1"
            value={editor.value}
            onChange={(event) => onOpenEditor(resourceKey, editor.mode, event.target.value)}
            className="w-full bg-transparent px-2 py-2 text-sm font-mono text-slate-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 outline-none"
          />

          {resourceKey === 'jade' && editor.mode === 'add' && (
            <div className="mt-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/20 px-2 py-2">
              <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                1 源石 = {exchangeRate} 嵌晶玉
              </div>
              <div className="mt-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                当前可兑换: {originiteBalance.toLocaleString()} 源石
              </div>
              <button
                type="button"
                onClick={() => {
                  onAdjustResourceAmount(resourceKey, 'convertOriginite', editor.value);
                  onCloseEditor();
                }}
                disabled={!canConvertOriginite}
                className="mt-2 w-full px-2 py-1.5 text-[11px] font-bold border border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                源石换玉 {numericInput > 0 ? `(+${(numericInput * exchangeRate).toLocaleString()} 玉)` : ''}
              </button>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                onAdjustResourceAmount(resourceKey, editor.mode, editor.value);
                onCloseEditor();
              }}
              className="flex-1 px-2 py-1.5 text-[11px] font-bold bg-endfield-yellow text-black hover:brightness-110 transition-colors"
            >
              {editor.mode === 'add' ? '增加' : '设为'}
            </button>
            <button
              type="button"
              onClick={onCloseEditor}
              className="px-2 py-1.5 text-[11px] font-bold border border-zinc-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const SimulatorToolbar = ({
  currentSimPoolId,
  onExportData,
  onExportReport,
  onInheritRealState,
  onReset,
  poolPullCounts,
  resourceLedger,
  onAdjustResourceAmount,
  onShareImage,
  onShareText,
  onSwitchPool,
  onToggleMultipleFreeTen,
  onToggleSkipAnimation,
  originiteToJadeRate,
  poolType,
  simulatorPools,
  multipleFreeTen,
  skipAnimation,
  supportsImageShare
}) => {
  const [activeEditor, setActiveEditor] = useState(null);
  const [showInheritAccountDropdown, setShowInheritAccountDropdown] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef(null);
  useHistoryStore((state) => state.history);
  const getGameAccountsFromHistory = useHistoryStore((state) => state.getGameAccountsFromHistory);
  const resourceItems = useMemo(() => ([
    { resourceKey: 'jade', value: Math.max(Number(resourceLedger?.jadeBalance || 0), 0) },
    { resourceKey: 'originite', value: Math.max(Number(resourceLedger?.originiteBalance || 0), 0) },
    { resourceKey: 'arsenalQuota', value: Math.max(Number(resourceLedger?.arsenalBalance || 0), 0) }
  ]), [resourceLedger]);
  const cumulativeItems = useMemo(() => ([
    { key: 'jadeSpent', label: '耗玉', value: Number(resourceLedger?.jadeSpent || 0), icon: RESOURCE_ICON_URLS.jade },
    { key: 'originiteEquivalent', label: '石折玉', value: Number(resourceLedger?.originiteEquivalent || 0), icon: RESOURCE_ICON_URLS.originite },
    { key: 'arsenalGained', label: '得配额', value: Number(resourceLedger?.arsenalGained || 0), icon: RESOURCE_ICON_URLS.arsenalQuota },
    { key: 'arsenalSpent', label: '耗配额', value: Number(resourceLedger?.arsenalSpent || 0), icon: RESOURCE_ICON_URLS.arsenalQuota }
  ]), [resourceLedger]);
  const selectorGroups = useMemo(() => buildPoolSelectorGroups({
    pools: simulatorPools,
    poolPullCounts
  }), [poolPullCounts, simulatorPools]);
  const gameAccounts = getGameAccountsFromHistory();

  const openEditor = (resourceKey, mode, value) => {
    setActiveEditor({
      resourceKey,
      mode,
      value: value === '' ? '' : String(Math.max(0, Math.floor(Number(value) || 0)))
    });
  };

  useEffect(() => {
    if (!showShareMenu) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!shareMenuRef.current?.contains(event.target)) {
        setShowShareMenu(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [showShareMenu]);

  return (
    <div className="mb-6 px-2 space-y-4">
      <PoolGroupCardRail
        groups={selectorGroups}
        currentSelectionId={currentSimPoolId}
        onSelectPool={onSwitchPool}
      />

      <div className="flex flex-col gap-2 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end xl:gap-4">
        <div className="order-2 min-w-0 xl:order-1 xl:self-end">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold mb-2">
              累计资源
            </div>
            <div className="flex flex-wrap gap-2">
              {cumulativeItems.map((item) => (
                <CumulativeChip
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  value={item.value}
                />
              ))}
            </div>
        </div>

        <div className="order-1 flex flex-col gap-2 xl:order-2 xl:items-end">
          <div className="flex flex-wrap xl:justify-end gap-3">
            {resourceItems.map((item) => (
              <ResourceChip
                key={item.resourceKey}
                activeEditor={activeEditor}
                exchangeRate={originiteToJadeRate}
                onAdjustResourceAmount={onAdjustResourceAmount}
                onOpenEditor={openEditor}
                onCloseEditor={() => setActiveEditor(null)}
                originiteBalance={Math.max(Number(resourceLedger?.originiteBalance || 0), 0)}
                resourceKey={item.resourceKey}
                value={item.value}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4">
        {poolType === 'limited' && (
          <div
            onClick={onToggleMultipleFreeTen}
            className={`
              flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all border select-none
              ${multipleFreeTen
                ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-700'
              }
            `}
            title="多次十连是BUG（划掉）特性哦~"
          >
            <div className={`w-3 h-3 border flex items-center justify-center transition-colors ${multipleFreeTen ? 'border-blue-500 bg-blue-500' : 'border-current'}`}>
              {multipleFreeTen && <Check size={10} className="text-white" strokeWidth={4} />}
            </div>
            <span className="text-xs font-bold uppercase">多次免费十连</span>
          </div>
        )}

        <div
          onClick={onToggleSkipAnimation}
          className={`
            flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all border select-none
            ${skipAnimation
              ? 'bg-yellow-50 dark:bg-endfield-yellow/10 border-yellow-600 dark:border-endfield-yellow text-yellow-700 dark:text-endfield-yellow'
              : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-700'
            }
          `}
        >
          <div className={`w-3 h-3 border flex items-center justify-center transition-colors ${skipAnimation ? 'border-yellow-600 dark:border-endfield-yellow bg-yellow-500 dark:bg-endfield-yellow' : 'border-current'}`}>
            {skipAnimation && <Check size={10} className="text-white dark:text-black" strokeWidth={4} />}
          </div>
          <span className="text-xs font-bold uppercase">跳过动画</span>
        </div>

        <div className="relative">
          <button
            onClick={() => {
              if (gameAccounts.length <= 1) {
                onInheritRealState(gameAccounts[0] || null);
                return;
              }

              setShowInheritAccountDropdown((visible) => !visible);
            }}
            className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-endfield-yellow hover:border-endfield-yellow transition-colors"
            title="选择一个账号并继承其真实抽卡记录"
          >
            <RefreshCw size={14} />
            <span className="hidden sm:inline">继承账号</span>
            <span className="sm:hidden">继承</span>
            {gameAccounts.length > 1 && (
              <ChevronDown size={12} className={`transition-transform ${showInheritAccountDropdown ? 'rotate-180' : ''}`} />
            )}
          </button>
          {showInheritAccountDropdown && gameAccounts.length > 1 && (
            <div className="absolute right-0 top-full mt-1 w-60 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg z-50">
              {gameAccounts.map((account) => (
                <button
                  key={account.gameUid}
                  type="button"
                  onClick={() => {
                    onInheritRealState(account);
                    setShowInheritAccountDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-mono hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors text-slate-600 dark:text-zinc-400"
                >
                  <div className="flex items-center gap-2">
                    <User size={12} className="shrink-0" />
                    <span className="font-bold text-slate-700 dark:text-zinc-300">{account.nickName}</span>
                    {account.serverTag && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                        {account.serverTag}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">UID: {account.gameUid}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={shareMenuRef}>
          <button
            type="button"
            onClick={() => setShowShareMenu((visible) => !visible)}
            className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-endfield-yellow hover:border-endfield-yellow transition-colors"
            title="分享模拟统计"
          >
            <Share2 size={14} />
            <span className="hidden sm:inline">分享</span>
            <ChevronDown size={12} className={`transition-transform ${showShareMenu ? 'rotate-180' : ''}`} />
          </button>

          {showShareMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-lg z-50">
              <button
                type="button"
                onClick={() => {
                  setShowShareMenu(false);
                  onShareImage();
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                {supportsImageShare ? <Share2 size={14} /> : <Download size={14} />}
                <span>{supportsImageShare ? '系统分享图片' : '下载分享卡 PNG'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowShareMenu(false);
                  onShareText();
                }}
                className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2"
              >
                <Copy size={14} />
                <span>复制分享文本</span>
              </button>
            </div>
          )}
        </div>

        <div className="relative group">
          <button
            className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-endfield-yellow hover:border-endfield-yellow transition-colors"
            title="导出数据"
          >
            <Download size={14} />
            <span className="hidden sm:inline">导出</span>
            <ChevronDown size={12} />
          </button>

          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <button
              onClick={() => onExportData('json')}
              className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              导出为 JSON（可导入）
            </button>
            <button
              onClick={() => onExportData('csv')}
              className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800"
            >
              导出为 CSV（可导入）
            </button>
            <button
              onClick={onExportReport}
              className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800"
            >
              导出统计报告
            </button>
          </div>
        </div>

        <button
          onClick={onReset}
          className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-red-500 hover:border-red-500 transition-colors"
          title="重置模拟器"
        >
          <RefreshCw size={14} />
          <span className="hidden sm:inline">重置</span>
        </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SimulatorToolbar;
