export { default } from './OracleCaptchaHubDemo';
/*
  requestUrl.searchParams.set('select', 'id,author,data,difficulty,status');
  requestUrl.searchParams.set('status', 'eq.approved');
  requestUrl.searchParams.set('difficulty', 'eq.1');
  requestUrl.searchParams.set('order', 'created_at.desc');
  requestUrl.searchParams.set('limit', '120');

  const response = await withHardTimeout(
    fetchWithTimeout(requestUrl.toString(), {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: 'application/json',
      },
    }, {
      label: 'captcha puzzle pool read',
      timeoutMs: CAPTCHA_PUZZLE_READ_TIMEOUT_MS,
      retries: 0,
    }),
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
*/

/* export default function OracleCaptchaHub({ onVerified, isMobile = false }) {
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
    if (activeMode !== 'puzzle' || currentPuzzle) {
      return undefined;
    }

    const requestId = bootstrapRequestRef.current + 1;
    bootstrapRequestRef.current = requestId;
    let disposed = false;

    async function bootstrapPuzzle() {
      setPuzzleLoading(true);

      try {
        const rows = await loadSharedPuzzlePool();

        if (disposed || bootstrapRequestRef.current !== requestId) {
          return;
        }

        if (!rows.length) {
          throw new Error('没有可用的简单拼图题目');
        }

        setPuzzleRows(rows);
        setPuzzleLoading(false);
        setCurrentPuzzle(pickRandomPuzzle(rows, null));
        setPuzzleVersion((previousVersion) => previousVersion + 1);
        setNotice(null);
      } catch (error) {
        if (disposed || bootstrapRequestRef.current !== requestId) {
          return;
        }

        // eslint-disable-next-line no-console
        console.error('[OracleCaptchaHub] bootstrap puzzle pool failed:', error);
        setPuzzleLoading(false);
        setCurrentPuzzle(null);
        setNotice({
          tone: 'warning',
          source: 'puzzle',
          message: getPuzzleErrorMessage(error),
        });
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
    if (puzzleLoading) {
      return;
    }

    setPuzzleLoading(true);
    setNotice(null);

    try {
      const rows = forceRemote || !puzzleRows.length ? await loadSharedPuzzlePool() : puzzleRows;

      if (!rows.length) {
        throw new Error('没有可用的简单拼图题目');
      }

      setPuzzleRows(rows);
      setCurrentPuzzle((previousPuzzle) => pickRandomPuzzle(rows, previousPuzzle?.id));
      setPuzzleVersion((previousVersion) => previousVersion + 1);
      setActiveMode('puzzle');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[OracleCaptchaHub] retry puzzle pool failed:', error);
      setCurrentPuzzle(null);
      setNotice({
        tone: 'warning',
        source: 'puzzle',
        message: getPuzzleErrorMessage(error),
      });
      setActiveMode('terminal');
    } finally {
      setPuzzleLoading(false);
    }
  };

  const renderModeRail = () => (
    <>
      <div className="panel-title">验证切换</div>
      <p className="panel-copy">左侧保留独立验证码切换卡，可在不同验证方式之间切换。</p>

      <div className="mode-list" style={{ marginTop: '16px' }}>
        {CAPTCHA_MODES.map((mode) => {
          const isActive = mode.id === activeMode;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => handleModeSelect(mode.id)}
              className={`mode-card ${isActive ? 'active' : ''}`}
            >
              <span className="mode-icon">{mode.icon}</span>
              <span className="mode-copy">
                <span className="mode-short">{mode.shortLabel}</span>
                <span className="mode-main">{mode.label}</span>
                <span className="mode-detail">{mode.detail}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mode-note">
        当前默认：{CAPTCHA_MODES.find((mode) => mode.id === preferredMode)?.label ?? '拼图'}
      </div>
    </>
  );

  const renderActiveContent = () => {
    if (activeMode === 'puzzle') {
      if (puzzleLoading) {
        return <LoadingPanel message="同步拼图题库" />;
      }

      if (!currentPuzzle) {
        return (
          <div className="min-h-[320px] flex items-center justify-center border border-zinc-800 bg-black/70 px-6 py-12">
            <div className="max-w-sm text-center">
              <p className="font-mono text-sm tracking-[0.18em] uppercase text-endfield-yellow">Puzzle Source Offline</p>
              <p className="mt-3 text-sm text-zinc-400">共享题库当前不可用，可切换到终端或 MC 继续验证。</p>
              <button
                type="button"
                onClick={() => void handlePuzzleRetry(true)}
                className="action-btn mt-5"
              >
                重试拼图源
              </button>
            </div>
          </div>
        );
      }

      return (
        <EnhancedPuzzleCaptcha
          key={`${puzzleVersion}-${currentPuzzle.id}`}
          isMobile={isMobile}
          modeRail={renderModeRail()}
          onVerified={onVerified}
          onRequestNextPuzzle={() => void handlePuzzleRetry(false)}
          playerUrl={buildPlayerUrl(playerBaseUrl, currentPuzzle.id)}
          puzzleAuthor={currentPuzzle.author}
          puzzleId={currentPuzzle.id}
          puzzle={currentPuzzle.puzzle}
        />
      );
    }

    if (activeMode === 'minecraft') {
      return (
        <div className="flex min-h-[320px] items-center justify-center bg-black/40 px-3 py-4" style={{ flex: '1' }}>
          <div className={isMobile ? 'origin-top scale-[0.84]' : ''}>
            <MinecraftCaptcha onVerified={onVerified} />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[320px] bg-black/40 p-4" style={{ flex: '1' }}>
        <TerminalPowCaptcha
          isMobile={isMobile}
          onUseMinecraft={() => handleModeSelect('minecraft')}
          onVerified={onVerified}
        />
      </div>
    );
  };

  if (activeMode === 'puzzle' && currentPuzzle && !puzzleLoading) {
    return (
      <div className={`endfield-captcha-container w-full ${isMobile ? 'max-w-[390px]' : 'max-w-5xl'}`}>
        {notice && (
          <div className="notice" style={{ marginBottom: '16px' }}>
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{notice.message}</span>
            </div>
            {notice.source === 'puzzle' && (
              <button type="button" onClick={() => void handlePuzzleRetry(true)}>重试</button>
            )}
          </div>
        )}
        
        {renderActiveContent()}
        
        {!playerBaseUrl && (
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>未配置 `VITE_PUZZLE_PLAYER_URL`，游玩站跳转按钮将保持禁用。</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`endfield-captcha-container w-full ${isMobile ? 'max-w-[390px]' : 'max-w-5xl'}`}>
      <div className="play-shell">
        <div className="captcha-stage">
          <aside className="side-column side-left">
            <section className="panel mode-rail">
              {renderModeRail()}
            </section>
          </aside>

          <div className="panel demo-frame demo-content captcha-card" style={{ flex: '1 1 auto', maxWidth: 'none', display: 'flex', flexDirection: 'column' }}>
            <section className="topbar">
              <div>
                <div className="eyebrow">ORACLE IDENTITY CHECK</div>
                <div className="topbar-title" style={{ marginTop: '8px' }}>
                  <strong style={{ fontSize: '16px' }}>{CAPTCHA_MODES.find((mode) => mode.id === activeMode)?.label ?? '拼图'}</strong>
                </div>
                <div className="meta-row meta-pills">
                  <span><i className="meta-dot"></i>{activeMode === 'minecraft' ? 'Manual Crafting Check' : activeMode === 'terminal' ? 'Local Proof Of Work' : 'Shared Puzzle Pool'}</span>
                </div>
              </div>
            </section>

            {notice && (
              <div className="notice" style={{ margin: '16px 0 0 0' }}>
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{notice.message}</span>
                </div>
                {notice.source === 'puzzle' && (
                  <button type="button" onClick={() => void handlePuzzleRetry(true)}>重试</button>
                )}
              </div>
            )}

            <div style={{ marginTop: '16px', flex: '1', display: 'flex', flexDirection: 'column' }}>
              {renderActiveContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
*/
