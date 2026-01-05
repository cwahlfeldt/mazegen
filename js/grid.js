export function buildOrthogonalGrid(rows, cols, cellSize) {
  const grid = Array.from({ length: rows }, () => []);
  const cells = [];
  let id = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = {
        id: id++,
        r,
        c,
        x: c * cellSize + cellSize / 2,
        y: r * cellSize + cellSize / 2,
        walls: { top: true, right: true, bottom: true, left: true },
        neighbors: [],
        active: true,
      };
      grid[r][c] = cell;
      cells.push(cell);
    }
  }

  const dirs = [
    { dr: -1, dc: 0, wall: "top", opposite: "bottom" },
    { dr: 0, dc: 1, wall: "right", opposite: "left" },
    { dr: 1, dc: 0, wall: "bottom", opposite: "top" },
    { dr: 0, dc: -1, wall: "left", opposite: "right" },
  ];

  for (const cell of cells) {
    for (const dir of dirs) {
      const nr = cell.r + dir.dr;
      const nc = cell.c + dir.dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        cell.neighbors.push({
          dir: dir.wall,
          opposite: dir.opposite,
          cell: grid[nr][nc],
        });
      }
    }
  }

  return { cells, rows, cols, style: "orthogonal" };
}

export function buildHexGrid(rows, cols, cellSize) {
  const grid = Array.from({ length: rows }, () => []);
  const cells = [];
  let id = 0;
  const root3 = Math.sqrt(3);

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = cellSize * root3 * (c + r / 2);
      const y = cellSize * 1.5 * r;
      const cell = {
        id: id++,
        r,
        c,
        x,
        y,
        walls: { e: true, w: true, se: true, sw: true, ne: true, nw: true },
        neighbors: [],
        active: true,
      };
      grid[r][c] = cell;
      cells.push(cell);
    }
  }

  const dirs = [
    { dq: 1, dr: 0, wall: "e", opposite: "w" },
    { dq: -1, dr: 0, wall: "w", opposite: "e" },
    { dq: 0, dr: 1, wall: "se", opposite: "nw" },
    { dq: 0, dr: -1, wall: "nw", opposite: "se" },
    { dq: 1, dr: -1, wall: "ne", opposite: "sw" },
    { dq: -1, dr: 1, wall: "sw", opposite: "ne" },
  ];

  for (const cell of cells) {
    for (const dir of dirs) {
      const nr = cell.r + dir.dr;
      const nc = cell.c + dir.dq;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        cell.neighbors.push({
          dir: dir.wall,
          opposite: dir.opposite,
          cell: grid[nr][nc],
        });
      }
    }
  }

  return { cells, rows, cols, style: "sigma" };
}

export function buildTriangleGrid(rows, cols, cellSize) {
  const grid = Array.from({ length: rows }, () => []);
  const cells = [];
  let id = 0;
  const triHeight = (Math.sqrt(3) / 2) * cellSize;

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const baseX = c * (cellSize / 2);
      const baseY = r * triHeight;
      const isUp = (r + c) % 2 === 0;
      const points = getTrianglePoints(baseX, baseY, cellSize, triHeight, isUp);
      const center = points.reduce(
        (acc, point) => ({ x: acc.x + point.x / 3, y: acc.y + point.y / 3 }),
        { x: 0, y: 0 }
      );
      const cell = {
        id: id++,
        r,
        c,
        x: center.x,
        y: center.y,
        baseX,
        baseY,
        isUp,
        walls: { left: true, right: true, base: true },
        neighbors: [],
        active: true,
      };
      grid[r][c] = cell;
      cells.push(cell);
    }
  }

  for (const cell of cells) {
    const left = cell.c - 1;
    const right = cell.c + 1;
    const base = cell.isUp ? cell.r + 1 : cell.r - 1;

    if (left >= 0) {
      cell.neighbors.push({
        dir: "left",
        opposite: "right",
        cell: grid[cell.r][left],
      });
    }
    if (right < cols) {
      cell.neighbors.push({
        dir: "right",
        opposite: "left",
        cell: grid[cell.r][right],
      });
    }
    if (base >= 0 && base < rows) {
      cell.neighbors.push({
        dir: "base",
        opposite: "base",
        cell: grid[base][cell.c],
      });
    }
  }

  return { cells, rows, cols, style: "delta" };
}

export function buildPolarGrid(rings, cellsPerRing, cellSize) {
  const ringCount = Math.max(1, rings);
  const ringsData = [];
  const cells = [];
  let id = 0;
  const ringHeight = cellSize;

  const addRing = (count, ringIndex) => {
    const ring = { index: ringIndex, count, cells: [] };
    const innerRadius = ringIndex * ringHeight;
    const outerRadius = (ringIndex + 1) * ringHeight;
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i += 1) {
      const startAngle = i * step;
      const endAngle = (i + 1) * step;
      const midAngle = (startAngle + endAngle) / 2;
      const midRadius = (innerRadius + outerRadius) / 2;
      const cell = {
        id: id++,
        ring: ringIndex,
        index: i,
        x: Math.cos(midAngle) * midRadius,
        y: Math.sin(midAngle) * midRadius,
        startAngle,
        endAngle,
        innerRadius,
        outerRadius,
        walls: { cw: true, ccw: true, inward: ringIndex > 0, outward: [] },
        neighbors: [],
        active: true,
      };
      ring.cells.push(cell);
      cells.push(cell);
    }
    ringsData.push(ring);
  };

  addRing(1, 0);
  if (ringCount > 1) {
    addRing(Math.max(4, cellsPerRing), 1);
  }

  for (let r = 2; r < ringCount; r += 1) {
    const prevCount = ringsData[r - 1].count;
    const radius = r * ringHeight;
    const circumference = 2 * Math.PI * radius;
    const estimatedWidth = circumference / prevCount;
    const ratio = Math.max(1, Math.round(estimatedWidth / ringHeight));
    addRing(prevCount * ratio, r);
  }

  for (let r = 0; r < ringsData.length; r += 1) {
    const ring = ringsData[r];
    const hasRingNeighbors = ring.count > 1;
    const outwardCount =
      r < ringsData.length - 1
        ? Math.max(1, ringsData[r + 1].count / ring.count)
        : 1;
    for (const cell of ring.cells) {
      cell.walls.outward = Array.from({ length: outwardCount }, () => true);
      if (hasRingNeighbors) {
        const cwIndex = (cell.index + 1) % ring.count;
        const ccwIndex = (cell.index - 1 + ring.count) % ring.count;
        cell.neighbors.push({ type: "cw", cell: ring.cells[cwIndex] });
        cell.neighbors.push({ type: "ccw", cell: ring.cells[ccwIndex] });
      } else {
        cell.walls.cw = false;
        cell.walls.ccw = false;
      }
    }
  }

  for (let r = 1; r < ringsData.length; r += 1) {
    const ring = ringsData[r];
    const innerRing = ringsData[r - 1];
    const ratio = ring.count / innerRing.count;
    for (const cell of ring.cells) {
      const inwardIndex = Math.floor(cell.index / ratio);
      const outIndex = cell.index % ratio;
      const inwardCell = innerRing.cells[inwardIndex];
      cell.neighbors.push({ type: "inward", cell: inwardCell, outIndex });
    }
  }

  for (let r = 0; r < ringsData.length - 1; r += 1) {
    const ring = ringsData[r];
    const outerRing = ringsData[r + 1];
    const ratio = outerRing.count / ring.count;
    for (const cell of ring.cells) {
      const start = cell.index * ratio;
      for (let k = 0; k < ratio; k += 1) {
        const outwardCell = outerRing.cells[start + k];
        cell.neighbors.push({ type: "outward", cell: outwardCell, outIndex: k });
      }
    }
  }

  return {
    cells,
    rows: ringCount,
    cols: ringsData.length > 1 ? ringsData[1].count : 1,
    style: "polar",
    outerRadius: ringCount * ringHeight,
  };
}

export function buildGrid(style, rows, cols, cellSize) {
  if (style === "polar") {
    return buildPolarGrid(rows, cols, cellSize);
  }
  if (style === "sigma") {
    return buildHexGrid(rows, cols, cellSize);
  }
  if (style === "delta") {
    return buildTriangleGrid(rows, cols, cellSize);
  }
  return buildOrthogonalGrid(rows, cols, cellSize);
}

export function getTrianglePoints(baseX, baseY, cellSize, triHeight, isUp) {
  if (isUp) {
    return [
      { x: baseX + cellSize / 2, y: baseY },
      { x: baseX + cellSize, y: baseY + triHeight },
      { x: baseX, y: baseY + triHeight },
    ];
  }
  return [
    { x: baseX, y: baseY },
    { x: baseX + cellSize, y: baseY },
    { x: baseX + cellSize / 2, y: baseY + triHeight },
  ];
}

export function getHexPoints(cell, cellSize) {
  const points = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    points.push({
      x: cell.x + cellSize * Math.cos(angle),
      y: cell.y + cellSize * Math.sin(angle),
    });
  }
  return points;
}

export function getCellBounds(grid, cellSize) {
  const cells = grid.cells;
  const style = grid.style;
  if (style === "polar") {
    const radius = grid.outerRadius || grid.rows * cellSize;
    return {
      minX: -radius,
      minY: -radius,
      maxX: radius,
      maxY: radius,
    };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const triHeight = (Math.sqrt(3) / 2) * cellSize;

  for (const cell of cells) {
    let points;
    if (style === "sigma") {
      points = getHexPoints(cell, cellSize);
    } else if (style === "delta") {
      points = getTrianglePoints(cell.baseX, cell.baseY, cellSize, triHeight, cell.isUp);
    } else {
      const half = cellSize / 2;
      points = [
        { x: cell.x - half, y: cell.y - half },
        { x: cell.x + half, y: cell.y - half },
        { x: cell.x + half, y: cell.y + half },
        { x: cell.x - half, y: cell.y + half },
      ];
    }
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  return { minX, minY, maxX, maxY };
}
