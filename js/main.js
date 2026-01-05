import { SHAPES, STYLES, HISTORY_LIMIT } from "./constants.js";
import {
  clampOdd,
  getSelectedStyle,
  resolveGridType,
  state,
  syncStyleControl,
  updateMazeHeader,
  updateState,
} from "./state.js";
import { buildGrid } from "./grid.js";
import {
  applyShapeMask,
  carveMaze,
  openEntranceExit,
  pickEndpoints,
  solveMaze,
} from "./maze.js";
import { animateBuild, drawMaze, exportSvgToPng, updateViewBox } from "./render.js";
import { buildPayload, loadHistory, saveHistory } from "./storage.js";

const svg = document.getElementById("maze");

const widthInput = document.getElementById("S1WidthTextBox");
const heightInput = document.getElementById("S1HeightTextBox");
const shapeSelect = document.getElementById("ShapeDropDownList");
const styleSelect = document.getElementById("S1TesselationDropDownList");
const generateBtn = document.getElementById("GenerateButton");
const animateBtn = document.getElementById("AnimateButton");
const showSolutionCheck = document.getElementById("ShowSolutionCheckBox");
const showLinesCheck = document.getElementById("ShowAsLinesCheckBox");
const downloadBtn = document.getElementById("DownloadFileButton");
const fileFormatSelect = document.getElementById("FileFormatSelectorList");
const mazeHeader = document.getElementById("MazeHeader");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");

function updateHistoryControls() {
  prevBtn.disabled = state.historyIndex <= 0;
  nextBtn.disabled =
    state.historyIndex < 0 || state.historyIndex >= state.history.length - 1;
}

function applyPayload(payload) {
  state.rows = clampOdd(Number(payload.rows), 5, 51);
  state.cols = clampOdd(Number(payload.cols), 5, 51);
  state.cell = Math.max(10, Math.min(30, Number(payload.cell || state.cell)));
  state.style = payload.style || state.style;
  state.shape = payload.shape || state.shape;
  state.gridType = resolveGridType(state.shape, state.style);

  heightInput.value = state.rows;
  widthInput.value = state.cols;
  shapeSelect.value = String(
    Number(Object.keys(SHAPES).find((key) => SHAPES[key] === state.shape) || 1)
  );
  styleSelect.value = String(
    Number(Object.keys(STYLES).find((key) => STYLES[key] === state.style) || 1)
  );
  syncStyleControl(state.shape, styleSelect);
  if (state.shape !== "rectangular") {
    state.style = getSelectedStyle(styleSelect);
    state.gridType = resolveGridType(state.shape, state.style);
  }

  const grid = buildGrid(state.gridType, state.rows, state.cols, state.cell);
  if (Array.isArray(payload.cells) && payload.cells.length === grid.cells.length) {
    grid.cells.forEach((cell, index) => {
      cell.active = Boolean(payload.cells[index].active);
      const storedWalls = payload.cells[index].walls || {};
      const merged = { ...cell.walls };
      Object.entries(storedWalls).forEach(([key, value]) => {
        merged[key] = Array.isArray(value) ? [...value] : value;
      });
      cell.walls = merged;
    });
    for (const cell of grid.cells) {
      if (!cell.active) {
        cell.neighbors = [];
      } else {
        cell.neighbors = cell.neighbors.filter((neighbor) => neighbor.cell.active);
      }
    }
  } else {
    if (state.shape === "triangular" || state.shape === "hexagonal") {
      applyShapeMask(grid, state.shape);
    }
  }

  updateViewBox(svg, grid);
  state.maze = grid;
  state.carveSteps = [];
  const endpoints = pickEndpoints(grid.cells, grid);
  state.startCellId = endpoints.start ? endpoints.start.id : null;
  state.endCellId = endpoints.end ? endpoints.end.id : null;
  openEntranceExit(grid, endpoints.start, endpoints.end);
  state.solution = solveMaze(grid, state.startCellId, state.endCellId);
  drawMaze(svg, grid);
  updateMazeHeader(mazeHeader);
  updateHistoryControls();
}

function generateMaze() {
  updateState({
    widthInput,
    heightInput,
    shapeSelect,
    styleSelect,
    showLinesCheck,
  });
  const grid = buildGrid(state.gridType, state.rows, state.cols, state.cell);
  if (state.shape === "triangular" || state.shape === "hexagonal") {
    applyShapeMask(grid, state.shape);
  }
  state.carveSteps = carveMaze(grid);
  updateViewBox(svg, grid);
  state.maze = grid;
  const endpoints = pickEndpoints(grid.cells, grid);
  state.startCellId = endpoints.start ? endpoints.start.id : null;
  state.endCellId = endpoints.end ? endpoints.end.id : null;
  openEntranceExit(grid, endpoints.start, endpoints.end);
  state.solution = solveMaze(grid, state.startCellId, state.endCellId);
  drawMaze(svg, grid);
  updateMazeHeader(mazeHeader);

  const payload = buildPayload(state);
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  state.history.push(payload);
  if (state.history.length > HISTORY_LIMIT) {
    state.history.shift();
  }
  state.historyIndex = state.history.length - 1;
  saveHistory(state.history);
  updateHistoryControls();
}

function toggleSolution() {
  if (!state.maze) {
    generateMaze();
  }
  state.showSolution = showSolutionCheck.checked;
  drawMaze(svg, state.maze);
}

function toggleLines() {
  state.showAsLines = showLinesCheck.checked;
  drawMaze(svg, state.maze);
}

function downloadMaze() {
  const format = Number(fileFormatSelect.value);
  if (format !== 9 && format !== 10) {
    window.alert("Only PNG export is supported in this demo.");
    return;
  }
  const shouldShowSolution = format === 10 ? true : state.showSolution;
  const priorSolution = state.showSolution;
  state.showSolution = shouldShowSolution;
  drawMaze(svg, state.maze);
  requestAnimationFrame(() => {
    exportSvgToPng(svg, `maze-${state.rows}x${state.cols}.png`);
    state.showSolution = priorSolution;
    showSolutionCheck.checked = priorSolution;
    drawMaze(svg, state.maze);
  });
}

function showPrevious() {
  if (state.historyIndex <= 0) {
    return;
  }
  state.historyIndex -= 1;
  applyPayload(state.history[state.historyIndex]);
}

function showNext() {
  if (state.historyIndex >= state.history.length - 1) {
    return;
  }
  state.historyIndex += 1;
  applyPayload(state.history[state.historyIndex]);
}

function loadHistoryState() {
  const history = loadHistory();
  if (!history) {
    return false;
  }
  state.history = history;
  state.historyIndex = state.history.length - 1;
  applyPayload(state.history[state.historyIndex]);
  saveHistory(state.history);
  return true;
}

widthInput.addEventListener("change", generateMaze);
heightInput.addEventListener("change", generateMaze);
shapeSelect.addEventListener("change", generateMaze);
styleSelect.addEventListener("change", generateMaze);

generateBtn.addEventListener("click", generateMaze);
animateBtn.addEventListener("click", () => animateBuild(svg, state.maze));
showSolutionCheck.addEventListener("change", toggleSolution);
showLinesCheck.addEventListener("change", toggleLines);
downloadBtn.addEventListener("click", downloadMaze);
prevBtn.addEventListener("click", showPrevious);
nextBtn.addEventListener("click", showNext);

window.addEventListener("resize", () => {
  if (state.maze) {
    updateViewBox(svg, state.maze);
    drawMaze(svg, state.maze);
  }
});

state.showSolution = showSolutionCheck.checked;
state.showAsLines = showLinesCheck.checked;

if (!loadHistoryState()) {
  generateMaze();
}
