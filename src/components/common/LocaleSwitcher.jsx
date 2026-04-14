import React from 'react';
import { Globe } from 'lucide-react';
import { LANGUAGE_OPTIONS, useI18n } from '../../i18n/index.js';

function LocaleSwitcher({ className = '', compact = false, variant = 'default' }) {
  const { locale, setLocale, t } = useI18n();

  if (variant === 'header') {
    return (
      <div className={`inline-flex items-center rounded-full border border-zinc-200/80 bg-white/80 p-0.5 backdrop-blur-md dark:border-white/10 dark:bg-black/30 ${className}`.trim()}>
        {LANGUAGE_OPTIONS.map((option) => {
          const active = locale === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setLocale(option.value)}
              className={`min-w-[42px] rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
                active
                  ? 'bg-endfield-yellow text-black shadow-[0_6px_18px_rgba(255,250,0,0.2)]'
                  : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
              }`}
              title={t(`language.option.${option.key}`)}
              aria-label={t(`language.option.${option.key}`)}
            >
              {t(`language.option.${option.key}`)}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`.trim()}>
      <div className={`flex items-center gap-1 ${compact ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400`}>
        <Globe size={compact ? 12 : 14} />
        {!compact && <span>{t('language.switcher')}</span>}
      </div>

      <div className="inline-flex items-center rounded-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900">
        {LANGUAGE_OPTIONS.map((option) => {
          const active = locale === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setLocale(option.value)}
              className={`px-2.5 py-1 text-[11px] font-bold transition-colors ${
                active
                  ? 'bg-endfield-yellow text-black'
                  : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
              title={t(`language.option.${option.key}`)}
            >
              {t(`language.option.${option.key}`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default React.memo(LocaleSwitcher);
