export const COLS = 20;
export const ROWS = 20;
export const CELL = 24;

export type Dir = "up" | "down" | "left" | "right";
export type Status = "ready" | "playing" | "lost" | "won";

export interface Cell {
  x: number;
  y: number;
}

export interface SnakeState {
  snake: Cell[]; // head first
  dir: Dir; // direction applied on the last tick
  pendingDir: Dir | null; // direction accepted for the next tick
  status: Status;
}

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

export function createState(): SnakeState {
  const cx = Math.floor(COLS / 2);
  const cy = Math.floor(ROWS / 2);
  return {
    snake: [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ],
    dir: "right",
    pendingDir: null,
    status: "ready",
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

export function tick(state: SnakeState): void {
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

  // The tail leaves this tick, so the new head may land on it.
  const body = state.snake.slice(0, -1);
  if (body.some((c) => c.x === next.x && c.y === next.y)) {
    state.status = "lost";
    return;
  }

  state.snake.unshift(next);
  state.snake.pop();
}
