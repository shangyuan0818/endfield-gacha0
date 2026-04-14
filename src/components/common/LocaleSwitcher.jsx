import React from 'react';
import { Globe } from 'lucide-react';
import { LANGUAGE_OPTIONS, useI18n } from '../../i18n/index.js';

function LocaleSwitcher({ className = '', compact = false }) {
  const { locale, setLocale, t } = useI18n();

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
