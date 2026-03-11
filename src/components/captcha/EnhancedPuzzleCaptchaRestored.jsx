import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, RotateCw, User } from 'lucide-react';
import { getRotations, normalizeCells, rotateCells, shuffleItems } from './puzzleUtils';

function getNearestCell(shape, row, col) {
  const match = shape.find(([shapeRow, shapeCol]) => shapeRow === row && shapeCol === col);
  if (match) return match;

  return shape.reduce((bestCell, currentCell) => {
    const currentDistance = Math.abs(currentCell[0] - row) + Math.abs(currentCell[1] - col);
    if (!bestCell || currentDistance < bestCell.distance) return { cell: currentCell, distance: currentDistance };
    return bestCell;
  }, null)?.cell ?? shape[0];
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

  const restricted = new Set((puzzle.restricted || []).map(([row, col]) => `${row},${col}`));
  const locked = new Set((puzzle.locked || []).map(([row, col]) => `${row},${col}`));
  const absoluteCells = piece.shape.map(([deltaRow, deltaCol]) => [anchorRow + deltaRow, anchorCol + deltaCol]);

  const valid = absoluteCells.every(([row, col]) => (
    row >= 0 &&
    row < (puzzle.rows || 5) &&
    col >= 0 &&
    col < (puzzle.cols || 5) &&
    !occupied.has(`${row},${col}`) &&
    !restricted.has(`${row},${col}`) &&
    !locked.has(`${row},${col}`)
  ));

  return valid ? absoluteCells : null;
}

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds | 0);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function getTone(target, current) {
  if (current > target) return 'over';
  if (current === target && target > 0) return 'done';
  return 'idle';
}

function ConstraintBars({ target, current, vertical = false }) {
  if (target === 0) return <span className={`text-sm ${current > 0 ? 'text-red-400' : 'text-zinc-700'}`}>{current > 0 ? '×' : '·'}</span>;

  return (
    <div className={vertical ? 'flex items-center gap-1' : 'flex flex-col justify-end gap-1'}>
      {Array.from({ length: Math.max(target, current, 1) }).map((_, index) => {
        const active = index < current;
        const overflow = current > target && active;
        const className = overflow ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : active ? 'bg-[#90c50a] shadow-[0_0_6px_rgba(144,197,10,0.45)]' : 'bg-zinc-800';
        return <span key={`${target}-${current}-${index}`} className={`block ${vertical ? 'h-3 w-[5px]' : 'h-[5px] w-3'} ${className}`} />;
      })}
    </div>
  );
}

export default function EnhancedPuzzleCaptchaRestored({
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
  const trayCardSize = isMobile ? 88 : 100;

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
  const solutionCellSet = useMemo(() => new Set(puzzle.pieces.flatMap((piece) => (piece.cells || []).map(([row, col]) => `${row},${col}`))), [puzzle]);
  const placedCount = Object.keys(placed).length;

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
      if (remainingSeconds <= 0) window.clearInterval(hintIntervalRef.current);
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
    const foundPlacement = placedEntries.find(([, placement]) => placement.cells.some(([placedRow, placedCol]) => placedRow === row && placedCol === col));
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
      setDrag((previousDrag) => (previousDrag ? { ...previousDrag, x: event.clientX, y: event.clientY } : previousDrag));
      updatePreview(event.clientX, event.clientY, drag, pieces, placed);
    };

    const handlePointerEnd = () => {
      const latestPreview = previewRef.current;
      if (latestPreview) {
        setPlaced((previousPlaced) => ({
          ...previousPlaced,
          [drag.id]: { anchor: [latestPreview.anchorRow, latestPreview.anchorCol], cells: latestPreview.cells },
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
    if (resolvedRef.current) return;
    const nextPlaced = { ...placed };
    delete nextPlaced[pieceId];

    setPieces((previousPieces) => {
      const nextPieces = previousPieces.map((piece) => (piece.id === pieceId ? { ...piece, shape: normalizeCells(rotateCells(piece.shape)) } : piece));
      if (drag?.id === pieceId) updatePreview(drag.x, drag.y, drag, nextPieces, nextPlaced);
      return nextPieces;
    });

    setPlaced(nextPlaced);
    setSelectedPieceId(pieceId);
  }, [drag, placed, updatePreview]);

  useEffect(() => {
    const handleKeyboardRotate = (event) => {
      if (event.key !== 'r' && event.key !== 'R') return;
      if (drag) rotatePiece(drag.id);
      else if (selectedPieceId !== null) rotatePiece(selectedPieceId);
    };

    window.addEventListener('keydown', handleKeyboardRotate);
    return () => window.removeEventListener('keydown', handleKeyboardRotate);
  }, [drag, rotatePiece, selectedPieceId]);

  useEffect(() => {
    const allPlaced = placedCount === pieces.length && pieces.length > 0;
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
  }, [onVerified, pieces.length, placed, placedCount, puzzle]);

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

  const topConstraintHeight = Math.max(38, Math.max(...puzzle.colConstraints, 0) * 10 + 18);
  const dragPiece = drag ? pieces.find((piece) => piece.id === drag.id) : null;
  const dragBounds = dragPiece ? {
    rows: Math.max(...dragPiece.shape.map(([row]) => row)) + 1,
    cols: Math.max(...dragPiece.shape.map(([, col]) => col)) + 1,
  } : null;

  return (
    <div className="relative">
      <div className={`relative z-10 flex ${isMobile ? 'flex-col gap-4' : 'items-start gap-4'}`}>
        <aside className={`${isMobile ? 'w-full' : 'w-[212px] shrink-0'} flex flex-col gap-4`}>
          {modeRail ? (
            <section className="relative overflow-hidden border border-endfield-yellow/20 bg-black/90 shadow-[0_0_28px_rgba(0,0,0,0.28)]">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-endfield-yellow/80 to-transparent" />
              <div className="relative z-10 p-4">{modeRail}</div>
            </section>
          ) : null}

          <section className="relative overflow-hidden border border-endfield-yellow/20 bg-black/90 shadow-[0_0_28px_rgba(0,0,0,0.28)]">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-endfield-yellow/80 to-transparent" />
            <div className="relative z-10 p-4">
              {!hintUnlocked ? (
                <div className="space-y-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-endfield-yellow">HINT LOCKED</div>
                  <div className="text-sm text-zinc-200">提示按钮未解锁</div>
                  <div className="text-xs leading-5 text-zinc-400">剩余 {formatCountdown(hintRemainingSeconds)} 后可查看提示。</div>
                  <button type="button" onClick={() => { clearHintTimers(); setHintRemainingSeconds(0); setHintUnlocked(true); }} className="border border-zinc-700 px-3 py-2 font-mono text-[11px] tracking-[0.18em] text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow">直接看提示</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-endfield-yellow">HINT ONLINE</div>
                  <button type="button" onClick={() => setShowSolutionOverlay((previous) => !previous)} className={`overflow-hidden border transition-colors ${showSolutionOverlay ? 'border-endfield-yellow' : 'border-zinc-700 hover:border-endfield-yellow'}`}>
                    <img src="/penguin_endmin.jpeg" alt="提示按钮" className="h-40 w-full object-cover transition-transform duration-200 hover:scale-[1.03]" />
                  </button>
                </div>
              )}
            </div>
          </section>
        </aside>

        <section className={`relative min-w-0 flex-1 overflow-hidden border border-endfield-yellow/20 bg-black/90 shadow-[0_0_28px_rgba(0,0,0,0.28)] ${isWrong ? 'ring-1 ring-red-500/60' : ''}`}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-endfield-yellow/80 to-transparent" />
          <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(255,255,255,0.28) 6px, rgba(255,255,255,0.28) 7px)' }} />
          <div className={`relative z-10 ${isMobile ? 'p-3' : 'p-4'}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 border border-zinc-800 bg-black/35 px-3 py-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">Oracle Puzzle Access</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm uppercase tracking-[0.22em] text-endfield-yellow">#{puzzleId}</span>
                  <span className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">已审核 / 简单</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                  <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5 text-zinc-500" />{puzzleAuthor || '匿名上传者'}</span>
                  <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-endfield-yellow/90" />已放 {placedCount} / {pieces.length} 块</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onRequestNextPuzzle} className="border border-zinc-700 px-3 py-2 font-mono text-[11px] tracking-[0.18em] text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow">换一题</button>
                <button type="button" onClick={() => setConstraintMode((previous) => (previous === 'bars' ? 'numbers' : 'bars'))} className="border border-zinc-700 px-3 py-2 font-mono text-[11px] tracking-[0.18em] text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow">{constraintMode === 'bars' ? '显示数字' : '显示条形'}</button>
                <button type="button" disabled={!playerUrl} onClick={() => window.open(playerUrl, '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-2 border border-endfield-yellow/60 px-3 py-2 font-mono text-[11px] tracking-[0.18em] text-endfield-yellow transition-colors hover:bg-endfield-yellow hover:text-black disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600 disabled:hover:bg-transparent disabled:hover:text-zinc-600"><ArrowUpRight className="h-3.5 w-3.5" />前往游玩站</button>
              </div>
            </div>

            <div className={`mt-4 flex ${isMobile ? 'flex-col gap-4' : 'gap-4'}`}>
              <article className="min-w-0 flex-1 border border-zinc-800 bg-[linear-gradient(180deg,rgba(10,10,10,0.98),rgba(8,8,8,0.96))] p-3">
                <div className="border border-zinc-900 bg-black/40 p-3">
                  <div className="mx-auto w-fit">
                    <div className="flex pl-8" style={{ alignItems: 'flex-end' }}>
                      {puzzle.colConstraints.map((target, columnIndex) => {
                        const current = currentCounts.colCounts[columnIndex] || 0;
                        const tone = getTone(target, current);
                        return (
                          <div key={`column-${columnIndex}`} className="flex items-center justify-center pb-2" style={{ width: cellSize, height: topConstraintHeight }}>
                            {constraintMode === 'numbers' ? <span className={`font-mono text-sm ${tone === 'over' ? 'text-red-400' : tone === 'done' ? 'text-[#90c50a]' : 'text-zinc-500'}`}>{target}</span> : <ConstraintBars target={target} current={current} />}
                          </div>
                        );
                      })}
                    </div>

                    <div ref={gridRef} className="flex flex-col">
                      {Array.from({ length: puzzle.rows || 5 }).map((_, rowIndex) => (
                        <div key={`row-${rowIndex}`} className="flex items-center">
                          <div className="flex w-8 justify-end pr-2" style={{ height: cellSize }}>
                            {constraintMode === 'numbers' ? <span className={`font-mono text-sm ${getTone(puzzle.rowConstraints[rowIndex], currentCounts.rowCounts[rowIndex] || 0) === 'over' ? 'text-red-400' : getTone(puzzle.rowConstraints[rowIndex], currentCounts.rowCounts[rowIndex] || 0) === 'done' ? 'text-[#90c50a]' : 'text-zinc-500'}`}>{puzzle.rowConstraints[rowIndex]}</span> : <ConstraintBars target={puzzle.rowConstraints[rowIndex]} current={currentCounts.rowCounts[rowIndex] || 0} vertical />}
                          </div>

                          {Array.from({ length: puzzle.cols || 5 }).map((_, colIndex) => {
                            const cellKey = `${rowIndex},${colIndex}`;
                            const occupiedId = getPlacedPieceId(rowIndex, colIndex);
                            const isRestricted = restrictedSet.has(cellKey);
                            const isLocked = lockedSet.has(cellKey);
                            const isHintTarget = showSolutionOverlay && occupiedId === null && !isRestricted && !isLocked && solutionCellSet.has(cellKey);
                            const isPreview = previewSet.has(cellKey) && occupiedId === null;
                            const cellClassName = [
                              'relative shrink-0 border transition-colors',
                              occupiedId !== null ? 'cursor-pointer border-white/10 bg-[#90c50a] hover:border-endfield-yellow' : isLocked ? 'border-white/10 bg-white/10' : isRestricted ? 'border-red-500/30 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(255,255,255,0.03)_5px,rgba(255,255,255,0.03)_10px)]' : 'border-zinc-800 bg-white/[0.03]',
                              isHintTarget ? 'shadow-[inset_0_0_0_1px_rgba(255,250,0,0.35)] bg-endfield-yellow/[0.06]' : '',
                              isPreview ? 'border-[#90c50a] bg-[#90c50a]/30 shadow-[inset_0_0_0_1px_rgba(144,197,10,0.55)]' : '',
                            ].filter(Boolean).join(' ');

                            return (
                              <button key={`cell-${rowIndex}-${colIndex}`} type="button" onClick={() => occupiedId !== null && removePlacedPiece(occupiedId)} className={cellClassName} style={{ width: cellSize, height: cellSize }}>
                                {isRestricted ? <span className="absolute inset-0 flex items-center justify-center text-sm text-red-500/40">✕</span> : null}
                                {isLocked ? <span className="absolute inset-[5px] border border-white/15" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4 ${isMobile ? 'text-[11px]' : 'text-xs'}`}>
                  <div className="text-zinc-400">将拼图块放入网格，使每行每列的填充数满足约束条件。</div>
                  <div className="font-mono text-zinc-500">操作提示：拖拽放置 · 按 R 旋转 · 点击已放块移除</div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <aside className={`relative shrink-0 overflow-hidden border border-endfield-yellow/20 bg-black/90 shadow-[0_0_28px_rgba(0,0,0,0.28)] ${isMobile ? 'w-full' : 'w-[240px]'}`}>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-endfield-yellow/80 to-transparent" />
          <div className="relative z-10 p-3">
            <div className="border-b border-zinc-800 pb-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">拼图模块</p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">右侧模块区固定为独立卡片。拖拽整张卡片放入网格，按 <span className="border border-zinc-700 px-1 py-0.5 font-mono text-[10px] text-zinc-300">R</span> 旋转当前抓取或选中的模块。</p>
            </div>

            <div className="mt-3 overflow-y-auto pr-1" style={{ maxHeight: trayHeight }}>
              <div className="flex flex-col gap-3">
                {pieces.map((piece, index) => {
                  const maxRow = Math.max(...piece.shape.map(([row]) => row));
                  const maxCol = Math.max(...piece.shape.map(([, col]) => col));
                  const occupied = new Set(piece.shape.map(([row, col]) => `${row},${col}`));
                  const isPlaced = Boolean(placed[piece.id]);
                  const isSelected = selectedPieceId === piece.id;

                  return (
                    <article key={piece.id} className={`relative border px-3 py-3 transition-colors ${isPlaced ? 'border-zinc-900 bg-zinc-950/60 opacity-45' : isSelected ? 'border-endfield-yellow/70 bg-endfield-yellow/[0.07]' : 'border-zinc-800 bg-zinc-950/85 hover:border-zinc-600'}`} onPointerDown={(event) => {
                      if (event.target.closest('[data-rotate]')) return;
                      const captureRect = event.currentTarget.querySelector('[data-piece-grid]')?.getBoundingClientRect() || event.currentTarget.getBoundingClientRect();
                      beginDrag(piece.id, event.clientX, event.clientY, captureRect);
                      event.preventDefault();
                    }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">模块 {String(index + 1).padStart(2, '0')}</div>
                          <div className="mt-1 text-xs text-zinc-300">{piece.shape.length} 格</div>
                        </div>
                        <button type="button" data-rotate={piece.id} disabled={isPlaced} onClick={() => rotatePiece(piece.id)} className="border border-zinc-700 p-2 text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"><RotateCw className="h-3.5 w-3.5" /></button>
                      </div>

                      <div className="mt-3 flex items-center justify-center border border-zinc-900 bg-black/60 p-3">
                        <div className="grid gap-0.5" data-piece-grid={piece.id} style={{ gridTemplateColumns: `repeat(${maxCol + 1}, ${miniCell}px)`, width: trayCardSize, minHeight: trayCardSize }}>
                          {Array.from({ length: (maxRow + 1) * (maxCol + 1) }).map((_, miniIndex) => {
                            const row = Math.floor(miniIndex / (maxCol + 1));
                            const col = miniIndex % (maxCol + 1);
                            const filled = occupied.has(`${row},${col}`);
                            return <span key={`mini-${piece.id}-${miniIndex}`} className={`${filled ? 'bg-[#90c50a]' : 'bg-transparent'} block`} style={{ width: miniCell, height: miniCell, opacity: filled ? 1 : 0 }} />;
                          })}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {drag && dragPiece && dragBounds ? (
        <div className="pointer-events-none fixed z-[9999] rounded-sm border border-endfield-yellow/40 bg-black/50 p-1" style={{ left: drag.x - (drag.grabCol + 0.5) * cellSize, top: drag.y - (drag.grabRow + 0.5) * cellSize }}>
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${dragBounds.cols}, ${cellSize}px)` }}>
            {Array.from({ length: dragBounds.rows * dragBounds.cols }).map((_, index) => {
              const row = Math.floor(index / dragBounds.cols);
              const col = index % dragBounds.cols;
              const filled = dragPiece.shape.some(([shapeRow, shapeCol]) => shapeRow === row && shapeCol === col);
              return <span key={`ghost-${index}`} className={`block ${filled ? 'bg-[#90c50a]/90 shadow-[0_0_10px_rgba(144,197,10,0.45)]' : 'bg-transparent'}`} style={{ width: cellSize, height: cellSize }} />;
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
