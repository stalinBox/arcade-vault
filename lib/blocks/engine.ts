// Port of references/started-games/03-claude-tetris/game.js.
// Same rules as the reference; drawn into a fixed 800x600 canvas (scaled by CSS).

const W = 800;
const H = 600;

const COLS = 10;
const ROWS = 20;
const BLOCK = 28; // reference uses 30; 28 fits the 4:3 frame

// Board origin: 280x560 board centered horizontally.
const BOARD_X = (W - COLS * BLOCK) / 2;
const BOARD_Y = 20;

// "SIGUIENTE" panel, right of the board: 4x4 cells.
const NEXT_X = BOARD_X + COLS * BLOCK + 24;
const NEXT_LABEL_Y = BOARD_Y + 16;
const NEXT_Y = BOARD_Y + 32;
const NEXT_SIZE = 4 * BLOCK;

const COLORS = [
  "",
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#7986cb", // J - indigo
  "#ffb74d", // L - orange
];

const PIECES: number[][][] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const KICKS = [0, -1, 1, -2, 2];
const GHOST_ALPHA = 0.2;
const START_INTERVAL = 1000; // ms
const MAX_DT = 100; // ms: no jump after a background tab

const PREVENT_DEFAULT = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "Enter",
];

type Board = number[][];

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

export interface BlocksController {
  destroy(): void; // cancels rAF and listeners; idempotent
}

export function createBlocks(canvas: HTMLCanvasElement): BlocksController {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  const c = ctx;

  // Game state (closure, never module-level)
  let board: Board = createBoard();
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let over = false;
  let dropInterval = START_INTERVAL;
  let dropAccum = 0;
  let destroyed = false;

  function collide(shape: number[][], ox: number, oy: number) {
    for (let r = 0; r < shape.length; r++) {
      for (let col = 0; col < shape[r].length; col++) {
        if (!shape[r][col]) continue;
        const nx = ox + col;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    for (const kick of KICKS) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let col = 0; col < current.shape[r].length; col++)
        if (current.shape[r][col])
          board[current.y + r][current.x + col] = current.shape[r][col];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, START_INTERVAL - (level - 1) * 90);
    }
  }

  function ghostY() {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) gameOver();
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function gameOver() {
    over = true;
  }

  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    over = false;
    dropInterval = START_INTERVAL;
    dropAccum = 0;
    lastTime = null;
    next = randomPiece();
    spawn();
  }

  // Input: one action per keydown (OS autorepeat included), as in the reference.
  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT_DEFAULT.includes(e.code)) e.preventDefault();
    if (over) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  };
  window.addEventListener("keydown", onKeyDown);

  // Rendering
  function drawBlock(px: number, py: number, colorIndex: number, alpha = 1) {
    if (!colorIndex) return;
    c.globalAlpha = alpha;
    c.fillStyle = COLORS[colorIndex];
    c.fillRect(px + 1, py + 1, BLOCK - 2, BLOCK - 2);
    c.fillStyle = "rgba(255,255,255,0.12)"; // highlight
    c.fillRect(px + 1, py + 1, BLOCK - 2, 4);
    c.globalAlpha = 1;
  }

  function drawCell(col: number, row: number, colorIndex: number, alpha = 1) {
    drawBlock(BOARD_X + col * BLOCK, BOARD_Y + row * BLOCK, colorIndex, alpha);
  }

  function drawGrid() {
    c.strokeStyle = "#22222e";
    c.lineWidth = 0.5;
    for (let col = 1; col < COLS; col++) {
      c.beginPath();
      c.moveTo(BOARD_X + col * BLOCK, BOARD_Y);
      c.lineTo(BOARD_X + col * BLOCK, BOARD_Y + ROWS * BLOCK);
      c.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      c.beginPath();
      c.moveTo(BOARD_X, BOARD_Y + r * BLOCK);
      c.lineTo(BOARD_X + COLS * BLOCK, BOARD_Y + r * BLOCK);
      c.stroke();
    }
    c.lineWidth = 1;
    c.strokeRect(BOARD_X, BOARD_Y, COLS * BLOCK, ROWS * BLOCK);
  }

  function drawNext() {
    c.textAlign = "left";
    c.fillStyle = "rgba(255,255,255,0.65)";
    c.font = "16px monospace";
    c.fillText("SIGUIENTE", NEXT_X, NEXT_LABEL_Y);
    c.strokeStyle = "#22222e";
    c.lineWidth = 1;
    c.strokeRect(NEXT_X, NEXT_Y, NEXT_SIZE, NEXT_SIZE);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let col = 0; col < shape[r].length; col++)
        drawBlock(
          NEXT_X + (offX + col) * BLOCK,
          NEXT_Y + (offY + r) * BLOCK,
          shape[r][col],
        );
  }

  function draw() {
    c.fillStyle = "#000";
    c.fillRect(0, 0, W, H);
    drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let col = 0; col < COLS; col++) drawCell(col, r, board[r][col]);

    if (!over) {
      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++)
        for (let col = 0; col < current.shape[r].length; col++)
          if (current.shape[r][col])
            drawCell(
              current.x + col,
              gy + r,
              current.shape[r][col],
              GHOST_ALPHA,
            );
    }

    for (let r = 0; r < current.shape.length; r++)
      for (let col = 0; col < current.shape[r].length; col++)
        drawCell(current.x + col, current.y + r, current.shape[r][col]);

    drawNext();
  }

  // Main loop: never steps the game after game over (the reference does).
  let lastTime: number | null = null;
  let rafId = 0;

  function update(dt: number) {
    if (over) return;
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) current.y++;
      else lockPiece();
    }
  }

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_DT);
    lastTime = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  initGame();
  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
