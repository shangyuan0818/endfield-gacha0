import React, { useCallback, useEffect, useRef, useState } from 'react';
import MinecraftCaptcha from '../MinecraftCaptcha';
import TerminalPowCaptcha from './TerminalPowCaptcha';
import EnhancedPuzzleCaptcha from './EnhancedPuzzleCaptchaImpl';
import { fetchWithTimeout } from '../../services/supabaseRequest';
import { buildPlayerUrl, expandPuzzle } from './puzzleUtils';
import './CaptchaPuzzleOracle.css';

const CAPTCHA_MODES = [
  {
    id: 'puzzle',
    short: 'PZ',
    label: '拼图',
    detail: 'SHARED GRID',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="1.5" />
        <path d="M8 3v18M16 3v18M3 8h18M3 16h18" />
      </svg>
    ),
  },
  {
    id: 'minecraft',
    short: 'MC',
    label: 'MC 合成',
    detail: 'CRAFTING CHECK',
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
    short: '岗哨',
    label: '终端',
    detail: '边境值守',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M4 5h16v14H4z" />
        <path d="M8 10l2 2-2 2M12.5 16H16" />
      </svg>
    ),
  },
];

const CAPTCHA_PUZZLE_READ_TIMEOUT_MS = 10000;

function getInitialMode(isMobile = false) {
  const savedMode = localStorage.getItem('captchaModePreference');
  return CAPTCHA_MODES.some(({ id }) => id === savedMode) ? savedMode : (isMobile ? 'terminal' : 'puzzle');
}

function getInitialDifficulty() {
  const savedDifficulty = Number(localStorage.getItem('puzzleCaptchaDifficulty'));
  return [1, 2, 3].includes(savedDifficulty) ? savedDifficulty : 1;
}

function getDifficultyLabel(value) {
  return {
    1: '简单',
    2: '中等',
    3: '困难',
  }[value] || '简单';
}

function pickRandomPuzzle(rows, currentId) {
  if (!rows.length) {
    return null;
  }

  if (rows.length === 1) {
    return rows[0];
  }

  const candidates = currentId ? rows.filter((row) => row.id !== currentId) : rows;
  const pool = candidates.length ? candidates : rows;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getPuzzleErrorMessage(error, difficulty) {
  const detail = error instanceof Error ? error.message : '未知错误';

  if (detail.includes('没有可用题目')) {
    return `共享题库当前无“已审核 + ${getDifficultyLabel(difficulty)}”题目。`;
  }

  if (detail.includes('Supabase 未配置')) {
    return '主站未读取到 Supabase 配置，拼图题库当前不可用。';
  }

  if (detail.toLowerCase().includes('timed out')) {
    return '拼图题库请求超时，请重试共享题库或切换其他验证方式。';
  }

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

async function loadSharedPuzzlePool(difficulty) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase 未配置');
  }

  const requestUrl = new URL('/rest/v1/puzzles', supabaseUrl);
  requestUrl.searchParams.set('select', 'id,author,data,difficulty,status');
  requestUrl.searchParams.set('status', 'eq.approved');
  requestUrl.searchParams.set('difficulty', `eq.${difficulty}`);
  requestUrl.searchParams.set('order', 'created_at.desc');
  requestUrl.searchParams.set('limit', '80');

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

  if (!response.ok) {
    throw new Error(`Supabase REST ${response.status}`);
  }

  const data = await response.json();

  return (data ?? []).map((row) => ({
    id: row.id,
    author: row.author || '',
    difficulty: row.difficulty || difficulty,
    puzzle: expandPuzzle(row.data),
  }));
}

function CaptchaShell({ modeRail, children, placeholderRight = true, noticeMessage, onRetryRemote, isMobile = false }) {
  const showModeRail = Boolean(modeRail);

  return (
    <div className={`endfield-captcha-container${isMobile ? ' mobile-captcha' : ''}`}>
      <div className={`play-shell${isMobile ? ' mobile-shell' : ''}`}>
        {noticeMessage ? (
          <div className="notice">
            <div>{noticeMessage}</div>
            <button type="button" onClick={onRetryRemote}>重试共享题库</button>
          </div>
        ) : null}

        <div className={`captcha-stage${isMobile ? ' mobile-stage' : ''}${showModeRail ? '' : ' no-rail'}`}>
          {showModeRail ? <aside className="side-column side-left">{modeRail}</aside> : null}
          {children}
          {placeholderRight && showModeRail ? <aside className="panel side-column side-right side-placeholder" aria-hidden="true" /> : null}
        </div>
      </div>
    </div>
  );
}

function LoadingFrame({ modeRail, noticeMessage, onRetryRemote, isMobile = false }) {
  return (
    <CaptchaShell isMobile={isMobile} modeRail={modeRail} noticeMessage={noticeMessage} onRetryRemote={onRetryRemote}>
      <div className="demo-frame demo-content">
        <div className="loading-view">
          <div className="loading-spinner" />
          <strong>同步拼图题库</strong>
          <p>
            {isMobile
              ? '正在拉取手机端拼图题目，请稍候后重试。'
              : '正在尝试从共享题库拉取已审核题目。若长时间没有返回，请重试共享题库或切换其他验证方式。'}
          </p>
        </div>
      </div>
    </CaptchaShell>
  );
}

function OfflineFrame({ modeRail, noticeMessage, onRetryRemote, isMobile = false }) {
  return (
    <CaptchaShell isMobile={isMobile} modeRail={modeRail} noticeMessage={noticeMessage} onRetryRemote={onRetryRemote}>
      <div className="demo-frame demo-content">
        <div className="offline-view">
          <strong>题库暂不可用</strong>
          <p>
            {isMobile
              ? '当前没有拿到可用的拼图题目，请稍后重试共享题库。'
              : '当前没有拿到可用的拼图题目。你可以重试共享题库，或从左侧切换到 MC 合成和终端备用验证。'}
          </p>
          <button className="action-btn" type="button" onClick={onRetryRemote}>重试共享题库</button>
        </div>
      </div>
    </CaptchaShell>
  );
}

function SecondaryModeFrame({ modeRail, title, eyebrow, children }) {
  return (
    <CaptchaShell modeRail={modeRail} placeholderRight>
      <div className="panel demo-frame demo-content captcha-card">
        <section className="topbar">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <div className="topbar-title">
              <strong>{title}</strong>
            </div>
          </div>
        </section>
        <section className="play-body">
          <article className="panel board-panel" style={{ width: '100%' }}>
            {children}
          </article>
        </section>
      </div>
    </CaptchaShell>
  );
}

function MobileModeFrame({ modePills, title, noticeMessage, onRetryRemote, children }) {
  return (
    <div className="endfield-captcha-container mobile-captcha mobile-access">
      <div className="play-shell mobile-shell">
        {noticeMessage ? (
          <div className="notice">
            <div>{noticeMessage}</div>
            <button type="button" onClick={onRetryRemote}>重试共享题库</button>
          </div>
        ) : null}

        <div className="mobile-access-shell">
          <div className="mobile-compact-header">
            <div className="mobile-compact-header-title">{title}</div>
            {modePills}
          </div>

          <div className="mobile-access-body">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OracleCaptchaHubImpl({ onVerified, isMobile = false }) {
  const [activeMode, setActiveMode] = useState(() => getInitialMode(isMobile));
  const [currentDifficulty, setCurrentDifficulty] = useState(getInitialDifficulty);
  const [puzzleRows, setPuzzleRows] = useState([]);
  const [currentPuzzle, setCurrentPuzzle] = useState(null);
  const [puzzleVersion, setPuzzleVersion] = useState(0);
  const [puzzleLoading, setPuzzleLoading] = useState(false);
  const [puzzleNotice, setPuzzleNotice] = useState('');
  const bootstrapRequestRef = useRef(0);
  const playerBaseUrl = import.meta.env.VITE_PUZZLE_PLAYER_URL?.trim() || '';
  const availableModes = CAPTCHA_MODES;
  const effectiveMode = activeMode;

  const persistMode = useCallback((nextMode) => {
    localStorage.setItem('captchaModePreference', nextMode);
  }, []);

  const persistDifficulty = useCallback((nextDifficulty) => {
    setCurrentDifficulty(nextDifficulty);
    localStorage.setItem('puzzleCaptchaDifficulty', String(nextDifficulty));
  }, []);

  const renderModeRail = useCallback(() => (
    <section className={`panel mode-rail${isMobile ? ' compact' : ''}`.trim()}>
      <div className="panel-title">{isMobile ? '验证方式' : '验证切换'}</div>
      {!isMobile ? <p className="panel-copy">左侧保留独立验证码切换卡，可在不同验证方式之间切换。</p> : null}
      <div
        className="mode-list"
        style={isMobile ? { gridTemplateColumns: `repeat(${availableModes.length}, minmax(0, 1fr))` } : undefined}
      >
        {availableModes.map((mode) => (
          <button
            key={mode.id}
            className={`mode-card ${effectiveMode === mode.id ? 'active' : ''}`.trim()}
            type="button"
            onClick={() => {
              persistMode(mode.id);
              setActiveMode(mode.id);
              if (mode.id !== 'puzzle') {
                setPuzzleNotice('');
              }
            }}
          >
            <span className="mode-icon">{mode.icon}</span>
            <span className="mode-copy">
              <span className="mode-short">{mode.short}</span>
              <span className="mode-main">{mode.label}</span>
              {!isMobile ? <span className="mode-detail">{mode.detail}</span> : null}
            </span>
          </button>
        ))}
      </div>
      {!isMobile ? <div className="mode-note">当前高亮：{CAPTCHA_MODES.find((mode) => mode.id === activeMode)?.label ?? '拼图'}</div> : null}
    </section>
  ), [activeMode, availableModes, effectiveMode, isMobile, persistMode]);

  const renderModePills = useCallback(() => (
    <div className="mobile-pill-switcher">
      {availableModes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          className={`mobile-pill${effectiveMode === mode.id ? ' active' : ''}`}
          onClick={() => {
            persistMode(mode.id);
            setActiveMode(mode.id);
            if (mode.id !== 'puzzle') {
              setPuzzleNotice('');
            }
          }}
        >
          {mode.label}
        </button>
      ))}
    </div>
  ), [availableModes, effectiveMode, persistMode]);

  const fetchPuzzleRows = useCallback(async (difficulty, currentId = null, forceRemote = true) => {
    const rows = !forceRemote && puzzleRows.length ? puzzleRows : await loadSharedPuzzlePool(difficulty);
    if (!rows.length) {
      throw new Error('没有可用题目');
    }

    setPuzzleRows(rows);
    setCurrentPuzzle(pickRandomPuzzle(rows, currentId));
    setPuzzleVersion((previousVersion) => previousVersion + 1);
  }, [puzzleRows]);

  useEffect(() => {
    if (effectiveMode !== 'puzzle' || currentPuzzle) {
      return undefined;
    }

    const requestId = bootstrapRequestRef.current + 1;
    bootstrapRequestRef.current = requestId;
    let disposed = false;

    async function bootstrapPuzzle() {
      setPuzzleLoading(true);
      try {
        await fetchPuzzleRows(currentDifficulty, null, true);
        if (disposed || bootstrapRequestRef.current !== requestId) {
          return;
        }
        setPuzzleNotice('');
      } catch (error) {
        if (disposed || bootstrapRequestRef.current !== requestId) {
          return;
        }
        setCurrentPuzzle(null);
        setPuzzleRows([]);
        setPuzzleNotice(getPuzzleErrorMessage(error, currentDifficulty));
      } finally {
        if (!disposed && bootstrapRequestRef.current === requestId) {
          setPuzzleLoading(false);
        }
      }
    }

    void bootstrapPuzzle();
    return () => {
      disposed = true;
    };
  }, [currentDifficulty, currentPuzzle, effectiveMode, fetchPuzzleRows]);

  const handlePuzzleRetry = useCallback(async (forceRemote = true) => {
    if (puzzleLoading) {
      return;
    }

    const requestId = bootstrapRequestRef.current + 1;
    bootstrapRequestRef.current = requestId;
    setPuzzleLoading(true);

    try {
      await fetchPuzzleRows(currentDifficulty, currentPuzzle?.id ?? null, forceRemote);
      if (bootstrapRequestRef.current !== requestId) {
        return;
      }
      setActiveMode('puzzle');
      setPuzzleNotice('');
    } catch (error) {
      if (bootstrapRequestRef.current !== requestId) {
        return;
      }
      setCurrentPuzzle(null);
      setPuzzleRows([]);
      setPuzzleNotice(getPuzzleErrorMessage(error, currentDifficulty));
    } finally {
      if (bootstrapRequestRef.current === requestId) {
        setPuzzleLoading(false);
      }
    }
  }, [currentDifficulty, currentPuzzle?.id, fetchPuzzleRows, puzzleLoading]);

  const handleCycleDifficulty = useCallback(() => {
    const nextDifficulty = currentDifficulty === 3 ? 1 : currentDifficulty + 1;
    persistDifficulty(nextDifficulty);
    setPuzzleRows([]);
    setCurrentPuzzle(null);
    setPuzzleNotice('');
    setActiveMode('puzzle');
  }, [currentDifficulty, persistDifficulty]);

  if (effectiveMode === 'puzzle') {
    if (puzzleLoading && !currentPuzzle) {
      return <LoadingFrame isMobile={isMobile} modeRail={renderModeRail()} noticeMessage={puzzleNotice} onRetryRemote={() => void handlePuzzleRetry(true)} />;
    }

    if (!currentPuzzle) {
      return <OfflineFrame isMobile={isMobile} modeRail={renderModeRail()} noticeMessage={puzzleNotice} onRetryRemote={() => void handlePuzzleRetry(true)} />;
    }

    return (
      <EnhancedPuzzleCaptcha
        key={`${puzzleVersion}-${currentPuzzle.id}`}
        isMobile={isMobile}
        noticeMessage={puzzleNotice}
        modeRail={renderModeRail()}
        modePills={isMobile ? renderModePills() : null}
        onRetryRemote={() => void handlePuzzleRetry(true)}
        onVerified={onVerified}
        onRequestNextPuzzle={() => void handlePuzzleRetry(false)}
        onCycleDifficulty={handleCycleDifficulty}
        playerUrl={buildPlayerUrl(playerBaseUrl, currentPuzzle.id)}
        puzzle={currentPuzzle.puzzle}
        puzzleAuthor={currentPuzzle.author}
        puzzleDifficulty={currentDifficulty}
        puzzleId={currentPuzzle.id}
      />
    );
  }

  if (effectiveMode === 'minecraft') {
    if (isMobile) {
      return (
        <MobileModeFrame
          modePills={renderModePills()}
          title="MC 合成验证"
          noticeMessage=""
        >
          <div className="mobile-secondary-mode minecraft-mode">
            <div className="origin-top scale-[0.88]">
              <MinecraftCaptcha onVerified={onVerified} />
            </div>
          </div>
        </MobileModeFrame>
      );
    }

    return (
      <SecondaryModeFrame modeRail={renderModeRail()} eyebrow="ORACLE BACKUP ACCESS" title="MC 合成">
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div className={isMobile ? 'origin-top scale-[0.84]' : undefined}>
            <MinecraftCaptcha onVerified={onVerified} />
          </div>
        </div>
      </SecondaryModeFrame>
    );
  }

  if (isMobile) {
    return (
      <MobileModeFrame
        modePills={renderModePills()}
        title="终端验证"
        noticeMessage=""
      >
        <div className="mobile-secondary-mode terminal-mode">
          <TerminalPowCaptcha isMobile onUseMinecraft={() => {
            persistMode('minecraft');
            setActiveMode('minecraft');
          }} onVerified={onVerified} />
        </div>
      </MobileModeFrame>
    );
  }

  return (
    <SecondaryModeFrame modeRail={renderModeRail()} eyebrow="边境值守记录" title="值守终端">
      <TerminalPowCaptcha isMobile={isMobile} onUseMinecraft={() => {
        persistMode('minecraft');
        setActiveMode('minecraft');
      }} onVerified={onVerified} />
    </SecondaryModeFrame>
  );
}
