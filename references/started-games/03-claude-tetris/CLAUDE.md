# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build, no dependencies, no install needed. Choose one:

```bash
# Option 1: Python HTTP server
python3 -m http.server 8000
# Then open http://localhost:8000

# Option 2: Node.js
npx serve .

# Option 3: PHP server
php -S localhost:8000

# Option 4: Open directly (no server)
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

## Architecture Overview

**Three-file system:** HTML (structure) + CSS (styling) + JS (logic). All game logic lives in `game.js` (~305 lines).

### Game Model

- **Board**: 2D array (ROWS × COLS), where each cell stores `0` (empty) or color index `1–7` (piece type).
- **Pieces**: Defined as 4×4 matrices (PIECES constant). Index 0 = padding, 1–7 = colors.
- **Current/Next**: Objects with `{type, shape, x, y}` tracking active piece and preview.
- **State**: `score`, `lines`, `level`, `paused`, `gameOver`.

### Key Functions & Flow

```
init()
  ├─ createBoard() → empty 20×10 matrix
  ├─ next = randomPiece()
  ├─ spawn() → move next→current, generate new next
  └─ requestAnimationFrame(loop)

loop(timestamp)  [game tick]
  ├─ accumulate time in dropAccum
  ├─ if dropAccum ≥ dropInterval:
  │   └─ move piece down or lockPiece()
  ├─ draw() → render grid + board + ghost + piece
  └─ requestAnimationFrame(loop)

lockPiece()
  ├─ merge() → bake current piece into board
  ├─ clearLines() → remove full rows, update score/level
  └─ spawn() → next piece becomes current

collide(shape, ox, oy)  [core logic]
  └─ returns true if shape hits walls, floor, or existing blocks

tryRotate()  [with wall kick]
  ├─ rotate shape CW
  └─ test [0, -1, +1, -2, +2] column offsets; apply first that clears

hardDrop() / softDrop()
  ├─ hardDrop: skip to ghostY(), award 2 pts/cell
  └─ softDrop: move down 1 row, award 1 pt, lock on collision

ghostY()
  └─ compute landing row for visual preview (drawn at 20% alpha)

keydown handler
  └─ Left/Right/Down/Up/X/Space/P → movement/rotation/drop/pause
```

### Rendering Pipeline

1. **drawGrid()** — faint grid lines
2. **Board blocks** — iterate board, draw color indexes
3. **Ghost piece** — preview where current piece lands (0.2 alpha)
4. **Active piece** — current shape at (x, y)
5. **Next preview** — drawNext() on separate canvas (4×4)

## Customization Points

Edit constants at top of `game.js`:

| Constant     | Default | Meaning                           |
|--------------|---------|-----------------------------------|
| `COLS`       | 10      | Board width (cells)               |
| `ROWS`       | 20      | Board height (cells)              |
| `BLOCK`      | 30      | Pixel size per cell               |
| `COLORS`     | array   | 7 hex colors (I, O, T, S, Z, J, L)|
| `LINE_SCORES`| array   | Points for 1/2/3/4 line clears    |

**Important:** If you change `COLS`, `ROWS`, or `BLOCK`, also update the canvas `width` and `height` in `index.html`:
- `board`: `COLS × BLOCK` by `ROWS × BLOCK` (should be 300×600)
- `next-canvas`: at least 120×120 for piece preview

## Scoring & Progression

- **Base score**: `LINE_SCORES[linesCleared] × level`
  - 1 line: 100 pts, 2 lines: 300 pts, 3 lines: 500 pts, 4 lines (Tetris): 800 pts
- **Bonus**: Hard drop +2 pts/cell, soft drop +1 pt/row
- **Level up**: Every 10 lines cleared. Speed increases: `dropInterval = max(100, 1000 - (level-1)×90)` ms.

## Game States

- **Playing**: Normal gameplay, respond to input.
- **Paused** (`P` key): Freeze animation, show "PAUSA" overlay, hide HUD updates.
- **Game Over**: Spawn fails (piece collides at y=0), show overlay with final score, await restart button.

## Common Edits

**Adjust difficulty:**
- Change dropInterval formula in `clearLines()` or increase initial `dropInterval`
- Tweak LINE_SCORES for different reward

**Add new piece:**
- Add 4×4 matrix to PIECES array (index 1–7 used; skip index 0)
- Add color to COLORS array
- Increment randomPiece() rand range

**Tweak wall kick distances:**
- Modify `kicks` array in `tryRotate()` (currently `[0, -1, 1, -2, 2]`)

**Change appearance:**
- Board size: edit COLS, ROWS, BLOCK; sync canvas dimensions in HTML
- Colors: edit COLORS hex values
- Styling: modify style.css (dark theme, fonts, shadows)
- Ghost opacity: change 0.2 in `drawBlock()` call in draw()

## Known Quirks & Design Decisions

- **Collision on spawn**: If new current piece collides at y=0 (dropped immediately from top), game ends. Authentic Tetris behavior.
- **Wall kick limits**: Only tries ±1 and ±2 column offsets (not full SRS table). Simpler, feels good.
- **Ghost piece alpha**: 0.2 was chosen for subtle visibility without visual clutter.
- **Score multiplier**: Uses current level to reward staying alive; 4-line clears (800 pts) are 8× a 1-line (100 pts) at level 1.
- **O-piece (square) doesn't rotate**: Its matrix is symmetric, so rotation is no-op—acceptable.

## Testing Play Session

1. Start server, open game.
2. Test piece movement (arrows), rotation (↑/X), drops (↓/Space).
3. Clear lines and verify score increments.
4. Trigger level-up (10 lines), watch speed increase.
5. Fill board to trigger Game Over, verify overlay.
6. Click "Reiniciar" (Restart) button, verify state resets.
7. Test pause (P), confirm HUD freeze and overlay.

## File Roles

- **index.html** → DOM + canvas elements + overlay UI
- **style.css** → Dark theme, flexbox layout, backdrop blur for overlays
- **game.js** → Game logic: board model, collision, piece spawn/drop/lock/clear, rendering loop, input handling
