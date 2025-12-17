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
  ExternalLink
} from 'lucide-react';

/**
 * 关于面板组件
 */
const AboutPanel = React.memo(() => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 dark:from-zinc-900 dark:to-black rounded-none p-8 text-white shadow-lg relative overflow-hidden border-l-4 border-endfield-yellow">
        <div className="absolute top-0 right-0 opacity-10">
          <Sparkles size={200} />
        </div>
        <div className="relative z-10">
          <h2 className="text-3xl font-bold flex items-center gap-3 mb-2">
            <BarChart3 size={32} />
            终末地抽卡分析器
          </h2>
          <p className="text-zinc-300">记录你的每一次命运邂逅</p>
          <div className="mt-4 text-sm text-zinc-400">
            版本 2.6.1 | 2025
          </div>
        </div>
      </div>

      {/* 作者信息 */}
      <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center gap-2">
          <Heart size={20} className="text-red-500" />
          <h3 className="font-bold text-slate-700 dark:text-zinc-300">制作团队</h3>
        </div>
        <div className="p-6">
          {/* 主要作者 */}
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20 rounded-none border border-pink-100 dark:border-pink-900/50 mb-4">
            <img
              src="/avatar.png"
              alt="蘑菇菌__"
              className="w-16 h-16 rounded-sm object-cover shadow-lg"
            />
            <div className="flex-1">
              <h4 className="text-lg font-bold text-slate-800 dark:text-zinc-100">蘑菇菌__</h4>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mb-2">项目发起人 & 产品设计</p>
              <a
                href="https://space.bilibili.com/14932613"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-sm font-medium rounded-none transition-colors shadow-sm"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.659.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.853-2.747c.267-.249.573-.373.92-.373.347 0 .662.151.929.4.267.249.391.551.391.907 0 .355-.124.657-.373.906L17.813 4.653zM5.333 7.24c-.746.018-1.373.276-1.88.773-.506.498-.769 1.13-.786 1.894v7.52c.017.764.28 1.395.786 1.893.507.498 1.134.756 1.88.773h13.334c.746-.017 1.373-.275 1.88-.773.506-.498.769-1.129.786-1.893v-7.52c-.017-.765-.28-1.396-.786-1.894-.507-.497-1.134-.755-1.88-.773H5.333zM8 11.107c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373zm8 0c.373 0 .684.124.933.373.25.249.383.569.4.96v1.173c-.017.391-.15.711-.4.96-.249.25-.56.374-.933.374s-.684-.125-.933-.374c-.25-.249-.383-.569-.4-.96V12.44c.017-.391.15-.711.4-.96.249-.249.56-.373.933-.373z"/>
                </svg>
                访问 B站主页
                <ExternalLink size={14} />
              </a>
            </div>
          </div>

          {/* AI 助手 */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
            <p className="text-sm text-slate-500 dark:text-zinc-500 mb-3 flex items-center gap-2">
              <Code size={16} />
              AI 开发助手
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-none border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-amber-500 rounded-none flex items-center justify-center text-white text-xs font-bold">
                    C
                  </div>
                  <span className="font-bold text-slate-700 dark:text-zinc-300">Claude</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-500">Anthropic Claude Opus 4.5</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">后端逻辑 & 数据处理 & 前端优化</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-none border border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-none flex items-center justify-center text-white text-xs font-bold">
                    G
                  </div>
                  <span className="font-bold text-slate-700 dark:text-zinc-300">Gemini</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-500">Google Gemini 3 Pro</p>
                <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">前端界面设计</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 功能特性 */}
      <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center gap-2">
          <Sparkles size={20} className="text-amber-500" />
          <h3 className="font-bold text-slate-700 dark:text-zinc-300">功能特性</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: Star, label: '多卡池管理', desc: '限定/常驻/武器池' },
              { icon: Calculator, label: '保底计算', desc: '实时垫刀追踪' },
              { icon: BarChart3, label: '数据分析', desc: '概率分布图表' },
              { icon: Cloud, label: '云端同步', desc: '多设备数据共享' },
              { icon: Download, label: '导入导出', desc: 'JSON/CSV 格式' },
              { icon: Shield, label: '权限管理', desc: '多角色权限控制' },
            ].map((feature, idx) => (
              <div key={idx} className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-none">
                <feature.icon size={20} className="text-indigo-500 mb-2" />
                <h4 className="font-medium text-slate-700 dark:text-zinc-300 text-sm">{feature.label}</h4>
                <p className="text-xs text-slate-400 dark:text-zinc-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 开源项目 */}
      <div className="bg-white dark:bg-zinc-900 rounded-none shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center gap-2">
          <Code size={20} className="text-slate-600 dark:text-zinc-400" />
          <h3 className="font-bold text-slate-700 dark:text-zinc-300">开源项目</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-800 to-slate-900 rounded-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white dark:bg-zinc-900 rounded-none flex items-center justify-center">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="#1f2937">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </div>
              <div>
                <h4 className="font-bold text-white">GitHub 仓库</h4>
                <p className="text-sm text-slate-400 dark:text-zinc-500">欢迎 Star ⭐ 和提交 Issue</p>
              </div>
            </div>
            <a
              href="https://github.com/MoguJunn/endfield-gacha"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 hover:bg-slate-100 text-slate-800 dark:text-zinc-100 text-sm font-medium rounded-none transition-colors shadow-sm"
            >
              查看源码
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* 免责声明 */}
      <div className="bg-slate-50 dark:bg-zinc-950 rounded-none border border-zinc-200 dark:border-zinc-800 p-4">
        <p className="text-xs text-slate-500 dark:text-zinc-500 text-center">
          本工具仅供个人抽卡记录使用，与游戏官方无关。
          <br />
          游戏内容版权归 Gryphline / HyperGryph 所有。
        </p>
      </div>
    </div>
  );
});

AboutPanel.displayName = 'AboutPanel';

export default AboutPanel;
