import { state } from "./state.js";
import { getCellBounds } from "./grid.js";

export function applyShapeMask(grid, shape) {
  if (grid.style === "polar") {
    return;
  }
  const bounds = getCellBounds(grid, state.cell);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const width = bounds.maxX - bounds.minX || 1;
  const height = bounds.maxY - bounds.minY || 1;

  for (const cell of grid.cells) {
    if (shape === "rectangular") {
      cell.active = true;
      continue;
    }

    const xNorm = (cell.x - centerX) / (width / 2);
    const yNorm = (cell.y - centerY) / (height / 2);
    if (shape === "circular") {
      cell.active = xNorm * xNorm + yNorm * yNorm <= 1;
      continue;
    }
    if (shape === "triangular") {
      const yTop = (cell.y - bounds.minY) / height;
      cell.active = yTop >= Math.abs(xNorm);
      continue;
    }
    if (shape === "hexagonal") {
      const ax = Math.abs(xNorm);
      const ay = Math.abs(yNorm);
      const limit = 0.866;
      cell.active = ay <= limit && ax <= 1 && ax + ay / limit <= 1;
      continue;
    }
    cell.active = true;
  }

  for (const cell of grid.cells) {
    if (!cell.active) {
      cell.neighbors = [];
      continue;
    }
    cell.neighbors = cell.neighbors.filter((neighbor) => neighbor.cell.active);
  }
}

export function resetWalls(grid) {
  for (const cell of grid.cells) {
    Object.entries(cell.walls).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        cell.walls[key] = value.map(() => true);
        return;
      }
      if (grid.style === "polar" && cell.ring === 0 && (key === "cw" || key === "ccw")) {
        cell.walls[key] = false;
        return;
      }
      if (grid.style === "polar" && cell.ring === 0 && key === "inward") {
        cell.walls[key] = false;
        return;
      }
      cell.walls[key] = true;
    });
    cell.visited = false;
  }
}

export function hasWall(cell, neighbor, grid) {
  if (grid.style === "polar") {
    if (neighbor.type === "outward") {
      return cell.walls.outward[neighbor.outIndex];
    }
    if (neighbor.type === "inward") {
      return cell.walls.inward;
    }
    if (neighbor.type === "cw") {
      return cell.walls.cw;
    }
    if (neighbor.type === "ccw") {
      return cell.walls.ccw;
    }
  }
  return cell.walls[neighbor.dir];
}

export function removeWall(cell, neighbor, grid) {
  if (grid.style === "polar") {
    if (neighbor.type === "outward") {
      cell.walls.outward[neighbor.outIndex] = false;
      neighbor.cell.walls.inward = false;
      return;
    }
    if (neighbor.type === "inward") {
      cell.walls.inward = false;
      if (neighbor.outIndex !== undefined) {
        neighbor.cell.walls.outward[neighbor.outIndex] = false;
      }
      return;
    }
    if (neighbor.type === "cw") {
      cell.walls.cw = false;
      neighbor.cell.walls.ccw = false;
      return;
    }
    if (neighbor.type === "ccw") {
      cell.walls.ccw = false;
      neighbor.cell.walls.cw = false;
    }
    return;
  }
  cell.walls[neighbor.dir] = false;
  neighbor.cell.walls[neighbor.opposite] = false;
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function getLineWidth() {
  return Math.max(2, Math.floor(state.cell / 3));
}

function getGridCenter(grid) {
  const bounds = getCellBounds(grid, state.cell);
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

function isBoundaryCell(cell, grid) {
  if (!cell.active) {
    return false;
  }
  if (grid.style === "polar") {
    return cell.ring === grid.rows - 1;
  }
  const neighborDirs = new Set(cell.neighbors.map((neighbor) => neighbor.dir));
  const boundaryEdges = Object.keys(cell.walls).filter((key) => !neighborDirs.has(key));
  if (!boundaryEdges.length) {
    return false;
  }
  // For triangular grids, exclude cells where the only path into the maze
  // is through a non-boundary edge (like the apex triangle)
  if (grid.style === "delta" && cell.neighbors.length === 1) {
    return false;
  }
  return true;
}

export function pickEndpoints(cells, grid) {
  const active = cells.filter((cell) => cell.active);
  if (!active.length) {
    return { start: null, end: null };
  }
  const boundary = active.filter((cell) => isBoundaryCell(cell, grid));
  const candidates = boundary.length ? boundary : active;

  // For triangular shapes, start at apex (top) and end at bottom-right
  if (state.shape === "triangular") {
    const start = candidates.reduce((a, b) =>
      b.y < a.y || (b.y === a.y && Math.abs(b.x) < Math.abs(a.x)) ? b : a
    );
    const end = candidates.reduce((a, b) =>
      b.y > a.y || (b.y === a.y && b.x > a.x) ? b : a
    );
    return { start, end };
  }

  const start = candidates.reduce((a, b) =>
    b.y < a.y || (b.y === a.y && b.x < a.x) ? b : a
  );
  const end = candidates.reduce((a, b) =>
    b.y > a.y || (b.y === a.y && b.x > a.x) ? b : a
  );
  return { start, end };
}

export function getBoundaryEdges(cell, grid) {
  if (grid.style === "polar") {
    if (cell.ring !== grid.rows - 1) {
      return [];
    }
    return cell.walls.outward.map((_, index) => ({ type: "outward", index }));
  }
  const neighborDirs = new Set(cell.neighbors.map((neighbor) => neighbor.dir));
  return Object.keys(cell.walls)
    .filter((key) => !neighborDirs.has(key))
    .map((key) => ({ type: "edge", key }));
}

function getEdgeVector(cell, grid, key) {
  if (grid.style === "sigma") {
    const vectors = {
      e: { x: 1, y: 0 },
      w: { x: -1, y: 0 },
      ne: { x: 0.5, y: -0.866 },
      nw: { x: -0.5, y: -0.866 },
      se: { x: 0.5, y: 0.866 },
      sw: { x: -0.5, y: 0.866 },
    };
    return vectors[key] || { x: 0, y: 0 };
  }
  if (grid.style === "delta") {
    if (key === "base") {
      return { x: 0, y: cell.isUp ? 1 : -1 };
    }
    return key === "left" ? { x: -1, y: 0 } : { x: 1, y: 0 };
  }
  const vectors = {
    top: { x: 0, y: -1 },
    bottom: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  return vectors[key] || { x: 0, y: 0 };
}

function openBoundaryForCell(cell, grid) {
  if (!cell) {
    return;
  }
  const edges = getBoundaryEdges(cell, grid);
  if (!edges.length) {
    return;
  }
  if (grid.style === "polar") {
    const index = edges[Math.floor(edges.length / 2)].index;
    cell.walls.outward[index] = false;
    return;
  }
  const center = getGridCenter(grid);
  const direction = { x: cell.x - center.x, y: cell.y - center.y };
  let bestEdge = edges[0];
  let bestScore = -Infinity;
  for (const edge of edges) {
    const vec = getEdgeVector(cell, grid, edge.key);
    const score = vec.x * direction.x + vec.y * direction.y;
    if (score > bestScore) {
      bestScore = score;
      bestEdge = edge;
    }
  }
  if (bestEdge.type === "edge") {
    cell.walls[bestEdge.key] = false;
  }
}

export function openEntranceExit(grid, start, end) {
  openBoundaryForCell(start, grid);
  openBoundaryForCell(end, grid);
}

export function carveMaze(grid) {
  const steps = [];
  resetWalls(grid);
  const active = grid.cells.filter((cell) => cell.active);
  if (!active.length) {
    return steps;
  }
  const start = active[Math.floor(Math.random() * active.length)];
  start.visited = true;
  const stack = [start];

  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = current.neighbors.filter((neighbor) => !neighbor.cell.visited);

    if (!options.length) {
      stack.pop();
      continue;
    }

    const next = shuffle(options)[0];
    removeWall(current, next, grid);
    next.cell.visited = true;
    stack.push(next.cell);
    steps.push({ from: current.id, to: next.cell.id });
  }

  return steps;
}

export function solveMaze(grid, startId, endId) {
  if (startId === null || endId === null) {
    return [];
  }
  const queue = [startId];
  const visited = new Set([startId]);
  const parent = new Map();

  while (queue.length) {
    const currentId = queue.shift();
    if (currentId === endId) {
      break;
    }
    const cell = grid.cells[currentId];
    for (const neighbor of cell.neighbors) {
      const next = neighbor.cell.id;
      if (hasWall(cell, neighbor, grid)) {
        continue;
      }
      if (visited.has(next)) {
        continue;
      }
      visited.add(next);
      parent.set(next, currentId);
      queue.push(next);
    }
  }

  if (!parent.has(endId) && startId !== endId) {
    return [];
  }

  const path = [];
  let cursor = endId;
  while (cursor !== undefined) {
    path.push(grid.cells[cursor]);
    if (cursor === startId) {
      break;
    }
    cursor = parent.get(cursor);
  }
  return path.reverse();
}
