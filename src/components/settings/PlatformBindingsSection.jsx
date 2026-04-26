import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Copy, Link2, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import { useAuthStore } from '../../stores';
import {
  createBindingChallenge,
  loadOwnBindings,
  revokeBinding,
} from '../../services/accountIntegrationsService.js';

const PROVIDER_META = {
  discord: {
    labelKey: 'settings.integration.provider.discord',
    accent: 'text-indigo-500',
  },
  telegram: {
    labelKey: 'settings.integration.provider.telegram',
    accent: 'text-sky-500',
  },
  qq: {
    labelKey: 'settings.integration.provider.qq',
    accent: 'text-emerald-500',
  },
};

function getVisualClasses(variant) {
  if (variant === 'mobile') {
    return {
      wrapper: 'space-y-3',
      card: 'rounded-[1.05rem] border border-zinc-200 bg-zinc-50/75 p-4 dark:border-white/8 dark:bg-white/[0.03]',
      button: 'rounded-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider',
      helper: 'text-[10px] text-zinc-500 dark:text-zinc-400',
    };
  }

  return {
    wrapper: 'space-y-3',
    card: 'border border-zinc-200 bg-zinc-50/70 p-4 rounded-sm dark:border-zinc-800 dark:bg-zinc-950/40',
    button: 'rounded-sm px-3 py-2 text-[11px] font-bold uppercase tracking-widest',
    helper: 'text-[11px] text-zinc-500 dark:text-zinc-400',
  };
}

function normalizeBindingStatus(binding, challenge) {
  if (binding?.status === 'verified') {
    return 'verified';
  }

  if (challenge?.status === 'pending') {
    return 'pending';
  }

  if (binding?.status === 'revoked') {
    return 'revoked';
  }

  return 'idle';
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

export default function PlatformBindingsSection({ variant = 'desktop' }) {
  const { t, formatDateTime } = useI18n();
  const user = useAuthStore((state) => state.user);
  const styles = useMemo(() => getVisualClasses(variant), [variant]);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const lastStatusMapRef = useRef(new Map());

  const applyEntries = useCallback((nextEntries, { silent = false } = {}) => {
    setEntries(nextEntries);

    const nextStatusMap = new Map(
      (Array.isArray(nextEntries) ? nextEntries : []).map(({ provider, binding, challenge }) => [
        provider,
        normalizeBindingStatus(binding, challenge),
      ])
    );

    if (!silent) {
      const justVerified = (nextEntries || []).some(({ provider, binding, challenge }) => {
        const previousStatus = lastStatusMapRef.current.get(provider);
        const nextStatus = normalizeBindingStatus(binding, challenge);
        return previousStatus === 'pending' && nextStatus === 'verified';
      });

      if (justVerified) {
        setSuccess(t('settings.integration.challengeVerified'));
        setError('');
      }
    }

    lastStatusMapRef.current = nextStatusMap;
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!user?.id) {
        setEntries([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const nextEntries = await loadOwnBindings(user.id);
        if (!cancelled) {
          applyEntries(nextEntries, { silent: true });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message || t('settings.integration.loadError'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [applyEntries, t, user?.id]);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const nextEntries = await loadOwnBindings(user.id);
      applyEntries(nextEntries, { silent });
    } catch (loadError) {
      setError(loadError?.message || t('settings.integration.loadError'));
    } finally {
      setLoading(false);
    }
  }, [applyEntries, t, user?.id]);

  useEffect(() => {
    const hasPendingChallenge = entries.some(({ challenge }) => challenge?.status === 'pending');
    if (!user?.id || !hasPendingChallenge) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      refresh({ silent: false });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [entries, refresh, user?.id]);

  const handleCreateChallenge = async (provider) => {
    setActionLoading(provider);
    setError('');
    setSuccess('');
    try {
      await createBindingChallenge(provider);
      await refresh({ silent: true });
      setSuccess(t('settings.integration.challengeCreated'));
    } catch (actionError) {
      setError(actionError?.message || t('settings.integration.challengeError'));
    } finally {
      setActionLoading('');
    }
  };

  const handleRevoke = async (provider) => {
    setActionLoading(provider);
    setError('');
    setSuccess('');
    try {
      await revokeBinding(provider);
      await refresh({ silent: true });
      setSuccess(t('settings.integration.revokeSuccess'));
    } catch (actionError) {
      setError(actionError?.message || t('settings.integration.revokeError'));
    } finally {
      setActionLoading('');
    }
  };

  if (!user) {
    return (
      <div className={styles.card}>
        <div className="flex items-center gap-2 text-zinc-500">
          <ShieldCheck size={14} />
          <span className={styles.helper}>{t('settings.integration.loginRequired')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.card} space-y-2`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bot size={14} className="text-endfield-yellow" />
              <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-100">{t('settings.integration.bindingsTitle')}</h4>
            </div>
            <p className={styles.helper}>{t('settings.integration.bindingsDesc')}</p>
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
        {error ? <div className="text-[11px] text-red-500">{error}</div> : null}
        {success ? <div className="text-[11px] text-emerald-500">{success}</div> : null}
      </div>

      {loading ? (
        <div className={styles.card}>
          <div className={styles.helper}>{t('common.loading')}</div>
        </div>
      ) : entries.map(({ provider, binding, challenge }) => {
        const providerMeta = PROVIDER_META[provider];
        const status = normalizeBindingStatus(binding, challenge);
        const statusLabel = t(`settings.integration.status.${status}`);

        return (
          <div key={provider} className={`${styles.card} space-y-3`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link2 size={14} className={providerMeta.accent} />
                  <span className="font-bold text-sm text-slate-800 dark:text-zinc-100">
                    {t(providerMeta.labelKey)}
                  </span>
                  <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:border-zinc-700 dark:text-zinc-300">
                    {statusLabel}
                  </span>
                </div>
                <div className={styles.helper}>
                  {binding?.display_handle
                    ? t('settings.integration.handleValue', { value: binding.display_handle })
                    : t('settings.integration.handleUnknown')}
                </div>
              </div>
            </div>

            {status === 'verified' ? (
              <div className={styles.helper}>
                {t('settings.integration.verifiedAt', {
                  value: formatDateTime(binding?.verified_at, {}, t('common.unknown')),
                })}
              </div>
            ) : null}

            {challenge?.status === 'pending' ? (
              <div className="rounded-sm border border-endfield-yellow/30 bg-endfield-yellow/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-endfield-yellow">
                      {t('settings.integration.challengeCode')}
                    </div>
                    <div className="font-mono text-lg text-slate-800 dark:text-zinc-100">{challenge.challenge_code}</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const copied = await copyText(challenge.challenge_code);
                      setSuccess(copied ? t('settings.integration.copySuccess') : t('settings.integration.copyFailure'));
                    }}
                    className={`${styles.button} border border-endfield-yellow/40 bg-endfield-yellow/10 text-endfield-yellow hover:bg-endfield-yellow/20`}
                  >
                    <Copy size={12} />
                    {t('settings.integration.copyCode')}
                  </button>
                </div>
                <div className={styles.helper}>
                  {t('settings.integration.challengeExpiresAt', {
                    value: formatDateTime(challenge.expires_at, {}, t('common.unknown')),
                  })}
                </div>
                <div className={styles.helper}>{t('settings.integration.challengeInstruction')}</div>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCreateChallenge(provider)}
                disabled={actionLoading === provider}
                className={`${styles.button} border border-endfield-yellow/40 bg-endfield-yellow/10 text-amber-700 hover:bg-endfield-yellow hover:text-black disabled:opacity-60 dark:text-endfield-yellow`}
              >
                {actionLoading === provider ? t('settings.integration.processing') : challenge?.status === 'pending'
                  ? t('settings.integration.regenerateCode')
                  : t('settings.integration.startBinding')}
              </button>
              {(binding?.status === 'verified' || challenge?.status === 'pending') ? (
                <button
                  type="button"
                  onClick={() => handleRevoke(provider)}
                  disabled={actionLoading === provider}
                  className={`${styles.button} border border-red-400/30 bg-red-500/10 text-red-500 hover:bg-red-500/15 disabled:opacity-60`}
                >
                  <Unplug size={12} />
                  {t('settings.integration.revokeAction')}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
