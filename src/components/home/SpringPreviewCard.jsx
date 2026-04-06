import React, { useState, useEffect } from 'react';

// SVG Bamboo Leaf Component
const BambooLeaf = ({ className }) => (
  <svg viewBox="0 0 100 100" className={`absolute fill-white pointer-events-none ${className}`}>
    <path d="M5,95 Q40,-10 95,5 Q40,40 5,95" />
  </svg>
);

const SpringPreviewCard = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetDate = new Date('2026-04-11T19:30:00+08:00').getTime();
    
    const timer = setInterval(() => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            clearInterval(timer);
            return;
        }

        setTimeLeft({
            days: Math.floor(distance / (1000 * 60 * 60 * 24)),
            hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const pad = (num) => String(num).padStart(2, '0');

  const topoPattern = `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='0.15' fill-rule='evenodd'/%3E%3C/svg%3E")`;

  return (
    <>
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Teko:wght@600&family=Noto+Serif+SC:wght@700;900&display=swap');
    `}</style>
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
      <div className="relative inset-0 flex flex-row items-center justify-center gap-4 sm:gap-8 px-4 py-8 z-20 w-full">
          
          {/* Left Side: Title */}
          <div className="flex flex-col items-start relative scale-90 sm:scale-100 origin-right">
              {/* Red Stamp */}
              <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-2 border-[#e02424] flex items-center justify-center text-[#e02424] text-xs font-bold rotate-[-15deg] opacity-80 z-30 bg-[#c3e870]/20 backdrop-blur-sm" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                  武陵
              </div>

              <div className="text-[#1a1f16] font-mono text-sm tracking-[0.2em] mb-1 font-bold whitespace-nowrap">AT THE WAKE OF SPRING</div>
              
              <div className="relative border-4 border-[#1a1f16] px-6 py-2 bg-white/10 backdrop-blur-[2px] shadow-lg">
                  {/* Green slash through text effect */}
                  <div className="absolute top-0 right-1/4 w-12 h-full bg-[#aedc5f] mix-blend-multiply skew-x-12 opacity-80"></div>
                  <div className="absolute bottom-0 left-1/4 w-8 h-full bg-[#7cb324] mix-blend-multiply -skew-x-12 opacity-60"></div>
                  
                  <h1 className="text-6xl sm:text-7xl font-black text-[#1a1f16] tracking-tighter" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                      春晓时
                  </h1>
              </div>
              
              <div className="flex items-center gap-2 mt-4 text-[#1a1f16] font-mono text-[10px] font-bold tracking-[0.3em] whitespace-nowrap">
                  <div className="w-1.5 h-1.5 bg-[#1a1f16]"></div>
                  AT THE WAKE OF SPRING
                  <div className="w-1.5 h-1.5 bg-[#1a1f16]"></div>
              </div>
          </div>

          {/* Divider Line */}
          <div className="w-[2px] h-24 bg-[#e02424] opacity-80 shrink-0 shadow-[0_0_8px_rgba(224,36,36,0.6)]"></div>

          {/* Right Side: Countdown */}
          <div className="flex flex-col scale-90 sm:scale-100 origin-left">
              <div className="flex justify-between items-end mb-2 border-b-2 border-[#1a1f16]/30 pb-1 w-full gap-4">
                  <div className="text-xl font-bold text-[#1a1f16] tracking-widest whitespace-nowrap drop-shadow-sm" style={{ fontFamily: '"Noto Serif SC", serif' }}>前瞻特别节目</div>
                  <div className="text-right">
                      <div className="text-[10px] text-[#1a1f16]/80 font-bold whitespace-nowrap">开启时间</div>
                      <div className="text-sm font-black text-[#1a1f16] whitespace-nowrap">4月11日</div>
                  </div>
              </div>

              <div className="relative bg-white/40 backdrop-blur-md border border-white/60 px-6 py-3 shadow-[0_8px_32px_rgba(164,216,82,0.4)] mt-2">
                  {/* Tech decorations */}
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full border-2 border-[#e02424]"></div>
                  <div className="absolute -bottom-3 left-2 flex gap-1 items-center bg-white/50 backdrop-blur-sm p-1 rounded-sm">
                      <div className="w-3 h-3 border border-[#1a1f16]/40"></div>
                      <div className="w-3 h-3 border border-[#1a1f16]/40 bg-white"></div>
                      <div className="w-4 h-4 border border-[#e02424] flex items-center justify-center text-[8px] font-bold text-[#e02424] bg-white">园</div>
                  </div>
                  <div className="absolute -bottom-2 right-4 flex items-center gap-1">
                      <div className="w-12 h-[2px] bg-[#1a1f16]/30"></div>
                      <div className="w-2 h-2 rounded-full border-2 border-[#e02424]"></div>
                      <div className="w-4 h-[2px] bg-[#1a1f16]/30"></div>
                  </div>

                  {/* Numbers */}
                  <div className="flex items-baseline gap-0.5 sm:gap-1 text-4xl sm:text-5xl font-black text-[#1a1f16] tracking-tighter tabular-nums" style={{ fontFamily: '"Noto Serif SC", serif' }}>
                      <span className="min-w-[1em] text-center inline-block" style={{ textShadow: '2px 2px 0px rgba(162, 213, 78, 0.5), -1px -1px 0px rgba(255, 255, 255, 0.8)' }}>
                          {timeLeft.days}
                      </span>
                      <span className="text-base sm:text-lg text-[#7cb324] font-black tracking-widest relative -top-0.5 pr-0.5" style={{ textShadow: 'none', fontFamily: '"Noto Serif SC", serif' }}>天</span>
                      
                      <span className="min-w-[1.2em] text-center inline-block" style={{ textShadow: '2px 2px 0px rgba(162, 213, 78, 0.5), -1px -1px 0px rgba(255, 255, 255, 0.8)' }}>
                          {pad(timeLeft.hours)}
                      </span>
                      <span className="text-base sm:text-lg text-[#7cb324] font-black tracking-widest relative -top-0.5" style={{ textShadow: 'none', fontFamily: '"Noto Serif SC", serif' }}>时</span>
                      
                      <span className="text-xl sm:text-2xl text-[#7cb324] animate-pulse relative -top-1 sm:-top-2 drop-shadow-md mx-0.5" aria-hidden="true">:</span>
                      
                      <span className="min-w-[1.2em] text-center inline-block" style={{ textShadow: '2px 2px 0px rgba(162, 213, 78, 0.5), -1px -1px 0px rgba(255, 255, 255, 0.8)' }}>
                          {pad(timeLeft.minutes)}
                      </span>
                      <span className="text-base sm:text-lg text-[#7cb324] font-black tracking-widest relative -top-0.5" style={{ textShadow: 'none', fontFamily: '"Noto Serif SC", serif' }}>分</span>
                      
                      <span className="min-w-[1.2em] text-center inline-block text-2xl sm:text-3xl text-[#1a1f16]/60 ml-1" style={{ textShadow: 'none' }}>
                          {pad(timeLeft.seconds)}
                      </span>
                  </div>
              </div>
          </div>
      </div>

      {/* Bottom Small Logo */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-80 z-10">
          <div className="flex gap-1 mb-1">
              <div className="w-1.5 h-1.5 bg-white rotate-45 opacity-60"></div>
              <div className="w-2 h-2 bg-white rotate-45"></div>
              <div className="w-1.5 h-1.5 bg-white rotate-45 opacity-60"></div>
          </div>
          <div className="text-[8px] font-mono font-bold tracking-[0.2em] text-[#1a1f16] drop-shadow-sm">ARKNIGHTS: ENDFIELD</div>
          <div className="mt-1 w-3 h-3 border border-[#e02424] text-[#e02424] text-[6px] flex items-center justify-center bg-white/50 backdrop-blur-sm" style={{ fontFamily: '"Noto Serif SC", serif' }}>璧</div>
      </div>

      {/* Action Button Overlay (Hover State) */}
      <a href="https://live.bilibili.com/1921300321" target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[#1a1f16]/40 backdrop-blur-sm">
          <div className="px-8 py-4 bg-[#e2f5b8] border-2 border-[#7cb324] text-[#7cb324] font-bold font-mono tracking-widest text-xl hover:bg-white hover:scale-105 transition-all shadow-[0_0_40px_rgba(164,216,82,0.8)] flex items-center gap-3">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              前往直播间
          </div>
      </a>
    </div>
    </>
  );
};

export default SpringPreviewCard;