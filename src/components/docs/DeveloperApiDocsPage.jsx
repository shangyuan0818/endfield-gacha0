import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, ExternalLink, KeyRound, Languages, ShieldCheck } from 'lucide-react';
import SimpleMarkdown from '../SimpleMarkdown.jsx';
import { useI18n } from '../../i18n/index.js';
import zhDeveloperApiDocs from '../../../docs/developer-api-v1.zh-CN.md?raw';
import enDeveloperApiDocs from '../../../docs/developer-api-v1.en-US.md?raw';

const DOC_LOCALES = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en-US', label: 'English' },
];

function getDocContent(locale) {
  return locale === 'en-US' ? enDeveloperApiDocs : zhDeveloperApiDocs;
}

function buildQuickLinks(isEnglish) {
  return [
    {
      label: isEnglish ? 'Meta' : '元信息',
      href: '#public-analytics-api-v1',
    },
    {
      label: isEnglish ? 'Authentication' : '鉴权',
      href: isEnglish ? '#1-quick-start' : '#1-快速开始',
    },
    {
      label: isEnglish ? 'Catalog' : '目录端点',
      href: isEnglish ? '#5-catalog-endpoints' : '#5-目录端点',
    },
    {
      label: isEnglish ? 'Analytics' : '分析端点',
      href: isEnglish ? '#6-analytics-endpoints' : '#6-公开分析端点',
    },
    {
      label: isEnglish ? 'Privacy' : '隐私边界',
      href: isEnglish ? '#8-privacy-boundary' : '#8-隐私边界',
    },
  ];
}

export default function DeveloperApiDocsPage() {
  const { isEnglish, locale, t } = useI18n();
  const [docLocale, setDocLocale] = useState(locale);
  const docContent = useMemo(() => getDocContent(docLocale), [docLocale]);
  const quickLinks = useMemo(() => buildQuickLinks(docLocale === 'en-US'), [docLocale]);

  useEffect(() => {
    setDocLocale(locale);
  }, [locale]);

  useEffect(() => {
    document.title = isEnglish
      ? 'Developer API Wiki | Endfield Gacha Analyzer'
      : '开发者 API Wiki | 终末地抽卡分析器';

    return () => {
      document.title = t('app.documentTitle');
    };
  }, [isEnglish, t]);

  return (
    <div className="min-h-screen bg-[#f4f5f0] text-slate-900 dark:bg-[#08090b] dark:text-zinc-100">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="border border-zinc-200 bg-white/85 shadow-sm dark:border-white/10 dark:bg-zinc-950/80">
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-7">
            <div className="space-y-4">
              <a
                href="/settings"
                className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-amber-600 dark:text-zinc-400 dark:hover:text-endfield-yellow"
              >
                <ArrowLeft size={14} />
                {isEnglish ? 'Back to settings' : '返回设置'}
              </a>
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.35em] text-amber-600 dark:text-endfield-yellow">
                  <BookOpen size={15} />
                  API WIKI
                </div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
                  {isEnglish ? 'Developer API Documentation' : '开发者 API 文档'}
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                  {isEnglish
                    ? 'A bilingual, wiki-style guide for approved developer applications. Use it after your public.read application is approved and an API key is issued.'
                    : '供已审核通过的开发者应用使用的双语 Wiki 文档。申请通过并获得 API Key 后，可按此文档接入 public.read 接口。'}
                </p>
              </div>
            </div>

            <div className="grid gap-2 text-[11px] font-bold uppercase tracking-wider sm:grid-cols-3 lg:min-w-[24rem]">
              <div className="border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <ShieldCheck size={14} className="mb-2 text-emerald-500" />
                <div>{isEnglish ? 'Scope' : '权限范围'}</div>
                <div className="mt-1 font-mono text-emerald-600 dark:text-emerald-400">public.read</div>
              </div>
              <div className="border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <KeyRound size={14} className="mb-2 text-amber-500 dark:text-endfield-yellow" />
                <div>{isEnglish ? 'Auth' : '鉴权'}</div>
                <div className="mt-1 font-mono text-zinc-500 dark:text-zinc-300">X-API-Key</div>
              </div>
              <div className="border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <ExternalLink size={14} className="mb-2 text-sky-500" />
                <div>{isEnglish ? 'Version' : '版本'}</div>
                <div className="mt-1 font-mono text-zinc-500 dark:text-zinc-300">v1</div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <div className="space-y-4 border border-zinc-200 bg-white/85 p-4 dark:border-white/10 dark:bg-zinc-950/80">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  <Languages size={13} />
                  {isEnglish ? 'Language' : '文档语言'}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DOC_LOCALES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setDocLocale(option.value)}
                      className={`border px-3 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                        docLocale === option.value
                          ? 'border-amber-500 bg-amber-400 text-black dark:border-endfield-yellow dark:bg-endfield-yellow'
                          : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-amber-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  {docLocale === 'en-US' ? 'Quick Links' : '快速定位'}
                </div>
                <nav className="space-y-1">
                  {quickLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="block border border-transparent px-3 py-2 text-xs font-bold text-zinc-600 transition-colors hover:border-amber-400 hover:bg-amber-50 hover:text-amber-700 dark:text-zinc-300 dark:hover:border-endfield-yellow/50 dark:hover:bg-endfield-yellow/10 dark:hover:text-endfield-yellow"
                    >
                      {link.label}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="border border-amber-500/30 bg-amber-400/10 p-3 text-xs leading-6 text-amber-800 dark:border-endfield-yellow/30 dark:bg-endfield-yellow/10 dark:text-endfield-yellow">
                {docLocale === 'en-US'
                  ? 'This public API is read-only and anonymous. Private user-data authorization is not available in v1.'
                  : '当前公开 API 只读且匿名。v1 不开放第三方读取用户私有数据。'}
              </div>
            </div>
          </aside>

          <main className="min-w-0 border border-zinc-200 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950/80 sm:p-6 lg:p-8">
            <SimpleMarkdown content={docContent} className="developer-api-wiki" />
          </main>
        </div>
      </div>
    </div>
  );
}
