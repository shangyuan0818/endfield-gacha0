import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeCells, getRotations, shuffleItems } from './puzzleUtils';

function getNearestCell(shape, row, col) {
  const direct = shape.find(([shapeRow, shapeCol]) => shapeRow === row && shapeCol === col);
  if (direct) {
    return direct;
  }

  return shape.reduce((bestCell, currentCell) => {
    if (!bestCell) {
      return currentCell;
    }

    const bestDistance = Math.abs(bestCell[0] - row) + Math.abs(bestCell[1] - col);
    const currentDistance = Math.abs(currentCell[0] - row) + Math.abs(currentCell[1] - col);

    return currentDistance < bestDistance ? currentCell : bestCell;
  }, null);
}

function buildPieces(puzzle) {
  return shuffleItems(
    puzzle.pieces.map((piece) => {
      const rotations = getRotations(piece.shape);
      return {
        id: piece.id,
        shape: rotations[Math.floor(Math.random() * rotations.length)],
      };
    }),
  );
}

function getCurrentCounts(puzzle, placed) {
  const rowCounts = Array(puzzle.rows || 5).fill(0);
  const colCounts = Array(puzzle.cols || 5).fill(0);

  Object.values(placed).forEach((placement) => {
    placement.cells.forEach(([row, col]) => {
      rowCounts[row] += 1;
      colCounts[col] += 1;
    });
  });

  (puzzle.locked || []).forEach(([row, col]) => {
    rowCounts[row] += 1;
    colCounts[col] += 1;
  });

  return { rowCounts, colCounts };
}

function getPlaceableCells(puzzle, pieces, placed, pieceId, anchorRow, anchorCol) {
  const piece = pieces.find((item) => item.id === pieceId);
  if (!piece) {
    return null;
  }

  const occupied = new Set();
  Object.entries(placed).forEach(([placedId, placement]) => {
    if (Number(placedId) === pieceId) {
      return;
    }

    placement.cells.forEach(([row, col]) => occupied.add(`${row},${col}`));
  });

  const restricted = new Set((puzzle.restricted || []).map(([row, col]) => `${row},${col}`));
  const locked = new Set((puzzle.locked || []).map(([row, col]) => `${row},${col}`));
  const absoluteCells = piece.shape.map(([deltaRow, deltaCol]) => [anchorRow + deltaRow, anchorCol + deltaCol]);

  const fits = absoluteCells.every(([row, col]) => (
    row >= 0 &&
    row < (puzzle.rows || 5) &&
    col >= 0 &&
    col < (puzzle.cols || 5) &&
    !occupied.has(`${row},${col}`) &&
    !restricted.has(`${row},${col}`) &&
    !locked.has(`${row},${col}`)
  ));

  return fits ? absoluteCells : null;
}

function getInitialConstraintMode() {
  if (typeof window === 'undefined') {
    return 'bars';
  }

  return localStorage.getItem('puzzleCaptchaConstraintMode') === 'numbers' ? 'numbers' : 'bars';
}

function getResponsiveSizing() {
  if (typeof window === 'undefined') {
    return { cellSize: 48, miniCell: 11 };
  }

  if (window.innerWidth <= 580) {
    return { cellSize: 40, miniCell: 10 };
  }

  if (window.innerWidth <= 860) {
    return { cellSize: 44, miniCell: 11 };
  }

  return { cellSize: 48, miniCell: 11 };
}

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds | 0);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
  const seconds = String(safeSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getConstraintTone(target, current) {
  if (current > target) {
    return 'over';
  }

  if (current === target && target > 0) {
    return 'done';
  }

  return 'idle';
}

function getDifficultyLabel(value) {
  return {
    1: '简单',
    2: '中等',
    3: '困难',
  }[value] || '简单';
}

function renderBarStack(target, current, vertical = false) {
  if (target === 0) {
    return <span className="constraint-pack zero">{current > 0 ? '×' : '·'}</span>;
  }

  return Array.from({ length: Math.max(target, current, 1) }).map((_, index) => {
    const active = index < current;
    const overflow = current > target && active;
    const toneClass = overflow ? 'bar-over' : active ? 'bar-lit' : '';

    return (
      <span
        key={`${target}-${current}-${index}`}
        className={`${vertical ? 'bar-v' : 'bar-h'} ${toneClass}`.trim()}
      />
    );
  });
}

export default function EnhancedPuzzleCaptchaImpl({
  isMobile = false,
  puzzle,
  puzzleId,
  puzzleAuthor,
  playerUrl,
  puzzleDifficulty,
  noticeMessage,
  modePills,
  modeRail,
  onRetryRemote,
  onVerified,
  onRequestNextPuzzle,
  onCycleDifficulty,
}) {
  const gridRef = useRef(null);
  const previewRef = useRef(null);
  const resolvedRef = useRef(false);
  const wrongTimerRef = useRef(null);
  const hintUnlockTimerRef = useRef(null);
  const hintIntervalRef = useRef(null);

  const [{ cellSize, miniCell }, setSizing] = useState(getResponsiveSizing);
  const [pieces, setPieces] = useState(() => buildPieces(puzzle));
  const [placed, setPlaced] = useState({});
  const [selectedPieceId, setSelectedPieceId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [preview, setPreview] = useState(null);
  const [constraintMode, setConstraintMode] = useState(getInitialConstraintMode);
  const [isShaking, setIsShaking] = useState(false);
  const [hintUnlocked, setHintUnlocked] = useState(false);
  const [hintRemainingSeconds, setHintRemainingSeconds] = useState(60);
  const [showSolutionOverlay, setShowSolutionOverlay] = useState(false);
  const [showHintPanel, setShowHintPanel] = useState(!isMobile);
  const [showTrayPanel, setShowTrayPanel] = useState(true);

  const placedEntries = useMemo(() => Object.entries(placed), [placed]);
  const placedCount = placedEntries.length;
  const remainingPieceCount = pieces.length - placedCount;
  const selectedPiece = useMemo(
    () => (selectedPieceId === null ? null : pieces.find((piece) => piece.id === selectedPieceId) || null),
    [pieces, selectedPieceId],
  );
  const selectedPieceIndex = useMemo(
    () => (selectedPieceId === null ? -1 : pieces.findIndex((piece) => piece.id === selectedPieceId)),
    [pieces, selectedPieceId],
  );
  const currentCounts = useMemo(() => getCurrentCounts(puzzle, placed), [placed, puzzle]);
  const solutionCellSet = useMemo(
    () => new Set(puzzle.pieces.flatMap((piece) => (piece.cells || []).map(([row, col]) => `${row},${col}`))),
    [puzzle],
  );
  const previewSet = useMemo(() => new Set((preview?.cells || []).map(([row, col]) => `${row},${col}`)), [preview]);
  const restrictedSet = useMemo(() => new Set((puzzle.restricted || []).map(([row, col]) => `${row},${col}`)), [puzzle]);
  const lockedSet = useMemo(() => new Set((puzzle.locked || []).map(([row, col]) => `${row},${col}`)), [puzzle]);

  const trayViewportHeight = Math.max(((puzzle.rows || 5) * cellSize) + 260, 620);
  const author = puzzleAuthor || '匿名上传者';

  const clearHintTimers = useCallback(() => {
    window.clearTimeout(hintUnlockTimerRef.current);
    window.clearInterval(hintIntervalRef.current);
  }, []);

  useEffect(() => {
    resolvedRef.current = false;
  }, [puzzleId]);

  useEffect(() => {
    function syncSizing() {
      setSizing(getResponsiveSizing());
    }

    window.addEventListener('resize', syncSizing);
    return () => {
      window.removeEventListener('resize', syncSizing);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('puzzleCaptchaConstraintMode', constraintMode);
  }, [constraintMode]);

  useEffect(() => {
    const unlockAt = Date.now() + 60000;

    hintIntervalRef.current = window.setInterval(() => {
      const remainingMs = Math.max(0, unlockAt - Date.now());
      const nextSeconds = Math.ceil(remainingMs / 1000);
      setHintRemainingSeconds(nextSeconds);

      if (nextSeconds <= 0) {
        window.clearInterval(hintIntervalRef.current);
      }
    }, 250);

    hintUnlockTimerRef.current = window.setTimeout(() => {
      window.clearInterval(hintIntervalRef.current);
      setHintRemainingSeconds(0);
      setHintUnlocked(true);
    }, 60000);

    return () => {
      clearHintTimers();
    };
  }, [clearHintTimers, puzzleId]);

  useEffect(() => () => {
    window.clearTimeout(wrongTimerRef.current);
    clearHintTimers();
  }, [clearHintTimers]);

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  const getPlacedPieceId = useCallback((row, col) => {
    const found = placedEntries.find(([, placement]) => placement.cells.some(([placedRow, placedCol]) => placedRow === row && placedCol === col));
    return found ? Number(found[0]) : null;
  }, [placedEntries]);

  const updatePreview = useCallback((clientX, clientY, activeDrag, activePieces, activePlaced) => {
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect || !activeDrag) {
      setPreview(null);
      return;
    }

    const anchorRow = Math.floor((clientY - gridRect.top) / cellSize) - activeDrag.grabRow;
    const anchorCol = Math.floor((clientX - gridRect.left) / cellSize) - activeDrag.grabCol;
    const cells = getPlaceableCells(puzzle, activePieces, activePlaced, activeDrag.id, anchorRow, anchorCol);

    setPreview(cells ? { anchorRow, anchorCol, cells } : null);
  }, [cellSize, puzzle]);

  useEffect(() => {
    if (!drag) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      setDrag((previousDrag) => (previousDrag ? { ...previousDrag, x: event.clientX, y: event.clientY } : previousDrag));
      updatePreview(event.clientX, event.clientY, drag, pieces, placed);
    };

    const handlePointerEnd = () => {
      const latestPreview = previewRef.current;
      if (latestPreview) {
        setPlaced((previousPlaced) => ({
          ...previousPlaced,
          [drag.id]: {
            anchor: [latestPreview.anchorRow, latestPreview.anchorCol],
            cells: latestPreview.cells,
          },
        }));
      }

      setDrag(null);
      setPreview(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [drag, pieces, placed, updatePreview]);

  const rotatePiece = useCallback((pieceId) => {
    const piece = pieces.find((item) => item.id === pieceId);
    if (!piece || resolvedRef.current) {
      return;
    }

    const rawRotated = piece.shape.map(([row, col]) => [col, -row]);
    const minRow = Math.min(...rawRotated.map(([row]) => row));
    const minCol = Math.min(...rawRotated.map(([, col]) => col));
    const rotatedShape = normalizeCells(rawRotated);
    const draggingSamePiece = drag?.id === pieceId;
    const nextDrag = draggingSamePiece ? {
      ...drag,
      grabRow: drag.grabCol - minRow,
      grabCol: -drag.grabRow - minCol,
    } : null;

    const nextPieces = pieces.map((currentPiece) => (
      currentPiece.id === pieceId ? { ...currentPiece, shape: rotatedShape } : currentPiece
    ));

    const nextPlaced = { ...placed };
    delete nextPlaced[pieceId];

    setPieces(nextPieces);
    setPlaced(nextPlaced);
    setSelectedPieceId(pieceId);
    setDrag(nextDrag);

    if (nextDrag) {
      updatePreview(nextDrag.x, nextDrag.y, nextDrag, nextPieces, nextPlaced);
      return;
    }

    setPreview(null);
  }, [drag, pieces, placed, updatePreview]);

  useEffect(() => {
    const handleKeyboardRotate = (event) => {
      if (event.key !== 'r' && event.key !== 'R') {
        return;
      }

      if (drag) {
        rotatePiece(drag.id);
        return;
      }

      if (selectedPieceId !== null) {
        rotatePiece(selectedPieceId);
      }
    };

    window.addEventListener('keydown', handleKeyboardRotate);
    return () => {
      window.removeEventListener('keydown', handleKeyboardRotate);
    };
  }, [drag, rotatePiece, selectedPieceId]);

  useEffect(() => {
    if (placedCount !== pieces.length || !pieces.length || resolvedRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const { rowCounts, colCounts } = getCurrentCounts(puzzle, placed);
      const rowsMatch = puzzle.rowConstraints.every((value, index) => value === rowCounts[index]);
      const colsMatch = puzzle.colConstraints.every((value, index) => value === colCounts[index]);

      if (rowsMatch && colsMatch) {
        resolvedRef.current = true;
        clearHintTimers();
        setShowSolutionOverlay(false);
        onVerified();
        return;
      }

      setIsShaking(true);
      window.clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = window.setTimeout(() => setIsShaking(false), 460);
    }, 260);

    return () => {
      window.clearTimeout(timer);
    };
  }, [clearHintTimers, onVerified, pieces.length, placed, placedCount, puzzle]);

  const beginDrag = (pieceId, clientX, clientY, captureRect) => {
    const piece = pieces.find((item) => item.id === pieceId);
    if (!piece || placed[pieceId] || resolvedRef.current) {
      return;
    }

    const maxRow = Math.max(...piece.shape.map(([row]) => row));
    const maxCol = Math.max(...piece.shape.map(([, col]) => col));
    const step = miniCell + 1;
    const localRow = Math.min(maxRow, Math.max(0, Math.floor((clientY - captureRect.top) / step)));
    const localCol = Math.min(maxCol, Math.max(0, Math.floor((clientX - captureRect.left) / step)));
    const [grabRow, grabCol] = getNearestCell(piece.shape, localRow, localCol);

    setSelectedPieceId(pieceId);
    setDrag({
      id: pieceId,
      grabRow,
      grabCol,
      x: clientX,
      y: clientY,
    });
    setPreview(null);
  };

  const removePlacedPiece = (pieceId) => {
    setPlaced((previousPlaced) => {
      const nextPlaced = { ...previousPlaced };
      delete nextPlaced[pieceId];
      return nextPlaced;
    });
    setSelectedPieceId(pieceId);
    if (isMobile) {
      setShowTrayPanel(true);
    }
    setPreview(null);
  };

  const attemptPlaceSelectedPiece = useCallback((row, col) => {
    if (!isMobile || selectedPieceId === null || resolvedRef.current) {
      return false;
    }

    const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId);
    if (!selectedPiece || placed[selectedPieceId]) {
      return false;
    }

    const [grabRow, grabCol] = getNearestCell(selectedPiece.shape, 0, 0);
    const anchorRow = row - grabRow;
    const anchorCol = col - grabCol;
    const cells = getPlaceableCells(puzzle, pieces, placed, selectedPieceId, anchorRow, anchorCol);

    if (!cells) {
      return false;
    }

    setPlaced((previousPlaced) => ({
      ...previousPlaced,
      [selectedPieceId]: {
        anchor: [anchorRow, anchorCol],
        cells,
      },
    }));
    setSelectedPieceId(null);
    setShowTrayPanel(true);
    setPreview(null);
    return true;
  }, [isMobile, pieces, placed, puzzle, selectedPieceId]);

  const dragPiece = drag ? pieces.find((piece) => piece.id === drag.id) : null;
  const dragBounds = dragPiece ? {
    rows: Math.max(...dragPiece.shape.map(([row]) => row)) + 1,
    cols: Math.max(...dragPiece.shape.map(([, col]) => col)) + 1,
  } : null;
  const hintPanel = (
    <section className={`panel side-block hint-panel${isMobile ? ' mobile-hint-panel' : ''}`.trim()}>
      {isMobile ? (
        <button
          className="mobile-hint-toggle"
          type="button"
          onClick={() => setShowHintPanel((previous) => !previous)}
        >
          <span className="mobile-hint-label">提示</span>
          <span className="mobile-hint-status">
            {hintUnlocked ? '已解锁' : formatCountdown(hintRemainingSeconds)}
          </span>
        </button>
      ) : null}

      {!isMobile || showHintPanel ? (
        !hintUnlocked ? (
          <div className="hint-locked">
            <div className="hint-badge">HINT LOCKED</div>
            <div className="hint-title">提示按钮未解锁</div>
            <div className="hint-copy">
              剩余 <span>{formatCountdown(hintRemainingSeconds)}</span> 后可查看提示。
            </div>
            <button
              className="action-btn"
              type="button"
              onClick={() => {
                clearHintTimers();
                setHintRemainingSeconds(0);
                setHintUnlocked(true);
              }}
            >
              直接看提示
            </button>
          </div>
        ) : (
          <div className="hint-shell">
            <div className="hint-badge">HINT ONLINE</div>
            <button
              className="hint-trigger"
              type="button"
              onClick={() => setShowSolutionOverlay((previous) => !previous)}
            >
              <img className="hint-image" src="/penguin_endmin.jpeg" alt="提示按钮" />
            </button>
          </div>
        )
      ) : null}
    </section>
  );

  const trayPanel = (
    <aside className={`${isMobile ? 'panel mobile-tray-panel' : 'panel side-column side-right tray-panel'}${isMobile && !showTrayPanel ? ' collapsed' : ''}`.trim()}>
      <section>
        <div className="panel-head tray-head">
          <div>
            <div className="panel-title">{isMobile ? '模块托盘' : '拼图模块'}</div>
            <p className="panel-copy tray-copy">
              {isMobile
                ? (selectedPieceIndex >= 0
                  ? `剩余 ${remainingPieceCount} 块，已选模块 ${String(selectedPieceIndex + 1).padStart(2, '0')}，点棋盘空位即可放置。`
                  : `剩余 ${remainingPieceCount} 块，先点选下方模块，再点棋盘放置。`)
                : <>右侧模块区固定为独立卡片，拖拽整张卡片放入网格，按 <span className="inline-kbd">R</span> 旋转当前抓取或选中的模块。</>}
            </p>
          </div>
          {isMobile ? (
            <div className="tray-mobile-actions">
              {selectedPiece ? (
                <button
                  className="ghost-btn tray-toggle"
                  type="button"
                  onClick={() => rotatePiece(selectedPiece.id)}
                >
                  旋转已选
                </button>
              ) : null}
              <button
                className="ghost-btn tray-toggle"
                type="button"
                onClick={() => setShowTrayPanel((previous) => !previous)}
              >
                {showTrayPanel ? '收起' : '展开'}
              </button>
            </div>
          ) : null}
        </div>

        {!isMobile || showTrayPanel ? (
        <div className="tray-grid" style={isMobile ? undefined : { maxHeight: trayViewportHeight }}>
          {pieces.map((piece, index) => {
            const maxRow = Math.max(...piece.shape.map(([row]) => row));
            const maxCol = Math.max(...piece.shape.map(([, col]) => col));
            const occupied = new Set(piece.shape.map(([row, col]) => `${row},${col}`));
            const isPlaced = Boolean(placed[piece.id]);
            const isSelected = selectedPieceId === piece.id;

            return (
              <article
                key={piece.id}
                className={`piece-card ${isPlaced ? 'done' : ''} ${isSelected ? 'selected' : ''}`.trim()}
                onPointerDown={(event) => {
                  if (isMobile) {
                    return;
                  }

                  if (event.target.closest('[data-rotate]')) {
                    return;
                  }

                  event.preventDefault();
                  const captureRect = event.currentTarget.querySelector('[data-piece-grid]')?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
                  beginDrag(piece.id, event.clientX, event.clientY, captureRect);
                }}
                onClick={() => {
                  if (resolvedRef.current || isPlaced) {
                    return;
                  }

                  if (isMobile) {
                    const nextSelectedId = selectedPieceId === piece.id ? null : piece.id;
                    setSelectedPieceId(nextSelectedId);
                    setShowTrayPanel(nextSelectedId === null);
                    setPreview(null);
                  }
                }}
              >
                <div className="piece-card-body">
                  <div className="piece-meta">
                    <div>
                      <div className="piece-label">模块 {String(index + 1).padStart(2, '0')}</div>
                      <div className="piece-stat">{piece.shape.length} 格</div>
                    </div>
                  </div>

                  <div className="piece-mini-frame">
                    <div className="piece-mini-shell">
                      <div className="piece-mini-wrap">
                        <div
                          className="mini-grid"
                          data-piece-grid={piece.id}
                          style={{ gridTemplateColumns: `repeat(${maxCol + 1}, ${miniCell}px)` }}
                        >
                          {Array.from({ length: (maxRow + 1) * (maxCol + 1) }).map((_, miniIndex) => {
                            const row = Math.floor(miniIndex / (maxCol + 1));
                            const col = miniIndex % (maxCol + 1);
                            const filled = occupied.has(`${row},${col}`);

                            return (
                              <div
                                key={`mini-${piece.id}-${miniIndex}`}
                                className={`mini-cell ${filled ? 'filled' : ''}`.trim()}
                                style={{
                                  width: miniCell,
                                  height: miniCell,
                                  opacity: filled ? 1 : 0,
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  className="ghost-btn piece-rotate"
                  type="button"
                  data-rotate={piece.id}
                  disabled={isPlaced}
                  onClick={() => rotatePiece(piece.id)}
                >
                  ↻
                </button>
              </article>
            );
          })}
        </div>
        ) : null}
      </section>
    </aside>
  );

  const puzzleCard = (
    <div className="panel demo-frame demo-content captcha-card">
      <section className={`topbar${isMobile ? ' mobile-compact-topbar' : ''}`.trim()}>
        <div>
          {!isMobile ? <div className="eyebrow">ORACLE PUZZLE ACCESS</div> : null}
          {isMobile ? (
            <div className="mobile-topbar-row">
              <span className="mobile-topbar-id">#{puzzleId}</span>
              <span className="mobile-topbar-sep">&middot;</span>
              <span>{getDifficultyLabel(puzzleDifficulty)}</span>
              <span className="mobile-topbar-sep">&middot;</span>
              <span>{author === '匿名上传者' ? '匿名' : author}</span>
              <span className="mobile-topbar-placed">已放 {placedCount}/{pieces.length}</span>
            </div>
          ) : (
            <>
              <div className="topbar-title">
                <strong>#{puzzleId}</strong>
                <span className="badge source">已审核 / {getDifficultyLabel(puzzleDifficulty)}</span>
              </div>
              <div className="meta-row meta-pills">
                <span><i className="meta-dot" />上传者 {author}</span>
                <span><i className="meta-dot" />{pieces.length} 块模块</span>
                <span><i className="meta-dot" />已放 {placedCount} / {pieces.length} 块</span>
              </div>
            </>
          )}
        </div>
      </section>

      <section className={`play-body ${isShaking ? 'shake' : ''}`}>
        <article className="panel board-panel">
          <div className="board-layer">
            <div className="board-wrap">
              <div className="col-bars">
                {puzzle.colConstraints.map((target, index) => {
                  const current = currentCounts.colCounts[index] || 0;
                  const tone = getConstraintTone(target, current);

                  if (constraintMode === 'numbers') {
                    return (
                      <div key={`col-${index}`} className="constraint-top number" style={{ width: cellSize }}>
                        <span className={`constraint-number ${tone === 'done' ? 'done' : tone === 'over' ? 'over' : ''}`.trim()}>
                          {target}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div key={`col-${index}`} className="constraint-top" style={{ width: cellSize }}>
                      {renderBarStack(target, current)}
                    </div>
                  );
                })}
              </div>

              <div ref={gridRef}>
                {Array.from({ length: puzzle.rows || 5 }).map((_, rowIndex) => (
                  <div key={`row-${rowIndex}`} className="row">
                    {constraintMode === 'numbers' ? (
                      <div className="constraint-side number">
                        <span
                          className={`constraint-number ${
                            getConstraintTone(puzzle.rowConstraints[rowIndex], currentCounts.rowCounts[rowIndex] || 0) === 'done'
                              ? 'done'
                              : getConstraintTone(puzzle.rowConstraints[rowIndex], currentCounts.rowCounts[rowIndex] || 0) === 'over'
                                ? 'over'
                                : ''
                          }`.trim()}
                        >
                          {puzzle.rowConstraints[rowIndex]}
                        </span>
                      </div>
                    ) : (
                      <div className="row-bars">
                        {renderBarStack(puzzle.rowConstraints[rowIndex], currentCounts.rowCounts[rowIndex] || 0, true)}
                      </div>
                    )}

                    {Array.from({ length: puzzle.cols || 5 }).map((_, colIndex) => {
                      const cellKey = `${rowIndex},${colIndex}`;
                      const occupiedId = getPlacedPieceId(rowIndex, colIndex);
                      const isRestricted = restrictedSet.has(cellKey);
                      const isLocked = lockedSet.has(cellKey);
                      const isPreview = previewSet.has(cellKey) && occupiedId === null;
                      const isSolutionTarget = (
                        showSolutionOverlay &&
                        occupiedId === null &&
                        !isRestricted &&
                        !isLocked &&
                        solutionCellSet.has(cellKey)
                      );

                      const classNames = [
                        'cell',
                        occupiedId !== null ? 'occ' : isRestricted ? 'restricted' : isLocked ? 'locked' : 'free',
                        isPreview ? 'preview' : '',
                        isSolutionTarget ? 'solution-target' : '',
                      ].filter(Boolean).join(' ');

                      return (
                        <button
                          key={`cell-${rowIndex}-${colIndex}`}
                          type="button"
                          className={classNames}
                          style={{ width: cellSize, height: cellSize }}
                          onClick={() => {
                            if (occupiedId !== null) {
                              removePlacedPiece(occupiedId);
                              return;
                            }

                            if (isMobile) {
                              attemptPlaceSelectedPiece(rowIndex, colIndex);
                            }
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>

      {isMobile ? (
        <div className="mobile-compact-actions">
          <button className="action-btn" type="button" onClick={onRequestNextPuzzle}>换一题</button>
          <button className="action-btn" type="button" onClick={onCycleDifficulty}>{getDifficultyLabel(puzzleDifficulty)}</button>
          <button
            className="action-btn"
            type="button"
            onClick={() => setConstraintMode((previous) => (previous === 'bars' ? 'numbers' : 'bars'))}
          >
            {constraintMode === 'bars' ? '数字' : '条形'}
          </button>
          {selectedPieceIndex >= 0 ? (
            <button className="action-btn" type="button" onClick={() => setSelectedPieceId(null)}>取消</button>
          ) : !showTrayPanel ? (
            <button className="action-btn primary" type="button" onClick={() => setShowTrayPanel(true)}>选模块</button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="play-actions">
            <button className="action-btn" type="button" onClick={onRequestNextPuzzle}>换一题</button>
            <button className="action-btn" type="button" onClick={onCycleDifficulty}>难度：{getDifficultyLabel(puzzleDifficulty)}</button>
            <button
              className="action-btn"
              type="button"
              onClick={() => setConstraintMode((previous) => (previous === 'bars' ? 'numbers' : 'bars'))}
            >
              {constraintMode === 'bars' ? '显示数字' : '显示条形'}
            </button>
            {playerUrl ? (
              <button
                className="action-btn primary"
                type="button"
                onClick={() => window.open(playerUrl, '_blank', 'noopener,noreferrer')}
              >
                前往游玩站
              </button>
            ) : null}
          </div>

          <div className="play-status">
            <span>已放 {placedCount}/{pieces.length}</span>
            <span>{author === '匿名上传者' ? '匿名上传' : `出题：${author}`}</span>
          </div>

          <div className="footer-bar play-hint">
            <div>将拼图块放入网格，使每行每列的填充数满足约束条件。</div>
            <div className="footer-accent">
              操作提示：拖拽放置 · 按 R 旋转 · 点击已放块移除 · 可切换为数字提示
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="endfield-captcha-container mobile-puzzle">
        <div className="play-shell mobile-shell">
          {noticeMessage ? (
            <div className="notice">
              <div>{noticeMessage}</div>
              <button type="button" onClick={onRetryRemote}>重试共享题库</button>
            </div>
          ) : null}

          {modePills ? (
            <div className="mobile-compact-header">
              <div className="mobile-compact-header-title">拼图验证</div>
              {modePills}
            </div>
          ) : null}

          <div className="mobile-puzzle-shell">
            {hintPanel}
            {puzzleCard}
            {trayPanel}
          </div>
        </div>

        {drag && dragPiece && dragBounds ? (
          <div
            className="drag-ghost"
            style={{
              left: drag.x - ((drag.grabCol + 0.5) * cellSize),
              top: drag.y - ((drag.grabRow + 0.5) * cellSize),
            }}
          >
            <div
              className="mini-grid"
              style={{
                gridTemplateColumns: `repeat(${dragBounds.cols}, ${cellSize}px)`,
                gap: '1px',
                cursor: 'grabbing',
              }}
            >
              {Array.from({ length: dragBounds.rows * dragBounds.cols }).map((_, index) => {
                const row = Math.floor(index / dragBounds.cols);
                const col = index % dragBounds.cols;
                const filled = dragPiece.shape.some(([shapeRow, shapeCol]) => shapeRow === row && shapeCol === col);

                return (
                  <div
                    key={`ghost-${index}`}
                    className={`mini-cell ${filled ? 'filled' : ''}`.trim()}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      opacity: filled ? 1 : 0,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="endfield-captcha-container">
      <div className="play-shell">
        {noticeMessage ? (
          <div className="notice">
            <div>{noticeMessage}</div>
            <button type="button" onClick={onRetryRemote}>重试共享题库</button>
          </div>
        ) : null}

        <div className="captcha-stage">
          <aside className="side-column side-left">
            {modeRail}
            {hintPanel}
          </aside>

          <div>
            {puzzleCard}
          </div>

          {trayPanel}
        </div>
      </div>

      {drag && dragPiece && dragBounds ? (
        <div
          className="drag-ghost"
          style={{
            left: drag.x - ((drag.grabCol + 0.5) * cellSize),
            top: drag.y - ((drag.grabRow + 0.5) * cellSize),
          }}
        >
          <div
            className="mini-grid"
            style={{
              gridTemplateColumns: `repeat(${dragBounds.cols}, ${cellSize}px)`,
              gap: '1px',
              cursor: 'grabbing',
            }}
          >
            {Array.from({ length: dragBounds.rows * dragBounds.cols }).map((_, index) => {
              const row = Math.floor(index / dragBounds.cols);
              const col = index % dragBounds.cols;
              const filled = dragPiece.shape.some(([shapeRow, shapeCol]) => shapeRow === row && shapeCol === col);

              return (
                <div
                  key={`ghost-${index}`}
                  className={`mini-cell ${filled ? 'filled' : ''}`.trim()}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    opacity: filled ? 1 : 0,
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
