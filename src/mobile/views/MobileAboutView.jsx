import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Calculator,
  BarChart3,
  Cloud,
  Download,
  Shield,
  Heart,
  Code,
  Sparkles,
  ExternalLink,
  Bot,
  ChevronLeft
} from 'lucide-react';
import useSiteConfigStore from '../../stores/useSiteConfigStore';
import { APP_VERSION_LABEL } from '../../constants/appMeta';
import { getMobilePathForTab } from '../../constants/appRoutes';

function MobileAboutSectionHeader({ title, icon }) {
  const IconComponent = icon;

  return (
    <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 flex items-center gap-2">
      <IconComponent size={14} className="text-zinc-500" />
      <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">{title}</span>
    </div>
  );
}

/**
 * 移动端关于页面 - 工业风重构版 (中文)
 * 站点配置从 useSiteConfigStore 读取（管理面板可编辑）
 */
function MobileAboutView() {
  const navigate = useNavigate();
  const config = useSiteConfigStore(state => state.config);

  const siteVersion = config.site_version || APP_VERSION_LABEL;
  const buildInfo = config.build_info || 'Build 2026.02';
  const authorName = config.author_name || '';
  const authorBilibili = config.author_bilibili || '';
  const githubUrl = config.github_url || '';
  const icpNumber = config.icp_number || '';
  const icpUrl = config.icp_url || 'https://beian.miit.gov.cn/';
  const policeNumber = config.police_number || '';
  const policeUrl = config.police_url || 'https://www.beian.gov.cn/';

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 返回按钮 */}
      <button
        onClick={() => navigate(getMobilePathForTab('home'))}
        className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 touch-feedback -ml-1 hover:text-endfield-yellow transition-colors"
      >
        <ChevronLeft size={16} />
        <span className="text-xs font-bold uppercase tracking-wide">返回控制台</span>
      </button>

      {/* 页面标题 */}
      <div className="bg-zinc-900 text-white p-6 relative overflow-hidden border-l-4 border-endfield-yellow shadow-md group">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] animate-shine-slow pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-lg font-black tracking-tight flex items-center gap-2 mb-2 uppercase">
            <BarChart3 size={20} className="text-endfield-yellow" />
            终末地抽卡分析器
          </h1>
          <p className="text-zinc-500 text-[10px] tracking-[0.2em] uppercase font-mono">/ 终末地项目分析工具</p>
          <div className="mt-4 flex items-center gap-3">
            <span className="bg-zinc-800 px-2 py-0.5 text-[10px] font-mono border border-zinc-700 text-endfield-yellow">{siteVersion}</span>
            <span className="text-zinc-600 text-[10px] font-mono uppercase">{buildInfo}</span>
          </div>
        </div>
      </div>

      {/* 作者信息 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <MobileAboutSectionHeader title="项目团队" icon={Heart} />
        <div className="p-4">
          {/* 主要作者 */}
          {authorName && (
            <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700 mb-4 transition-colors hover:border-zinc-300 dark:hover:border-zinc-600">
              <div className="relative">
                <div className="w-14 h-14 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center overflow-hidden border border-zinc-300 dark:border-zinc-600 rounded-none">
                  <img
                    src="/avatar.png"
                    alt={authorName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border border-white dark:border-zinc-900"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h4 className="font-bold text-zinc-800 dark:text-zinc-100 uppercase text-sm">{authorName}</h4>
                  <span className="px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-[9px] text-zinc-600 dark:text-zinc-300 uppercase tracking-wider font-bold">负责人</span>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-2 font-mono uppercase">产品设计与开发</p>
                {authorBilibili && (
                  <a
                    href={authorBilibili}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-pink-50 dark:bg-pink-900/10 border border-pink-100 dark:border-pink-900/30 text-pink-600 dark:text-pink-400 text-[10px] font-bold touch-feedback uppercase tracking-wider hover:bg-pink-100 dark:hover:bg-pink-900/20 transition-colors"
                  >
                    Bilibili
                  </a>
                )}
              </div>
            </div>
          )}

          {/* AI 助手 */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <p className="text-[10px] font-bold text-zinc-400 mb-3 flex items-center gap-2 uppercase tracking-wider font-mono">
              <Bot size={12} />
              AI 协作单元
            </p>
            <div className="space-y-3">
              {/* Claude */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#D97757] flex items-center justify-center text-white shrink-0 border border-[#D97757] rounded-none">
                    <span className="font-bold font-serif italic text-xs">Cl</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-bold text-zinc-800 dark:text-zinc-200 text-xs uppercase">Claude</h5>
                      <span className="text-[9px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 font-mono font-bold">OPUS</span>
                    </div>
                    <p className="text-[9px] text-zinc-400 mt-1 uppercase tracking-wide">架构与逻辑</p>
                  </div>
                </div>
              </div>

              {/* Gemini */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#1A73E8] flex items-center justify-center text-white shrink-0 border border-[#1A73E8] rounded-none">
                    <span className="font-bold font-sans text-xs">Ge</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-bold text-zinc-800 dark:text-zinc-200 text-xs uppercase">Gemini</h5>
                      <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 font-mono font-bold">1.5 PRO</span>
                    </div>
                    <p className="text-[9px] text-zinc-400 mt-1 uppercase tracking-wide">界面与前端</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 功能特性 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <MobileAboutSectionHeader title="核心功能" icon={Sparkles} />
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Star, label: '卡池管理', desc: '限定/武器/常驻' },
              { icon: Calculator, label: '模拟抽卡', desc: '真实概率' },
              { icon: BarChart3, label: '数据分析', desc: '保底/不歪率统计' },
              { icon: Cloud, label: '云端同步', desc: '数据持久化' },
              { icon: Download, label: '数据导入', desc: '官方接口支持' },
              { icon: Shield, label: '全服统计', desc: '实时数据' },
            ].map((feature, idx) => (
              <div key={idx} className="p-3 bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700 group hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors">
                <feature.icon size={16} className="text-zinc-400 mb-2 group-hover:text-endfield-yellow transition-colors" />
                <h4 className="font-bold text-zinc-700 dark:text-zinc-300 text-[10px] mb-0.5 uppercase tracking-wide">{feature.label}</h4>
                <p className="text-[9px] text-zinc-500 font-mono">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 开源项目 */}
      {githubUrl && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
          <MobileAboutSectionHeader title="开源项目" icon={Code} />
          <div className="p-4">
            <div className="flex items-center justify-between p-4 bg-zinc-900 text-white border border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white flex items-center justify-center text-black shrink-0 rounded-none">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs tracking-tight uppercase">{githubUrl.replace('https://github.com/', '')}</h4>
                </div>
              </div>
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 bg-white text-black text-[10px] font-bold uppercase tracking-wider touch-feedback shrink-0 hover:bg-zinc-200 transition-colors"
              >
                查看
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 免责声明 */}
      <div className="text-center py-4 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-[9px] text-zinc-400 dark:text-zinc-600 uppercase tracking-widest font-mono">
          非官方工具。与 GRYPHLINE 无关。
        </p>
        <div className="mt-2 flex items-center justify-center gap-2 text-[9px] text-zinc-400 dark:text-zinc-600 font-mono">
          <a href="/privacy" className="underline">隐私政策</a>
          <span>|</span>
          <a href="/terms" className="underline">用户协议</a>
        </div>
        {(icpNumber || policeNumber) && (
          <div className="mt-1 flex items-center justify-center gap-2 text-[9px] text-zinc-400 dark:text-zinc-600 font-mono">
            {icpNumber && (
              <a href={icpUrl} target="_blank" rel="noopener noreferrer">{icpNumber}</a>
            )}
            {icpNumber && policeNumber && <span>|</span>}
            {policeNumber && (
              <a href={policeUrl} target="_blank" rel="noopener noreferrer">{policeNumber}</a>
            )}
          </div>
        )}
      </div>

      {/* 底部留白 */}
      <div className="h-4" />
    </div>
  );
}

export default MobileAboutView;
