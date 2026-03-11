export { default } from './EnhancedPuzzleCaptchaDemo';
/*
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { getRotations, normalizeCells, rotateCells, shuffleItems } from './puzzleUtils';
import './CaptchaPuzzle.css';

function getNearestCell(shape, row, col) {
  const match = shape.find(([shapeRow, shapeCol]) => shapeRow === row && shapeCol === col);
  if (match) return match;

  return shape.reduce((bestCell, currentCell) => {
    const currentDistance = Math.abs(currentCell[0] - row) + Math.abs(currentCell[1] - col);
    if (!bestCell || currentDistance < bestCell.distance) {
      return { cell: currentCell, distance: currentDistance };
    }
    return bestCell;
  }, null)?.cell 已审核 / 简单shape[0];
}

function buildPieces(puzzle) {
  return shuffleItems(
    puzzle.pieces.map((piece) => {
      const rotations = getRotations(piece.shape);
      return {
        id: piece.id,
        shape: normalizeCells(rotations[Math.floor(Math.random() * rotations.length)]),
      };
    }),
  );
}

function getCountsForPuzzle(puzzle, placements) {
  const rowCounts = Array(puzzle.rows || 5).fill(0);
  const colCounts = Array(puzzle.cols || 5).fill(0);

  Object.values(placements).forEach((placement) => {
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

function getPlaceableCells(puzzle, placements, pieceList, pieceId, anchorRow, anchorCol) {
  const piece = pieceList.find((item) => item.id === pieceId);
  if (!piece) return null;

  const occupied = new Set();
  Object.entries(placements).forEach(([placementId, placement]) => {
    if (Number(placementId) === pieceId) return;
    placement.cells.forEach(([row, col]) => occupied.add(`${row},${col}`));
  });

  const absoluteCells = piece.shape.map(([deltaRow, deltaCol]) => [anchorRow + deltaRow, anchorCol + deltaCol]);
  const rowLimit = puzzle.rows || 5;
  const colLimit = puzzle.cols || 5;
  const restricted = new Set((puzzle.restricted || []).map(([row, col]) => `${row},${col}`));
  const locked = new Set((puzzle.locked || []).map(([row, col]) => `${row},${col}`));

  const isValid = absoluteCells.every(([row, col]) => (
    row >= 0 &&
    row < rowLimit &&
    col >= 0 &&
    col < colLimit &&
    !occupied.has(`${row},${col}`) &&
    !restricted.has(`${row},${col}`) &&
    !locked.has(`${row},${col}`)
  ));

  return isValid ? absoluteCells : null;
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getTone(target, current) {
  if (current > target) return 'over';
  if (current === target && target > 0) return 'done';
  return '';
}

export default function EnhancedPuzzleCaptcha({
  puzzle,
  puzzleId,
  puzzleAuthor,
  playerUrl,
  onVerified,
  onRequestNextPuzzle,
  isMobile = false,
  modeRail = null,
}) {
  const gridRef = useRef(null);
  const previewRef = useRef(null);
  const resolvedRef = useRef(false);
  const wrongTimerRef = useRef(null);
  const hintUnlockTimerRef = useRef(null);
  const hintIntervalRef = useRef(null);

  const cellSize = isMobile ? 40 : 48;
  const miniCell = isMobile ? 10 : 12;
  const trayHeight = isMobile ? 280 : 620;

  const [pieces, setPieces] = useState(() => buildPieces(puzzle));
  const [placed, setPlaced] = useState({});
  const [selectedPieceId, setSelectedPieceId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [preview, setPreview] = useState(null);
  const [constraintMode, setConstraintMode] = useState('bars');
  const [isWrong, setIsWrong] = useState(false);
  const [hintUnlocked, setHintUnlocked] = useState(false);
  const [hintRemainingSeconds, setHintRemainingSeconds] = useState(60);
  const [showSolutionOverlay, setShowSolutionOverlay] = useState(false);

  const placedEntries = useMemo(() => Object.entries(placed), [placed]);
  const currentCounts = useMemo(() => getCountsForPuzzle(puzzle, placed), [placed, puzzle]);
  const restrictedSet = useMemo(() => new Set((puzzle.restricted || []).map(([row, col]) => `${row},${col}`)), [puzzle]);
  const lockedSet = useMemo(() => new Set((puzzle.locked || []).map(([row, col]) => `${row},${col}`)), [puzzle]);
  const previewSet = useMemo(() => new Set((preview?.cells || []).map(([row, col]) => `${row},${col}`)), [preview]);
  const solutionCellSet = useMemo(() => new Set(
    puzzle.pieces.flatMap((piece) => (piece.cells || []).map(([row, col]) => `${row},${col}`)),
  ), [puzzle]);

  const clearHintTimers = useCallback(() => {
    window.clearTimeout(hintUnlockTimerRef.current);
    window.clearInterval(hintIntervalRef.current);
  }, []);

  useEffect(() => {
    const unlockAt = Date.now() + 60000;
    hintIntervalRef.current = window.setInterval(() => {
      const remainingMs = Math.max(0, unlockAt - Date.now());
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      setHintRemainingSeconds(remainingSeconds);
      if (remainingSeconds <= 0) {
        window.clearInterval(hintIntervalRef.current);
      }
    }, 250);

    hintUnlockTimerRef.current = window.setTimeout(() => {
      window.clearInterval(hintIntervalRef.current);
      setHintRemainingSeconds(0);
      setHintUnlocked(true);
    }, 60000);

    return () => clearHintTimers();
  }, [clearHintTimers, puzzle]);

  useEffect(() => () => {
    window.clearTimeout(wrongTimerRef.current);
    clearHintTimers();
  }, [clearHintTimers]);

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  const getPlacedPieceId = useCallback((row, col) => {
    const foundPlacement = placedEntries.find(([, placement]) =>
      placement.cells.some(([placedRow, placedCol]) => placedRow === row && placedCol === col),
    );
    return foundPlacement ? Number(foundPlacement[0]) : null;
  }, [placedEntries]);

  const updatePreview = useCallback((clientX, clientY, activeDrag, activePieces, activePlaced) => {
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect || !activeDrag) {
      setPreview(null);
      return;
    }

    const anchorRow = Math.floor((clientY - gridRect.top) / cellSize) - activeDrag.grabRow;
    const anchorCol = Math.floor((clientX - gridRect.left) / cellSize) - activeDrag.grabCol;
    const cells = getPlaceableCells(puzzle, activePlaced, activePieces, activeDrag.id, anchorRow, anchorCol);
    setPreview(cells ? { anchorRow, anchorCol, cells } : null);
  }, [cellSize, puzzle]);

  useEffect(() => {
    if (!drag) return undefined;

    const handlePointerMove = (event) => {
      setDrag((previousDrag) => (
        previousDrag ? { ...previousDrag, x: event.clientX, y: event.clientY } : previousDrag
      ));
      updatePreview(event.clientX, event.clientY, drag, pieces, placed);
    };

    const handlePointerUp = () => {
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

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [drag, pieces, placed, updatePreview]);

  const rotatePiece = useCallback((pieceId) => {
    if (resolvedRef.current) return;

    const nextPlaced = { ...placed };
    delete nextPlaced[pieceId];

    setPieces((previousPieces) => {
      const nextPieces = previousPieces.map((piece) => (
        piece.id === pieceId ? { ...piece, shape: normalizeCells(rotateCells(piece.shape)) } : piece
      ));

      if (drag?.id === pieceId) {
        updatePreview(drag.x, drag.y, drag, nextPieces, nextPlaced);
      }

      return nextPieces;
    });
    setPlaced(nextPlaced);
    setSelectedPieceId(pieceId);
  }, [drag, placed, updatePreview]);

  useEffect(() => {
    const handleKeyboardRotate = (event) => {
      if (event.key !== "r" && event.key !== "R") return;
      if (drag) rotatePiece(drag.id);
      else if (selectedPieceId !== null) rotatePiece(selectedPieceId);
    };

    window.addEventListener("keydown", handleKeyboardRotate);
    return () => window.removeEventListener("keydown", handleKeyboardRotate);
  }, [drag, rotatePiece, selectedPieceId]);

  useEffect(() => {
    const allPlaced = Object.keys(placed).length === pieces.length && pieces.length > 0;
    if (!allPlaced || resolvedRef.current) return undefined;

    const timer = window.setTimeout(() => {
      const { rowCounts, colCounts } = getCountsForPuzzle(puzzle, placed);
      const rowsMatch = puzzle.rowConstraints.every((value, index) => value === rowCounts[index]);
      const colsMatch = puzzle.colConstraints.every((value, index) => value === colCounts[index]);

      if (rowsMatch && colsMatch) {
        resolvedRef.current = true;
        onVerified();
        return;
      }

      setIsWrong(true);
      window.clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = window.setTimeout(() => setIsWrong(false), 520);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [onVerified, pieces.length, placed, puzzle]);

  const beginDrag = (pieceId, clientX, clientY, captureRect) => {
    if (resolvedRef.current) return;
    const piece = pieces.find((item) => item.id === pieceId);
    if (!piece || placed[pieceId]) return;

    const localRow = Math.max(0, Math.floor((clientY - captureRect.top) / miniCell));
    const localCol = Math.max(0, Math.floor((clientX - captureRect.left) / miniCell));
    const [grabRow, grabCol] = getNearestCell(piece.shape, localRow, localCol);

    setPlaced((previousPlaced) => {
      const nextPlaced = { ...previousPlaced };
      delete nextPlaced[pieceId];
      return nextPlaced;
    });
    setSelectedPieceId(pieceId);
    setDrag({ id: pieceId, grabRow, grabCol, x: clientX, y: clientY });
    setPreview(null);
  };

  const removePlacedPiece = (pieceId) => {
    setPlaced((previousPlaced) => {
      const nextPlaced = { ...previousPlaced };
      delete nextPlaced[pieceId];
      return nextPlaced;
    });
    setSelectedPieceId(pieceId);
    setPreview(null);
  };

  const dragPiece = drag  pieces.find((piece) => piece.id === drag.id) : null;
  const dragBounds = dragPiece ? {
    rows: Math.max(...dragPiece.shape.map(([row]) => row)) + 1,
    cols: Math.max(...dragPiece.shape.map(([, col]) => col)) + 1,
  } : null;

  return (
    
      <div className="captcha-stage">
        <aside className="side-column side-left">
          {modeRail && (
            <section className="panel mode-rail">
              {modeRail}
            </section>
          )}

          {hintUnlocked ? (
            <section className="side-block hint-panel">
              <div className="hint-shell">
                <div className="hint-badge">HINT ONLINE</div>
                <button className="hint-trigger" type="button" onClick={() => setShowSolutionOverlay(p => !p)}>
                  <img className="hint-image" src="/penguin_endmin.jpeg" alt="提示按钮" />
                </button>
              </div>
            </section>
          ) : (
            <section className="side-block hint-panel">
              <div className="hint-locked">
                <div className="hint-badge">HINT LOCKED</div>
                <div className="hint-title">提示按钮未解锁</div>
                <div className="hint-copy">剩余 <span data-hint-countdown>{formatCountdown(hintRemainingSeconds)}</span> 后可查看提示。</div>
                <button className="action-btn" type="button" onClick={() => {
                  clearHintTimers();
                  setHintRemainingSeconds(0);
                  setHintUnlocked(true);
                }}>直接看提示</button>
              </div>
            </section>
          )}
        </aside>

        <div className={`panel demo-frame demo-content captcha-card`}>
          <section className="topbar">
            <div>
              <div className="eyebrow">ORACLE PUZZLE ACCESS</div>
              <div className="topbar-title">
                <strong>#{puzzleId || "unknown"}</strong>
                <span className="badge source">已审核 / 简单</span>
              </div>
              <div className="meta-row meta-pills">
                <span><i className="meta-dot"></i>上传者 {puzzleAuthor || "匿名上传者"}</span>
                <span><i className="meta-dot"></i>{pieces.length} 块模块</span>
                <span><i className="meta-dot"></i>已放 {Object.keys(placed).length} / {pieces.length} 块</span>
              </div>
            </div>
          </section>

          <section className={`play-body ${isWrong  'shake' : ''}`}>
            <article className="panel board-panel">
              <div className="board-layer">
                <div className="board-wrap">
                  <div className="col-bars">
                    {puzzle.colConstraints.map((target, index) => {
                      const current = currentCounts.colCounts[index] || 0;
                      if (constraintMode === 'numbers') {
                        const tone = getTone(target, current);
                        return (
                          <div key={index} className="constraint-top number" style={{ width: cellSize }}>
                            <span className={`constraint-number ${tone}`}>{target}</span>
                          </div>
                        );
                      }
                      if (target === 0) {
                        return <div key={index} className="constraint-top" style={{ width: cellSize }}><span className="constraint-pack zero">{current > 0  '×' : '·'}</span></div>;
                      }
                      return (
                        <div key={index} className="constraint-top" style={{ width: cellSize }}>
                          {Array.from({ length: Math.max(target, current, 1) }, (_, barIndex) => {
                            const className = barIndex < current  (barIndex >= target  'bar-v bar-over' : 'bar-v bar-lit') : 'bar-v';
                            return <span key={barIndex} className={className}></span>;
                          })}
                        </div>
                      );
                    })}
                  </div>
                  <div id="boardGrid" ref={gridRef}>
                    {Array.from({ length: puzzle.rows || 5 }).map((_, rowIndex) => (
                      <div key={rowIndex} className="row">
                        <div className="row-bars" style={{ height: cellSize }}>
                          {(() => {
                            const target = puzzle.rowConstraints[rowIndex];
                            const current = currentCounts.rowCounts[rowIndex] || 0;
                            if (constraintMode === 'numbers') {
                              const tone = getTone(target, current);
                              return (
                                <div className="constraint-side number">
                                  <span className={`constraint-number ${tone}`}>{target}</span>
                                </div>
                              );
                            }
                            if (target === 0) {
                              return <div className="constraint-side"><span className="constraint-pack zero">{current > 0  '×' : '·'}</span></div>;
                            }
                            return (
                              <div className="constraint-side">
                                {Array.from({ length: Math.max(target, current, 1) }, (_, barIndex) => {
                                  const className = barIndex < current  (barIndex >= target  'bar-h bar-over' : 'bar-h bar-lit') : 'bar-h';
                                  return <span key={barIndex} className={className}></span>;
                                })}
                              </div>
                            );
                          })()}
                        </div>
                        {Array.from({ length: puzzle.cols || 5 }).map((_, colIndex) => {
                          const cellKey = `${rowIndex},${colIndex}`;
                          const occupiedId = getPlacedPieceId(rowIndex, colIndex);
                          const isRestricted = restrictedSet.has(cellKey);
                          const isLocked = lockedSet.has(cellKey);
                          const isHintTarget = showSolutionOverlay && occupiedId === null && !isRestricted && !isLocked && solutionCellSet.has(cellKey);
                          const isPreview = previewSet.has(cellKey) && occupiedId === null;

                          let className = "cell free";
                          if (isRestricted) className = "cell restricted";
                          else if (isLocked) className = "cell locked";
                          else if (occupiedId !== null) className = "cell occ";

                          if (isHintTarget) className += " solution-target";
                          if (isPreview) className += " preview";

                          return (
                            <div
                              key={colIndex}
                              className={className}
                              style={{ width: cellSize, height: cellSize }}
                              onClick={() => occupiedId !== null && removePlacedPiece(occupiedId)}
                            ></div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          </section>

          <div className="play-actions">
            <button className="action-btn" type="button" onClick={onRequestNextPuzzle}>换一题</button>
            <button className="action-btn" type="button" onClick={() => setConstraintMode(p => p === 'bars'  'numbers' : 'bars')}>
              {constraintMode === 'bars'  '显示数字' : '显示条形'}
            </button>
            <button className="action-btn primary" type="button" disabled={!playerUrl} onClick={() => window.open(playerUrl, '_blank', 'noopener,noreferrer')}>前往游玩站</button>
          </div>

          <div className="play-status">
            <span>已放 {Object.keys(placed).length}/{pieces.length}</span>
            <span>{puzzleAuthor === '匿名上传者'  '匿名上传' : `出题：${puzzleAuthor || ''}`}</span>
          </div>

          <div className="footer-bar play-hint">
            <div>将拼图块放入网格，使每行每列的填充数满足约束条件。</div>
            <div className="footer-accent">操作提示：拖拽放置 · 按 R 旋转 · 点击已放块移除 · 可切换为数字提示</div>
          </div>
        </div>

        <aside className="panel side-column side-right tray-panel">
          <section>
            <div className="panel-head tray-head">
              <div>
                <div className="panel-title">拼图模块</div>
                <p className="panel-copy tray-copy">右侧模块区固定为独立卡片，拖拽整张卡片放入网格，按 <span className="inline-kbd">R</span> 旋转当前抓取或选中的模块。</p>
              </div>
            </div>
            <div className="tray-grid" style={{ maxHeight: trayHeight }}>
              {pieces.map((piece, index) => {
                const maxRow = Math.max(...piece.shape.map(([row]) => row));
                const maxCol = Math.max(...piece.shape.map(([, col]) => col));
                const occupied = new Set(piece.shape.map(([row, col]) => `${row},${col}`));
                const isPlaced = Boolean(placed[piece.id]);
                const isSelected = selectedPieceId === piece.id;

                let cardClass = "piece-card";
                if (isSelected) cardClass += " selected";
                if (isPlaced) cardClass += " done";

                return (
                  <article
                    key={piece.id}
                    className={cardClass}
                    onPointerDown={(event) => {
                      if (event.target.closest('[data-rotate]')) return;
                      const captureRect = event.currentTarget.querySelector('[data-piece-grid]')?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
                      beginDrag(piece.id, event.clientX, event.clientY, captureRect);
                      event.preventDefault();
                    }}
                  >
                    <div className="piece-card-body">
                      <div className="piece-meta">
                        <div className="piece-label">模块 {String(index + 1).padStart(2, '0')}</div>
                        <div className="piece-stat">{piece.shape.length} 格</div>
                      </div>
                      <div className="piece-mini-frame">
                        <div className="piece-mini-shell">
                          <div className="piece-mini-wrap">
                            <div className="mini-grid" data-piece-grid={piece.id} style={{ gridTemplateColumns: `repeat(${maxCol + 1}, ${miniCell}px)` }}>
                              {Array.from({ length: (maxRow + 1) * (maxCol + 1) }).map((_, miniIndex) => {
                                const row = Math.floor(miniIndex / (maxCol + 1));
                                const col = miniIndex % (maxCol + 1);
                                const filled = occupied.has(`${row},${col}`);
                                return (
                                  <div
                                    key={miniIndex}
                                    className={`mini-cell ${filled  'filled' : ''}`}
                                    style={{ width: miniCell, height: miniCell, opacity: filled ? 1 : 0 }}
                                  ></div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button className="ghost-btn piece-rotate" type="button" data-rotate={piece.id} disabled={isPlaced} onClick={() => rotatePiece(piece.id)}>↻</button>
                  </article>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      {drag && dragPiece && dragBounds && (
        <div className="drag-ghost" style={{ left: drag.x - (drag.grabCol + 0.5) * cellSize, top: drag.y - (drag.grabRow + 0.5) * cellSize }}>
          <div className="mini-grid" style={{ gridTemplateColumns: `repeat(${dragBounds.cols}, ${cellSize}px)`, gap: '1px' }}>
            {Array.from({ length: dragBounds.rows * dragBounds.cols }).map((_, index) => {
              const row = Math.floor(index / dragBounds.cols);
              const col = index % dragBounds.cols;
              const filled = dragPiece.shape.some(([shapeRow, shapeCol]) => shapeRow === row && shapeCol === col);
              return (
                <div
                  key={index}
                  className={`mini-cell ${filled  'filled' : ''}`}
                  style={{ width: cellSize, height: cellSize, borderColor: filled  'rgba(255,255,255,0.14)' : 'transparent', opacity: filled ? 1 : 0 }}
                ></div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
*/
