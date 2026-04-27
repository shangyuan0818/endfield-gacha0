import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Copy, ExternalLink, Globe, KeyRound, RefreshCw, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n/index.js';
import { useAuthStore } from '../../stores';
import {
  loadMyDeveloperApplications,
  submitDeveloperApplication,
} from '../../services/developerApiService.js';

function getVisualClasses(variant) {
  if (variant === 'mobile') {
    return {
      card: 'rounded-[1.05rem] border border-zinc-200 bg-zinc-50/75 p-4 dark:border-white/8 dark:bg-white/[0.03]',
      button: 'rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider',
      input: 'w-full rounded-[0.95rem] border border-zinc-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none focus:border-endfield-yellow focus:ring-2 focus:ring-endfield-yellow dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100',
      helper: 'text-[10px] text-zinc-500 dark:text-zinc-400',
    };
  }

  return {
    card: 'border border-zinc-200 bg-zinc-50/70 p-4 rounded-sm dark:border-zinc-800 dark:bg-zinc-950/40',
    button: 'rounded-sm px-3 py-2 text-[11px] font-bold uppercase tracking-widest',
    input: 'w-full rounded-sm border border-zinc-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-endfield-yellow focus:ring-2 focus:ring-endfield-yellow dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
    helper: 'text-[11px] text-zinc-500 dark:text-zinc-400',
  };
}

function getStatusTone(status) {
  switch (status) {
    case 'active':
      return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
    case 'rejected':
      return 'text-red-500 border-red-500/30 bg-red-500/10';
    case 'revoked':
      return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
    default:
      return 'text-zinc-500 border-zinc-300 bg-zinc-100/80 dark:border-zinc-700 dark:bg-zinc-900/60';
  }
}

async function copyText(value) {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export default function DeveloperApiSection({ variant = 'desktop' }) {
  const { t, formatDateTime } = useI18n();
  const user = useAuthStore((state) => state.user);
  const styles = useMemo(() => getVisualClasses(variant), [variant]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    name: '',
    useCase: '',
  });
  const hasActiveApplication = applications.some((application) => application?.status === 'active');
  const docsPath = variant === 'mobile' ? '/m/developer-api' : '/developer-api';

  const refresh = async () => {
    if (!user) {
      setApplications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const nextApplications = await loadMyDeveloperApplications();
      setApplications(nextApplications);
    } catch (loadError) {
      setError(loadError?.message || t('settings.integration.apiLoadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const application = await submitDeveloperApplication(form);
      setApplications((prev) => [application, ...prev]);
      setForm({ name: '', useCase: '' });
      setSuccess(t('settings.integration.apiSubmitSuccess'));
      await refresh();
    } catch (submitError) {
      setError(submitError?.message || t('settings.integration.apiSubmitError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className={styles.card}>
        <div className={styles.helper}>{t('settings.integration.loginRequired')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`${styles.card} space-y-3`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-endfield-yellow" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100">{t('settings.integration.apiTitle')}</h4>
            </div>
            <p className={styles.helper}>{t('settings.integration.apiDesc')}</p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className={`${styles.button} border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800`}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className={styles.helper}>{t('settings.integration.apiScopeHint')}</div>
        {hasActiveApplication ? (
          <Link
            to={docsPath}
            className="inline-flex w-full items-center justify-between gap-3 rounded-sm border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[11px] font-black uppercase tracking-wider text-amber-700 transition-colors hover:bg-amber-400 hover:text-black dark:border-endfield-yellow/40 dark:bg-endfield-yellow/10 dark:text-endfield-yellow dark:hover:bg-endfield-yellow dark:hover:text-black"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen size={13} />
              {t('settings.integration.apiOpenDocs')}
            </span>
            <ExternalLink size={13} />
          </Link>
        ) : (
          <div className={styles.helper}>
            {t('settings.integration.apiDocsAfterApproval')}
          </div>
        )}
        {error ? <div className="text-[11px] text-red-500">{error}</div> : null}
        {success ? <div className="text-[11px] text-emerald-500">{success}</div> : null}

        <div className="space-y-2">
          <input
            type="text"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder={t('settings.integration.apiNamePlaceholder')}
            className={styles.input}
          />
          <textarea
            value={form.useCase}
            onChange={(event) => setForm((prev) => ({ ...prev, useCase: event.target.value }))}
            placeholder={t('settings.integration.apiUseCasePlaceholder')}
            rows={variant === 'mobile' ? 4 : 5}
            className={`${styles.input} resize-y`}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`${styles.button} w-full border border-endfield-yellow/40 bg-endfield-yellow/10 text-amber-700 hover:bg-endfield-yellow hover:text-black disabled:opacity-60 dark:text-endfield-yellow`}
          >
            <Send size={12} />
            {submitting ? t('settings.integration.processing') : t('settings.integration.apiSubmitAction')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.card}>
          <div className={styles.helper}>{t('common.loading')}</div>
        </div>
      ) : applications.length === 0 ? (
        <div className={styles.card}>
          <div className={styles.helper}>{t('settings.integration.apiEmpty')}</div>
        </div>
      ) : applications.map((application) => (
        <div key={application.id} className={`${styles.card} space-y-3`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-sm text-slate-800 dark:text-zinc-100 truncate">{application.name}</div>
              <div className={styles.helper}>{application.use_case}</div>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusTone(application.status)}`}>
              {t(`settings.integration.apiStatus.${application.status}`)}
            </span>
          </div>

          <div className={styles.helper}>
            {t('settings.integration.apiCreatedAt', {
              value: formatDateTime(application.created_at, {}, t('common.unknown')),
            })}
          </div>
          {application.review_note ? (
            <div className={styles.helper}>
              {t('settings.integration.apiReviewNote', { value: application.review_note })}
            </div>
          ) : null}

          <div className="space-y-2">
            {(application.keys || []).map((keyRow) => (
              <div key={keyRow.id} className="rounded-sm border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-zinc-100">
                      <KeyRound size={13} className="text-endfield-yellow" />
                      <span className="truncate">{keyRow.label}</span>
                    </div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {t('settings.integration.apiKeyPrefixLabel')}
                    </div>
                    <div className="font-mono text-[11px] text-zinc-500 mt-0.5">{keyRow.key_prefix}</div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusTone(keyRow.status)}`}>
                    {t(`settings.integration.apiKeyStatus.${keyRow.status}`)}
                  </span>
                </div>
                {keyRow.one_time_secret ? (
                  <div className="mt-3 space-y-2 rounded-sm border border-endfield-yellow/30 bg-endfield-yellow/5 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-endfield-yellow">
                      {t('settings.integration.apiOneTimeSecret')}
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {t('settings.integration.apiOneTimeSecretHint')}
                    </div>
                    <div className="font-mono text-[12px] break-all text-slate-800 dark:text-zinc-100">{keyRow.one_time_secret}</div>
                    <button
                      type="button"
                      onClick={async () => {
                        const copied = await copyText(keyRow.one_time_secret);
                        setSuccess(copied ? t('settings.integration.copySuccess') : t('settings.integration.copyFailure'));
                      }}
                      className={`${styles.button} border border-endfield-yellow/40 bg-endfield-yellow/10 text-endfield-yellow hover:bg-endfield-yellow/20`}
                    >
                      <Copy size={12} />
                      {t('settings.integration.copySecret')}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
