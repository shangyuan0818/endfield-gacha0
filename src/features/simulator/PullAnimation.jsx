import React from 'react';

const PullAnimation = () => {
  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex items-center justify-center overflow-hidden">
       {/* 中心聚合动画 */}
       <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-1 bg-endfield-yellow shadow-[0_0_100px_50px_rgba(255,250,0,0.8)] animate-ping" />
       </div>
       
       {/* 扫描线 */}
       <div className="absolute inset-0 bg-gradient-to-b from-transparent via-endfield-yellow/20 to-transparent h-[20%] animate-scan-fast" />

       {/* 文字闪烁 */}
       <div className="relative z-20 text-center">
          <h2 className="text-6xl font-black text-white italic tracking-tighter animate-pulse mb-4">
            正在连接...
          </h2>
          <div className="flex justify-center gap-1">
             <div className="w-20 h-1 bg-endfield-yellow animate-[width_1s_ease-in-out_infinite]" />
             <div className="w-4 h-1 bg-white animate-[width_1s_ease-in-out_infinite_0.2s]" />
             <div className="w-2 h-1 bg-zinc-500 animate-[width_1s_ease-in-out_infinite_0.4s]" />
          </div>
       </div>

       <style jsx>{`
         @keyframes scan-fast {
           0% { top: -20%; opacity: 0; }
           50% { opacity: 1; }
           100% { top: 120%; opacity: 0; }
         }
         .animate-scan-fast {
            animation: scan-fast 1.5s linear infinite;
         }
       `}</style>
    </div>
  );
};

export default PullAnimation;
