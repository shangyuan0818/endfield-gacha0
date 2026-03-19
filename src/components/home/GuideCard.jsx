import React, { useCallback } from 'react';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronUp,
  Cloud,
  Download,
  Gamepad2,
  Import,
  LogIn,
  MessageSquare,
  PieChart,
  Zap
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import CollapsibleContent from './CollapsibleContent';
import { getDesktopPathForTab, getMobilePathForTab } from '../../constants/appRoutes';
import { useAuthStore } from '../../stores';

const NavButton = ({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 bg-endfield-yellow/10 hover:bg-endfield-yellow/20 text-amber-700 dark:text-endfield-yellow border border-endfield-yellow/30 rounded-sm transition-colors cursor-pointer"
  >
    {Icon && <Icon size={11} />}
    <span>{label}</span>
    <ArrowRight size={10} className="opacity-60" />
  </button>
);

const GuideCard = React.memo(function GuideCard({ isOpen, onToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const isMobileRoute = location.pathname.startsWith('/m');

  const goTo = useCallback((tab, scrollTo) => () => {
    const targetPath = isMobileRoute ? getMobilePathForTab(tab) : getDesktopPathForTab(tab);
    navigate(targetPath, scrollTo ? { state: { scrollTo, _ts: Date.now() } } : undefined);
  }, [isMobileRoute, navigate]);

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
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-0.5">从注册到分析的完整操作流程</p>
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

              {/* STEP 01 - 账号注册与数据导入 */}
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono text-[10px] px-1.5 py-0.5 rounded-sm font-bold">STEP 01</span>
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm">账号注册与数据导入</h4>
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed space-y-2">
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><LogIn size={12} /> 注册 / 登录</strong>
                    <p>点击右上角登录，使用邮箱注册账号。登录后数据自动同步至云端，支持多设备无缝切换。</p>
                  </div>
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><Import size={12} /> 导入抽卡记录</strong>
                    <p>进入<span className="font-bold text-slate-700 dark:text-zinc-300">「卡池分析」</span>页面，点击<span className="font-bold text-slate-700 dark:text-zinc-300">「导入数据」</span>按钮，选择<span className="font-bold text-slate-700 dark:text-zinc-300">国服 / 国际服</span>。</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 p-2 rounded-sm space-y-1">
                    <p><span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">CN</span>登录鹰角通行证 → 打开 <code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">web-api.hypergryph.com/account/info/hg</code> → 复制内容</p>
                    <p><span className="text-zinc-400 dark:text-zinc-600 font-bold mr-1">EN</span>登录 Gryphline 充值中心 → 打开 <code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">web-api.gryphline.com/cookie_store/account_token</code> → 复制内容</p>
                  </div>
                  <p>将复制的内容粘贴至输入框并开始导入，系统会自动去重与解析。</p>
                </div>
                <div className="mt-auto pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50 flex flex-wrap items-center gap-2">
                  {!user && (
                    <NavButton icon={LogIn} label="登录 / 注册" onClick={openAuthModal} />
                  )}
                  <NavButton icon={Import} label="前往导入" onClick={goTo('dashboard', 'guide-import-btn')} />
                </div>
              </div>

              {/* STEP 02 - 数据分析与统计 */}
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-endfield-yellow/20 text-amber-700 dark:text-endfield-yellow font-mono text-[10px] px-1.5 py-0.5 rounded-sm font-bold">STEP 02</span>
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm">数据分析与统计</h4>
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-3 leading-relaxed">
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><BarChart3 size={12} /> 卡池分析</strong>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>查看 6★/5★ <span className="text-amber-600 dark:text-amber-500">保底进度</span>与当前垫刀数</li>
                      <li>分析平均出货、不歪率与出货分布图</li>
                      <li>追踪 120 抽硬保底、240 抽赠送、情报书等<span className="text-blue-600 dark:text-blue-400">特殊机制</span>进度</li>
                      <li>角色出货瀑布图与时间线视图</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><PieChart size={12} /> 统计汇总</strong>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>全账号生涯总览与欧非评价</li>
                      <li>全服数据对比与角色出货排名</li>
                      <li>各稀有度分布饼图与出货曲线</li>
                    </ul>
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50 flex flex-wrap items-center gap-2">
                  <NavButton icon={BarChart3} label="卡池分析" onClick={goTo('dashboard')} />
                  <NavButton icon={PieChart} label="统计汇总" onClick={goTo('summary')} />
                </div>
              </div>

              {/* STEP 03 - 实用工具与服务 */}
              <div className="p-6 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-mono text-[10px] px-1.5 py-0.5 rounded-sm font-bold">STEP 03</span>
                  <h4 className="font-bold text-slate-800 dark:text-zinc-200 text-sm">实用工具与服务</h4>
                </div>
                <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-3 leading-relaxed">
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><Gamepad2 size={12} /> 抽卡模拟器</strong>
                    <p>精确还原游戏概率引擎（含 65 抽软保底），支持从真实记录继承保底状态、资源追踪与无限十连。</p>
                  </div>
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><Cloud size={12} /> 云同步与导出</strong>
                    <p>登录后数据自动云端同步，支持 JSON / CSV 导出备份，可按卡池、账号、日期筛选导出。</p>
                  </div>
                  <div>
                    <strong className="block text-slate-700 dark:text-zinc-300 mb-1 flex items-center gap-1"><MessageSquare size={12} /> 工单反馈</strong>
                    <p>在应用内提交 Bug 报告、功能建议或使用问题，支持状态追踪与回复。</p>
                  </div>
                </div>
                <div className="mt-auto pt-3 border-t border-zinc-200/50 dark:border-zinc-700/50 flex flex-wrap items-center gap-2">
                  <NavButton icon={Gamepad2} label="抽卡模拟器" onClick={goTo('simulator')} />
                  <NavButton icon={Download} label="导出数据" onClick={goTo('dashboard', 'guide-export-section')} />
                  <NavButton icon={MessageSquare} label="工单反馈" onClick={goTo('tickets')} />
                </div>
              </div>

            </div>
          </div>

          {/* 底部提示 */}
          <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">
            <Zap size={10} />
            <span>TIP: 游客可直接使用模拟器和查看全服统计；登录后解锁数据导入、云同步与工单功能</span>
          </div>
        </div>
      </CollapsibleContent>
    </div>
  );
});

export default GuideCard;
