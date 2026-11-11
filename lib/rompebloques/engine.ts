// Port of references/started-games/04-arkanoid/game.js.
// Same rules as the reference. Logic field is 640x640; it is drawn into a fixed
// 800x600 canvas (scaled by CSS) with the field scaled to 600 px and centered.

import {
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  drawFrame,
  drawSprite,
  loadSprites,
  type BlockColor,
} from "./sprites";

const CANVAS_W = 800;
const CANVAS_H = 600;
const FIELD = { w: 640, h: 640 };
const FIELD_SCALE = 600 / 640;
const FIELD_OFFSET_X = 100;

const BLOCK = { w: 64, h: 32, cols: 10, top: 64 }; // sprite 32x16 scaled x2

// 3 maps of 7 rows x 10 cols; '.' = empty
// g=gray(3) h=hotpink(2) r=red y=yellow c=cyan m=magenta v=green (1 hit)
const LEVELS = [
  [
    "gggggggggg",
    "hhhhhhhhhh",
    "rrrrrrrrrr",
    "yyyyyyyyyy",
    "cccccccccc",
    "mmmmmmmmmm",
    "vvvvvvvvvv",
  ],
  [
    "....gg....",
    "...hhhh...",
    "..rrrrrr..",
    ".yyyyyyyy.",
    "cccccccccc",
    ".mmmmmmmm.",
    "..vvvvvv..",
  ],
  [
    "gggggggggg",
    "hghghghghg",
    "r.r.r.r.r.",
    ".y.y.y.y.y",
    "cmcmcmcmcm",
    "hhhhhhhhhh",
    "g.g.g.g.g.",
  ],
];

const BLOCK_TYPES: Record<string, { color: BlockColor; hp: number }> = {
  g: { color: "gray", hp: 3 },
  h: { color: "hotpink", hp: 2 },
  r: { color: "red", hp: 1 },
  y: { color: "yellow", hp: 1 },
  c: { color: "cyan", hp: 1 },
  m: { color: "magenta", hp: 1 },
  v: { color: "green", hp: 1 },
};

const DIFFICULTIES = {
  easy: { ballSpeed: 300, paddleW: 160, lives: 5 },
  normal: { ballSpeed: 360, paddleW: 120, lives: 3 },
  hard: { ballSpeed: 440, paddleW: 90, lives: 2 },
};
type Difficulty = keyof typeof DIFFICULTIES;

const LEVEL_SPEED_STEP = 0.1; // +10 % ball speed per map
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180; // from the vertical
const PADDLE_Y = 600;

type Phase = "ready" | "playing" | "won" | "lost";

interface Block {
  col: number;
  row: number;
  color: BlockColor;
  hp: number;
  maxHp: number;
}

interface Explosion {
  x: number;
  y: number;
  color: BlockColor;
  t: number; // ms elapsed
}

function createBlocks(levelIndex: number): Block[] {
  const blocks: Block[] = [];
  LEVELS[levelIndex].forEach((rowStr, row) => {
    [...rowStr].forEach((ch, col) => {
      const type = BLOCK_TYPES[ch];
      if (type) {
        blocks.push({
          col,
          row,
          color: type.color,
          hp: type.hp,
          maxHp: type.hp,
        });
      }
    });
  });
  return blocks;
}

export function createRompebloques(canvas: HTMLCanvasElement) {
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;

  const normal = DIFFICULTIES.normal;
  const state = {
    phase: "ready" as Phase,
    score: 0,
    lives: normal.lives,
    difficulty: "normal" as Difficulty,
    started: false, // true after the first launch of the game
    paddle: {
      x: (FIELD.w - normal.paddleW) / 2,
      y: PADDLE_Y,
      w: normal.paddleW,
      h: 14,
      speed: 480,
    },
    ball: {
      x: FIELD.w / 2,
      y: PADDLE_Y - 8,
      r: 8,
      vx: 0,
      vy: 0,
      speed: normal.ballSpeed,
    },
    level: 0, // index into LEVELS (0..2)
    blocks: createBlocks(0),
    explosions: [] as Explosion[],
  };

  const keys = { left: false, right: false };
  let paused = false;

  // Sound: one shared channel; a new sound cuts the one playing.
  const sounds = {
    bounce: new Audio("/games/rompebloques/sounds/ball-bounce.mp3"),
    break: new Audio("/games/rompebloques/sounds/break-sound.mp3"),
  };
  for (const s of Object.values(sounds)) s.preload = "auto";
  let currentSound: HTMLAudioElement | null = null;

  function playSound(name: keyof typeof sounds) {
    if (currentSound) {
      currentSound.pause();
      currentSound.currentTime = 0;
    }
    currentSound = sounds[name];
    currentSound.currentTime = 0;
    currentSound.play().catch(() => {}); // autoplay blocked: ignore
  }

  // Paddle and lives follow the current difficulty.
  function applyDifficulty() {
    const d = DIFFICULTIES[state.difficulty];
    state.paddle.w = d.paddleW;
    state.paddle.x = (FIELD.w - d.paddleW) / 2;
    state.lives = d.lives;
  }

  function resetGame() {
    paused = false;
    lastTime = null;
    state.phase = "ready";
    state.score = 0;
    state.level = 0;
    state.started = false;
    applyDifficulty();
    state.ball.vx = state.ball.vy = 0;
    state.blocks = createBlocks(state.level);
    state.explosions = [];
  }

  function togglePause() {
    if (state.phase === "won" || state.phase === "lost") return;
    paused = !paused;
    lastTime = null; // no time jump on resume
    if (paused) currentSound?.pause(); // never resumed
  }

  function launch() {
    state.phase = "playing";
    state.started = true;
    state.ball.speed =
      DIFFICULTIES[state.difficulty].ballSpeed *
      (1 + LEVEL_SPEED_STEP * state.level);
    state.ball.vx = 0;
    state.ball.vy = -state.ball.speed;
  }

  function stickBallToPaddle() {
    const p = state.paddle;
    const b = state.ball;
    b.x = p.x + p.w / 2;
    b.y = p.y - b.r;
  }

  function loseLife() {
    state.lives--;
    state.phase = state.lives > 0 ? "ready" : "lost";
    state.ball.vx = state.ball.vy = 0;
  }

  // No blocks left: next map in 'ready' (score and lives kept) or win on the last.
  function clearLevel() {
    if (state.level >= LEVELS.length - 1) {
      state.phase = "won";
      return;
    }
    state.level++;
    state.blocks = createBlocks(state.level);
    state.explosions = [];
    state.ball.vx = state.ball.vy = 0;
    stickBallToPaddle();
    state.phase = "ready";
  }

  function collideBallPaddle() {
    const p = state.paddle;
    const b = state.ball;
    if (b.vy <= 0) return;
    const hit =
      b.y + b.r >= p.y &&
      b.y - b.r <= p.y + p.h &&
      b.x >= p.x - b.r &&
      b.x <= p.x + p.w + b.r;
    if (!hit) return;
    const offset = Math.max(
      -1,
      Math.min(1, (b.x - (p.x + p.w / 2)) / (p.w / 2)),
    );
    const angle = offset * MAX_BOUNCE_ANGLE;
    b.vx = b.speed * Math.sin(angle);
    b.vy = -b.speed * Math.cos(angle);
    b.y = p.y - b.r;
    playSound("bounce");
  }

  function collideBallBlocks() {
    const b = state.ball;
    for (let i = 0; i < state.blocks.length; i++) {
      const k = state.blocks[i];
      const bx = k.col * BLOCK.w;
      const by = BLOCK.top + k.row * BLOCK.h;
      const cx = Math.max(bx, Math.min(b.x, bx + BLOCK.w));
      const cy = Math.max(by, Math.min(b.y, by + BLOCK.h));
      if ((b.x - cx) ** 2 + (b.y - cy) ** 2 >= b.r * b.r) continue;

      // Penetration per side; bounce on the axis with the least penetration.
      const fromLeft = b.x + b.r - bx;
      const fromRight = bx + BLOCK.w - (b.x - b.r);
      const fromTop = b.y + b.r - by;
      const fromBottom = by + BLOCK.h - (b.y - b.r);
      const min = Math.min(fromLeft, fromRight, fromTop, fromBottom);
      if (min === fromLeft) {
        b.x -= fromLeft;
        b.vx = -Math.abs(b.vx);
      } else if (min === fromRight) {
        b.x += fromRight;
        b.vx = Math.abs(b.vx);
      } else if (min === fromTop) {
        b.y -= fromTop;
        b.vy = -Math.abs(b.vy);
      } else {
        b.y += fromBottom;
        b.vy = Math.abs(b.vy);
      }

      if (--k.hp <= 0) {
        playSound("break");
        state.score += k.maxHp * 10;
        state.explosions.push({ x: bx, y: by, color: k.color, t: 0 });
        state.blocks.splice(i, 1);
        if (state.blocks.length === 0) clearLevel();
      }
      return; // one block per sub-step
    }
  }

  function stepBall(dt: number) {
    const b = state.ball;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = Math.abs(b.vx);
      playSound("bounce");
    } else if (b.x + b.r > FIELD.w) {
      b.x = FIELD.w - b.r;
      b.vx = -Math.abs(b.vx);
      playSound("bounce");
    }
    if (b.y - b.r < 0) {
      b.y = b.r;
      b.vy = Math.abs(b.vy);
      playSound("bounce");
    }
    collideBallPaddle();
    collideBallBlocks();
    if (b.y - b.r > FIELD.h) loseLife();
  }

  function update(dt: number) {
    const p = state.paddle;
    const b = state.ball;
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    p.x = Math.max(0, Math.min(FIELD.w - p.w, p.x + dir * p.speed * dt));

    for (const e of state.explosions) e.t += dt * 1000;
    state.explosions = state.explosions.filter((e) => e.t < EXPLOSION_DURATION);

    if (state.phase === "ready") {
      stickBallToPaddle();
    } else if (state.phase === "playing") {
      // Sub-steps: per-step displacement never exceeds the radius (no tunneling).
      const steps = Math.ceil((b.speed * dt) / b.r);
      for (let i = 0; i < steps && state.phase === "playing"; i++) {
        stepBall(dt / steps);
      }
    }
  }

  const DIFFICULTY_KEYS: Record<string, Difficulty> = {
    Digit1: "easy",
    Digit2: "normal",
    Digit3: "hard",
  };
  const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    easy: "Fácil",
    normal: "Normal",
    hard: "Difícil",
  };
  const PREVENT_DEFAULT = ["ArrowLeft", "ArrowRight", "Space", "Enter"];

  // Typing in a form field (e.g. the score name) must not drive the game.
  function isTyping(e: KeyboardEvent) {
    const t = e.target;
    return (
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      t instanceof HTMLSelectElement
    );
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e)) return;
    if (PREVENT_DEFAULT.includes(e.code)) e.preventDefault();
    switch (e.code) {
      case "ArrowLeft":
        keys.left = true;
        break;
      case "ArrowRight":
        keys.right = true;
        break;
      case "Space":
        if (e.repeat || paused) break;
        if (state.phase === "ready") launch();
        else if (state.phase === "won" || state.phase === "lost") resetGame();
        break;
      case "Enter":
        if (e.repeat || paused) break;
        if (state.phase === "won" || state.phase === "lost") resetGame();
        break;
      case "KeyP":
        if (!e.repeat) togglePause();
        break;
      case "Digit1":
      case "Digit2":
      case "Digit3":
        // Only in 'ready' before the first launch of the game.
        if (!paused && state.phase === "ready" && !state.started) {
          state.difficulty = DIFFICULTY_KEYS[e.code];
          applyDifficulty();
        }
        break;
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft") keys.left = false;
    else if (e.code === "ArrowRight") keys.right = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function drawOverlay(title: string, sub?: string, veil = false) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (veil) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "48px monospace";
    ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2);
    if (sub) {
      ctx.font = "20px monospace";
      ctx.fillText(sub, CANVAS_W / 2, CANVAS_H / 2 + 48);
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#1b1b2f";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Field: 640x640 logic units -> 600 px, centered horizontally.
    ctx.setTransform(FIELD_SCALE, 0, 0, FIELD_SCALE, FIELD_OFFSET_X, 0);

    for (const k of state.blocks) {
      drawSprite(
        ctx,
        `block_${k.color}`,
        k.col * BLOCK.w,
        BLOCK.top + k.row * BLOCK.h,
        BLOCK.w,
        BLOCK.h,
      );
    }

    for (const e of state.explosions) {
      const frames = EXPLOSION_FRAMES[e.color];
      const i = Math.min(
        frames.length - 1,
        Math.floor((e.t / EXPLOSION_DURATION) * frames.length),
      );
      if (e.color === "gray") ctx.filter = "grayscale(1)";
      drawFrame(ctx, frames[i], e.x, e.y, BLOCK.w, BLOCK.h);
      if (e.color === "gray") ctx.filter = "none";
    }

    const p = state.paddle;
    drawSprite(ctx, "paddle", p.x, p.y, p.w, p.h);

    const b = state.ball;
    drawSprite(ctx, "ball", b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);

    if (paused) {
      drawOverlay("PAUSA", undefined, true);
    } else if (state.phase === "ready") {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "24px monospace";
      ctx.fillText("Pulsa Espacio para lanzar", CANVAS_W / 2, 440);
      ctx.font = "18px monospace";
      ctx.fillText(
        `Dificultad: ${DIFFICULTY_LABELS[state.difficulty]} · 1/2/3 cambia`,
        CANVAS_W / 2,
        474,
      );
    } else if (state.phase === "lost" || state.phase === "won") {
      drawOverlay(
        state.phase === "won" ? "¡GANASTE!" : "GAME OVER",
        `Puntuación: ${state.score}`,
      );
    }
  }

  let raf = 0;
  let destroyed = false;
  let lastTime: number | null = null;

  function frame(now: number) {
    if (destroyed) return;
    if (lastTime !== null && !paused) {
      update(Math.min((now - lastTime) / 1000, 0.05)); // dt in s, capped at 50 ms
    }
    lastTime = now;
    draw();
    raf = requestAnimationFrame(frame);
  }

  loadSprites(() => {
    if (!destroyed) raf = requestAnimationFrame(frame);
  });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      currentSound?.pause();
    },
  };
}
