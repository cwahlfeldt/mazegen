import { state } from "./state.js";
import { getHexPoints, getTrianglePoints, getCellBounds } from "./grid.js";
import { getBoundaryEdges, getLineWidth, hasWall } from "./maze.js";

const svgNS = "http://www.w3.org/2000/svg";

export function updateViewBox(svg, grid) {
  const bounds = getCellBounds(grid, state.cell);
  const padding = state.cell * 1.2;
  grid.bounds = bounds;
  grid.offsetX = padding - bounds.minX;
  grid.offsetY = padding - bounds.minY;
  state.viewWidth = bounds.maxX - bounds.minX + padding * 2;
  state.viewHeight = bounds.maxY - bounds.minY + padding * 2;
  svg.setAttribute("viewBox", `0 0 ${state.viewWidth} ${state.viewHeight}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
}

function getCellCenter(cell, grid) {
  return {
    x: cell.x + grid.offsetX,
    y: cell.y + grid.offsetY,
  };
}

function clearSvg(svg) {
  while (svg.firstChild) {
    svg.removeChild(svg.firstChild);
  }
}

function createSvgElement(tag, attrs) {
  const el = document.createElementNS(svgNS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, value);
  });
  return el;
}

function drawBackground(svg) {
  svg.appendChild(
    createSvgElement("rect", {
      x: 0,
      y: 0,
      width: state.viewWidth,
      height: state.viewHeight,
      fill: "#fdfbf7",
    })
  );
}

function pushLine(parts, x1, y1, x2, y2) {
  parts.push(`M ${x1} ${y1} L ${x2} ${y2}`);
}

function pushArc(parts, cx, cy, radius, startAngle, endAngle) {
  const x1 = cx + Math.cos(startAngle) * radius;
  const y1 = cy + Math.sin(startAngle) * radius;
  const x2 = cx + Math.cos(endAngle) * radius;
  const y2 = cy + Math.sin(endAngle) * radius;
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  parts.push(`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`);
}

function drawWalls(svg, grid) {
  const parts = [];
  for (const cell of grid.cells) {
    if (!cell.active) {
      continue;
    }
    if (grid.style === "polar") {
      const centerX = grid.offsetX;
      const centerY = grid.offsetY;
      const start = cell.startAngle;
      const end = cell.endAngle;
      const inner = cell.innerRadius;
      const outer = cell.outerRadius;

      if (cell.walls.inward && inner > 0) {
        pushArc(parts, centerX, centerY, inner, start, end);
      }
      if (cell.walls.ccw) {
        pushLine(
          parts,
          centerX + Math.cos(start) * inner,
          centerY + Math.sin(start) * inner,
          centerX + Math.cos(start) * outer,
          centerY + Math.sin(start) * outer
        );
      }
      if (cell.walls.cw) {
        pushLine(
          parts,
          centerX + Math.cos(end) * inner,
          centerY + Math.sin(end) * inner,
          centerX + Math.cos(end) * outer,
          centerY + Math.sin(end) * outer
        );
      }
      const outwardCount = cell.walls.outward.length;
      if (outwardCount > 0) {
        const segmentAngle = (end - start) / outwardCount;
        for (let i = 0; i < outwardCount; i += 1) {
          if (!cell.walls.outward[i]) {
            continue;
          }
          const segStart = start + segmentAngle * i;
          const segEnd = segStart + segmentAngle;
          pushArc(parts, centerX, centerY, outer, segStart, segEnd);
        }
      }
      continue;
    }

    if (grid.style === "sigma") {
      const points = getHexPoints(cell, state.cell).map((point) => ({
        x: point.x + grid.offsetX,
        y: point.y + grid.offsetY,
      }));
      const edges = {
        e: [points[0], points[1]],
        se: [points[1], points[2]],
        sw: [points[2], points[3]],
        w: [points[3], points[4]],
        nw: [points[4], points[5]],
        ne: [points[5], points[0]],
      };
      Object.entries(edges).forEach(([key, segment]) => {
        if (!cell.walls[key]) {
          return;
        }
        pushLine(parts, segment[0].x, segment[0].y, segment[1].x, segment[1].y);
      });
      continue;
    }

    if (grid.style === "delta") {
      const triHeight = (Math.sqrt(3) / 2) * state.cell;
      const points = getTrianglePoints(
        cell.baseX,
        cell.baseY,
        state.cell,
        triHeight,
        cell.isUp
      ).map((point) => ({
        x: point.x + grid.offsetX,
        y: point.y + grid.offsetY,
      }));
      const edges = cell.isUp
        ? {
            left: [points[0], points[2]],
            right: [points[0], points[1]],
            base: [points[1], points[2]],
          }
        : {
            left: [points[0], points[2]],
            right: [points[1], points[2]],
            base: [points[0], points[1]],
          };
      Object.entries(edges).forEach(([key, segment]) => {
        if (!cell.walls[key]) {
          return;
        }
        pushLine(parts, segment[0].x, segment[0].y, segment[1].x, segment[1].y);
      });
      continue;
    }

    const half = state.cell / 2;
    const x = cell.x + grid.offsetX - half;
    const y = cell.y + grid.offsetY - half;
    const size = state.cell;
    if (cell.walls.top) {
      pushLine(parts, x, y, x + size, y);
    }
    if (cell.walls.right) {
      pushLine(parts, x + size, y, x + size, y + size);
    }
    if (cell.walls.bottom) {
      pushLine(parts, x + size, y + size, x, y + size);
    }
    if (cell.walls.left) {
      pushLine(parts, x, y + size, x, y);
    }
  }

  if (!parts.length) {
    return;
  }
  svg.appendChild(
    createSvgElement("path", {
      d: parts.join(" "),
      fill: "none",
      stroke: "#1d1b18",
      "stroke-width": 2,
      "stroke-linecap": "square",
      "stroke-linejoin": "round",
    })
  );
}

function drawPassageLines(svg, grid, stepsLimit = null) {
  const parts = [];

  if (typeof stepsLimit === "number") {
    const limit = Math.min(stepsLimit, state.carveSteps.length);
    for (let i = 0; i <= limit; i += 1) {
      const step = state.carveSteps[i];
      if (!step) {
        continue;
      }
      const from = grid.cells[step.from];
      const to = grid.cells[step.to];
      if (!from || !to) {
        continue;
      }
      const start = getCellCenter(from, grid);
      const end = getCellCenter(to, grid);
      pushLine(parts, start.x, start.y, end.x, end.y);
    }
  } else {
    for (const cell of grid.cells) {
      if (!cell.active) {
        continue;
      }
      const start = getCellCenter(cell, grid);
      for (const neighbor of cell.neighbors) {
        if (cell.id >= neighbor.cell.id) {
          continue;
        }
        if (hasWall(cell, neighbor, grid)) {
          continue;
        }
        const end = getCellCenter(neighbor.cell, grid);
        pushLine(parts, start.x, start.y, end.x, end.y);
      }
    }
  }

  if (!parts.length) {
    return;
  }
  svg.appendChild(
    createSvgElement("path", {
      d: parts.join(" "),
      fill: "none",
      stroke: "#1d1b18",
      "stroke-width": getLineWidth(),
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function getEdgeMidpoint(cell, grid, key) {
  if (grid.style === "sigma") {
    const points = getHexPoints(cell, state.cell).map((point) => ({
      x: point.x + grid.offsetX,
      y: point.y + grid.offsetY,
    }));
    const edges = {
      e: [points[0], points[1]],
      se: [points[1], points[2]],
      sw: [points[2], points[3]],
      w: [points[3], points[4]],
      nw: [points[4], points[5]],
      ne: [points[5], points[0]],
    };
    const segment = edges[key];
    if (!segment) {
      return null;
    }
    return {
      x: (segment[0].x + segment[1].x) / 2,
      y: (segment[0].y + segment[1].y) / 2,
    };
  }
  if (grid.style === "delta") {
    const triHeight = (Math.sqrt(3) / 2) * state.cell;
    const points = getTrianglePoints(
      cell.baseX,
      cell.baseY,
      state.cell,
      triHeight,
      cell.isUp
    ).map((point) => ({
      x: point.x + grid.offsetX,
      y: point.y + grid.offsetY,
    }));
    const edges = cell.isUp
      ? {
          left: [points[0], points[2]],
          right: [points[0], points[1]],
          base: [points[1], points[2]],
        }
      : {
          left: [points[0], points[2]],
          right: [points[1], points[2]],
          base: [points[0], points[1]],
        };
    const segment = edges[key];
    if (!segment) {
      return null;
    }
    return {
      x: (segment[0].x + segment[1].x) / 2,
      y: (segment[0].y + segment[1].y) / 2,
    };
  }
  const center = getCellCenter(cell, grid);
  const half = state.cell / 2;
  const offsets = {
    top: { x: 0, y: -half },
    bottom: { x: 0, y: half },
    left: { x: -half, y: 0 },
    right: { x: half, y: 0 },
  };
  const offset = offsets[key];
  if (!offset) {
    return null;
  }
  return { x: center.x + offset.x, y: center.y + offset.y };
}

function getEndpointMarker(cell, grid, radius) {
  if (!cell) {
    return null;
  }
  if (grid.style === "polar") {
    if (!Array.isArray(cell.walls.outward) || cell.ring !== grid.rows - 1) {
      return getCellCenter(cell, grid);
    }
    const openings = cell.walls.outward
      .map((wall, index) => (wall ? null : index))
      .filter((index) => index !== null);
    if (!openings.length) {
      return getCellCenter(cell, grid);
    }
    const segmentAngle = (cell.endAngle - cell.startAngle) / cell.walls.outward.length;
    const angle = cell.startAngle + segmentAngle * (openings[0] + 0.5);
    const offsetRadius = cell.outerRadius + radius * 1.2;
    return {
      x: grid.offsetX + Math.cos(angle) * offsetRadius,
      y: grid.offsetY + Math.sin(angle) * offsetRadius,
    };
  }

  const edges = getBoundaryEdges(cell, grid);
  const openEdges = edges.filter((edge) => !cell.walls[edge.key]);
  const edge = openEdges[0] || edges[0];
  if (!edge) {
    return getCellCenter(cell, grid);
  }
  const midpoint = getEdgeMidpoint(cell, grid, edge.key);
  if (!midpoint) {
    return getCellCenter(cell, grid);
  }
  const center = getCellCenter(cell, grid);
  const direction = normalizeVector({
    x: midpoint.x - center.x,
    y: midpoint.y - center.y,
  });
  return {
    x: midpoint.x + direction.x * radius * 1.2,
    y: midpoint.y + direction.y * radius * 1.2,
  };
}

function drawEndpoints(svg, grid) {
  if (state.startCellId === null || state.endCellId === null) {
    return;
  }
  const start = grid.cells[state.startCellId];
  const end = grid.cells[state.endCellId];
  if (!start || !end) {
    return;
  }
  const radius = Math.max(4, state.cell * 0.25);
  const startPos = getEndpointMarker(start, grid, radius);
  const endPos = getEndpointMarker(end, grid, radius);
  if (!startPos || !endPos) {
    return;
  }

  svg.appendChild(
    createSvgElement("circle", {
      cx: startPos.x,
      cy: startPos.y,
      r: radius,
      fill: "#2d8f58",
    })
  );

  svg.appendChild(
    createSvgElement("circle", {
      cx: endPos.x,
      cy: endPos.y,
      r: radius,
      fill: "#d6452c",
    })
  );
}

function drawSolution(svg, path, grid) {
  if (!path.length) {
    return;
  }
  const parts = [];
  path.forEach((cell, index) => {
    const point = getCellCenter(cell, grid);
    if (index === 0) {
      parts.push(`M ${point.x} ${point.y}`);
    } else {
      parts.push(`L ${point.x} ${point.y}`);
    }
  });

  svg.appendChild(
    createSvgElement("path", {
      d: parts.join(" "),
      fill: "none",
      stroke: "#2d8f58",
      "stroke-width": getLineWidth(),
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    })
  );
}

export function drawMaze(svg, grid) {
  if (!grid) {
    return;
  }
  clearSvg(svg);

  if (state.showAsLines) {
    drawPassageLines(svg, grid);
  } else {
    drawWalls(svg, grid);
  }

  drawEndpoints(svg, grid);

  if (state.showSolution) {
    drawSolution(svg, state.solution, grid);
  }
}

export function animateBuild(svg, grid) {
  if (!grid) {
    return;
  }
  let stepIndex = 0;

  const drawStep = () => {
    clearSvg(svg);
    drawPassageLines(svg, grid, stepIndex);
    drawEndpoints(svg, grid);
    stepIndex += 1;
    if (stepIndex <= state.carveSteps.length) {
      requestAnimationFrame(drawStep);
    } else {
      drawMaze(svg, grid);
    }
  };

  drawStep();
}

export function exportSvgToPng(svg, filename) {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const image = new Image();
  const scale = window.devicePixelRatio || 1;
  const width = state.viewWidth || svg.viewBox.baseVal.width;
  const height = state.viewHeight || svg.viewBox.baseVal.height;

  image.onload = () => {
    const raster = document.createElement("canvas");
    raster.width = Math.round(width * scale);
    raster.height = Math.round(height * scale);
    const ctx = raster.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0);
    URL.revokeObjectURL(url);
    const link = document.createElement("a");
    link.href = raster.toDataURL("image/png");
    link.download = filename;
    link.click();
  };

  image.src = url;
}
