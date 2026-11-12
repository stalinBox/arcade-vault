import {
  DEFAULT_COLOR_MODE,
  DEFAULT_SKIN,
  type ColorMode,
  type SkinId,
} from "@/lib/skins";
import { SKIN_PALETTES, type Palette } from "./skins";
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

/** Glow for the next draw calls; a palette with glow 0 turns it off. */
function setGlow(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  color: string,
): void {
  ctx.shadowBlur = pal.glow;
  ctx.shadowColor = color;
}

// 8-bit fruit: a chunky plus sign on a 4px grid, centered in the cell.
const BLOCK_FRUIT = ["0110", "1111", "1111", "0110"];

function drawFood(
  ctx: CanvasRenderingContext2D,
  food: Food,
  sheet: HTMLImageElement | null,
  pal: Palette,
): void {
  const px = food.x * CELL;
  const py = food.y * CELL;
  if (pal.foodStyle === "block") {
    const unit = 4;
    const off = (CELL - unit * BLOCK_FRUIT.length) / 2;
    ctx.fillStyle = pal.food;
    BLOCK_FRUIT.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        if (row[c] === "1")
          ctx.fillRect(px + off + c * unit, py + off + r * unit, unit, unit);
      }
    });
    return;
  }
  if (sheet === null) {
    setGlow(ctx, pal, pal.food);
    ctx.fillStyle = pal.food;
    ctx.beginPath();
    ctx.arc(px + CELL / 2, py + CELL / 2, CELL / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    return;
  }
  const rect = FRUIT_SPRITES[food.fruit];
  // Fit the sprite inside the cell without distorting its aspect ratio.
  const scale = Math.min((CELL - 4) / rect.w, (CELL - 4) / rect.h);
  const dw = rect.w * scale;
  const dh = rect.h * scale;
  ctx.save();
  ctx.filter = pal.foodFilter;
  if (pal.foodHalo) {
    ctx.shadowBlur = 3;
    ctx.shadowColor = pal.foodHalo;
  } else {
    setGlow(ctx, pal, pal.food);
  }
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
  ctx.restore();
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  title: string,
  sub: string,
  pal: Palette,
): void {
  const center = CANVAS_SIZE / 2;
  ctx.fillStyle = pal.veil;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = pal.title;
  ctx.font = `bold 36px ${MONO}`;
  setGlow(ctx, pal, pal.title);
  ctx.fillText(title, center, center - (sub ? 16 : 0));
  ctx.shadowBlur = 0;
  if (sub) {
    ctx.fillStyle = pal.sub;
    ctx.font = `16px ${MONO}`;
    ctx.fillText(sub, center, center + 24);
  }
}

// Full frame: board, grid, fruit, snake (head drawn last) and status overlay.
// `sheet` is the loaded fruits.png, or null to draw the fallback circle.
// Every color comes from `pal` (lib/snake/skins.ts).
export function drawBoard(
  ctx: CanvasRenderingContext2D,
  state: SnakeState,
  paused: boolean,
  sheet: HTMLImageElement | null,
  pal: Palette = SKIN_PALETTES[DEFAULT_SKIN][DEFAULT_COLOR_MODE],
): void {
  ctx.shadowBlur = 0;
  ctx.fillStyle = pal.board;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  if (pal.grid) {
    ctx.strokeStyle = pal.grid;
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
  }

  if (state.food) drawFood(ctx, state.food, sheet, pal);

  // Tail to head, so the head is painted on top.
  const size = CELL - pal.inset * 2;
  for (let i = state.snake.length - 1; i >= 0; i--) {
    const c = state.snake[i];
    const color = i === 0 ? pal.head : pal.body;
    ctx.fillStyle = color;
    setGlow(ctx, pal, color);
    ctx.fillRect(c.x * CELL + pal.inset, c.y * CELL + pal.inset, size, size);
  }
  ctx.shadowBlur = 0;

  const message = overlayFor(state.status, paused);
  if (message) drawOverlay(ctx, message.title, message.sub, pal);
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
  /** Swaps the palette in place; the match is untouched. */
  setSkin(skin: SkinId, mode: ColorMode): void;
}

export interface SnakeOptions {
  skin?: SkinId;
  mode?: ColorMode;
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
  { skin = DEFAULT_SKIN, mode = DEFAULT_COLOR_MODE }: SnakeOptions = {},
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
  let palette: Palette = SKIN_PALETTES[skin][mode];

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

    drawBoard(ctx!, state, paused, sheet, palette);
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
    setSkin(nextSkin, nextMode) {
      palette = SKIN_PALETTES[nextSkin][nextMode];
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
