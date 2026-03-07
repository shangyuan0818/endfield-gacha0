import { ArrowRight, CheckCircle, ExternalLink, HelpCircle } from 'lucide-react';

export default function OfficialImportIdleView({
  autoDetected,
  tokenInput,
  onImport,
  onInputChange
}) {
  return (
    <>
      <div className="bg-slate-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4 transition-colors">
        <h3 className="text-slate-800 dark:text-zinc-300 text-sm font-bold flex items-center gap-2 mb-4">
          <HelpCircle size={14} className="text-amber-600 dark:text-yellow-500" />
          快速指南
        </h3>

        <div className="space-y-4 pt-2 text-xs text-slate-500 dark:text-zinc-400 font-mono">
          <div className="flex gap-3">
            <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300">1</div>
            <div>
              <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1">登录官网并绑定</p>
              <p className="mb-1 text-slate-500 dark:text-zinc-500">官服与B服均需在此绑定终末地角色：</p>
              <a href="https://user.hypergryph.com/bindCharacters?game=endfield" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-1 underline">
                user.hypergryph.com <ExternalLink size={10} />
              </a>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300">2</div>
            <div>
              <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1">获取数据内容</p>
              <p className="mb-1 text-slate-500 dark:text-zinc-500">在新标签页打开链接，建议复制页面显示的<span className="text-slate-700 dark:text-zinc-300">完整内容</span>，或仅复制 <span className="text-slate-700 dark:text-zinc-300">content</span> 字段的值：</p>
              <a href="https://web-api.hypergryph.com/account/info/hg" target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 flex items-center gap-1 underline">
                web-api.hypergryph.com <ExternalLink size={10} />
              </a>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-5 h-5 flex-shrink-0 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center text-slate-600 dark:text-zinc-300">3</div>
            <div>
              <p className="text-slate-800 dark:text-zinc-300 font-bold mb-1">粘贴至下方</p>
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
          <label className="block text-[10px] text-slate-500 dark:text-zinc-500 font-bold uppercase tracking-wider mb-2">
            身份认证 Token
          </label>
          <input
            type="text"
            value={tokenInput}
            onChange={onInputChange}
            className="w-full bg-white dark:bg-black/30 border border-zinc-300 dark:border-zinc-700 p-4 font-mono text-center text-lg text-slate-800 dark:text-white focus:border-amber-500 dark:focus:border-yellow-500 focus:outline-none transition-colors placeholder:text-slate-400 dark:placeholder:text-zinc-700"
            placeholder="粘贴24位Token或完整JSON"
          />
          <div className="absolute right-3 top-[38px] text-[10px] text-slate-400 dark:text-zinc-600 font-mono pointer-events-none">
            {tokenInput.trim().length} 字符
          </div>
        </div>

        {autoDetected && tokenInput.length === 24 && (
          <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-500 font-mono bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30 px-3 py-2 transition-colors">
            <CheckCircle size={14} />
            <span>已从JSON中自动提取Token</span>
          </div>
        )}

        <button
          onClick={onImport}
          disabled={!tokenInput.trim()}
          className="w-full bg-amber-500 hover:bg-amber-600 dark:bg-yellow-500 dark:hover:bg-yellow-400 disabled:opacity-50 disabled:hover:bg-amber-500 dark:disabled:hover:bg-yellow-500 text-white dark:text-black font-bold py-3 text-sm tracking-wider transition-colors flex items-center justify-center gap-2 group"
        >
          开始导入
          <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </>
  );
}
