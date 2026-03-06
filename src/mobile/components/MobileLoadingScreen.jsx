import React, { useEffect, useState } from 'react';
import MinecraftCaptcha from '../../components/MinecraftCaptcha';
import TerminalCaptcha from '../../components/TerminalCaptcha';
import { Settings } from 'lucide-react';

// 验证码有效期：24小时（毫秒）- 与桌面端共享
const CAPTCHA_VALIDITY_DURATION = 24 * 60 * 60 * 1000;

/**
 * 移动端加载屏幕 - 完整版
 * 与桌面端 LoadingScreen.jsx 功能完全一致
 * 共享 localStorage 的验证状态
 */
const MobileLoadingScreen = ({ onComplete }) => {
  const [stage, setStage] = useState('loading'); // loading | captcha | done
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('INITIALIZING');
  const [skipCaptcha] = useState(() => {
    const lastVerifiedTime = localStorage.getItem('lastCaptchaVerified');
    if (!lastVerifiedTime) {
      return false;
    }

    const timeSinceLastVerified = Date.now() - parseInt(lastVerifiedTime, 10);
    return timeSinceLastVerified < CAPTCHA_VALIDITY_DURATION;
  });

  // 验证码模式: 'minecraft' | 'terminal'
  // 移动端默认使用 terminal 模式（更适合触屏）
  const [captchaMode, setCaptchaMode] = useState(() => localStorage.getItem('captchaModePreference') || 'terminal');

  // 切换验证码模式
  const toggleCaptchaMode = () => {
    const newMode = captchaMode === 'minecraft' ? 'terminal' : 'minecraft';
    setCaptchaMode(newMode);
    localStorage.setItem('captchaModePreference', newMode);
  };

  // 阶段1: 进度条加载
  useEffect(() => {
    if (stage !== 'loading') return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // 进度完成后，根据 skipCaptcha 决定是否显示验证码
          setTimeout(() => {
            if (skipCaptcha) {
              // 跳过验证码，直接完成
              setStage('done');
              setTimeout(() => onComplete(), 800);
            } else {
              // 显示验证码
              setStage('captcha');
            }
          }, 500);
          return 100;
        }
        // 随机增量，模拟加载过程
        return prev + Math.floor(Math.random() * 15) + 5;
      });
    }, 150);

    // 随机文本切换
    const texts = [
      'INITIALIZING',
      'CONNECTING TO ORACLE',
      'SYNCING DATABASE',
      'LOADING ASSETS',
      'VERIFYING IDENTITY',
      'CONNECTING TO ENDFIELD'
    ];
    const textInterval = setInterval(() => {
      setText(texts[Math.floor(Math.random() * texts.length)]);
    }, 450);

    return () => {
      clearInterval(interval);
      clearInterval(textInterval);
    };
  }, [stage, skipCaptcha, onComplete]);

  // 阶段2: 验证码完成处理
  const handleCaptchaVerified = () => {
    // 存储验证成功时间（与桌面端共享）
    localStorage.setItem('lastCaptchaVerified', Date.now().toString());

    setStage('done');
    // 显示成功提示1秒后进入主应用
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center font-mono text-endfield-yellow overflow-hidden safe-area-inset">
      {/* 背景网格效果 */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* 装饰性边角 */}
      <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-endfield-yellow/50" />
      <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-endfield-yellow/50" />
      <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-endfield-yellow/50" />
      <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-endfield-yellow/50" />

      {/* 扫描线 */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-yellow-400/5 to-transparent h-4 animate-scan" />

      {/* 阶段1: 加载进度 */}
      {stage === 'loading' && (
        <div className="relative z-10 flex flex-col items-center px-4">
          {/* Central Logo */}
          <div className="relative z-10 mb-8 animate-pulse">
            <img
              src="/endfield-logo.svg"
              alt="Endfield Logo"
              className="w-24 h-auto invert"
            />
          </div>

          {/* 进度条 */}
          <div className="w-64 h-1 bg-gray-800 relative overflow-hidden">
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
          </div>
        </div>
      )}

      {/* 阶段2: 验证码 */}
      {stage === 'captcha' && (
        <div className="relative z-10 flex flex-col items-center animate-fadeIn w-full max-w-md px-4">
          {/* 标题 */}
          <div className="text-endfield-yellow text-xl mb-4 tracking-widest font-mono text-center">
            [ ORACLE 身份验证 ]
          </div>
          <div className="text-gray-400 text-xs mb-4 text-center">
            ENDFIELD SECURITY PROTOCOL v2.2.2
          </div>

          {/* 验证码容器 - 移动端缩放 */}
          <div className="transform scale-90 origin-top w-full flex flex-col items-center">
            {captchaMode === 'minecraft' ? (
              <MinecraftCaptcha onVerified={handleCaptchaVerified} />
            ) : (
              <TerminalCaptcha onVerified={handleCaptchaVerified} />
            )}
          </div>

          {/* 切换按钮 */}
          <button
            onClick={toggleCaptchaMode}
            className="mt-4 flex items-center gap-2 text-xs text-zinc-500 hover:text-endfield-yellow transition-colors border border-zinc-800 hover:border-endfield-yellow/50 px-3 py-1.5 bg-black/50 touch-feedback"
          >
            <Settings size={12} />
            <span>切换验证: {captchaMode === 'minecraft' ? '终端指令' : 'MC合成'}</span>
          </button>

          {/* 提示文本 */}
          <div className="text-gray-500 text-xs mt-3 text-center max-w-xs px-4">
            {captchaMode === 'minecraft' ? (
              <>
                提示：合成末影之眼需要两步操作<br/>
                <span className="text-endfield-yellow/70">完成验证后将自动进入系统</span>
              </>
            ) : (
              <>
                提示：请输入屏幕上显示的终端指令代码<br/>
                <span className="text-endfield-yellow/70">输入正确后按回车进入系统</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 阶段3: 验证成功 */}
      {stage === 'done' && (
        <div className="relative z-10 flex flex-col items-center animate-pulse px-4">
          <div className="text-endfield-yellow text-2xl font-bold tracking-wider mb-4 text-center">
            ✓ {skipCaptcha ? 'TRUSTED SESSION' : 'VERIFIED'}
          </div>
          <div className="text-gray-400 text-sm text-center">
            {skipCaptcha ? '身份已验证 · 正在进入系统...' : '身份验证成功 · 正在进入系统...'}
          </div>
        </div>
      )}

      {/* 动画样式 */}
      <style dangerouslySetInnerHTML={{ __html: `
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
      `}} />
    </div>
  );
};

export default MobileLoadingScreen;
