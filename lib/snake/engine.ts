import { FRUIT_SPRITES, type FruitName } from "./sprites";

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
