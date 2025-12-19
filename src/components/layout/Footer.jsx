import React from 'react';
import { Heart, Code, ExternalLink } from 'lucide-react';

/**
 * 全局页脚组件
 * 显示版权信息、制作者和项目链接
 */
const Footer = React.memo(() => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-8 py-6 border-t border-zinc-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-zinc-500">
          {/* 版权信息 */}
          <div className="flex items-center gap-1">
            <span>终末地抽卡分析器 v2.7.2</span>
            <span className="mx-2">|</span>
            <span>&copy; {currentYear}</span>
          </div>

          {/* 制作者信息 */}
          <div className="flex items-center gap-4">
            <a
              href="https://space.bilibili.com/14932613"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-pink-500 transition-colors"
            >
              <Heart size={12} className="text-pink-500" />
              <span>蘑菇菌__</span>
            </a>
            <a
              href="https://github.com/MoguJunn/endfield-gacha"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
            >
              <Code size={12} />
              <span>GitHub</span>
              <ExternalLink size={10} />
            </a>
          </div>

          {/* 免责声明 */}
          <div className="text-center md:text-right text-[10px] text-slate-400 dark:text-zinc-600">
            本工具与游戏官方无关 | 游戏内容版权归 Gryphline / HyperGryph 所有
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;
