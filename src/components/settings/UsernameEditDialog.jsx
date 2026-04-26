import React, { useEffect, useMemo, useState } from 'react';
import { User, X } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';
import {
  buildUsernameHandle,
  getUsernameValidationCode,
  normalizeUsername,
} from '../../utils/usernameValidation.js';

function getLocalizedUsernameValidationMessage(t, validationCode) {
  switch (validationCode) {
    case 'required':
      return t('settings.error.usernameRequired');
    case 'too_short':
      return t('settings.error.usernameTooShort');
    case 'too_long':
      return t('settings.error.usernameTooLong');
    case 'invalid_characters':
      return t('settings.error.usernameInvalid');
    default:
      return t('settings.error.usernameUpdateFailed');
  }
}

function getVisualClasses(variant) {
  if (variant === 'mobile') {
    return {
      overlay: 'fixed inset-0 z-[90] bg-black/72 backdrop-blur-sm flex items-end justify-center sm:items-center',
      card: 'w-full max-w-lg rounded-t-[1.5rem] border border-zinc-200 bg-white shadow-2xl dark:border-white/8 dark:bg-zinc-950 sm:rounded-[1.25rem]',
      header: 'flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-white/8',
      closeButton: 'rounded-full border border-zinc-200 bg-zinc-50 p-1.5 transition-colors hover:bg-zinc-100 dark:border-white/8 dark:bg-white/5 dark:hover:bg-white/10',
      body: 'space-y-4 px-5 py-5',
      input: 'w-full rounded-[1rem] border border-zinc-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-endfield-yellow focus:ring-2 focus:ring-endfield-yellow dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-100 dark:placeholder:text-zinc-500',
      primaryButton: 'w-full rounded-full border border-endfield-yellow bg-endfield-yellow py-3 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-yellow-400 disabled:opacity-60 disabled:hover:bg-endfield-yellow',
      secondaryButton: 'w-full rounded-full border border-zinc-200 bg-zinc-50 py-3 text-xs font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-300 dark:hover:bg-white/[0.05]',
      helper: 'text-[11px] leading-5 text-zinc-500 dark:text-zinc-400',
    };
  }

  return {
    overlay: 'fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4',
    card: 'w-full max-w-md border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 rounded-sm',
    header: 'flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-950/50',
    closeButton: 'rounded-sm border border-zinc-200 bg-white p-1.5 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800',
    body: 'space-y-4 px-4 py-4',
    input: 'w-full rounded-sm border border-zinc-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-endfield-yellow focus:ring-2 focus:ring-endfield-yellow dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600',
    primaryButton: 'w-full rounded-sm border border-zinc-900 bg-zinc-900 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
    secondaryButton: 'w-full rounded-sm border border-zinc-200 bg-zinc-50 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
    helper: 'text-[11px] leading-5 text-zinc-500 dark:text-zinc-400',
  };
}

export default function UsernameEditDialog({
  open,
  onClose,
  user,
  currentUsername,
  currentUsernameHandle,
  onSubmit,
  variant = 'desktop',
}) {
  const { t } = useI18n();
  const styles = useMemo(() => getVisualClasses(variant), [variant]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!open) {
      setDraft('');
      setLoading(false);
      setError('');
      setSuccess('');
      return;
    }

    setDraft(currentUsername || '');
    setLoading(false);
    setError('');
    setSuccess('');
  }, [open, currentUsername]);

  const previewHandle = useMemo(() => {
    const normalizedDraft = normalizeUsername(draft) || currentUsername;
    return buildUsernameHandle({
      ...user,
      user_metadata: {
        ...(user?.user_metadata || {}),
        username: normalizedDraft,
      },
    });
  }, [currentUsername, draft, user]);

  const handleSave = async () => {
    if (!user?.id) {
      setError(t('settings.error.notLoggedInUsername'));
      setSuccess('');
      return;
    }

    const normalizedUsername = normalizeUsername(draft);
    const validationCode = getUsernameValidationCode(normalizedUsername, { required: true });
    if (validationCode) {
      setError(getLocalizedUsernameValidationMessage(t, validationCode));
      setSuccess('');
      return;
    }

    if (normalizedUsername === currentUsername) {
      setError(t('settings.error.usernameUnchanged'));
      setSuccess('');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await onSubmit(normalizedUsername);
      setSuccess(t('settings.success.usernameUpdated'));
      setDraft(normalizedUsername);
    } catch (submitError) {
      setError(submitError?.message || t('settings.error.usernameUpdateFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <User size={16} className="text-endfield-yellow" />
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-zinc-100">
                {t('settings.usernameDialogTitle')}
              </h3>
            </div>
            <p className={`${styles.helper} mt-1`}>{t('settings.usernameDialogDesc')}</p>
          </div>
          <button type="button" onClick={onClose} className={styles.closeButton}>
            <X size={16} className="text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className={styles.body}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {t('settings.usernameCurrentHandleLabel')}
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                {currentUsernameHandle}
              </span>
            </div>
            <input
              type="text"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (error) setError('');
                if (success) setSuccess('');
              }}
              placeholder={t('settings.usernamePlaceholder')}
              maxLength={50}
              className={styles.input}
            />
            <div className={styles.helper}>{t('settings.usernameFormatHint')}</div>
            <div className={styles.helper}>
              {t('settings.usernamePublicHandle', { value: previewHandle })}
            </div>
          </div>

          {error ? (
            <div className="rounded-sm border border-red-400/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-500">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-sm border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-500">
              {success}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className={styles.secondaryButton}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className={styles.primaryButton}
            >
              {loading ? `${t('settings.changeUsername')}...` : t('settings.changeUsername')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
