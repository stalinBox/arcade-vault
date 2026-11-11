import { FRUIT_SPRITES, FRUITS_SHEET_URL, type FruitName } from "./sprites";

export const COLS = 20;
export const ROWS = 20;
export const CELL = 24;

export const POINTS_PER_FRUIT = 10;
export const FRUITS_PER_LEVEL = 5;
const START_TICK_MS = 150;
const TICK_STEP_MS = 10;
const MIN_TICK_MS = 60;

const FRUIT_NAMES = Object.keys(FRUIT_SPRITES) as FruitName[];

export type Dir = "up" | "down" | "left" | "right";
export type Status = "ready" | "playing" | "lost" | "won";

export interface Cell {
  x: number;
  y: number;
}

export interface Food extends Cell {
  fruit: FruitName;
}

export interface SnakeState {
  snake: Cell[]; // head first
  food: Food | null;
  dir: Dir; // direction applied on the last tick
  pendingDir: Dir | null; // direction accepted for the next tick
  status: Status;
  foodsEaten: number;
}

type Random = () => number;

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const wrap = (value: number, size: number) => ((value % size) + size) % size;

export function createState(random: Random = Math.random): SnakeState {
  const cx = Math.floor(COLS / 2);
  const cy = Math.floor(ROWS / 2);
  const snake = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  return {
    snake,
    food: placeFood(snake, random),
    dir: "right",
    pendingDir: null,
    status: "ready",
    foodsEaten: 0,
  };
}

// Stores the direction for the next tick; the last valid key before the tick wins.
// A 180° turn against the applied direction is ignored, so the snake cannot
// reverse into its own neck, even when several keys arrive in one tick.
export function queueDirection(state: SnakeState, dir: Dir): void {
  if (state.status !== "ready" && state.status !== "playing") return;
  if (dir === OPPOSITE[state.dir]) return;
  state.pendingDir = dir;
  if (state.status === "ready") state.status = "playing";
}

// Picks a random free cell and a random fruit. Null when the board is full.
function placeFood(snake: Cell[], random: Random): Food | null {
  const occupied = new Set(snake.map((c) => c.y * COLS + c.x));
  const free: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!occupied.has(y * COLS + x)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  const cell = free[Math.floor(random() * free.length)];
  const fruit = FRUIT_NAMES[Math.floor(random() * FRUIT_NAMES.length)];
  return { ...cell, fruit };
}

// Separate function so callers keep the wide Status type (no narrowing to "playing").
function isOver(state: SnakeState): boolean {
  return state.status === "lost" || state.status === "won";
}

export function levelOf(state: SnakeState): number {
  return Math.floor(state.foodsEaten / FRUITS_PER_LEVEL) + 1;
}

export function scoreOf(state: SnakeState): number {
  return state.foodsEaten * POINTS_PER_FRUIT;
}

export function tickIntervalMs(state: SnakeState): number {
  const ms = START_TICK_MS - (levelOf(state) - 1) * TICK_STEP_MS;
  return Math.max(MIN_TICK_MS, ms);
}

export function tick(state: SnakeState, random: Random = Math.random): void {
  if (state.status !== "playing") return;

  if (state.pendingDir) {
    state.dir = state.pendingDir;
    state.pendingDir = null;
  }

  const head = state.snake[0];
  const delta = DELTA[state.dir];
  const next: Cell = {
    x: wrap(head.x + delta.x, COLS),
    y: wrap(head.y + delta.y, ROWS),
  };

  const eating =
    state.food !== null && state.food.x === next.x && state.food.y === next.y;

  // The tail leaves this tick unless the snake grows, so only then is it blocked.
  const blockers = eating ? state.snake : state.snake.slice(0, -1);
  if (blockers.some((c) => c.x === next.x && c.y === next.y)) {
    state.status = "lost";
    return;
  }

  state.snake.unshift(next);
  if (!eating) {
    state.snake.pop();
    return;
  }

  state.foodsEaten += 1;
  state.food = placeFood(state.snake, random);
  if (state.food === null) state.status = "won";
}

export const CANVAS_SIZE = COLS * CELL;

const COLOR = {
  board: "#0a0a18",
  grid: "#16163a",
  body: "#00ff88",
  head: "#00f5ff",
  food: "#ff006e",
  title: "#00f5ff",
  sub: "#8a8fb5",
  veil: "rgba(10, 10, 24, 0.72)",
};

const MONO = "monospace";

function overlayFor(
  status: Status,
  paused: boolean,
): { title: string; sub: string } | null {
  if (paused) return { title: "PAUSA", sub: "Pulsa P para reanudar" };
  if (status === "ready") return { title: "PULSA UNA FLECHA", sub: "" };
  if (status === "lost")
    return { title: "GAME OVER", sub: "Enter para reiniciar" };
  if (status === "won")
    return { title: "¡GANASTE!", sub: "Enter para reiniciar" };
  return null;
}

function drawFood(
  ctx: CanvasRenderingContext2D,
  food: Food,
  sheet: HTMLImageElement | null,
): void {
  const px = food.x * CELL;
  const py = food.y * CELL;
  if (sheet === null) {
    ctx.fillStyle = COLOR.food;
    ctx.beginPath();
    ctx.arc(px + CELL / 2, py + CELL / 2, CELL / 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  const rect = FRUIT_SPRITES[food.fruit];
  // Fit the sprite inside the cell without distorting its aspect ratio.
  const scale = Math.min((CELL - 4) / rect.w, (CELL - 4) / rect.h);
  const dw = rect.w * scale;
  const dh = rect.h * scale;
  ctx.drawImage(
    sheet,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    px + (CELL - dw) / 2,
    py + (CELL - dh) / 2,
    dw,
    dh,
  );
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  title: string,
  sub: string,
): void {
  const center = CANVAS_SIZE / 2;
  ctx.fillStyle = COLOR.veil;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = COLOR.title;
  ctx.font = `bold 36px ${MONO}`;
  ctx.fillText(title, center, center - (sub ? 16 : 0));
  if (sub) {
    ctx.fillStyle = COLOR.sub;
    ctx.font = `16px ${MONO}`;
    ctx.fillText(sub, center, center + 24);
  }
}

// Full frame: board, grid, fruit, snake (head drawn last) and status overlay.
// `sheet` is the loaded fruits.png, or null to draw the fallback circle.
export function drawBoard(
  ctx: CanvasRenderingContext2D,
  state: SnakeState,
  paused: boolean,
  sheet: HTMLImageElement | null,
): void {
  ctx.fillStyle = COLOR.board;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.strokeStyle = COLOR.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= COLS; x++) {
    ctx.moveTo(x * CELL + 0.5, 0);
    ctx.lineTo(x * CELL + 0.5, CANVAS_SIZE);
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.moveTo(0, y * CELL + 0.5);
    ctx.lineTo(CANVAS_SIZE, y * CELL + 0.5);
  }
  ctx.stroke();

  if (state.food) drawFood(ctx, state.food, sheet);

  // Tail to head, so the head is painted on top.
  for (let i = state.snake.length - 1; i >= 0; i--) {
    const c = state.snake[i];
    ctx.fillStyle = i === 0 ? COLOR.head : COLOR.body;
    ctx.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
  }

  const message = overlayFor(state.status, paused);
  if (message) drawOverlay(ctx, message.title, message.sub);
}

export interface SnakeStats {
  score: number;
  level: number;
}

export interface SnakeCallbacks {
  onStats(stats: SnakeStats): void; // on start and on change; never per frame
  onGameOver(result: SnakeStats): void; // once per match
  onPauseChange(paused: boolean): void;
}

export interface SnakeController {
  togglePause(): void; // no effect before the first move or after the match ends
  end(): void; // FIN button: ends the match now
  restart(): void;
  destroy(): void; // stops the loop and listeners; idempotent
}

const MAX_FRAME_MS = 50;

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

// Keys typed into form fields or focused controls belong to them, not to the game.
function ignoresKeys(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(el.tagName);
}

export function createSnake(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
): SnakeController {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  let state = createState(Math.random);
  let paused = false;
  let finished = false;
  let destroyed = false;
  let acc = 0;
  let last: number | null = null;
  let rafId = 0;
  let reported: string | null = null;
  let sheet: HTMLImageElement | null = null;

  function emitStats(): void {
    const stats = { score: scoreOf(state), level: levelOf(state) };
    const key = `${stats.score}:${stats.level}`;
    if (key === reported) return;
    reported = key;
    callbacks.onStats(stats);
  }

  function finish(): void {
    if (finished) return;
    finished = true;
    if (paused) {
      paused = false;
      callbacks.onPauseChange(false);
    }
    emitStats();
    callbacks.onGameOver({ score: scoreOf(state), level: levelOf(state) });
  }

  function frame(now: number): void {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);
    if (last === null) last = now;
    const elapsed = Math.min(now - last, MAX_FRAME_MS);
    last = now;

    if (!paused && state.status === "playing") {
      acc += elapsed;
      let interval = tickIntervalMs(state);
      while (acc >= interval && state.status === "playing") {
        acc -= interval;
        tick(state, Math.random);
        interval = tickIntervalMs(state);
      }
      emitStats();
      if (isOver(state)) finish();
    }

    drawBoard(ctx!, state, paused, sheet);
  }

  function startLoop(): void {
    if (!destroyed) rafId = requestAnimationFrame(frame);
  }

  // The loop starts once fruits.png has loaded or failed; a failure draws the fallback circle.
  const image = new Image();
  image.onload = () => {
    if (destroyed) return;
    sheet = image;
    startLoop();
  };
  image.onerror = () => {
    if (destroyed) return;
    sheet = null;
    startLoop();
  };
  image.src = FRUITS_SHEET_URL;

  function togglePause(): void {
    if (destroyed || finished || state.status !== "playing") return;
    paused = !paused;
    if (paused) {
      state.pendingDir = null;
      acc = 0;
    }
    callbacks.onPauseChange(paused);
  }

  function end(): void {
    if (destroyed || finished) return;
    if (state.status === "ready" || state.status === "playing")
      state.status = "lost";
    finish();
  }

  function restart(): void {
    if (destroyed) return;
    state = createState(Math.random);
    paused = false;
    finished = false;
    acc = 0;
    last = null;
    reported = null;
    emitStats();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed || ignoresKeys(e.target)) return;

    const dir = KEY_DIRS[e.key];
    if (dir) {
      e.preventDefault();
      queueDirection(state, dir);
      return;
    }
    if (e.key === " ") {
      e.preventDefault();
      return;
    }
    if (e.key === "p" || e.key === "P") {
      if (!e.repeat) togglePause();
      return;
    }
    if (e.key === "Enter" && finished) {
      e.preventDefault();
      restart();
    }
  }

  window.addEventListener("keydown", onKeyDown);
  emitStats();

  return {
    togglePause,
    end,
    restart,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
