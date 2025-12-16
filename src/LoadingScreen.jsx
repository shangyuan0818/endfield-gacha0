import React, { useEffect, useState } from 'react';
import MinecraftCaptcha from './components/MinecraftCaptcha';

const LoadingScreen = ({ onComplete }) => {
  const [stage, setStage] = useState('loading'); // loading | captcha | done
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('INITIALIZING');

  // 阶段1: 进度条加载（约3秒）
  useEffect(() => {
    if (stage !== 'loading') return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // 进度完成后，延迟0.5秒切换到验证码阶段
          setTimeout(() => setStage('captcha'), 500);
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
      'VERIFYING IDENTITY'
    ];
    const textInterval = setInterval(() => {
      setText(texts[Math.floor(Math.random() * texts.length)]);
    }, 450);

    return () => {
      clearInterval(interval);
      clearInterval(textInterval);
    };
  }, [stage]);

  // 阶段2: 验证码完成处理
  const handleCaptchaVerified = () => {
    setStage('done');
    // 显示成功提示1秒后进入主应用
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center font-mono text-endfield-yellow overflow-hidden">
      {/* 背景网格效果 */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* 装饰性边角 */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-endfield-yellow/50" />
      <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-endfield-yellow/50" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-endfield-yellow/50" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-endfield-yellow/50" />

      {/* 扫描线 */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-yellow-400/5 to-transparent h-4 animate-scan" />

      {/* 阶段1: 加载进度 */}
      {stage === 'loading' && (
        <div className="relative z-10 flex flex-col items-center">
          {/* Logo占位 */}
          <div className="mb-12 animate-pulse">
            <div className="text-6xl font-bold tracking-wider text-endfield-yellow">
              ENDFIELD
            </div>
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
          </div>
        </div>
      )}

      {/* 阶段2: 验证码 */}
      {stage === 'captcha' && (
        <div className="relative z-10 flex flex-col items-center animate-fadeIn">
          {/* 标题 */}
          <div className="text-endfield-yellow text-2xl mb-6 tracking-widest font-mono">
            [ ORACLE 身份验证系统 ]
          </div>
          <div className="text-gray-400 text-sm mb-6">
            ENDFIELD SECURITY PROTOCOL v2.2.2
          </div>

          {/* Minecraft验证码 */}
          <div className="transform scale-95 md:scale-100">
            <MinecraftCaptcha onVerified={handleCaptchaVerified} />
          </div>

          {/* 提示文本 */}
          <div className="text-gray-500 text-xs mt-6 text-center max-w-md">
            提示：合成末影之眼需要两步操作<br/>
            <span className="text-endfield-yellow/70">完成验证后将自动进入系统</span>
          </div>
        </div>
      )}

      {/* 阶段3: 验证成功 */}
      {stage === 'done' && (
        <div className="relative z-10 flex flex-col items-center animate-pulse">
          <div className="text-endfield-yellow text-3xl font-bold tracking-wider mb-4">
            ✓ VERIFIED
          </div>
          <div className="text-gray-400 text-sm">
            身份验证成功 · 正在进入系统...
          </div>
        </div>
      )}

      {/* 动画样式 */}
      <style jsx>{`
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
