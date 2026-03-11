import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, RefreshCw, RotateCw, User } from 'lucide-react';
import { getRotations, normalizeCells, shuffleItems } from './puzzleUtils';

function getNearestCell(shape, row, col) {
  const directMatch = shape.find(([shapeRow, shapeCol]) => shapeRow === row && shapeCol === col);

  if (directMatch) {
    return directMatch;
  }

  return shape.reduce((bestCell, currentCell) => {
    const currentDistance = Math.abs(currentCell[0] - row) + Math.abs(currentCell[1] - col);

    if (!bestCell) {
      return { cell: currentCell, distance: currentDistance };
    }

    return currentDistance < bestCell.distance ? { cell: currentCell, distance: currentDistance } : bestCell;
  }, null)?.cell ?? shape[0];
}

function buildPieces(puzzle) {
  return shuffleItems(
    puzzle.pieces.map((piece) => {
      const rotations = getRotations(piece.shape);
      const rotation = rotations[Math.floor(Math.random() * rotations.length)];

      return {
        id: piece.id,
        shape: normalizeCells(rotation),
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

  if (!piece) {
    return null;
  }

  const occupied = new Set();

  Object.entries(placements).forEach(([placementId, placement]) => {
    if (Number(placementId) === pieceId) {
      return;
    }

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

export default function PuzzleCaptcha({
  puzzle,
  puzzleId,
  puzzleAuthor,
  playerUrl,
  onVerified,
  onRequestNextPuzzle,
  onRefreshRemotePuzzle,
  isMobile = false,
}) {
  const gridRef = useRef(null);
  const autoVerifyRef = useRef(null);
  const resolvedRef = useRef(false);

  const cellSize = isMobile ? 38 : 46;
  const miniCell = isMobile ? 10 : 12;

  const [pieces, setPieces] = useState(() => buildPieces(puzzle));
  const [placed, setPlaced] = useState({});
  const [selectedPieceId, setSelectedPieceId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [preview, setPreview] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [isWrong, setIsWrong] = useState(false);

  useEffect(() => {
    return () => {
      window.clearTimeout(autoVerifyRef.current);
    };
  }, []);

  const placedEntries = useMemo(() => Object.entries(placed), [placed]);
  const currentCounts = getCountsForPuzzle(puzzle, placed);

  const getPlacedPieceId = (row, col) => {
    const foundPlacement = placedEntries.find(([, placement]) =>
      placement.cells.some(([placedRow, placedCol]) => placedRow === row && placedCol === col),
    );

    return foundPlacement ? Number(foundPlacement[0]) : null;
  };

  const rotatePiece = (pieceId) => {
    setPieces((previousPieces) => previousPieces.map((piece) => (
      piece.id === pieceId
        ? { ...piece, shape: normalizeCells(piece.shape.map(([row, col]) => [col, -row])) }
        : piece
    )));
    setPlaced((previousPlaced) => {
      const nextPlaced = { ...previousPlaced };
      delete nextPlaced[pieceId];
      return nextPlaced;
    });
    setPreview(null);
    setSelectedPieceId(pieceId);
  };

  useEffect(() => {
    const handleKeyboardRotate = (event) => {
      if ((event.key === 'r' || event.key === 'R') && selectedPieceId !== null && !resolvedRef.current) {
        rotatePiece(selectedPieceId);
      }
    };

    window.addEventListener('keydown', handleKeyboardRotate);
    return () => window.removeEventListener('keydown', handleKeyboardRotate);
  }, [selectedPieceId]);

  useEffect(() => {
    if (!drag) {
      return undefined;
    }

    const handlePointerMove = (event) => {
      const gridRect = gridRef.current?.getBoundingClientRect();

      setDrag((previousDrag) => previousDrag ? { ...previousDrag, x: event.clientX, y: event.clientY } : previousDrag);

      if (!gridRect) {
        setPreview(null);
        return;
      }

      const anchorRow = Math.floor((event.clientY - gridRect.top) / cellSize) - drag.grabRow;
      const anchorCol = Math.floor((event.clientX - gridRect.left) / cellSize) - drag.grabCol;
      const cells = getPlaceableCells(puzzle, placed, pieces, drag.id, anchorRow, anchorCol);

      setPreview(cells ? { anchorRow, anchorCol, cells } : null);
    };

    const handlePointerUp = () => {
      if (preview) {
        setPlaced((previousPlaced) => ({
          ...previousPlaced,
          [drag.id]: {
            anchor: [preview.anchorRow, preview.anchorCol],
            cells: preview.cells,
          },
        }));
      }

      setDrag(null);
      setPreview(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [cellSize, drag, pieces, placed, preview, puzzle]);

  useEffect(() => {
    const allPlaced = Object.keys(placed).length === pieces.length && pieces.length > 0;

    if (!allPlaced || resolvedRef.current) {
      return undefined;
    }

    autoVerifyRef.current = window.setTimeout(() => {
      const { rowCounts, colCounts } = getCountsForPuzzle(puzzle, placed);
      const rowsMatch = puzzle.rowConstraints.every((value, index) => value === rowCounts[index]);
      const colsMatch = puzzle.colConstraints.every((value, index) => value === colCounts[index]);

      if (rowsMatch && colsMatch) {
        resolvedRef.current = true;
        onVerified();
        return;
      }

      setIsWrong(true);
      window.setTimeout(() => setIsWrong(false), 520);
      setAttempts((previousAttempts) => {
        const nextAttempts = previousAttempts + 1;

        if (nextAttempts >= 3) {
          window.setTimeout(() => {
            onRequestNextPuzzle();
          }, 680);
        }

        return nextAttempts;
      });
    }, 260);

    return () => window.clearTimeout(autoVerifyRef.current);
  }, [onRequestNextPuzzle, onVerified, pieces.length, placed, puzzle]);

  const handlePiecePointerDown = (event, pieceId) => {
    if (resolvedRef.current) {
      return;
    }

    const piece = pieces.find((item) => item.id === pieceId);

    if (!piece || placed[pieceId]) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const localRow = Math.max(0, Math.floor((event.clientY - bounds.top) / miniCell));
    const localCol = Math.max(0, Math.floor((event.clientX - bounds.left) / miniCell));
    const [grabRow, grabCol] = getNearestCell(piece.shape, localRow, localCol);

    setSelectedPieceId(pieceId);
    setDrag({
      id: pieceId,
      grabRow,
      grabCol,
      x: event.clientX,
      y: event.clientY,
      shape: piece.shape,
    });

    event.preventDefault();
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

  const previewSet = new Set((preview?.cells || []).map(([row, col]) => `${row},${col}`));
  const restrictedSet = new Set((puzzle.restricted || []).map(([row, col]) => `${row},${col}`));
  const lockedSet = new Set((puzzle.locked || []).map(([row, col]) => `${row},${col}`));

  return (
    <div className="relative overflow-hidden border border-zinc-800 bg-[linear-gradient(180deg,rgba(20,20,20,0.96),rgba(9,9,9,0.96))] p-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-endfield-yellow/80 to-transparent" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(255,255,255,0.35) 6px, rgba(255,255,255,0.35) 7px)' }} />

      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-3 border border-zinc-800 bg-black/35 px-3 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">Puzzle Captcha</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm uppercase tracking-[0.22em] text-endfield-yellow">Grid #{puzzleId}</span>
              <span className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                Shared / Simple
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-zinc-500" />
                {puzzleAuthor || '匿名上传者'}
              </span>
              <span className="text-zinc-700">|</span>
              <span>{attempts}/3 次失败</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRequestNextPuzzle}
              className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              换一题
            </button>
            <button
              type="button"
              onClick={onRefreshRemotePuzzle}
              className="inline-flex items-center gap-2 border border-zinc-700 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重拉题库
            </button>
            <button
              type="button"
              disabled={!playerUrl}
              onClick={() => window.open(playerUrl, '_blank', 'noopener,noreferrer')}
              className="inline-flex items-center gap-2 border border-endfield-yellow/60 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-endfield-yellow transition-colors hover:bg-endfield-yellow hover:text-black disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600 disabled:hover:bg-transparent disabled:hover:text-zinc-600"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              前往游玩站
            </button>
          </div>
        </div>

        <div className={`mt-4 flex ${isMobile ? 'flex-col gap-4' : 'gap-4'}`}>
          <div className={`flex-1 border border-zinc-800 bg-black/40 p-3 ${isWrong ? 'animate-[captcha-shake_0.45s_ease-in-out]' : ''}`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Constraint Matrix</p>
                <p className="mt-1 text-xs text-zinc-400">拖拽模块，使行列填充数量与约束完全一致。</p>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[0, 1, 2].map((lightIndex) => (
                  <span
                    key={lightIndex}
                    className={`h-2.5 w-2.5 rounded-full ${
                      Object.keys(placed).length > lightIndex
                        ? 'bg-endfield-yellow shadow-[0_0_8px_rgba(255,250,0,0.65)]'
                        : 'bg-zinc-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div ref={gridRef} className="inline-flex flex-col">
              <div className="flex pl-6">
                {puzzle.colConstraints.map((needCount, columnIndex) => (
                  <div key={`col-${columnIndex}`} className="flex w-[46px] flex-col-reverse items-center gap-1 pb-2" style={{ width: cellSize, height: Math.max(32, Math.ceil(needCount / 1) * 8 + 18) }}>
                    {needCount === 0 ? (
                      <span className="text-xs text-zinc-700">·</span>
                    ) : (
                      Array.from({ length: needCount }).map((_, barIndex) => (
                        <span
                          key={`col-bar-${columnIndex}-${barIndex}`}
                          className={`h-[5px] w-3 transition-all ${
                            currentCounts.colCounts[columnIndex] > needCount
                              ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.65)]'
                              : barIndex < currentCounts.colCounts[columnIndex]
                                ? 'bg-[#90c50a] shadow-[0_0_6px_rgba(144,197,10,0.55)]'
                                : 'bg-zinc-800'
                          }`}
                        />
                      ))
                    )}
                  </div>
                ))}
              </div>

              {(Array.from({ length: puzzle.rows || 5 })).map((_, rowIndex) => (
                <div key={`row-${rowIndex}`} className="flex items-center">
                  <div className="flex h-[46px] w-6 items-center justify-end gap-1 pr-2" style={{ height: cellSize }}>
                    {puzzle.rowConstraints[rowIndex] === 0 ? (
                      <span className="text-xs text-zinc-700">·</span>
                    ) : (
                      Array.from({ length: puzzle.rowConstraints[rowIndex] }).map((_, barIndex) => (
                        <span
                          key={`row-bar-${rowIndex}-${barIndex}`}
                          className={`h-3 w-[5px] transition-all ${
                            currentCounts.rowCounts[rowIndex] > puzzle.rowConstraints[rowIndex]
                              ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.65)]'
                              : barIndex < currentCounts.rowCounts[rowIndex]
                                ? 'bg-[#90c50a] shadow-[0_0_6px_rgba(144,197,10,0.55)]'
                                : 'bg-zinc-800'
                          }`}
                        />
                      ))
                    )}
                  </div>

                  {Array.from({ length: puzzle.cols || 5 }).map((_, colIndex) => {
                    const occupiedId = getPlacedPieceId(rowIndex, colIndex);
                    const isRestricted = restrictedSet.has(`${rowIndex},${colIndex}`);
                    const isLocked = lockedSet.has(`${rowIndex},${colIndex}`);
                    const isPreview = previewSet.has(`${rowIndex},${colIndex}`) && occupiedId === null;

                    return (
                      <button
                        key={`cell-${rowIndex}-${colIndex}`}
                        type="button"
                        onClick={() => {
                          if (occupiedId !== null) {
                            removePlacedPiece(occupiedId);
                          }
                        }}
                        className={`relative shrink-0 border transition-colors ${
                          occupiedId !== null
                            ? 'cursor-pointer border-white/10 bg-[#90c50a] hover:border-endfield-yellow'
                            : isLocked
                              ? 'border-white/10 bg-white/10'
                              : isRestricted
                                ? 'border-red-500/30 bg-[repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(255,255,255,0.03)_5px,rgba(255,255,255,0.03)_10px)]'
                                : isPreview
                                  ? 'border-[#90c50a] bg-[#90c50a]/25'
                                  : 'border-zinc-800 bg-white/[0.03]'
                        }`}
                        style={{ width: cellSize, height: cellSize }}
                      >
                        {isRestricted && <span className="absolute inset-0 flex items-center justify-center text-sm text-red-500/40">✕</span>}
                        {isLocked && <span className="absolute inset-[5px] border border-white/15" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className={`${isMobile ? 'w-full' : 'w-[210px]'} border border-zinc-800 bg-black/40 p-3`}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Puzzle Modules</p>
                <p className="mt-1 text-xs text-zinc-400">点击旋转或直接拖拽到网格。</p>
              </div>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-endfield-yellow">
                {Object.keys(placed).length}/{pieces.length}
              </span>
            </div>

            <div className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
              {pieces.map((piece) => {
                const isPlaced = Boolean(placed[piece.id]);
                const maxRow = Math.max(...piece.shape.map(([row]) => row)) + 1;
                const maxCol = Math.max(...piece.shape.map(([, col]) => col)) + 1;
                const filled = new Set(piece.shape.map(([row, col]) => `${row},${col}`));

                return (
                  <div
                    key={piece.id}
                    className={`border p-2 transition-all ${
                      isPlaced
                        ? 'border-zinc-800 bg-zinc-950/40 opacity-30'
                        : selectedPieceId === piece.id
                          ? 'border-endfield-yellow bg-endfield-yellow/10 shadow-[0_0_12px_rgba(255,250,0,0.12)]'
                          : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">MOD-{piece.id}</span>
                      <button
                        type="button"
                        disabled={isPlaced}
                        onClick={() => rotatePiece(piece.id)}
                        className="inline-flex h-6 w-6 items-center justify-center border border-zinc-800 text-zinc-400 transition-colors hover:border-endfield-yellow hover:text-endfield-yellow disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isPlaced}
                      onPointerDown={(event) => handlePiecePointerDown(event, piece.id)}
                      className="mt-2 w-full touch-none cursor-grab disabled:cursor-not-allowed"
                    >
                      <div
                        className="inline-grid gap-[2px]"
                        style={{ gridTemplateColumns: `repeat(${maxCol}, ${miniCell}px)` }}
                      >
                        {Array.from({ length: maxRow }).flatMap((_, rowIndex) =>
                          Array.from({ length: maxCol }).map((__, colIndex) => (
                            <span
                              key={`${piece.id}-${rowIndex}-${colIndex}`}
                              className={`block border ${filled.has(`${rowIndex},${colIndex}`) ? 'border-white/15 bg-[#90c50a]' : 'border-transparent bg-transparent'}`}
                              style={{ width: miniCell, height: miniCell }}
                            />
                          )),
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 border-t border-zinc-800 pt-3 text-xs leading-6 text-zinc-500">
              <p>拖拽模块放入网格，约束全部满足后自动通过。</p>
              <p>
                快捷键 <span className="border border-zinc-700 px-1 font-mono text-[11px] text-zinc-300">R</span> 旋转当前选中模块。
              </p>
            </div>
          </div>
        </div>

        {drag && (
          <div
            className="pointer-events-none fixed z-[10000] opacity-75 drop-shadow-[0_0_14px_rgba(144,197,10,0.55)]"
            style={{
              left: drag.x - (drag.grabCol + 0.5) * cellSize,
              top: drag.y - (drag.grabRow + 0.5) * cellSize,
            }}
          >
            <div
              className="inline-grid gap-px"
              style={{
                gridTemplateColumns: `repeat(${Math.max(...drag.shape.map(([, col]) => col)) + 1}, ${cellSize}px)`,
              }}
            >
              {Array.from({ length: Math.max(...drag.shape.map(([row]) => row)) + 1 }).flatMap((_, rowIndex) =>
                Array.from({ length: Math.max(...drag.shape.map(([, col]) => col)) + 1 }).map((__, colIndex) => {
                  const isFilled = drag.shape.some(([shapeRow, shapeCol]) => shapeRow === rowIndex && shapeCol === colIndex);

                  return (
                    <span
                      key={`drag-${rowIndex}-${colIndex}`}
                      className={isFilled ? 'border border-white/15 bg-[#90c50a]' : 'border border-transparent bg-transparent'}
                      style={{ width: cellSize, height: cellSize }}
                    />
                  );
                }),
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes captcha-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
