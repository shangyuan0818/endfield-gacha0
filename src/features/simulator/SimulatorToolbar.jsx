import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, Download, Loader2, Plus, RefreshCw, Share2, User } from 'lucide-react';
import { useHistoryStore } from '../../stores';
import { getLocalizedResourceLabel, RESOURCE_ICON_URLS } from '../../utils/resourceEconomy';
import PoolGroupCardRail from '../../components/pool/PoolGroupCardRail';
import ShareActionStatus from '../../components/share/ShareActionStatus';
import { buildPoolSelectorGroups } from '../../utils/poolSelectorDisplay';
import { useI18n } from '../../i18n/index.js';

const ORIGINITE_PURCHASE_PRESETS = [
  { label: '￥6', amount: 6, bonusLabel: '6' },
  { label: '￥30', amount: 36, bonusLabel: '24+12' },
  { label: '￥98', amount: 126, bonusLabel: '84+42' },
  { label: '￥198', amount: 255, bonusLabel: '170+85' },
  { label: '￥328', amount: 423, bonusLabel: '282+141' },
  { label: '￥648', amount: 840, bonusLabel: '560+280' },
];

function formatCompactMetric(value, locale) {
  const numericValue = Number(value) || 0;
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
  }).format(numericValue);
}

function CumulativeChip({ icon, label, value, locale }) {
  const fullValue = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(Number(value || 0)) ? 0 : 2,
  }).format(Number(value || 0));

  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 border border-zinc-200 bg-zinc-100/70 px-2.5 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
      <img src={icon} alt={label} className="w-5 h-5 object-contain shrink-0" loading="lazy" />
      <div className="min-w-0">
        <div
          className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400"
          title={label}
        >
          {label}
        </div>
        <div className="text-xs sm:text-sm font-mono font-bold text-slate-700 dark:text-zinc-200" title={fullValue}>
          {formatCompactMetric(value, locale)}
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
  quickAddPresets,
  resourceKey,
  value,
  t,
  locale,
}) {
  const editor = activeEditor?.resourceKey === resourceKey ? activeEditor : null;
  const label = getLocalizedResourceLabel(resourceKey, locale);
  const numericInput = Math.max(0, Math.floor(Number(editor?.value) || 0));
  const canConvertOriginite =
    resourceKey === 'jade' && editor?.mode === 'add' && numericInput > 0 && numericInput <= originiteBalance;
  const editTitle = t('simulator.resource.editTitle', { label });
  const addTitle = resourceKey === 'jade' ? t('simulator.resource.convertTitle') : t('simulator.resource.addTitle', { label });
  const editorTitle =
    resourceKey === 'jade' && editor?.mode === 'add'
      ? t('simulator.resource.convertTitle')
      : editor?.mode === 'add'
        ? t('simulator.resource.addTitle', { label })
        : t('simulator.resource.setTitle', { label });

  return (
    <div className="relative min-w-[180px]">
      <div className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2.5 min-w-0">
        <img
          src={RESOURCE_ICON_URLS[resourceKey]}
          alt={label}
          className="w-7 h-7 object-contain shrink-0"
          loading="lazy"
        />
        <button
          type="button"
          onClick={() => onOpenEditor(resourceKey, 'set', value)}
          className="min-w-0 flex-1 text-left font-mono font-bold text-slate-700 dark:text-zinc-200 hover:text-endfield-yellow transition-colors"
          title={editTitle}
        >
          <span className="block text-[10px] uppercase tracking-wider text-slate-500 dark:text-zinc-500">{label}</span>
          <span className="block text-sm sm:text-base leading-tight break-all">
            {Number(value || 0).toLocaleString(locale)}
          </span>
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
                {t('simulator.resource.rate', { rate: exchangeRate })}
              </div>
              <div className="mt-1 text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                {t('simulator.resource.availableOriginite', { count: originiteBalance.toLocaleString(locale) })}
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
                {t('simulator.resource.convertAction', {
                  gain: numericInput > 0 ? `(+${(numericInput * exchangeRate).toLocaleString(locale)} ${getLocalizedResourceLabel('jade', locale)})` : '',
                })}
              </button>
            </div>
          )}

          {resourceKey === 'originite' &&
            editor.mode === 'add' &&
            Array.isArray(quickAddPresets) &&
            quickAddPresets.length > 0 && (
              <div className="mt-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-black/20 px-2 py-2">
                <div className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 mb-2">{t('simulator.resource.presetTitle')}</div>
                <div className="grid grid-cols-2 gap-2">
                  {quickAddPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        onAdjustResourceAmount(resourceKey, 'add', preset.amount);
                        onCloseEditor();
                      }}
                      className="border border-zinc-200 dark:border-zinc-700 px-2 py-1.5 text-left hover:border-endfield-yellow hover:text-endfield-yellow transition-colors"
                    >
                      <div className="text-[11px] font-bold">{preset.label}</div>
                      <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">{preset.bonusLabel}</div>
                    </button>
                  ))}
                </div>
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
              {editor.mode === 'add' ? t('simulator.resource.addAction') : t('simulator.resource.setAction')}
            </button>
            <button
              type="button"
              onClick={onCloseEditor}
              className="px-2 py-1.5 text-[11px] font-bold border border-zinc-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
            >
              {t('common.cancel')}
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
  onDownloadImage,
  onCopyImage,
  onShareText,
  onSwitchPool,
  onToggleMultipleFreeTen,
  onToggleSkipAnimation,
  originiteToJadeRate,
  poolType,
  simulatorPools,
  multipleFreeTen,
  skipAnimation,
  supportsClipboardImageCopy,
  supportsImageShare,
  shareActionBusy,
  shareActionFeedback,
}) => {
  const { t, locale } = useI18n();
  const [activeEditor, setActiveEditor] = useState(null);
  const [showInheritAccountDropdown, setShowInheritAccountDropdown] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef(null);
  useHistoryStore((state) => state.history);
  const getGameAccountsFromHistory = useHistoryStore((state) => state.getGameAccountsFromHistory);
  const resourceItems = useMemo(
    () => [
      { resourceKey: 'jade', value: Math.max(Number(resourceLedger?.jadeBalance || 0), 0) },
      { resourceKey: 'originite', value: Math.max(Number(resourceLedger?.originiteBalance || 0), 0) },
      { resourceKey: 'arsenalQuota', value: Math.max(Number(resourceLedger?.arsenalBalance || 0), 0) },
    ],
    [resourceLedger]
  );
  const cumulativeItems = useMemo(
    () => [
      { key: 'jadeSpent', label: t('simulator.resource.cumulative.jadeSpent'), value: Number(resourceLedger?.jadeSpent || 0), icon: RESOURCE_ICON_URLS.jade },
      {
        key: 'originiteEquivalent',
        label: t('simulator.resource.cumulative.originiteEquivalent'),
        value: Number(resourceLedger?.originiteEquivalent || 0),
        icon: RESOURCE_ICON_URLS.originite,
      },
      {
        key: 'arsenalGained',
        label: t('simulator.resource.cumulative.arsenalGained'),
        value: Number(resourceLedger?.arsenalGained || 0),
        icon: RESOURCE_ICON_URLS.arsenalQuota,
      },
      {
        key: 'arsenalSpent',
        label: t('simulator.resource.cumulative.arsenalSpent'),
        value: Number(resourceLedger?.arsenalSpent || 0),
        icon: RESOURCE_ICON_URLS.arsenalQuota,
      },
    ],
    [resourceLedger, t]
  );
  const selectorGroups = useMemo(
    () =>
      buildPoolSelectorGroups({
        pools: simulatorPools,
        poolPullCounts,
        locale,
      }),
    [locale, poolPullCounts, simulatorPools]
  );
  const gameAccounts = getGameAccountsFromHistory();

  const openEditor = (resourceKey, mode, value) => {
    setActiveEditor({
      resourceKey,
      mode,
      value: value === '' ? '' : String(Math.max(0, Math.floor(Number(value) || 0))),
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
      <PoolGroupCardRail groups={selectorGroups} currentSelectionId={currentSimPoolId} onSelectPool={onSwitchPool} />

      <div className="flex flex-col gap-2 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end xl:gap-4">
        <div className="order-2 min-w-0 xl:order-1 xl:self-end">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-bold mb-2">
            {t('simulator.toolbar.cumulative')}
          </div>
          <div className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
            {cumulativeItems.map((item) => (
              <CumulativeChip key={item.key} icon={item.icon} label={item.label} value={item.value} locale={locale} />
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
                quickAddPresets={item.resourceKey === 'originite' ? ORIGINITE_PURCHASE_PRESETS : null}
                resourceKey={item.resourceKey}
                t={t}
                locale={locale}
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
              ${
                multipleFreeTen
                  ? 'bg-blue-500/10 border-blue-500 text-blue-500'
                  : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-700'
              }
            `}
                title={t('simulator.toolbar.multipleFreeTenHint')}
              >
                <div
                  className={`w-3 h-3 border flex items-center justify-center transition-colors ${multipleFreeTen ? 'border-blue-500 bg-blue-500' : 'border-current'}`}
                >
                  {multipleFreeTen && <Check size={10} className="text-white" strokeWidth={4} />}
                </div>
                <span className="text-xs font-bold uppercase">{t('simulator.toolbar.multipleFreeTen')}</span>
              </div>
            )}

            <div
              onClick={onToggleSkipAnimation}
              className={`
            flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all border select-none
            ${
              skipAnimation
                ? 'bg-yellow-50 dark:bg-endfield-yellow/10 border-yellow-600 dark:border-endfield-yellow text-yellow-700 dark:text-endfield-yellow'
                : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 hover:border-slate-300 dark:hover:border-zinc-700'
            }
          `}
            >
              <div
                className={`w-3 h-3 border flex items-center justify-center transition-colors ${skipAnimation ? 'border-yellow-600 dark:border-endfield-yellow bg-yellow-500 dark:bg-endfield-yellow' : 'border-current'}`}
              >
                {skipAnimation && <Check size={10} className="text-white dark:text-black" strokeWidth={4} />}
              </div>
              <span className="text-xs font-bold uppercase">{t('simulator.toolbar.skipAnimation')}</span>
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
                title={t('simulator.toolbar.inheritTitle')}
              >
                <RefreshCw size={14} />
                <span className="hidden sm:inline">{t('simulator.toolbar.inheritAccount')}</span>
                <span className="sm:hidden">{t('simulator.toolbar.inheritShort')}</span>
                {gameAccounts.length > 1 && (
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${showInheritAccountDropdown ? 'rotate-180' : ''}`}
                  />
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
                disabled={shareActionBusy}
                className={`px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 transition-colors ${
                  shareActionBusy
                    ? 'cursor-not-allowed opacity-60'
                    : 'hover:text-endfield-yellow hover:border-endfield-yellow'
                }`}
                title={t('simulator.toolbar.shareTitle')}
              >
                {shareActionBusy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                <span className="hidden sm:inline">{shareActionBusy ? t('simulator.toolbar.shareBusy') : t('simulator.toolbar.share')}</span>
                <ChevronDown size={12} className={`transition-transform ${showShareMenu ? 'rotate-180' : ''}`} />
              </button>

              {showShareMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-lg z-50">
                  {supportsImageShare && (
                    <button
                      type="button"
                      disabled={shareActionBusy}
                      onClick={() => {
                        setShowShareMenu(false);
                        onShareImage();
                      }}
                      className={`w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 transition-colors flex items-center gap-2 ${
                        shareActionBusy ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Share2 size={14} />
                      <span>{t('simulator.toolbar.systemShareImage')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={shareActionBusy}
                    onClick={() => {
                      setShowShareMenu(false);
                      onDownloadImage();
                    }}
                    className={`w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 transition-colors flex items-center gap-2 ${
                      supportsImageShare ? 'border-t border-zinc-100 dark:border-zinc-800' : ''
                    } ${shareActionBusy ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                  >
                    <Download size={14} />
                    <span>{t('simulator.toolbar.downloadPng')}</span>
                  </button>
                  {supportsClipboardImageCopy && (
                    <button
                      type="button"
                      disabled={shareActionBusy}
                      onClick={() => {
                        setShowShareMenu(false);
                        onCopyImage();
                      }}
                      className={`w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 transition-colors border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 ${
                        shareActionBusy ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Copy size={14} />
                      <span>{t('simulator.toolbar.copyImage')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={shareActionBusy}
                    onClick={() => {
                      setShowShareMenu(false);
                      onShareText();
                    }}
                    className={`w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 transition-colors border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 ${
                      shareActionBusy ? 'cursor-not-allowed opacity-60' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Copy size={14} />
                    <span>{t('simulator.toolbar.copyText')}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="relative group">
              <button
                className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-endfield-yellow hover:border-endfield-yellow transition-colors"
                title={t('simulator.toolbar.exportTitle')}
              >
                <Download size={14} />
                <span className="hidden sm:inline">{t('simulator.toolbar.export')}</span>
                <ChevronDown size={12} />
              </button>

              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-none shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button
                  onClick={() => onExportData('json')}
                  className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  {t('simulator.toolbar.exportJson')}
                </button>
                <button
                  onClick={() => onExportData('csv')}
                  className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800"
                >
                  {t('simulator.toolbar.exportCsv')}
                </button>
                <button
                  onClick={onExportReport}
                  className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800"
                >
                  {t('simulator.toolbar.exportReport')}
                </button>
              </div>
            </div>

            <button
              onClick={onReset}
              className="px-3 py-1.5 flex items-center gap-2 text-xs font-bold bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-red-500 hover:border-red-500 transition-colors"
              title={t('simulator.toolbar.resetTitle')}
            >
              <RefreshCw size={14} />
              <span className="hidden sm:inline">{t('simulator.toolbar.reset')}</span>
            </button>
          </div>
          {shareActionFeedback?.phase !== 'idle' && (
            <div className="flex justify-end">
              <ShareActionStatus feedback={shareActionFeedback} compact className="w-full max-w-[320px]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimulatorToolbar;
