import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, User } from 'lucide-react';
import confetti from 'canvas-confetti';
import { characterCache } from '../../utils/characterUtils';

const CountdownTimer = React.memo(function CountdownTimer({
  targetDate,
  title,
  subTitle,
  link,
  linkText,
  secondaryLink,
  secondaryLinkText,
  customEndedContent,
  size = 'normal',
  characterName = null,
}) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    ended: false,
  });
  const hasAutoConfettiFired = useRef(false);

  const calculateAndFormat = useCallback((target) => {
    const now = new Date().getTime();
    const tgt = new Date(target).getTime();
    const diff = tgt - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
    }

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      ended: false,
    };
  }, []);

  useEffect(() => {
    const updateTimers = () => {
      const newMainTime = calculateAndFormat(targetDate);
      setTimeLeft((prev) => {
        if (prev.seconds === newMainTime.seconds && prev.ended === newMainTime.ended) {
          return prev;
        }
        return newMainTime;
      });
    };

    updateTimers();
    const timer = setInterval(updateTimers, 1000);

    return () => clearInterval(timer);
  }, [targetDate, calculateAndFormat]);

  useEffect(() => {
    if (timeLeft.ended && !hasAutoConfettiFired.current && !customEndedContent) {
      hasAutoConfettiFired.current = true;
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
      });
    }
  }, [timeLeft.ended, customEndedContent]);

  const fireConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.7 },
    });
  }, []);

  const formatNum = (num) => String(num).padStart(2, '0');
  const isSmall = size === 'small';

  if (timeLeft.ended) {
    if (customEndedContent) {
      return customEndedContent;
    }

    return (
      <div
        className={`w-full bg-white dark:bg-black border border-zinc-200 dark:border-zinc-800 ${
          isSmall ? 'p-4' : 'p-8'
        } flex flex-col gap-4 items-center justify-center relative overflow-hidden`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,250,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,250,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

        <div
          className={`text-zinc-900 dark:text-endfield-yellow font-bold font-mono tracking-widest uppercase z-10 text-center animate-fade-in ${
            isSmall ? 'text-lg' : 'text-xl sm:text-2xl'
          }`}
        >
          协议已启动 // 欢迎来到塔罗斯II
        </div>

        <button
          onClick={fireConfetti}
          className={`z-10 bg-endfield-yellow text-black font-bold font-mono tracking-wider rounded-sm hover:bg-yellow-400 hover:shadow-[0_0_20px_rgba(255,250,0,0.4)] active:scale-95 transition-all flex items-center gap-3 group ${
            isSmall ? 'px-4 py-2 text-xs' : 'px-8 py-3'
          }`}
        >
          <span className="text-xl group-hover:rotate-12 transition-transform">🎉</span>
          <span>庆祝时刻</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`w-full bg-white dark:bg-black relative overflow-hidden border-y-2 border-endfield-yellow/80 sm:border-2 sm:border-endfield-yellow/20 ${
        isSmall ? 'rounded-none sm:rounded-sm h-full flex flex-col' : ''
      }`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,250,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,250,0,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

      {!isSmall && (
        <>
          <div className="hidden sm:block absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-endfield-yellow"></div>
          <div className="hidden sm:block absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-endfield-yellow"></div>
          <div className="hidden sm:block absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-endfield-yellow"></div>
          <div className="hidden sm:block absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-endfield-yellow"></div>
        </>
      )}

      <div
        className={`relative z-10 flex ${
          isSmall ? 'flex-col gap-3 p-4 flex-1' : 'flex-col md:flex-row items-stretch'
        }`}
      >
        <div
          className={`${
            isSmall
              ? 'border-b border-zinc-100 dark:border-zinc-800 pb-3'
              : 'flex-1 p-6 md:p-8 flex flex-col justify-between bg-gradient-to-r from-endfield-yellow/10 to-transparent border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800/50'
          }`}
        >
          <div>
            {!isSmall && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 bg-endfield-yellow animate-pulse shadow-[0_0_8px_rgba(255,250,0,0.8)]"></div>
                <span className="text-zinc-500 dark:text-endfield-yellow/80 font-mono text-[10px] tracking-[0.2em] uppercase">
                  系统倒计时
                </span>
              </div>
            )}
            <div className="flex items-center gap-4">
              {characterName && !isSmall && (() => {
                const charData = characterCache.searchByName(characterName, false);
                const avatarUrl = charData?.avatar_url;

                return (
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 to-pink-500 ring-2 ring-endfield-yellow shadow-[0_0_20px_rgba(255,250,0,0.3)]">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={characterName}
                        className="w-full h-full object-cover"
                        onError={(event) => {
                          event.target.style.display = 'none';
                          event.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-full h-full items-center justify-center text-white/80 ${
                        avatarUrl ? 'hidden' : 'flex'
                      }`}
                    >
                      <User size={32} />
                    </div>
                  </div>
                );
              })()}
              <div>
                <h2
                  className={`${
                    isSmall ? 'text-lg leading-tight' : 'text-3xl md:text-4xl'
                  } font-bold text-zinc-900 dark:text-white uppercase italic tracking-tighter mb-1`}
                >
                  {title}
                </h2>
                <p className="text-zinc-500 text-xs font-mono tracking-wide uppercase truncate">
                  {subTitle}
                </p>
              </div>
            </div>

            <div className={`${isSmall ? 'mt-3' : 'mt-6'} flex flex-wrap items-center gap-4`}>
              {link && (
                <a
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 self-start text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-endfield-yellow transition-colors group/link"
                >
                  <span className="border-b border-zinc-400 dark:border-zinc-600 group-hover/link:border-endfield-yellow pb-0.5">
                    {linkText}
                  </span>
                  <ArrowRight size={12} className="group-hover/link:translate-x-1 transition-transform" />
                </a>
              )}
              {secondaryLink && (
                <a
                  href={secondaryLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 self-start text-xs font-mono text-zinc-500 dark:text-zinc-400 hover:text-pink-400 transition-colors group/link2"
                >
                  <span className="border-b border-zinc-400 dark:border-zinc-600 group-hover/link2:border-pink-400 pb-0.5">
                    {secondaryLinkText}
                  </span>
                  <ArrowRight size={12} className="group-hover/link2:translate-x-1 transition-transform" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div
          className={`${
            isSmall
              ? 'flex justify-center gap-3 sm:gap-4 items-center flex-1 py-2'
              : 'flex-1 p-6 md:p-8 flex items-center justify-center md:justify-end gap-2 sm:gap-4 md:gap-6 bg-zinc-50/50 dark:bg-zinc-900/20 backdrop-blur-sm'
          }`}
        >
          {[
            { label: '天', value: timeLeft.days, highlight: false },
            { label: '时', value: timeLeft.hours, highlight: false },
            { label: '分', value: timeLeft.minutes, highlight: false },
            { label: '秒', value: timeLeft.seconds, highlight: true },
          ].map((item, index) => (
            <React.Fragment key={item.label}>
              {index > 0 && (
                <div
                  className={`${
                    isSmall ? 'text-3xl sm:text-4xl pb-3' : 'text-2xl sm:text-4xl pb-6'
                  } text-zinc-300 dark:text-zinc-800 font-light`}
                >
                  :
                </div>
              )}
              <div className="flex flex-col items-center relative group/time">
                <div className={item.highlight ? 'relative p-1 -m-1' : 'relative'}>
                  {item.highlight && (
                    <div className="absolute inset-0 bg-endfield-yellow/10 -skew-x-6 border border-endfield-yellow/20 opacity-100 sm:opacity-0 sm:group-hover/time:opacity-100 transition-opacity duration-300"></div>
                  )}
                  <div
                    className={`relative ${
                      isSmall ? 'text-5xl sm:text-6xl' : 'text-4xl sm:text-5xl md:text-6xl'
                    } font-bold ${
                      item.highlight
                        ? 'text-amber-500 dark:text-endfield-yellow'
                        : 'text-zinc-800 dark:text-white group-hover/time:text-endfield-yellow transition-colors duration-300'
                    } font-mono tracking-tighter leading-none`}
                  >
                    {formatNum(item.value)}
                  </div>
                  {!item.highlight && (
                    <div className="absolute -bottom-2 left-0 w-full h-0.5 bg-zinc-200 dark:bg-zinc-800 group-hover/time:bg-endfield-yellow transition-colors duration-300"></div>
                  )}
                </div>
                <span
                  className={`text-[10px] font-mono uppercase tracking-widest mt-2 ${
                    item.highlight
                      ? 'text-amber-500/70 dark:text-endfield-yellow/70'
                      : 'text-zinc-400 dark:text-zinc-600'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
});

export default CountdownTimer;
