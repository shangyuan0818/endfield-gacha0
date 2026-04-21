import { ArrowRight, CheckCircle, ExternalLink, HelpCircle } from 'lucide-react';

export default function OfficialImportIdleView({
  autoDetected,
  tokenInput,
  onImport,
  onInputChange
}) {
  return (
    <>
      <div className="bg-slate-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4 text-sm text-slate-600 dark:text-zinc-400 space-y-2 font-mono transition-colors" style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)' }}>
        <h3 className="text-slate-800 dark:text-zinc-300 font-bold mb-2 flex items-center gap-2 uppercase tracking-widest">
          <HelpCircle size={14} className="text-yellow-600 dark:text-yellow-500" />
          快速指南
        </h3>

        <div className="space-y-4 pt-2 text-xs text-slate-500 dark:text-zinc-400 font-mono">
          <div className="flex gap-3">
            <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%)' }}>1</div>
            <div>
              <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1 uppercase tracking-widest">登录官网并绑定</p>
              <p className="mb-1 text-slate-500 dark:text-zinc-500">官服与B服均需在此绑定终末地角色：</p>
              <a href="https://user.hypergryph.com/bindCharacters?game=endfield" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-1 underline">
                user.hypergryph.com <ExternalLink size={10} />
              </a>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%)' }}>2</div>
            <div>
              <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1 uppercase tracking-widest">获取数据内容</p>
              <p className="mb-1 text-slate-500 dark:text-zinc-500">在新标签页打开链接，建议复制页面显示的<span className="text-slate-700 dark:text-zinc-300">完整内容</span>，或仅复制 <span className="text-slate-700 dark:text-zinc-300">content</span> 字段的值：</p>
              <a href="https://web-api.hypergryph.com/account/info/hg" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-1 underline">
                web-api.hypergryph.com <ExternalLink size={10} />
              </a>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300" style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%)' }}>3</div>
            <div>
              <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1 uppercase tracking-widest">粘贴至下方</p>
              <p className="text-slate-500 dark:text-zinc-500 mb-2">将复制的内容粘贴在下方输入框中：</p>
              <div className="bg-slate-100 dark:bg-black/40 border border-zinc-200 dark:border-zinc-700 p-2 text-[10px] font-mono rounded-sm leading-relaxed transition-colors">
                <span className="text-slate-500 dark:text-zinc-500">{'{'}</span><br />
                <span className="text-slate-500 dark:text-zinc-500 ml-2">"code": 0,</span><br />
                <span className="text-slate-500 dark:text-zinc-500 ml-2">"data": {'{'}</span><br />
                <span className="text-purple-600 dark:text-purple-400 ml-4">"content"</span><span className="text-slate-500 dark:text-zinc-500">: </span>
                <span className="text-green-600 dark:text-green-400">"AbCdEf123456789012345678"</span><br />
                <span className="text-slate-500 dark:text-zinc-500 ml-2">{'}'}</span><span className="text-slate-400 dark:text-zinc-600 ml-2">// ← 复制引号内的24位字符</span><br />
                <span className="text-slate-500 dark:text-zinc-500">{'}'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <label className="block text-[11px] text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-widest mb-3 font-mono">
            身份认证 Token
          </label>
          <div className="relative">
            <input
              type="text"
              value={tokenInput}
              onChange={onInputChange}
              className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 p-4 font-mono text-center text-lg text-slate-800 dark:text-white focus:border-yellow-500 dark:focus:border-yellow-500 focus:outline-none transition-colors placeholder:text-slate-300 dark:placeholder:text-zinc-700 shadow-inner"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)' }}
              placeholder="粘贴24位Token或完整JSON"
            />
            <div className="absolute right-3 top-[38px] text-[10px] text-slate-400 dark:text-zinc-600 font-mono pointer-events-none">
              {tokenInput.trim().length} 字符
            </div>
          </div>
        </div>

        {autoDetected && tokenInput.length === 24 && (
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-500 font-mono bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 px-3 py-2 transition-colors" style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)' }}>
            <CheckCircle size={14} />
            <span>已从JSON中自动提取Token</span>
          </div>
        )}

        <button
          onClick={onImport}
          disabled={!tokenInput.trim()}
          className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:bg-zinc-300 dark:disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold py-4 text-sm tracking-widest uppercase transition-all duration-300 flex items-center justify-center gap-2 group relative overflow-hidden disabled:cursor-not-allowed"
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%)' }}
        >
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-in-out" />
          <span className="relative z-10">开始导入</span>
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform relative z-10" />
        </button>
      </div>
    </>
  );
}