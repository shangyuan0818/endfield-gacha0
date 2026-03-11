export function normalizeCells(cells) {
  const minRow = Math.min(...cells.map(([row]) => row));
  const minCol = Math.min(...cells.map(([, col]) => col));

  return cells
    .map(([row, col]) => [row - minRow, col - minCol])
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

export function rotateCells(cells) {
  return normalizeCells(cells.map(([row, col]) => [col, -row]));
}

export function getRotations(cells) {
  const rotations = [];
  const seen = new Set();
  let current = normalizeCells(cells);

  for (let index = 0; index < 4; index += 1) {
    const key = current.map(([row, col]) => `${row},${col}`).join('|');

    if (!seen.has(key)) {
      rotations.push(current);
      seen.add(key);
    }

    current = rotateCells(current);
  }

  return rotations;
}

export function shuffleItems(items) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[swapIndex]] = [nextItems[swapIndex], nextItems[index]];
  }

  return nextItems;
}

export function expandPuzzle(rawPuzzle) {
  if (rawPuzzle?.rowConstraints && rawPuzzle?.pieces) {
    return rawPuzzle;
  }

  return {
    rows: 5,
    cols: 5,
    rowConstraints: rawPuzzle?.rc ?? [],
    colConstraints: rawPuzzle?.cc ?? [],
    pieceCount: rawPuzzle?.p?.length ?? 0,
    pieces: (rawPuzzle?.p ?? []).map((piece, index) => ({
      id: index,
      shape: piece.s,
      cells: piece.s.map(([deltaRow, deltaCol]) => [piece.a[0] + deltaRow, piece.a[1] + deltaCol]),
    })),
    restricted: rawPuzzle?.x ?? [],
    locked: rawPuzzle?.l ?? [],
  };
}

export function buildPlayerUrl(baseUrl, puzzleId) {
  if (!baseUrl || !puzzleId) {
    return '';
  }

  try {
    const url = new URL(baseUrl, window.location.origin);
    url.searchParams.set('puzzleId', String(puzzleId));
    return url.toString();
  } catch {
    return '';
  }
}
