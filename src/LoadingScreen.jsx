import React, { useEffect, useRef, useState } from 'react';
import SiteGateCaptcha from './components/captcha/SiteGateCaptcha';
import { warmupApplication } from './services/appWarmupService';
import { useI18n } from './i18n/index.js';
import { readNumberStorageValue, STORAGE_KEYS, writeNumberStorageValue } from './utils/storageUtils.js';

// 验证码有效期：24小时（毫秒）
const CAPTCHA_VALIDITY_DURATION = 24 * 60 * 60 * 1000;
const MIN_LOADING_DURATION_MS = 2200;
const LONG_LOADING_HINT_DELAY_MS = 2600;
const WARMUP_STALL_HINT_DELAY_MS = 1200;
const LOADING_TEXTS = [
  'INITIALIZING',
  'CONNECTING TO ORACLE',
  'SYNCING DATABASE',
  'LOADING ASSETS',
  'PRELOADING INTERFACES',
  'VERIFYING IDENTITY',
  'CONNECTING TO ENDFIELD'
];

const LoadingScreen = ({ onComplete }) => {
  const { t } = useI18n();
  const [stage, setStage] = useState('loading'); // loading | captcha | done
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('INITIALIZING');
  const [showLongLoadingHint, setShowLongLoadingHint] = useState(false);
  const [showWarmupHint, setShowWarmupHint] = useState(false);
  const isMountedRef = useRef(true);
  const [skipCaptcha] = useState(() => {
    const lastVerifiedTime = readNumberStorageValue(STORAGE_KEYS.CAPTCHA_LAST_VERIFIED, null, { raw: true });
    if (!lastVerifiedTime) return false;

    const timeSinceLastVerified = Date.now() - lastVerifiedTime;
    return timeSinceLastVerified < CAPTCHA_VALIDITY_DURATION;
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (stage !== 'loading' || showLongLoadingHint) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (isMountedRef.current) {
        setShowLongLoadingHint(true);
      }
    }, LONG_LOADING_HINT_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showLongLoadingHint, stage]);

  useEffect(() => {
    if (stage !== 'loading' || progress < 92 || showWarmupHint) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (isMountedRef.current) {
        setShowWarmupHint(true);
      }
    }, WARMUP_STALL_HINT_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [progress, showWarmupHint, stage]);
  
  // 阶段1: 进度条加载（约3秒）
  useEffect(() => {
    if (stage !== 'loading') return;

    let isLoadingStageActive = true;
    let warmupReady = false;

    const completeLoadingStage = async () => {
      await Promise.allSettled([
        warmupApplication(),
        new Promise((resolve) => window.setTimeout(resolve, MIN_LOADING_DURATION_MS))
      ]);

      if (!isLoadingStageActive || !isMountedRef.current) {
        return;
      }

      warmupReady = true;
      setText(skipCaptcha ? 'TRUSTED SESSION READY' : 'SYSTEM READY');
      setProgress(100);

      window.setTimeout(() => {
        if (!isLoadingStageActive || !isMountedRef.current) {
          return;
        }

        if (skipCaptcha) {
          setStage('done');
          window.setTimeout(() => {
            if (isMountedRef.current) {
              onComplete();
            }
          }, 800);
        } else {
          setStage('captcha');
        }
      }, 350);
    };

    completeLoadingStage();

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 100;
        }

        const cap = warmupReady ? 100 : 92;
        const increment = Math.floor(Math.random() * 10) + 4;
        return Math.min(prev + increment, cap);
      });
    }, 150);

    const textInterval = setInterval(() => {
      if (!warmupReady) {
        setText(LOADING_TEXTS[Math.floor(Math.random() * LOADING_TEXTS.length)]);
      }
    }, 450);

    return () => {
      isLoadingStageActive = false;
      clearInterval(interval);
      clearInterval(textInterval);
    };
  }, [stage, skipCaptcha, onComplete]);

  // 阶段2: 验证码完成处理
  const handleCaptchaVerified = () => {
    // 存储验证成功时间（Cloudflare风格）
    writeNumberStorageValue(STORAGE_KEYS.CAPTCHA_LAST_VERIFIED, Date.now(), { raw: true });

    setStage('done');
    // 显示成功提示1秒后进入主应用
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  return (
    <div className={`fixed inset-0 bg-black z-[9999] flex flex-col items-center font-mono text-endfield-yellow ${
      stage === 'captcha' ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden justify-center'
    }`}>
      {/* 背景与扫描线容器 - absolute 并 overflow-hidden 截断溢出 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* 背景网格效果 */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
        {/* 扫描线 */}
        <div className="absolute left-0 right-0 h-4 bg-gradient-to-b from-transparent via-yellow-400/5 to-transparent animate-scan" />
      </div>

      {/* 阶段1: 加载进度 */}
      {stage === 'loading' && (
        <div className="relative z-10 flex flex-col items-center">
          {/* 装饰性边角 */}
          <div className="fixed top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-endfield-yellow/50 pointer-events-none" />
          <div className="fixed top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-endfield-yellow/50 pointer-events-none" />
          <div className="fixed bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-endfield-yellow/50 pointer-events-none" />
          <div className="fixed bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-endfield-yellow/50 pointer-events-none" />
          
          {/* Central Logo */}
          <div className="relative z-10 mb-12 animate-pulse">
            <img
              src="/endfield-logo.svg"
              alt="Endfield Logo"
              className="w-32 h-auto invert"
            />
          </div>

          {/* 进度条 */}
          <div className="w-80 h-1 bg-gray-800 relative overflow-hidden">
            <div
              className="h-full bg-endfield-yellow transition-all duration-100 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>

          {/* 技术文本 */}
          <div className="mt-4 flex flex-col items-center space-y-1">
            <div className="text-2xl font-bold tracking-widest text-endfield-yellow">
              {Math.min(progress, 100)}%
            </div>
            <div className="text-xs tracking-[0.2em] opacity-80 text-endfield-yellow">
              {text}
            </div>
            {skipCaptcha && progress > 80 && (
              <div className="text-[10px] text-green-500 mt-2 opacity-60 animate-pulse">
                TRUSTED SESSION DETECTED
              </div>
            )}
            {stage === 'loading' && (showLongLoadingHint || (showWarmupHint && progress >= 92)) && (
              <div className="mt-4 max-w-lg rounded-sm border border-endfield-yellow/35 bg-zinc-950/70 px-4 py-3 text-center text-[11px] leading-5 text-zinc-300 shadow-[0_0_24px_rgba(255,204,0,0.08)]">
                <div>{t('loading.hint.firstLoad')}</div>
                {progress >= 92 && (
                  <div className="mt-1 text-endfield-yellow/90">
                    {t('loading.hint.warmup')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 阶段2: 验证码 */}
      {stage === 'captcha' && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-[100dvh] w-full animate-fadeIn px-4 py-10">
          <div className="w-full flex justify-center">
            <SiteGateCaptcha onVerified={handleCaptchaVerified} />
          </div>
        </div>
      )}

      {/* 阶段3: 验证成功 */}
      {stage === 'done' && (
        <div className="relative z-10 flex flex-col items-center animate-pulse">
          <div className="text-endfield-yellow text-3xl font-bold tracking-wider mb-4">
            ✓ {skipCaptcha ? 'TRUSTED SESSION' : 'VERIFIED'}
          </div>
          <div className="text-gray-400 text-sm">
            {skipCaptcha ? t('loading.done.trusted') : t('loading.done.verified')}
          </div>
        </div>
      )}

      {/* 动画样式 */}
      <style>{`
        @keyframes scan {
          0% { top: -10%; }
          100% { top: 110%; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
