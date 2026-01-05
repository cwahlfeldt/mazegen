# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Maze Foundry is a browser-based procedural maze generator that creates perfect mazes using depth-first carving. The application supports multiple grid types (orthogonal, hexagonal, triangular, polar) and shapes (rectangular, circular, triangular, hexagonal).

## Development

This is a vanilla JavaScript project with no build system or package manager. All development is done directly in the browser.

**Running the application:**
- Open [index.html](index.html) in a web browser
- No server required for basic functionality
- For local development, use any static file server (e.g., `python3 -m http.server`)

## Architecture

### Module Structure

The codebase uses ES6 modules organized into single-responsibility files:

- [js/main.js](js/main.js) - Application entry point, event handlers, and UI coordination
- [js/state.js](js/state.js) - Global application state and state management utilities
- [js/grid.js](js/grid.js) - Grid construction for different tessellation types
- [js/maze.js](js/maze.js) - Maze generation algorithms (carving, solving, endpoint selection)
- [js/render.js](js/render.js) - SVG rendering and visualization
- [js/storage.js](js/storage.js) - LocalStorage persistence for maze history
- [js/constants.js](js/constants.js) - Shared constants and configuration

### Core Concepts

**Grid Types (Tessellations):**
- `orthogonal` - Square cells with 4-way connectivity
- `sigma` - Hexagonal cells with 6-way connectivity
- `delta` - Triangular cells with 3-way connectivity
- `polar` - Circular/radial grid with ring-based structure

**Shape Masking:**
Non-rectangular shapes (circular, triangular, hexagonal) are created by applying geometric masks to rectangular grids. The [applyShapeMask](js/maze.js:4) function deactivates cells outside the shape boundary.

**Maze Generation:**
Uses recursive backtracking (depth-first search) implemented in [carveMaze](js/maze.js:240). The algorithm:
1. Starts from a random active cell
2. Randomly selects unvisited neighbors
3. Removes walls between current and chosen neighbor
4. Records each step for animation playback
5. Backtracks when no unvisited neighbors remain

**Cell Data Structure:**
Each cell contains:
- Position coordinates (`x`, `y`, `r`, `c`)
- `walls` object (structure varies by grid type)
- `neighbors` array with direction and opposite wall information
- `active` flag for shape masking
- Grid-type-specific properties (e.g., `isUp` for triangles, `ring` for polar)

**Rendering Modes:**
- Wall mode: Draws cell boundaries
- Line mode: Draws passage centerlines
Both modes are implemented in [render.js](js/render.js) with separate SVG path generation

**History System:**
Mazes are serialized and stored in LocalStorage (limit: 20). Users can navigate through previous/next mazes. See [storage.js](js/storage.js) for serialization format.

### Critical Implementation Details

**Polar Grid Complexity:**
Polar grids ([buildPolarGrid](js/grid.js:162)) have unique characteristics:
- Cells in outer rings subdivide to maintain aspect ratio
- `walls.outward` is an array (one per subdivided outer neighbor)
- Center cell has no inward wall or rotational walls
- Neighbor relationships use `type` field instead of `dir`

**Wall Removal:**
The [removeWall](js/maze.js:89) function handles bidirectional wall removal. For polar grids, it manages the array-based `outward` walls and corresponding `inward` walls.

**Endpoint Selection:**
[pickEndpoints](js/maze.js:149) selects start/end cells from boundary cells when possible, preferring topmost-leftmost and bottommost-rightmost positions.

**Viewport Management:**
[updateViewBox](js/render.js:7) calculates bounding boxes for each grid type and adds padding. The SVG viewBox is dynamically adjusted based on grid bounds.

## Code Patterns

**State Mutations:**
The global `state` object in [state.js](js/state.js) is mutated directly. No immutability patterns are used.

**Neighbor Traversal:**
```javascript
for (const neighbor of cell.neighbors) {
  if (hasWall(cell, neighbor, grid)) continue;
  // Access neighbor.cell for the actual cell
  // Use neighbor.dir or neighbor.type for wall direction
}
```

**Grid Style Branching:**
Many functions check `grid.style` to handle different tessellation types. Always handle all four types: `orthogonal`, `sigma`, `delta`, `polar`.

**Wall Checking:**
Use [hasWall](js/maze.js:71) rather than directly accessing `cell.walls` - it handles polar grid array indexing.

## Known Limitations

- Only PNG export is implemented (PDF/SVG download shows alert)
- No undo/redo for individual maze modifications
- Animation cannot be paused or stepped through
- History is limited to last 20 mazes
