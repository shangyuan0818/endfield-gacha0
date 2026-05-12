import { createElement } from 'react';
import { createPortal } from 'react-dom';
import { CalendarRange, Database, Download, FileJson, Filter, RotateCcw, X } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import { localizePoolName } from '../../utils/gameDataI18n.js';
import { localizeGameAccountServerTag } from '../../utils/gameAccountMetadata.js';

function ExportActionCard({
  icon,
  title,
  badge,
  onClick,
  disabled,
  accent = 'yellow'
}) {
  const accentClasses = {
    yellow: 'hover:border-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-700 dark:hover:text-endfield-yellow',
    green: 'hover:border-green-500 hover:bg-green-500/10 hover:text-green-700 dark:hover:text-green-300',
    cyan: 'hover:border-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-700 dark:hover:text-cyan-300',
    violet: 'hover:border-violet-500 hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300'
  }[accent] || 'hover:border-yellow-500 hover:bg-yellow-500/10 hover:text-yellow-700 dark:hover:text-endfield-yellow';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[76px] w-full items-center gap-3 border border-zinc-200 bg-white p-3 text-left text-slate-600 transition-colors disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-zinc-200 disabled:hover:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:disabled:text-zinc-700 dark:disabled:hover:border-zinc-800 dark:disabled:hover:bg-zinc-950 ${accentClasses}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-current/40">
        {createElement(icon, { size: 18 })}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black leading-5">{title}</span>
        <span className="mt-1 inline-flex border border-current/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider opacity-75">
          {badge}
        </span>
      </span>
    </button>
  );
}

export default function DataExportOptionsModal({
  isOpen,
  onClose,
  onReset,
  exportOptions,
  onUpdateOption,
  canExport,
  currentPoolName,
  currentGameUid,
  poolOptions = [],
  gameAccounts = [],
  locale,
  onExportJSON,
  onExportCSV,
  onExportEndfieldGachaUserDataZip,
  onExportEndfieldGachaHelperJSON,
  onExportEndfieldGachaHelperCSV,
  onExportEndfieldGachaHelperUserDataZip,
  onExportEndgachaKwerTopPlainJSON,
  onExportEndgachaKwerTopPlainTXT
}) {
  const { t } = useI18n();

  if (!isOpen) {
    return null;
  }

  const modal = (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-950/70 p-4 py-8 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative my-auto w-full max-w-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#101012]"
        style={{ clipPath: 'polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))' }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('records.export.configTitle')}
      >
        <div className="absolute left-0 top-0 h-1 w-full bg-yellow-500" />
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-slate-50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black text-slate-900 dark:text-zinc-50">
              <Filter size={18} />
              {t('records.export.configTitle')}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              {t('records.export.configDescription')}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 border border-zinc-200 px-2.5 py-2 text-[11px] font-bold text-slate-500 transition-colors hover:border-yellow-500 hover:text-yellow-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-yellow-500 dark:hover:text-endfield-yellow"
            >
              <RotateCcw size={12} />
              {t('records.export.reset')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border border-transparent p-2 text-slate-400 transition-colors hover:border-red-500 hover:bg-red-500/10 hover:text-red-500"
              aria-label={t('common.close')}
              title={t('common.close')}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              {t('records.export.poolScope')}
            </label>
            <select
              value={exportOptions.poolFilter}
              onChange={(event) => onUpdateOption('poolFilter', event.target.value)}
              className="w-full border border-zinc-200 bg-white px-3 py-2.5 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="current">{t('records.export.poolScopeCurrent')}</option>
              <option value="all">{t('records.export.poolScopeAll')}</option>
              <option value="specific">{t('records.export.poolScopeSpecific')}</option>
            </select>
            {exportOptions.poolFilter === 'specific' && (
              <select
                value={exportOptions.poolId}
                onChange={(event) => onUpdateOption('poolId', event.target.value)}
                className="w-full border border-zinc-200 bg-white px-3 py-2.5 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value="">{t('records.export.poolPlaceholder')}</option>
                {poolOptions.map(pool => (
                  <option key={pool.id} value={pool.id}>
                    {localizePoolName(pool, { locale }) || pool.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              {t('records.export.accountScope')}
            </label>
            <select
              value={exportOptions.accountFilter}
              onChange={(event) => onUpdateOption('accountFilter', event.target.value)}
              className="w-full border border-zinc-200 bg-white px-3 py-2.5 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
            >
              <option value="all">{t('records.export.accountScopeAll')}</option>
              {currentGameUid && <option value="current">{t('records.export.accountScopeCurrent')}</option>}
              <option value="specific">{t('records.export.accountScopeSpecific')}</option>
            </select>
            {exportOptions.accountFilter === 'specific' && (
              <select
                value={exportOptions.gameUid}
                onChange={(event) => onUpdateOption('gameUid', event.target.value)}
                className="w-full border border-zinc-200 bg-white px-3 py-2.5 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              >
                <option value="">{t('records.export.accountPlaceholder')}</option>
                {gameAccounts.map(account => (
                  <option key={account.gameUid} value={account.gameUid}>
                    {account.nickName} · {account.gameUid}{account.serverTag ? ` · ${localizeGameAccountServerTag(account.serverTag, locale)}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-500">
              <CalendarRange size={12} />
              {t('records.export.dateRange')}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                value={exportOptions.dateFrom}
                onChange={(event) => onUpdateOption('dateFrom', event.target.value)}
                className="min-w-0 border border-zinc-200 bg-white px-3 py-2.5 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              />
              <input
                type="date"
                value={exportOptions.dateTo}
                onChange={(event) => onUpdateOption('dateTo', event.target.value)}
                className="min-w-0 border border-zinc-200 bg-white px-3 py-2.5 text-sm text-slate-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
              />
            </div>
          </div>

          <div className="border border-zinc-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500 md:col-span-2">
            <div>{t('records.export.summaryPool', { value: currentPoolName })}</div>
            <div>{t('records.export.summaryAccount', { value: currentGameUid || t('records.export.accountScopeAll') })}</div>
            <div>{t('records.export.csvNote')}</div>
          </div>
        </div>

        <div className="border-t border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#101012]">
          <div className="grid gap-3 md:grid-cols-2">
            <ExportActionCard
              icon={FileJson}
              title={t('records.export.json')}
              badge="JSON"
              onClick={onExportJSON}
              disabled={!canExport}
            />
            <ExportActionCard
              icon={Download}
              title={t('records.export.csv')}
              badge="CSV"
              onClick={onExportCSV}
              disabled={!canExport}
              accent="green"
            />
            <ExportActionCard
              icon={Database}
              title={t('records.export.endfieldGachaUserDataZip')}
              badge="userData ZIP"
              onClick={onExportEndfieldGachaUserDataZip}
              disabled={!canExport}
              accent="cyan"
            />
            <ExportActionCard
              icon={FileJson}
              title={t('records.export.endfieldGachaHelperJson')}
              badge="Helper JSON"
              onClick={onExportEndfieldGachaHelperJSON}
              disabled={!canExport}
              accent="violet"
            />
            <ExportActionCard
              icon={Download}
              title={t('records.export.endfieldGachaHelperCsv')}
              badge="Helper CSV"
              onClick={onExportEndfieldGachaHelperCSV}
              disabled={!canExport}
              accent="violet"
            />
            <ExportActionCard
              icon={Database}
              title={t('records.export.endfieldGachaHelperUserDataZip')}
              badge="SQLite ZIP"
              onClick={onExportEndfieldGachaHelperUserDataZip}
              disabled={!canExport}
              accent="violet"
            />
            <ExportActionCard
              icon={FileJson}
              title={t('records.export.endgachaPlainJson')}
              badge="endgacha JSON"
              onClick={onExportEndgachaKwerTopPlainJSON}
              disabled={!canExport}
              accent="cyan"
            />
            <ExportActionCard
              icon={Download}
              title={t('records.export.endgachaPlainTxt')}
              badge="endgacha TXT"
              onClick={onExportEndgachaKwerTopPlainTXT}
              disabled={!canExport}
              accent="cyan"
            />
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modal, document.body);
  }

  return modal;
}
