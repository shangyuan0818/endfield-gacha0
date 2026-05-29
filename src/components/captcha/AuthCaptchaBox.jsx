import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import {
  ensureAuthCaptchaProviderScriptLoaded,
  getAuthCaptchaClientConfig,
} from '../../services/authCaptchaClient.js';
import { createAuthPowChallenge } from '../../services/powChallengeService.js';
import { shouldPreferPowCaptcha } from '../../utils/powChallengeCore.js';
import { useI18n } from '../../i18n/index.js';
import TerminalPowCaptcha from './TerminalPowCaptcha.jsx';

function canUseTurnstile(config) {
  return config.enabled && config.configured && config.provider === 'turnstile';
}

export default function AuthCaptchaBox({
  action,
  onStateChange,
}) {
  const { isEnglish } = useI18n();
  const containerRef = React.useRef(null);
  const widgetIdRef = React.useRef(null);
  const config = React.useMemo(() => getAuthCaptchaClientConfig({ action }), [action]);
  const preferPow = React.useMemo(() => shouldPreferPowCaptcha(import.meta.env), []);
  const [mode, setMode] = React.useState(() => (preferPow ? 'pow' : 'turnstile'));
  const [powChallenge, setPowChallenge] = React.useState(null);
  const [status, setStatus] = React.useState('idle');
  const [message, setMessage] = React.useState('');
  const tt = React.useCallback((zh, en) => (isEnglish ? en : zh), [isEnglish]);

  const publishState = React.useCallback((nextStatus, {
    token = '',
    powPayload = null,
    provider = mode,
    message: nextMessage = '',
  } = {}) => {
    setStatus(nextStatus);
    setMessage(nextMessage);
    onStateChange?.({
      action: config.action,
      enabled: config.enabled,
      configured: provider === 'pow' ? true : config.configured,
      provider,
      ready: !config.enabled || !config.required || Boolean(token || powPayload),
      required: config.required,
      status: nextStatus,
      token,
      powPayload,
    });
  }, [config.action, config.configured, config.enabled, config.required, mode, onStateChange]);

  React.useEffect(() => {
    setMode(preferPow ? 'pow' : 'turnstile');
    setPowChallenge(null);
  }, [action, preferPow]);

  React.useEffect(() => {
    if (!config.enabled || mode !== 'pow') {
      return undefined;
    }

    let cancelled = false;
    publishState('loading', {
      provider: 'pow',
      message: tt('正在签发工作量证明挑战...', 'Issuing proof-of-work challenge...'),
    });

    createAuthPowChallenge(config.action)
      .then((challenge) => {
        if (cancelled) return;
        setPowChallenge(challenge);
        publishState('ready', {
          provider: 'pow',
          message: tt('请启动值守终端完成验证。', 'Start the terminal check to complete verification.'),
        });
      })
      .catch((error) => {
        if (cancelled) return;
        publishState('error', {
          provider: 'pow',
          message: error?.message || tt('工作量证明挑战签发失败。', 'Failed to issue proof-of-work challenge.'),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [config.action, config.enabled, mode, publishState, tt]);

  React.useEffect(() => {
    if (!config.enabled || mode !== 'turnstile') {
      return undefined;
    }

    let cancelled = false;

    if (!config.configured || config.provider !== 'turnstile') {
      setMode('pow');
      return undefined;
    }

    publishState('loading', {
      provider: 'turnstile',
      message: tt('正在加载人机验证组件...', 'Loading bot check...'),
    });

    ensureAuthCaptchaProviderScriptLoaded(config, window, document, 10000)
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded || !window.turnstile?.render || !containerRef.current) {
          setMode('pow');
          return;
        }

        try {
          containerRef.current.innerHTML = '';
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: config.siteKey,
            action: config.action,
            theme: 'auto',
            size: 'normal',
            appearance: 'always',
            execution: 'render',
            callback: (token) => {
              if (cancelled) return;
              publishState('success', {
                provider: 'turnstile',
                token,
                message: tt('验证已完成。', 'Verification completed.'),
              });
            },
            'error-callback': (code) => {
              if (cancelled) return;
              publishState('error', {
                provider: 'turnstile',
                message: tt(`Turnstile 验证失败：${code || 'unknown'}。你可以改用值守终端。`, `Turnstile failed: ${code || 'unknown'}. You can use terminal PoW instead.`),
              });
            },
            'expired-callback': () => {
              if (cancelled) return;
              publishState('expired', {
                provider: 'turnstile',
                message: tt('验证已过期，请重新完成验证。', 'Verification expired. Complete it again.'),
              });
            },
            'timeout-callback': () => {
              if (cancelled) return;
              setMode('pow');
            },
          });
          publishState('ready', {
            provider: 'turnstile',
            message: tt('请完成人机验证。', 'Complete the bot check.'),
          });
        } catch {
          setMode('pow');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMode('pow');
        }
      });

    return () => {
      cancelled = true;
      try {
        if (widgetIdRef.current && window.turnstile?.remove) {
          window.turnstile.remove(widgetIdRef.current);
        }
      } catch {
        // Best-effort cleanup only.
      }
      widgetIdRef.current = null;
    };
  }, [config, mode, publishState, tt]);

  if (!config.enabled) {
    return null;
  }

  const statusTone = status === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
    : status === 'error' || status === 'expired'
      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
      : 'border-zinc-200 bg-white text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300';

  return (
    <div className={`border rounded-none p-3 ${statusTone}`}>
      <div className="mb-3 flex items-start gap-2">
        {status === 'success' ? <CheckCircle2 size={17} className="mt-0.5 shrink-0" /> : status === 'error' || status === 'expired' ? <AlertTriangle size={17} className="mt-0.5 shrink-0" /> : <ShieldCheck size={17} className="mt-0.5 shrink-0" />}
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-bold uppercase tracking-wider">
              {mode === 'pow' ? tt('值守终端验证', 'Terminal PoW Check') : tt('人机验证', 'Bot Check')}
            </div>
            {canUseTurnstile(config) && (
              <button
                type="button"
                onClick={() => {
                  setPowChallenge(null);
                  setMode((current) => (current === 'pow' ? 'turnstile' : 'pow'));
                }}
                className="text-[11px] font-bold uppercase tracking-wider text-endfield-yellow hover:text-yellow-500"
              >
                {mode === 'pow' ? tt('使用 Turnstile', 'Use Turnstile') : tt('改用 PoW', 'Use PoW')}
              </button>
            )}
          </div>
          <p className="mt-0.5 text-xs leading-relaxed">
            {message || tt('请完成下方验证后继续。', 'Complete the verification below before continuing.')}
          </p>
        </div>
      </div>

      {mode === 'turnstile' && canUseTurnstile(config) && (
        <div className="min-h-[70px] overflow-hidden">
          <div ref={containerRef} />
        </div>
      )}

      {mode === 'pow' && powChallenge && (
        <TerminalPowCaptcha
          action={config.action}
          challenge={powChallenge}
          onVerified={(powPayload) => {
            publishState('success', {
              provider: 'pow',
              powPayload,
              message: tt('值守终端验证已完成。', 'Terminal PoW check completed.'),
            });
          }}
          showFallbackButton={false}
        />
      )}
    </div>
  );
}
