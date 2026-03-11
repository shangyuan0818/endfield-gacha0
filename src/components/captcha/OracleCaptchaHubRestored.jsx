import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowUpRight, Loader2, RefreshCw } from 'lucide-react';
import MinecraftCaptcha from '../MinecraftCaptcha';
import TerminalPowCaptcha from './TerminalPowCaptcha';
import EnhancedPuzzleCaptcha from './EnhancedPuzzleCaptchaRestored';
import { fetchWithTimeout } from '../../services/supabaseRequest';
import { buildPlayerUrl, expandPuzzle } from './puzzleUtils';

const CAPTCHA_MODES = [
  {
    id: 'puzzle',
    label: '拼图',
    shortLabel: 'PZ',
    detail: 'SHARED SIMPLE GRID',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="1.5" />
        <path d="M8 3v18M16 3v18M3 8h18M3 16h18" />
      </svg>
    ),
  },
  {
    id: 'minecraft',
    label: 'MC 合成',
    shortLabel: 'MC',
    detail: 'CRAFTING BACKUP',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
  },
  {
    id: 'terminal',
    label: '终端',
    shortLabel: 'POW',
    detail: 'TERMINAL RESERVE',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M4 5h16v14H4z" />
        <path d="M8 10l2 2-2 2M12.5 16H16" />
      </svg>
    ),
  },
];

const CAPTCHA_PUZZLE_READ_TIMEOUT_MS = 10000;

function getInitialMode() {
  const savedMode = localStorage.getItem('captchaModePreference');
  return CAPTCHA_MODES.some(({ id }) => id === savedMode) ? savedMode : 'puzzle';
}

function pickRandomPuzzle(rows, currentId) {
  if (!rows.length) return null;
  if (rows.length === 1) return rows[0];
  const candidates = currentId ? rows.filter((row) => row.id !== currentId) : rows;
  const pool = candidates.length ? candidates : rows;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getPuzzleErrorMessage(error) {
  const detail = error instanceof Error ? error.message : '未知错误';
  if (detail.includes('没有可用的简单拼图题目')) return '共享题库中暂无“已审核 + 简单”题目，已自动切换到终端备用验证。';
  if (detail.includes('Supabase 未配置')) return '主站未读取到 Supabase 配置，拼图题库当前不可用。';
  if (detail.toLowerCase().includes('timed out')) return '拼图题库请求超时，已切换到备用验证。你可以稍后再重试拼图模式。';
  return `拼图题库加载失败：${detail}`;
}

function withHardTimeout(promise, label, timeoutMs) {
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

async function loadSharedPuzzlePool() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase 未配置');

  const requestUrl = new URL('/rest/v1/puzzles', supabaseUrl);
  requestUrl.searchParams.set('select', 'id,author,data,difficulty,status');
  requestUrl.searchParams.set('status', 'eq.approved');
  requestUrl.searchParams.set('difficulty', 'eq.1');
  requestUrl.searchParams.set('order', 'created_at.desc');
  requestUrl.searchParams.set('limit', '120');

  const response = await withHardTimeout(
    fetchWithTimeout(
      requestUrl.toString(),
      {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Accept: 'application/json',
        },
      },
      {
        label: 'captcha puzzle pool read',
        timeoutMs: CAPTCHA_PUZZLE_READ_TIMEOUT_MS,
        retries: 0,
      },
    ),
    'captcha puzzle pool read',
    CAPTCHA_PUZZLE_READ_TIMEOUT_MS,
  );

  if (!response.ok) throw new Error(`Supabase REST ${response.status}`);
  const data = await response.json();

  return (data ?? []).map((row) => ({
    id: row.id,
    author: row.author || '',
    difficulty: row.difficulty || 1,
    puzzle: expandPuzzle(row.data),
  }));
}

function LoadingPanel({ message }) {
  return (
    <div className="min-h-[320px] flex items-center justify-center border border-zinc-800 bg-black/70 px-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="h-7 w-7 animate-spin text-endfield-yellow" />
        <p className="font-mono text-sm tracking-[0.22em] text-endfield-yellow uppercase">{message}</p>
        <p className="text-xs text-zinc-500">同步共享拼图题库中...</p>
      </div>
    </div>
  );
}

export default function OracleCaptchaHubRestored({ onVerified, isMobile = false }) {
  const [preferredMode, setPreferredMode] = useState(getInitialMode);
  const [activeMode, setActiveMode] = useState(getInitialMode);
  const [notice, setNotice] = useState(null);
  const [puzzleRows, setPuzzleRows] = useState([]);
  const [currentPuzzle, setCurrentPuzzle] = useState(null);
  const [puzzleVersion, setPuzzleVersion] = useState(0);
  const [puzzleLoading, setPuzzleLoading] = useState(false);
  const bootstrapRequestRef = useRef(0);
  const playerBaseUrl = import.meta.env.VITE_PUZZLE_PLAYER_URL?.trim() || '';

  useEffect(() => {
    if (activeMode !== 'puzzle' || currentPuzzle) return undefined;

    const requestId = bootstrapRequestRef.current + 1;
    bootstrapRequestRef.current = requestId;
    let disposed = false;

    async function bootstrapPuzzle() {
      setPuzzleLoading(true);
      try {
        const rows = await loadSharedPuzzlePool();
        if (disposed || bootstrapRequestRef.current !== requestId) return;
        if (!rows.length) throw new Error('没有可用的简单拼图题目');
        setPuzzleRows(rows);
        setPuzzleLoading(false);
        setCurrentPuzzle(pickRandomPuzzle(rows, null));
        setPuzzleVersion((previousVersion) => previousVersion + 1);
        setNotice(null);
      } catch (error) {
        if (disposed || bootstrapRequestRef.current !== requestId) return;
        setPuzzleLoading(false);
        setCurrentPuzzle(null);
        setNotice({ tone: 'warning', source: 'puzzle', message: getPuzzleErrorMessage(error) });
        setActiveMode('terminal');
      }
    }

    void bootstrapPuzzle();
    return () => {
      disposed = true;
    };
  }, [activeMode, currentPuzzle]);

  const persistMode = (nextMode) => {
    setPreferredMode(nextMode);
    localStorage.setItem('captchaModePreference', nextMode);
  };

  const handleModeSelect = (nextMode) => {
    persistMode(nextMode);
    setActiveMode(nextMode);
    setNotice(null);
  };

  const handlePuzzleRetry = async (forceRemote = false) => {
    if (puzzleLoading) return;
    setPuzzleLoading(true);
    setNotice(null);

    try {
      const rows = forceRemote || !puzzleRows.length ? await loadSharedPuzzlePool() : puzzleRows;
      if (!rows.length) throw new Error('没有可用的简单拼图题目');
      setPuzzleRows(rows);
      setCurrentPuzzle((previousPuzzle) => pickRandomPuzzle(rows, previousPuzzle?.id));
      setPuzzleVersion((previousVersion) => previousVersion + 1);
      setActiveMode('puzzle');
    } catch (error) {
      setCurrentPuzzle(null);
      setNotice({ tone: 'warning', source: 'puzzle', message: getPuzzleErrorMessage(error) });
      setActiveMode('terminal');
    } finally {
      setPuzzleLoading(false);
    }
  };

  const renderModeRail = () => (
    <div>
      <div className="font-mono text-sm tracking-[0.12em] text-zinc-100">验证切换</div>
      <p className="mt-2 text-xs leading-5 text-zinc-400">左侧保留独立验证码切换卡，可在不同验证方式之间切换。</p>
      <div className="mt-4 flex flex-col gap-3">
        {CAPTCHA_MODES.map((mode) => {
          const isActive = mode.id === activeMode;
          const isPuzzleBlocked = mode.id === 'puzzle' && !currentPuzzle && !puzzleLoading;
          return (
            <button key={mode.id} type="button" onClick={() => handleModeSelect(mode.id)} className={`group flex items-center gap-3 border px-3 py-3 text-left transition-all ${isActive ? 'border-endfield-yellow bg-endfield-yellow/12 text-endfield-yellow' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${isActive ? 'border-endfield-yellow/70' : 'border-zinc-700'} [&>svg]:h-4 [&>svg]:w-4`}>{mode.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{mode.shortLabel}</span>
                  <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-endfield-yellow shadow-[0_0_8px_rgba(255,250,0,0.65)]' : isPuzzleBlocked ? 'bg-amber-500' : 'bg-zinc-700 group-hover:bg-zinc-500'}`} />
                </span>
                <span className="mt-1 block text-sm font-semibold text-current">{mode.label}</span>
                {!isMobile ? <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500">{mode.detail}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-400">当前默认：{CAPTCHA_MODES.find((mode) => mode.id === preferredMode)?.label ?? '拼图'}</div>
    </div>
  );

  const renderActiveContent = () => {
    if (activeMode === 'puzzle') {
      if (puzzleLoading) return <LoadingPanel message="同步拼图题库" />;
      if (!currentPuzzle) {
        return (
          <div className="min-h-[320px] flex items-center justify-center border border-zinc-800 bg-black/70 px-6 py-12">
            <div className="max-w-sm text-center">
              <p className="font-mono text-sm tracking-[0.18em] uppercase text-endfield-yellow">Puzzle Source Offline</p>
              <p className="mt-3 text-sm text-zinc-400">共享题库当前不可用，可切换到终端或 MC 继续验证。</p>
              <button type="button" onClick={() => void handlePuzzleRetry(true)} className="mt-5 inline-flex items-center gap-2 border border-endfield-yellow px-4 py-2 font-mono text-xs tracking-[0.18em] text-endfield-yellow transition-colors hover:bg-endfield-yellow hover:text-black"><RefreshCw className="h-3.5 w-3.5" />重试拼图源</button>
            </div>
          </div>
        );
      }

      return <EnhancedPuzzleCaptcha key={`${puzzleVersion}-${currentPuzzle.id}`} isMobile={isMobile} modeRail={renderModeRail()} onVerified={onVerified} onRequestNextPuzzle={() => void handlePuzzleRetry(false)} playerUrl={buildPlayerUrl(playerBaseUrl, currentPuzzle.id)} puzzleAuthor={currentPuzzle.author} puzzleId={currentPuzzle.id} puzzle={currentPuzzle.puzzle} />;
    }

    if (activeMode === 'minecraft') {
      return <div className="flex min-h-[320px] items-center justify-center border border-zinc-800 bg-black/70 px-3 py-4"><div className={isMobile ? 'origin-top scale-[0.84]' : ''}><MinecraftCaptcha onVerified={onVerified} /></div></div>;
    }

    return <div className="min-h-[320px] border border-zinc-800 bg-black/70 p-4"><TerminalPowCaptcha isMobile={isMobile} onUseMinecraft={() => handleModeSelect('minecraft')} onVerified={onVerified} /></div>;
  };

  if (activeMode === 'puzzle' && currentPuzzle && !puzzleLoading) {
    return (
      <div className={`w-full ${isMobile ? 'max-w-[390px]' : 'max-w-5xl'}`}>
        <div className="relative overflow-hidden border border-endfield-yellow/25 bg-black/90 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
          <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'linear-gradient(#404040 1px, transparent 1px), linear-gradient(90deg, #404040 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-endfield-yellow to-transparent opacity-80" />
          <div className={`relative z-10 ${isMobile ? 'px-3 py-3' : 'px-5 py-5'}`}>
            {notice ? (
              <div className={`mb-3 flex items-start justify-between gap-3 border px-3 py-2 ${notice.tone === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-endfield-yellow/30 bg-endfield-yellow/10 text-endfield-yellow'}`}>
                <div className="flex min-w-0 items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-xs leading-5">{notice.message}</p></div>
                {notice.source === 'puzzle' ? <button type="button" onClick={() => void handlePuzzleRetry(true)} className="shrink-0 border border-current/30 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors hover:bg-white/5">重试</button> : null}
              </div>
            ) : null}
            {renderActiveContent()}
            {!playerBaseUrl ? <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><ArrowUpRight className="h-3.5 w-3.5" /><span>未配置 `VITE_PUZZLE_PLAYER_URL`，游玩站跳转按钮将保持禁用。</span></div> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${isMobile ? 'max-w-[390px]' : 'max-w-5xl'}`}>
      <div className="relative overflow-hidden border border-endfield-yellow/25 bg-black/90 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'linear-gradient(#404040 1px, transparent 1px), linear-gradient(90deg, #404040 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-endfield-yellow to-transparent opacity-80" />
        <div className={`relative z-10 flex ${isMobile ? 'gap-3 px-3 py-3' : 'gap-5 px-5 py-5'}`}>
          <aside className={`shrink-0 border border-zinc-800 bg-zinc-950/90 ${isMobile ? 'w-[90px] p-2' : 'w-[212px] p-4'}`}>{renderModeRail()}</aside>
          <div className="min-w-0 flex-1">
            <div className={`mb-3 flex flex-wrap items-center justify-between gap-3 border border-zinc-800 bg-zinc-950/80 ${isMobile ? 'px-3 py-2' : 'px-4 py-3'}`}>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">Oracle Identity Check</p>
                <p className={`mt-1 font-mono uppercase tracking-[0.24em] text-endfield-yellow ${isMobile ? 'text-sm' : 'text-base'}`}>{CAPTCHA_MODES.find((mode) => mode.id === activeMode)?.label ?? '拼图'}</p>
              </div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-endfield-yellow shadow-[0_0_10px_rgba(255,250,0,0.55)]" /><span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">{activeMode === 'puzzle' ? 'Shared Puzzle Pool' : activeMode === 'minecraft' ? 'Manual Crafting Check' : 'Local Proof Of Work'}</span></div>
            </div>
            {notice ? (
              <div className={`mb-3 flex items-start justify-between gap-3 border px-3 py-2 ${notice.tone === 'warning' ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-endfield-yellow/30 bg-endfield-yellow/10 text-endfield-yellow'}`}>
                <div className="flex min-w-0 items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><p className="text-xs leading-5">{notice.message}</p></div>
                {notice.source === 'puzzle' ? <button type="button" onClick={() => void handlePuzzleRetry(true)} className="shrink-0 border border-current/30 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors hover:bg-white/5">重试</button> : null}
              </div>
            ) : null}
            <div className="relative">
              {renderActiveContent()}
              {!playerBaseUrl && activeMode === 'puzzle' && currentPuzzle ? <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500"><ArrowUpRight className="h-3.5 w-3.5" /><span>未配置 `VITE_PUZZLE_PLAYER_URL`，游玩站跳转按钮将保持禁用。</span></div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
