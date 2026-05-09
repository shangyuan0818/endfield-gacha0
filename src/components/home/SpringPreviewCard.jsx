import React from 'react';
import { useI18n } from '../../i18n/index.js';

// SVG Bamboo Leaf Component
const BambooLeaf = ({ className }) => (
  <svg viewBox="0 0 100 100" className={`absolute fill-white pointer-events-none ${className}`}>
    <path d="M5,95 Q40,-10 95,5 Q40,40 5,95" />
  </svg>
);

const SpringPreviewCard = () => {
  const { isEnglish } = useI18n();
  const serifDisplayStyle = {
    fontFamily: '"Harmony Sans App", "Noto Serif SC", "Source Han Serif SC", serif',
  };

  const topoPattern = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E")`;

  const announcementsCN = [
    {
      title: '1. 月卡焕新与赠礼活动',
      desc: null,
      items: [
        '新版本开放后，月卡的每日奖励将追加【理智消耗许可】×4。',
        '「春晓时」版本前瞻特别节目播出之日至版本更新前领取的月卡每日奖励，将在新版开启首日补发对应【理智消耗许可】。',
        '在「全面测试」至「春晓时」版本更新前购买过月卡的管理员，将在新版本首日获得【理智消耗许可】×120补偿。',
        '「焕新月卡赠礼」活动：版本开启后至5月18日，每日登录可领取【嵌晶玉】×200、【应急理智加强剂】×1和【理智消耗许可】×4，最多可领30次（总计嵌晶玉×6000等）。',
      ]
    },
    {
      title: '2. 「辉光庆典」附加寻访开放',
      desc: '2026年5月14日开启。全部可能出现的6星干员为：莱万汀/洁尔佩塔/艾尔黛拉/骏卫。保底独立计算，80次必得6星干员。',
      items: [
        '每1次寻访或加急招募额外获得【保障配额】×1。',
        '累计寻访30次，额外获得10次加急招募（即1次免费十连，仅本次寻访生效）。',
        '累计寻访60次，额外获得【基础寻访凭证】×10。',
        '累计寻访120次，额外获得【流光庆时调用凭证】×1（自选当期6星）。',
        '每累计寻访240次，额外获得【流光庆时信物补给】×1（自选当期6星信物）。',
      ]
    }
  ];

  const announcementsEN = [
    {
      title: '1. Monthly Pass Revamp & Tribute Event',
      desc: null,
      items: [
        'After the new version goes live, Monthly Pass daily rewards will include an additional [Sanity Usage Permit]×4.',
        'From the date of the [At the Wake of Spring] Version Preview Special Program broadcast (Apr. 11) until the version update and maintenance, Endministrators who claim their Monthly Pass daily rewards during this period will be sent the corresponding number of [Sanity Usage Permits] via in-game mail on the first day of the new version.',
        'For those who purchased a Monthly Pass before the [At the Wake of Spring] version update and maintenance, a one-time grant of [Sanity Usage Permit]×120 will be sent via in-game mail on the first day of the new version.',
        'Additionally, the [At the Wake of Spring] version will feature a special [Pristine Monthly Pass Tribute] event. From the launch of the [At the Wake of Spring] version until May 18, 2026 at 04:00 (server time), you can log in daily to claim [Oroberyl]×200, [Emergency Sanity Booster]×1, and [Sanity Usage Permit]×4.',
      ]
    },
    {
      title: '2. [Fest of Brilliance] Special Headhunting Open',
      desc: 'The [Fest of Brilliance] Special Headhunting will begin on May 14, 2026. 6★ operators that may appear in this Special Headhunting include: Laevatain/Gilberta/Ardelia/Pogranichnik. A 5★ or better operator is guaranteed within 10 headhunting attempts; a 6★ operator is guaranteed within 80 headhunting attempts.',
      items: [
        'Each headhunting or Urgent Recruitment attempt gives a bonus [Bond Quota]×1.',
        'After performing 30 headhunting attempts, you will receive 10 bonus Urgent Recruitment attempts (which count as 1 free 10x headhunting attempt).',
        'Perform a total of 60 headhunting attempts to additionally receive [Basic HH Permit]×10.',
        'Perform a total of 120 headhunting attempts to receive a bonus [Shimmering Moment Designation Permit]×1.',
        'For every 240 headhunting attempts performed, you will receive a bonus [Shimmering Moment Token Supply]×1.',
      ]
    }
  ];

  const announcements = isEnglish ? announcementsEN : announcementsCN;

  return (
    <div 
      className="relative w-full min-h-[300px] overflow-hidden shadow-2xl rounded-sm group flex"
      style={{ background: 'radial-gradient(circle at 20% 20%, #f0fbd8 0%, #c3e870 40%, #93cc3b 80%, #6ba01f 100%)' }}
    >
      {/* Background Texture Layers */}
      <div className="absolute inset-0 opacity-40 mix-blend-overlay" style={{ backgroundImage: topoPattern }}></div>
      <div className="absolute inset-0 mix-blend-overlay" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      
      {/* Decorative Bamboo/Slashes */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[120%] bg-white/20 -rotate-12 blur-md mix-blend-overlay pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[30%] h-[80%] bg-white/30 rotate-45 blur-sm mix-blend-overlay pointer-events-none"></div>

      {/* Bamboo Leaves */}
      <BambooLeaf className="w-64 h-64 -top-10 -left-10 rotate-[15deg] opacity-70" />
      <BambooLeaf className="w-48 h-48 top-10 left-32 rotate-[45deg] opacity-50" />
      <BambooLeaf className="w-80 h-80 -bottom-20 -left-20 rotate-[-30deg] opacity-60" />
      <BambooLeaf className="w-56 h-56 top-0 -right-10 rotate-[120deg] opacity-40" />
      <BambooLeaf className="w-96 h-96 -bottom-32 -right-20 rotate-[160deg] opacity-50" />
      <BambooLeaf className="w-40 h-40 bottom-10 right-32 rotate-[80deg] opacity-30" />

      {/* Main Content Wrapper */}
      <div className="relative inset-0 flex flex-col md:flex-row items-center justify-start gap-4 md:gap-2 lg:gap-8 px-4 py-6 z-20 w-full">
          
          {/* Left Side: Title */}
          <div className="flex flex-col items-start relative origin-left shrink-0 scale-75 xl:scale-90 -mr-16 md:-mr-12 lg:-mr-8 xl:-mr-4">
              {/* Red Stamp */}
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-[#e02424] flex items-center justify-center text-[#e02424] text-xs font-bold rotate-[-15deg] opacity-80 z-30 bg-[#c3e870]/20 backdrop-blur-sm" style={serifDisplayStyle}>
                  武陵
              </div>

              <div className="text-[#1a1f16] font-mono text-sm tracking-[0.2em] mb-1 font-bold whitespace-nowrap">AT THE WAKE OF SPRING</div>
              
              <div className="relative border-4 border-[#1a1f16] px-6 py-2 bg-white/10 backdrop-blur-[2px] shadow-lg">
                  {/* Green slash through text effect */}
                  <div className="absolute top-0 right-1/4 w-12 h-full bg-[#aedc5f] mix-blend-multiply skew-x-12 opacity-80"></div>
                  <div className="absolute bottom-0 left-1/4 w-8 h-full bg-[#7cb324] mix-blend-multiply -skew-x-12 opacity-60"></div>
                  
                  <h1 className={`${isEnglish ? 'text-3xl sm:text-4xl' : 'text-5xl sm:text-6xl'} font-black text-[#1a1f16] tracking-tighter`} style={serifDisplayStyle}>
                      {isEnglish ? (
                        <>
                          WAKE OF<br />SPRING
                        </>
                      ) : '春晓时'}
                  </h1>
              </div>
              
              <div className="flex items-center gap-2 mt-4 text-[#1a1f16] font-mono text-[10px] font-bold tracking-[0.3em] whitespace-nowrap">
                  <div className="w-1.5 h-1.5 bg-[#1a1f16]"></div>
                  NEW VERSION CHANGES
                  <div className="w-1.5 h-1.5 bg-[#1a1f16]"></div>
              </div>
          </div>

          {/* Divider Line (Visible on md+) */}
          <div className="hidden md:block w-[2px] self-stretch my-4 bg-[#e02424] opacity-80 shrink-0 shadow-[0_0_8px_rgba(224,36,36,0.6)]"></div>

          {/* Right Side: Announcements */}
          <div className="flex flex-col flex-1 h-full min-h-[220px] max-h-[300px] overflow-y-auto pr-2 overflow-x-hidden text-[#1a1f16] bg-white/40 backdrop-blur-md border border-white/60 p-4 rounded-sm shadow-[0_8px_32px_rgba(164,216,82,0.4)]">
              <div className="flex justify-between items-end mb-3 border-b-2 border-[#1a1f16]/30 pb-1 w-full gap-4">
                  <div className="text-lg font-bold text-[#1a1f16] tracking-widest whitespace-nowrap drop-shadow-sm" style={serifDisplayStyle}>
                      {isEnglish ? 'VERSION HIGHLIGHTS' : '新版本变化'}
                  </div>
              </div>
              
              <div className="space-y-4">
                {announcements.map((block, i) => (
                  <div key={i} className="text-sm">
                    <h3 className="font-bold text-[#1a1f16] mb-1 text-sm tracking-wide">{block.title}</h3>
                    {block.desc && (
                      <p className="text-[#1a1f16]/80 text-xs mb-2 leading-relaxed">{block.desc}</p>
                    )}
                    <ul className="space-y-1.5 pl-1">
                      {block.items.map((item, j) => (
                        <li key={j} className="flex gap-2 text-xs text-[#1a1f16]/90 leading-relaxed items-start">
                          <span className="shrink-0 mt-1.5 w-1 h-1 bg-[#e02424] rounded-full"></span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
          </div>
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(26, 31, 22, 0.3);
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default SpringPreviewCard;
