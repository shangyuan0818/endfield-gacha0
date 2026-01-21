import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Terminal, ArrowRight } from 'lucide-react';

const TerminalCaptcha = ({ onVerified }) => {
  const [inputValue, setInputValue] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [isWrong, setIsWrong] = useState(false);
  const canvasRef = useRef(null);

  // 生成随机验证码
  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除易混淆字符
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // 绘制验证码
  const drawCaptcha = useCallback((code) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 1. 清空背景 (终端黑)
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    // 2. 绘制网格背景
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // 3. 绘制干扰线
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(255, 250, 0, 0.3)' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, Math.random() * height);
      ctx.lineTo(Math.random() * width, Math.random() * height);
      ctx.stroke();
    }

    // 4. 绘制文字
    ctx.font = 'bold 36px "Courier New", monospace';
    ctx.textBaseline = 'middle';
    const totalWidth = ctx.measureText(code).width + (code.length - 1) * 15;
    let startX = (width - totalWidth) / 2;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      ctx.save();
      // 随机位置微调
      const x = startX + i * 40;
      const y = height / 2 + (Math.random() - 0.5) * 10;
      // 随机旋转
      const angle = (Math.random() - 0.5) * 0.3;
      
      ctx.translate(x, y);
      ctx.rotate(angle);
      
      // 文字颜色 (终末地黄)
      ctx.fillStyle = '#FFFA00';
      // 文字阴影 (发光效果)
      ctx.shadowColor = 'rgba(255, 250, 0, 0.8)';
      ctx.shadowBlur = 10;
      
      ctx.fillText(char, 0, 0);
      ctx.restore();
    }

    // 5. 绘制噪点
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#FFFA00';
      ctx.beginPath();
      ctx.arc(Math.random() * width, Math.random() * height, 1, 0, 2 * Math.PI);
      ctx.fill();
    }

    // 6. 扫描线效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let i = 0; i < height; i += 3) {
      ctx.fillRect(0, i, width, 1);
    }

  }, []);

  // 初始化
  useEffect(() => {
    refreshCaptcha();
  }, [drawCaptcha]);

  const refreshCaptcha = () => {
    const newCode = generateCode();
    setCaptchaCode(newCode);
    drawCaptcha(newCode);
    setInputValue('');
    setIsWrong(false);
  };

  const handleVerify = (e) => {
    e?.preventDefault();
    if (inputValue.toUpperCase() === captchaCode) {
      onVerified();
    } else {
      setIsWrong(true);
      setInputValue('');
      setTimeout(() => setIsWrong(false), 500);
      refreshCaptcha(); // 输入错误刷新验证码
    }
  };

  return (
    <div className="w-full max-w-[320px] mx-auto font-mono">
      {/* 终端头部 */}
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-700 p-2 border-b-0">
        <div className="flex items-center gap-2 text-endfield-yellow text-xs tracking-wider">
          <Terminal size={14} />
          <span>SECURITY_CHECK_PROTOCOL</span>
        </div>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
          <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
        </div>
      </div>

      {/* 验证码区域 */}
      <div className="relative border border-zinc-700 bg-black p-4">
        {/* Canvas */}
        <div className="relative group cursor-pointer" onClick={refreshCaptcha} title="点击刷新">
          <canvas
            ref={canvasRef}
            width={280}
            height={100}
            className="w-full h-auto border border-zinc-800"
          />
          {/* 刷新遮罩 */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <RefreshCw className="text-white w-8 h-8" />
          </div>
        </div>

        {/* 提示文字 */}
        <div className="mt-3 mb-2 text-[10px] text-zinc-500 flex justify-between">
          <span>&gt; 请输入上方字符</span>
          <span className="text-zinc-600">ID: {Math.floor(Math.random() * 9999)}</span>
        </div>

        {/* 输入区域 */}
        <form onSubmit={handleVerify} className="relative flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-endfield-yellow text-sm">&gt;</span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              className={`w-full bg-zinc-900 border ${isWrong ? 'border-red-500 text-red-500' : 'border-zinc-700 text-endfield-yellow'} pl-6 pr-3 py-2 text-lg font-bold tracking-widest outline-none focus:border-endfield-yellow transition-colors placeholder-zinc-700`}
              placeholder="____"
              maxLength={4}
              autoFocus
            />
          </div>
          <button
            type="submit"
            className="bg-endfield-yellow hover:bg-yellow-400 text-black px-4 py-2 font-bold transition-colors flex items-center justify-center"
          >
            <ArrowRight size={20} />
          </button>
        </form>
      </div>
      
      {/* 装饰性底部 */}
      <div className="flex justify-between text-[9px] text-zinc-600 mt-1 px-1">
        <span>ENDFIELD OS // VERIFY</span>
        <span>STATUS: PENDING</span>
      </div>
    </div>
  );
};

export default TerminalCaptcha;
