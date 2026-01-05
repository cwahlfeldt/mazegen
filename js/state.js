import { SHAPES, STYLES } from "./constants.js";

export const state = {
  rows: 21,
  cols: 31,
  cell: 18,
  style: "orthogonal",
  shape: "rectangular",
  gridType: "orthogonal",
  showSolution: false,
  showAsLines: false,
  maze: null,
  carveSteps: [],
  solution: [],
  history: [],
  historyIndex: -1,
  startCellId: null,
  endCellId: null,
  viewWidth: 0,
  viewHeight: 0,
};

export function clampOdd(value, min, max) {
  const clamped = Math.max(min, Math.min(max, value));
  return clamped % 2 === 0 ? clamped - 1 : clamped;
}

export function getSelectedShape(shapeSelect) {
  return SHAPES[Number(shapeSelect.value)] || "rectangular";
}

export function getSelectedStyle(styleSelect) {
  return STYLES[Number(styleSelect.value)] || "orthogonal";
}

export function resolveGridType(shape, style) {
  if (shape === "circular") {
    return "polar";
  }
  if (shape === "triangular") {
    return "delta";
  }
  if (shape === "hexagonal") {
    return "sigma";
  }
  return style;
}

export function syncStyleControl(shape, styleSelect) {
  if (shape === "rectangular") {
    styleSelect.disabled = false;
    return;
  }
  styleSelect.disabled = true;
  if (shape === "triangular") {
    styleSelect.value = "3";
  } else if (shape === "hexagonal") {
    styleSelect.value = "2";
  } else if (shape === "circular") {
    styleSelect.value = "1";
  }
}

export function updateState({
  widthInput,
  heightInput,
  shapeSelect,
  styleSelect,
  showLinesCheck,
}) {
  state.rows = clampOdd(Number(heightInput.value), 5, 51);
  state.cols = clampOdd(Number(widthInput.value), 5, 51);
  state.shape = getSelectedShape(shapeSelect);
  state.style = getSelectedStyle(styleSelect);
  state.gridType = resolveGridType(state.shape, state.style);
  state.showAsLines = showLinesCheck.checked;
  heightInput.value = state.rows;
  widthInput.value = state.cols;
  syncStyleControl(state.shape, styleSelect);
  if (state.shape !== "rectangular") {
    state.style = getSelectedStyle(styleSelect);
    state.gridType = resolveGridType(state.shape, state.style);
  }
}

export function updateMazeHeader(mazeHeader) {
  if (!mazeHeader || !state.maze) {
    return;
  }
  mazeHeader.textContent = `${state.cols} by ${state.rows} ${state.gridType} maze`;
}
