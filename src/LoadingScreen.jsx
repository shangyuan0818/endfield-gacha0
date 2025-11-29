import React, { useEffect, useState } from 'react';

const LoadingScreen = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState('INITIALIZING');

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(onComplete, 500); // Delay before unmounting
          return 100;
        }
        // Random increments for "hacking" feel
        return prev + Math.floor(Math.random() * 10) + 1;
      });
    }, 100);

    // Random text scrambling
    const texts = ['INITIALIZING', 'CONNECTING TO ENDFIELD', 'SYNCING ORACLE', 'DECRYPTING', 'LOADING ASSETS'];
    const textInterval = setInterval(() => {
      setText(texts[Math.floor(Math.random() * texts.length)]);
    }, 450);

    return () => {
      clearInterval(interval);
      clearInterval(textInterval);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center font-mono text-endfield-yellow overflow-hidden">
      {/* Background Grid Effect */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ 
             backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
             backgroundSize: '40px 40px'
           }} 
      />

      {/* Central Logo Placeholder */}
      <div className="relative z-10 mb-12 animate-pulse">
        <img 
          src="/endfield-logo.svg" 
          alt="Endfield Logo" 
          className="w-32 h-auto invert"
        />
      </div>

      {/* Progress Bar Container */}
      <div className="w-64 h-1 bg-gray-800 relative overflow-hidden">
        <div 
          className="h-full bg-endfield-yellow transition-all duration-100 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      {/* Technical Text */}
      <div className="mt-4 flex flex-col items-center space-y-1">
        <div className="text-2xl font-bold tracking-widest text-endfield-yellow">{Math.min(progress, 100)}%</div>
        <div className="text-xs tracking-[0.2em] opacity-80 text-endfield-yellow">{text}</div>
      </div>

      {/* Decorative Corners */}
      <div className="absolute top-8 left-8 w-16 h-16 border-t-2 border-l-2 border-endfield-yellow/50" />
      <div className="absolute top-8 right-8 w-16 h-16 border-t-2 border-r-2 border-endfield-yellow/50" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-b-2 border-l-2 border-endfield-yellow/50" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-b-2 border-r-2 border-endfield-yellow/50" />

      {/* Scanline */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-yellow-400/5 to-transparent h-4 animate-scan" />
      
      <style>{`
        @keyframes scan {
          0% { top: -10%; }
          100% { top: 110%; }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;