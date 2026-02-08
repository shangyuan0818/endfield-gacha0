import React from 'react';
import { Monitor, Gamepad2, ArrowRight, Sparkles, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeviceDetection } from '../../hooks/useDeviceDetection';

/**
 * 移动端模拟器视图 - 引导用户切换到桌面端
 * 工业风重构版 (中文)
 */
function MobileSimulatorView() {
  const navigate = useNavigate();
  const { setPreference } = useDeviceDetection();

  const handleSwitchToDesktop = () => {
    setPreference('desktop');
    navigate('/?tab=simulator');
  };

  return (
    <div className="px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
      {/* 终端卡片容器 */}
      <div className="w-full max-w-sm bg-zinc-900 text-zinc-300 font-mono p-6 border-l-4 border-endfield-yellow shadow-2xl relative overflow-hidden">
        {/* 背景扫描线效果 */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.5)_50%)] bg-[size:100%_4px] opacity-20 pointer-events-none" />
        
        {/* 标题栏 */}
        <div className="flex justify-between items-center mb-6 border-b border-zinc-700 pb-4">
           <div className="flex items-center gap-2 text-endfield-yellow">
              <Terminal size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">系统提示</span>
           </div>
           <span className="text-[10px] text-zinc-500">移动端视图限制</span>
        </div>

        {/* 主要内容 */}
        <div className="text-center mb-8 relative z-10">
           <div className="w-20 h-20 bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4 relative">
              <Gamepad2 size={40} className="text-zinc-500" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 animate-pulse" />
           </div>
           
           <h1 className="text-lg font-bold text-white mb-2 uppercase tracking-wide">
             抽卡模拟模块
           </h1>
           <p className="text-xs text-zinc-400 leading-relaxed max-w-[240px] mx-auto">
             需要高级图形特性支持。移动端无法提供完整的模拟保真度。
           </p>
        </div>

        {/* 功能列表 */}
        <div className="space-y-2 mb-8 relative z-10">
           {[
             "概率引擎",
             "视觉特效渲染",
             "库存管理",
             "数据导出"
           ].map((item, i) => (
             <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-500 uppercase">
                <div className="w-1.5 h-1.5 bg-zinc-600" />
                <span>{item}</span>
                <span className="ml-auto text-endfield-yellow">[需桌面端]</span>
             </div>
           ))}
        </div>

        {/* 切换按钮 */}
        <button
          onClick={handleSwitchToDesktop}
          className="w-full flex items-center justify-center gap-2 py-3 bg-endfield-yellow text-black text-xs font-bold uppercase tracking-widest hover:bg-yellow-400 transition-colors touch-feedback relative z-10"
        >
          <Monitor size={14} />
          启动桌面模式
          <ArrowRight size={14} />
        </button>

        <p className="mt-4 text-[9px] text-zinc-600 text-center uppercase tracking-wider relative z-10">
          可在设置中覆盖
        </p>
      </div>
    </div>
  );
}

export default MobileSimulatorView;