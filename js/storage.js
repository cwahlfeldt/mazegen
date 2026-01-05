import { HISTORY_LIMIT, STORAGE_KEY } from "./constants.js";

export function serializeMaze(cells) {
  return cells.map((cell) => ({
    active: cell.active,
    walls: Object.fromEntries(
      Object.entries(cell.walls).map(([key, value]) => [
        key,
        Array.isArray(value) ? [...value] : value,
      ])
    ),
  }));
}

export function buildPayload(state) {
  return {
    rows: state.rows,
    cols: state.cols,
    cell: state.cell,
    style: state.style,
    shape: state.shape,
    cells: state.maze ? serializeMaze(state.maze.cells) : [],
  };
}

export function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function loadHistory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }
    return parsed.slice(-HISTORY_LIMIT);
  } catch (error) {
    return null;
  }
}
