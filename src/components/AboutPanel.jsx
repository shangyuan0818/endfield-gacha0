import React from 'react';
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
  Bot
} from 'lucide-react';

/**
 * 关于面板组件
 */
const AboutPanel = React.memo(() => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="bg-gradient-to-br from-zinc-800 to-zinc-950 p-8 text-white relative overflow-hidden border-l-4 border-endfield-yellow">
        <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
          <Sparkles size={240} />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3 mb-2">
            <BarChart3 size={32} className="text-endfield-yellow" />
            终末地抽卡分析器
          </h2>
          <p className="text-zinc-400 text-sm tracking-widest uppercase">/ 记录你的每一次命运邂逅</p>
          <div className="mt-6 flex items-center gap-4">
            <span className="bg-white/10 px-3 py-1 text-xs font-mono border border-white/20">版本 2.7.1</span>
            <span className="text-zinc-500 text-xs font-mono">构建于 2025</span>
          </div>
        </div>
      </div>

      {/* 作者信息 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2">
          <Heart size={18} className="text-pink-500" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200 tracking-wide uppercase text-sm">Credits // 制作团队</h3>
        </div>
        <div className="p-6">
          {/* 主要作者 */}
          <div className="flex items-center gap-5 p-5 bg-gradient-to-r from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-900 border border-zinc-200 dark:border-zinc-700 mb-6 group hover:border-pink-300 dark:hover:border-pink-900 transition-colors">
            <div className="relative">
              <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-300 dark:border-zinc-600">
                <img
                  src="/avatar.png"
                  alt="蘑菇菌__"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white dark:border-zinc-900"></div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">蘑菇菌__</h4>
                <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider border border-zinc-200 dark:border-zinc-700">项目负责人</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 font-mono">发起人 & 产品设计</p>
              <a
                href="https://space.bilibili.com/14932613"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-pink-50 dark:bg-pink-900/10 text-pink-600 dark:text-pink-400 text-xs font-bold hover:bg-pink-100 dark:hover:bg-pink-900/20 transition-colors"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.659.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906L17.813 4.653zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773H5.333zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z"/>
                </svg>
                Bilibili
              </a>
            </div>
          </div>

          {/* AI 助手 */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-6">
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Bot size={14} />
              AI 联合开发 // 智能协作单元
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Claude */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-orange-300 dark:hover:border-orange-800 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#D97757] flex items-center justify-center text-white shrink-0">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-white">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-bold text-zinc-800 dark:text-zinc-200">Claude</h5>
                      <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 font-mono">OPUS 4</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 font-mono">ANTHROPIC</p>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      核心架构设计、逻辑处理、后端集成
                    </p>
                  </div>
                </div>
              </div>

              {/* Gemini */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#1A73E8] flex items-center justify-center text-white shrink-0">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-white">
                      <path d="M12 2L2 7l10 5 10-5-10-5zm0 9l2.5-1.25L12 8.5l-2.5 1.25L12 11zm0 2.5l-5-2.5-5 2.5L12 22l10-8.5-5-2.5-5 2.5z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h5 className="font-bold text-zinc-800 dark:text-zinc-200">Gemini</h5>
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 font-mono">3 PRO</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 font-mono">GOOGLE</p>
                    <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                      UI/UX 设计、视觉优化、前端逻辑
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 功能特性 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2">
          <Sparkles size={18} className="text-amber-500" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200 tracking-wide uppercase text-sm">Features // 核心功能</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: Star, label: '卡池管理', desc: '限定/常驻/武器池' },
              { icon: Calculator, label: '保底追踪', desc: '实时垫刀追踪' },
              { icon: BarChart3, label: '数据分析', desc: '概率分布图表' },
              { icon: Cloud, label: '云端同步', desc: '多设备数据共享' },
              { icon: Download, label: '导入 / 导出', desc: 'JSON/CSV 格式' },
              { icon: Shield, label: '权限管理', desc: '多角色权限控制' },
            ].map((feature, idx) => (
              <div key={idx} className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group">
                <feature.icon size={20} className="text-zinc-400 group-hover:text-endfield-yellow mb-3 transition-colors" />
                <h4 className="font-bold text-zinc-700 dark:text-zinc-300 text-xs mb-1">{feature.label}</h4>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 开源项目 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2">
          <Code size={18} className="text-zinc-500" />
          <h3 className="font-bold text-zinc-700 dark:text-zinc-200 tracking-wide uppercase text-sm">Open Source // 开源仓库</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-5 bg-zinc-900 text-white">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white flex items-center justify-center text-black">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-lg tracking-tight">GITHUB 代码仓库</h4>
                <p className="text-xs text-zinc-400 font-mono mt-1">MoguJunn/endfield-gacha</p>
              </div>
            </div>
            <a
              href="https://github.com/MoguJunn/endfield-gacha"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 transition-colors"
            >
              查看源码
              <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>

      {/* 免责声明 */}
      <div className="text-center">
        <p className="text-[10px] text-zinc-400 dark:text-zinc-600 uppercase tracking-widest">
          非官方工具。与 Gryphline / HyperGryph 无关。
        </p>
      </div>
    </div>
  );
});

AboutPanel.displayName = 'AboutPanel';

export default AboutPanel;
