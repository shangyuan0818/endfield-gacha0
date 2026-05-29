import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../i18n/index.js';

const PREVIEW_PV_URL = 'https://www.bilibili.com/video/BV1hzGt6YEb8';
const PREVIEW_OPUS_URL = 'https://www.bilibili.com/opus/1205230628579049477';

const PREVIEW_POINTS_ZH = [
  '集成工业新增备用电源与事务总览，电力耗尽时可临时托底，并集中查看物流、仓储与跳转入口。',
  '日常任务减负：理智类任务活跃度提升，击败敌人要求下调，并新增帝江号收集与采购类任务。',
  '装备精锻加入一键填充，武器管理支持批量分解和 5 星武器一键锁定/解锁。',
  '屏幕外攻击、锁定目标切换与好友拜访返回链路继续优化，后续还将补充拍照、剧情释义和俯瞰模式改进。'
];

const PREVIEW_POINTS_EN = [
  'Integrated industry adds Backup Power and an Operations Overview for power recovery, logistics, storage, and quick jumps.',
  'Daily tasks are lighter: some stamina tasks grant more activity, enemy kill requirements drop, and Dijiang collection or procurement tasks are added.',
  'Gear refinement gains one-tap fill, while weapon management adds batch dismantle and one-tap lock or unlock for 5-star weapons.',
  'Combat warnings, target switching, and returning from friend visits are improved, with photo, glossary, and top-down interaction upgrades previewed next.'
];

export default function HeirloomsPreviewCard() {
  const { isEnglish } = useI18n();
  const serifDisplayStyle = {
    fontFamily: '"Harmony Sans App", "Noto Serif SC", "Source Han Serif SC", serif',
  };
  const previewPoints = isEnglish ? PREVIEW_POINTS_EN : PREVIEW_POINTS_ZH;

  return (
    <section className="relative min-h-[300px] overflow-hidden border border-zinc-200 bg-[#10100f] text-white shadow-2xl dark:border-white/10">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(204,168,110,0.26),transparent_30%),linear-gradient(135deg,rgba(200,16,26,0.18),transparent_36%),linear-gradient(180deg,#171716_0%,#0b0b0b_100%)]" />
        <div className="absolute inset-x-0 top-[42%] h-10 bg-gradient-to-r from-transparent via-[#c8101a]/50 to-transparent" />
        <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.28) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      </div>

      <div className="relative z-10 grid min-h-[300px] grid-cols-1 md:grid-cols-[3fr_7fr]">
        <div className="flex min-h-[180px] flex-col justify-between border-b border-white/10 p-5 md:min-h-0 md:border-b-0 md:border-r md:p-6">
          <div>
            <div className="mb-4 inline-flex border border-[#cca86e]/50 px-2 py-1 text-[10px] font-bold tracking-[0.24em] text-[#cca86e]">
              TALOS-II
            </div>
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-white/50">
              {isEnglish ? 'Next Version' : '下个版本'}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[0.08em] text-white md:text-4xl" style={serifDisplayStyle}>
              {isEnglish ? 'Lost Heirlooms' : '寻遗散记'}
            </h2>
            <p className="mt-2 text-[10px] uppercase tracking-[0.24em] text-white/45">
              Sketches of Lost Heirlooms
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href={PREVIEW_PV_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-[#c8101a]/70 bg-[#c8101a]/90 px-3 py-2 text-xs font-bold tracking-widest text-white shadow-[0_0_24px_rgba(200,16,26,0.32)] transition-colors hover:bg-[#e0202c] focus:outline-none focus:ring-2 focus:ring-[#cca86e]"
            >
              <ExternalLink size={14} />
              {isEnglish ? 'PV' : '前瞻PV'}
            </a>
            <a
              href={PREVIEW_OPUS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-[#cca86e]/60 bg-white/8 px-3 py-2 text-xs font-bold tracking-widest text-[#f3d19a] transition-colors hover:border-[#cca86e] hover:bg-white/14 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#cca86e]"
            >
              <ExternalLink size={14} />
              {isEnglish ? 'Post' : '前瞻动态'}
            </a>
          </div>
        </div>

        <div className="flex flex-col justify-center p-5 md:p-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/15 pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#cca86e]">
                Version Update
              </p>
              <h3 className="mt-1 text-xl font-black tracking-wide text-white md:text-2xl" style={serifDisplayStyle}>
                {isEnglish ? 'Update Summary' : '版本部分更新内容'}
              </h3>
            </div>
            <span className="border border-white/15 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-white/50">
              Preview
            </span>
          </div>

          <ul className="space-y-3">
            {previewPoints.map((item, index) => (
              <li key={item} className="grid grid-cols-[auto_1fr] gap-3 text-sm leading-relaxed text-white/78">
                <span className="mt-0.5 font-mono text-xs font-bold text-[#cca86e]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
