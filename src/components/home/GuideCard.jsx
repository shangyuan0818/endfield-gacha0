import React from 'react';
import { BarChart3, BookOpen, ChevronUp, Cloud, Gamepad2, Import, Zap } from 'lucide-react';
import CollapsibleContent from './CollapsibleContent';

const GuideCard = React.memo(function GuideCard({ isOpen, onToggle }) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden relative group/card">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500 origin-left scale-x-0 group-hover/card:scale-x-100 transition-transform duration-500"></div>

      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors relative z-10"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
            <BookOpen size={20} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">使用指南</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">系统操作手册与功能索引</p>
          </div>
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`}>
          <ChevronUp size={20} className="text-zinc-400" />
        </div>
      </button>

      <CollapsibleContent isOpen={isOpen}>
        <div className="px-6 pb-6 bg-zinc-50/50 dark:bg-black/20">
          <div className="border border-zinc-200 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-900/50">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800">
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[10px] px-1.5 py-0.5 rounded-sm font-bold">STEP 01</span>
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm">数据录入流程</h4>
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed space-y-2">
                  <p><span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">01.</span>点击右上角 <span className="font-bold text-slate-700 dark:text-zinc-300">登录/注册</span> 账号，确保数据可云端保存。</p>
                  <p><span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">02.</span>点击顶部的 <span className="font-bold text-slate-700 dark:text-zinc-300">「导入数据」</span> 按钮，打开导入面板，并先选择 <span className="font-bold text-slate-700 dark:text-zinc-300">国服 / 国际服</span> 区服来源。</p>
                  <p><span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">03.</span><span className="font-bold text-slate-700 dark:text-zinc-300">国服（官服 / B服）</span>：登录鹰角网络通行证，打开 `web-api.hypergryph.com/account/info/hg`，复制页面完整内容或 `content` 字段。</p>
                  <p><span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">04.</span><span className="font-bold text-slate-700 dark:text-zinc-300">国际服（亚服 / 欧/美服）</span>：先登录 Gryphline 充值中心，确认角色列表可见，再打开 `web-api.gryphline.com/cookie_store/account_token`，复制页面完整内容或 `content` 字段。</p>
                  <p><span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">05.</span>将复制的内容粘贴至输入框并开始导入；如果检测到多个游戏账号，再选择需要导入的目标账号。</p>
                </div>
                <div className="mt-auto pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono uppercase">
                    <Import size={12} />
                    <span>Token Import System</span>
                  </div>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-endfield-yellow/20 text-amber-700 dark:text-endfield-yellow font-mono text-[10px] px-1.5 py-0.5 rounded-sm font-bold">STEP 02</span>
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm">深度数据分析</h4>
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-3 leading-relaxed">
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1">📊 卡池详情页</strong>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>查看当前卡池的<span className="text-amber-600 dark:text-amber-500">水位垫刀</span>与保底进度。</li>
                      <li>分析 6 星出货的<span className="text-blue-600 dark:text-blue-400">平均消耗</span>与不歪率。</li>
                      <li>追踪 120 抽硬保底与 240 抽赠送进度。</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1">📈 统计汇总页</strong>
                    <p>全账号生涯数据总览，包含欧非评价（基于全服数据对比）、各稀有度分布占比及历史出货曲线。</p>
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono uppercase">
                    <BarChart3 size={12} />
                    <span>Visual Analytics</span>
                  </div>
                </div>
              </div>

              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono text-[10px] px-1.5 py-0.5 rounded-sm font-bold">STEP 03</span>
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm">实用工具与服务</h4>
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-3 leading-relaxed">
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><Gamepad2 size={12} /> 抽卡模拟器</strong>
                    <p>真实还原游戏内概率模型（含 65 抽软保底机制），支持无限十连，用于测试手气或规划资源。</p>
                  </div>
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><Cloud size={12} /> 云端同步服务</strong>
                    <p>登录后您的所有数据将加密存储于云端数据库，支持在 PC、手机等不同设备间无缝切换，数据永不丢失。</p>
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono uppercase">
                    <Zap size={12} />
                    <span>Tools & Cloud Sync</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </div>
  );
});

export default GuideCard;
