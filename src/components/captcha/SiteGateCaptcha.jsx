import React from 'react';
import { Globe2, ShieldCheck, TerminalSquare } from 'lucide-react';
import { ensureAuthCaptchaProviderScriptLoaded, getAuthCaptchaClientConfig } from '../../services/authCaptchaClient.js';
import { createAuthPowChallenge } from '../../services/powChallengeService.js';
import { shouldPreferPowCaptcha } from '../../utils/powChallengeCore.js';
import OracleCaptchaHub from './OracleCaptchaHub.jsx';
import TerminalPowCaptcha from './TerminalPowCaptcha.jsx';

function TurnstileGate({ onVerified, onFallbackPow }) {
  const containerRef = React.useRef(null);
  const widgetIdRef = React.useRef(null);
  const config = React.useMemo(() => getAuthCaptchaClientConfig({
    action: 'site_gate',
    env: {
      ...import.meta.env,
      VITE_AUTH_CAPTCHA_MODE: import.meta.env?.VITE_AUTH_CAPTCHA_MODE || 'enforce',
      VITE_AUTH_CAPTCHA_REQUIRED_ACTIONS: [
        import.meta.env?.VITE_AUTH_CAPTCHA_REQUIRED_ACTIONS,
        'site_gate',
      ].filter(Boolean).join(','),
    },
  }), []);
  const [message, setMessage] = React.useState('正在连接 Turnstile 验证节点...');

  React.useEffect(() => {
    let cancelled = false;

    if (!config.configured || config.provider !== 'turnstile') {
      onFallbackPow();
      return undefined;
    }

    ensureAuthCaptchaProviderScriptLoaded(config, window, document, 10000)
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded || !window.turnstile?.render || !containerRef.current) {
          onFallbackPow();
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: config.siteKey,
          action: 'site_gate',
          theme: 'auto',
          size: 'normal',
          appearance: 'always',
          execution: 'render',
          callback: () => {
            if (!cancelled) {
              setMessage('Turnstile 已确认来访请求。');
              onVerified();
            }
          },
          'error-callback': (code) => {
            if (!cancelled) {
              setMessage(`Turnstile 暂不可用：${code || 'unknown'}，正在切换到值守终端。`);
              window.setTimeout(onFallbackPow, 700);
            }
          },
          'timeout-callback': () => {
            if (!cancelled) {
              onFallbackPow();
            }
          },
        });
        setMessage('请完成 Turnstile 来访验证。');
      })
      .catch(() => {
        if (!cancelled) {
          onFallbackPow();
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
    };
  }, [config, onFallbackPow, onVerified]);

  return (
    <div className="mx-auto w-full max-w-[390px] border border-zinc-700 bg-black p-4 font-mono text-zinc-300">
      <div className="mb-3 flex items-center gap-2 text-xs tracking-[0.16em] text-endfield-yellow">
        <Globe2 className="h-4 w-4" />
        <span>Turnstile 来访验证</span>
      </div>
      <p className="mb-4 text-xs leading-5 text-zinc-400">{message}</p>
      <div className="min-h-[70px]">
        <div ref={containerRef} />
      </div>
      <button
        type="button"
        onClick={onFallbackPow}
        className="mt-4 border border-zinc-700 px-4 py-2 text-xs tracking-[0.18em] text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow"
      >
        改用值守终端
      </button>
    </div>
  );
}

function PowGate({ onVerified, isMobile }) {
  const [challenge, setChallenge] = React.useState(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    createAuthPowChallenge('site_gate')
      .then((nextChallenge) => {
        if (!cancelled) {
          setChallenge(nextChallenge);
          setError('');
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason?.message || '值守终端挑战签发失败。');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[390px] border border-red-800 bg-black p-4 font-mono text-red-300">
        <div className="mb-2 flex items-center gap-2 text-xs tracking-[0.16em]">
          <TerminalSquare className="h-4 w-4" />
          <span>值守终端离线</span>
        </div>
        <p className="text-xs leading-5">{error}</p>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="mx-auto w-full max-w-[390px] border border-zinc-700 bg-black p-4 font-mono text-zinc-400">
        <div className="mb-2 flex items-center gap-2 text-xs tracking-[0.16em] text-endfield-yellow">
          <TerminalSquare className="h-4 w-4" />
          <span>正在签发值守终端挑战</span>
        </div>
        <p className="text-xs leading-5">请稍候，终端正在生成本次来访记录。</p>
      </div>
    );
  }

  return (
    <TerminalPowCaptcha
      action="site_gate"
      challenge={challenge}
      isMobile={isMobile}
      onVerified={onVerified}
      showFallbackButton={false}
    />
  );
}

export default function SiteGateCaptcha({ onVerified, isMobile = false }) {
  const [mode, setMode] = React.useState(() => (shouldPreferPowCaptcha(import.meta.env) ? 'pow' : 'turnstile'));
  const [showLegacy, setShowLegacy] = React.useState(false);
  const handleFallbackPow = React.useCallback(() => {
    setMode('pow');
  }, []);

  if (showLegacy) {
    return <OracleCaptchaHub isMobile={isMobile} onVerified={onVerified} />;
  }

  return (
    <div className="space-y-4">
      {mode === 'turnstile' ? (
        <TurnstileGate
          onFallbackPow={handleFallbackPow}
          onVerified={onVerified}
        />
      ) : (
        <PowGate isMobile={isMobile} onVerified={onVerified} />
      )}
      <div className="mx-auto flex max-w-[390px] justify-center gap-2 font-mono">
        <button
          type="button"
          onClick={() => setMode((current) => (current === 'pow' ? 'turnstile' : 'pow'))}
          className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 text-[11px] tracking-[0.16em] text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          {mode === 'pow' ? '切换 Turnstile' : '切换 PoW'}
        </button>
        <button
          type="button"
          onClick={() => setShowLegacy(true)}
          className="border border-zinc-700 px-3 py-2 text-[11px] tracking-[0.16em] text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow"
        >
          旧版验证
        </button>
      </div>
    </div>
  );
}
