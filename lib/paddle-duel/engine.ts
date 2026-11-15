import {
  SKIN_PALETTES,
  type Palette,
} from "@/lib/paddle-duel/skins";
import type { ColorMode, SkinId } from "@/lib/skins";

export interface PaddleDuelStats {
  score: number;
  lives: number; // 3..0
  level: number; // 1..10
}

export interface PaddleDuelCallbacks {
  onStats(stats: PaddleDuelStats): void; // on start and on change; never per frame
  onGameOver(result: { score: number; level: number }): void; // once per match
  onPauseChange(paused: boolean): void;
}

export interface PaddleDuelController {
  togglePause(): void; // no effect in 'ready' and 'over'
  end(): void; // forces 'over' and fires onGameOver (FIN button); no effect if already over
  restart(): void; // clean match back in 'ready'
  destroy(): void; // cancels rAF and listeners; idempotent
  setSkin(skin: SkinId, mode: ColorMode): void; // swaps the palette; the match is untouched
}

const WIDTH = 800;
const HEIGHT = 600;
const PADDLE_W = 12;
const PADDLE_H = 90;
const PLAYER_X = 32;
const CPU_X = 756;
const PLAYER_SPEED = 440;
const BALL_SIZE = 10;
const BALL_HIT_GAIN = 1.04;
const BALL_MAX_SPEED = 900;
const MAX_BOUNCE_ANGLE = (55 * Math.PI) / 180;
const SERVE_ANGLE = (20 * Math.PI) / 180;
const SERVE_DELAY = 1.0;
const SMASH_WINDOW = 0.15;
const SMASH_GAIN = 1.3;
const CPU_DEAD_ZONE = 6;
const POPUP_TTL = 0.8;
const POPUP_RISE = 30;
const TRAIL_LENGTH = 4;
const START_LIVES = 3;
const MAX_LEVEL = 10;
const MAX_SCORE = 1_000_000;
const MAX_DT = 0.05;

const ballBaseSpeed = (level: number) => 340 + 25 * (level - 1);
const cpuSpeed = (level: number) => 250 + 30 * (level - 1);
const cpuAimError = (level: number) => Math.max(8, 48 - 4 * (level - 1));
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

const FONT = (px: number) => `${px}px "Press Start 2P", monospace`;
const DASH = 12;

type Status = "ready" | "serve" | "playing" | "over";

interface Popup {
  text: string;
  x: number;
  y: number; // starting y; the text rises POPUP_RISE over its life
  ttl: number;
  color: string;
}

// Keys typed into form fields or focused controls belong to them, not to the game.
function ignoresKeys(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(el.tagName);
}

export function createPaddleDuel(
  canvas: HTMLCanvasElement,
  callbacks: PaddleDuelCallbacks,
  options: { skin?: SkinId; mode?: ColorMode } = {},
): PaddleDuelController {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PaddleDuel: 2D canvas context unavailable");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;

  const player = { y: (HEIGHT - PADDLE_H) / 2 };
  const cpu = { y: (HEIGHT - PADDLE_H) / 2, target: HEIGHT / 2 };
  const ball = {
    x: (WIDTH - BALL_SIZE) / 2,
    y: (HEIGHT - BALL_SIZE) / 2,
    vx: 0,
    vy: 0,
    speed: 0,
  };
  const keys = new Set<string>();
  let palette: Palette =
    SKIN_PALETTES[options.skin ?? "classic"][options.mode ?? "dark"];

  let status: Status = "ready";
  let paused = false;
  let serveTimer = 0;
  let serveDir: -1 | 1 = 1;
  let aimError = 0; // CPU aim offset, redrawn on every player return
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let playerGoals = 0;
  let streak = 0; // goals won in a row without conceding
  let rallyHits = 0; // player returns in the current rally
  let clock = 0; // game seconds; advances only while the loop updates
  let smashAt = -Infinity; // clock value of the last Space press
  let popups: Popup[] = [];
  let smashTrail = false; // trail follows the ball from a smash until the next hit
  let trail: { x: number; y: number }[] = []; // previous ball positions, newest first

  let rafId = 0;
  let lastTime: number | null = null;
  let destroyed = false;
  let gameOverSent = false;
  let reported: PaddleDuelStats | null = null; // last stats sent to onStats

  // Sends stats only when they changed; silent after onGameOver until restart().
  function emitStats(): void {
    if (destroyed || gameOverSent) return;
    if (
      reported &&
      reported.score === score &&
      reported.lives === lives &&
      reported.level === level
    ) {
      return;
    }
    reported = { score, lives, level };
    callbacks.onStats({ ...reported });
  }

  // Final stats first, then onGameOver exactly once per match.
  function finish(): void {
    status = "over";
    keys.clear();
    clearTrail();
    emitStats();
    if (destroyed || gameOverSent) return;
    gameOverSent = true;
    callbacks.onGameOver({ score, level });
  }

  function setPaused(value: boolean): void {
    if (paused === value) return;
    paused = value;
    lastTime = null; // no time jump on resume
    callbacks.onPauseChange(paused);
  }

  function addScore(n: number): void {
    score = Math.min(MAX_SCORE, score + n);
  }

  function addPopup(text: string, x: number, y: number, color: string): void {
    popups.push({ text, x, y, ttl: POPUP_TTL, color });
  }

  function clearTrail(): void {
    smashTrail = false;
    trail = [];
  }

  function launchBall(dir: -1 | 1): void {
    rallyHits = 0;
    clearTrail();
    const angle = (Math.random() * 2 - 1) * SERVE_ANGLE;
    ball.x = (WIDTH - BALL_SIZE) / 2;
    ball.y = (HEIGHT - BALL_SIZE) / 2;
    ball.speed = ballBaseSpeed(level);
    ball.vx = dir * Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
    status = "playing";
  }

  function goal(by: "player" | "cpu"): void {
    if (by === "player") {
      playerGoals += 1;
      streak += 1;
      const points = 500 * Math.min(streak, 5);
      addScore(points);
      addPopup(`+${points}`, WIDTH / 2, 260, palette.playerText);
      if (streak >= 2) addPopup(`RACHA ×${streak}`, WIDTH / 2, 220, palette.accentText);
      level = Math.min(MAX_LEVEL, 1 + Math.floor(playerGoals / 2));
      serveDir = 1;
    } else {
      lives -= 1;
      streak = 0;
      serveDir = -1;
    }
    clearTrail();
    if (lives === 0) {
      finish();
    } else {
      status = "serve";
      serveTimer = SERVE_DELAY;
    }
  }

  function bounceOffPaddle(paddleY: number, dir: -1 | 1, smash: boolean): void {
    const offset = clamp(
      (ball.y + BALL_SIZE / 2 - (paddleY + PADDLE_H / 2)) / (PADDLE_H / 2),
      -1,
      1,
    );
    smashTrail = smash;
    trail = [];
    const angle = offset * MAX_BOUNCE_ANGLE;
    ball.speed = Math.min(ball.speed * BALL_HIT_GAIN, BALL_MAX_SPEED);
    if (smash) ball.speed = Math.min(ball.speed * SMASH_GAIN, BALL_MAX_SPEED);
    ball.vx = dir * Math.cos(angle) * ball.speed;
    ball.vy = Math.sin(angle) * ball.speed;
    if (dir === 1) aimError = (Math.random() * 2 - 1) * cpuAimError(level);
  }

  // A Space press within SMASH_WINDOW before contact turns the return into a smash.
  function playerHit(): void {
    const smash = clock - smashAt <= SMASH_WINDOW;
    smashAt = -Infinity;
    rallyHits += 1;
    const points = 10 * Math.min(rallyHits, 10) * (smash ? 2 : 1);
    addScore(points);
    const popupX = PLAYER_X + PADDLE_W + 40;
    const popupY = player.y + PADDLE_H / 2;
    addPopup(`+${points}`, popupX, popupY, palette.playerText);
    if (smash) addPopup("¡POTENTE!", popupX, popupY - 24, palette.accentText);
    bounceOffPaddle(player.y, 1, smash);
  }

  function moveBall(dt: number): void {
    const steps = Math.ceil((ball.speed * dt) / (BALL_SIZE / 2));
    const stepDt = dt / steps;
    for (let i = 0; i < steps; i++) {
      ball.x += ball.vx * stepDt;
      ball.y += ball.vy * stepDt;

      if (ball.y < 0) {
        ball.y = 0;
        ball.vy = Math.abs(ball.vy);
      } else if (ball.y + BALL_SIZE > HEIGHT) {
        ball.y = HEIGHT - BALL_SIZE;
        ball.vy = -Math.abs(ball.vy);
      }

      const overlapsY = (paddleY: number) =>
        ball.y + BALL_SIZE > paddleY && ball.y < paddleY + PADDLE_H;
      if (
        ball.vx < 0 &&
        ball.x < PLAYER_X + PADDLE_W &&
        ball.x + BALL_SIZE > PLAYER_X &&
        overlapsY(player.y)
      ) {
        ball.x = PLAYER_X + PADDLE_W;
        playerHit();
      } else if (
        ball.vx > 0 &&
        ball.x + BALL_SIZE > CPU_X &&
        ball.x < CPU_X + PADDLE_W &&
        overlapsY(cpu.y)
      ) {
        ball.x = CPU_X - BALL_SIZE;
        bounceOffPaddle(cpu.y, -1, false);
      }

      if (ball.x > WIDTH) return goal("player");
      if (ball.x + BALL_SIZE < 0) return goal("cpu");
    }
  }

  // Chases only while the ball comes toward it; otherwise drifts back to center.
  function updateCpu(dt: number): void {
    const chasing = status === "playing" && ball.vx > 0;
    cpu.target = chasing ? ball.y + aimError : HEIGHT / 2;
    const speed = cpuSpeed(level) * (chasing ? 1 : 0.5);
    const diff = cpu.target - (cpu.y + PADDLE_H / 2);
    if (Math.abs(diff) <= CPU_DEAD_ZONE) return;
    const step = Math.min(Math.abs(diff), speed * dt);
    cpu.y = clamp(cpu.y + Math.sign(diff) * step, 0, HEIGHT - PADDLE_H);
  }

  function update(dt: number): void {
    clock += dt;
    const dir =
      (keys.has("arrowdown") || keys.has("s") ? 1 : 0) -
      (keys.has("arrowup") || keys.has("w") ? 1 : 0);
    player.y = clamp(player.y + dir * PLAYER_SPEED * dt, 0, HEIGHT - PADDLE_H);

    updateCpu(dt);
    popups = popups
      .map((p) => ({ ...p, ttl: p.ttl - dt }))
      .filter((p) => p.ttl > 0);

    if (status === "playing") {
      if (smashTrail)
        trail = [{ x: ball.x, y: ball.y }, ...trail].slice(0, TRAIL_LENGTH);
      moveBall(dt);
    } else if (status === "serve") {
      serveTimer -= dt;
      if (serveTimer <= 0) launchBall(serveDir);
    }
  }

  function draw(): void {
    const c = ctx!;
    c.fillStyle = palette.board;
    c.fillRect(0, 0, WIDTH, HEIGHT);

    c.fillStyle = palette.line;
    for (let y = 0; y < HEIGHT; y += DASH * 2) {
      c.fillRect((WIDTH - palette.lineWidth) / 2, y, palette.lineWidth, DASH);
    }

    c.shadowBlur = palette.glow;
    c.shadowColor = palette.player;
    c.fillStyle = palette.player;
    c.fillRect(PLAYER_X, player.y, PADDLE_W, PADDLE_H);

    c.shadowColor = palette.cpu;
    c.fillStyle = palette.cpu;
    c.fillRect(CPU_X, cpu.y, PADDLE_W, PADDLE_H);

    if (status === "ready" || status === "playing") {
      c.shadowColor = palette.ball;
      c.fillStyle = palette.ball;
      trail.forEach((t, i) => {
        c.globalAlpha = 0.5 * (1 - i / TRAIL_LENGTH);
        c.fillRect(t.x, t.y, BALL_SIZE, BALL_SIZE);
      });
      c.globalAlpha = 1;
      c.fillRect(ball.x, ball.y, BALL_SIZE, BALL_SIZE);
    }
    c.shadowBlur = 0;

    for (const p of popups) {
      const age = 1 - p.ttl / POPUP_TTL;
      c.globalAlpha = 1 - age;
      drawText(p.text, p.x, p.y - POPUP_RISE * age, p.color, 16);
    }
    c.globalAlpha = 1;

    drawOverlays();
  }

  function drawText(
    text: string,
    x: number,
    y: number,
    color: string,
    size: number,
  ): void {
    const c = ctx!;
    c.font = FONT(size);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  function drawVeil(): void {
    ctx!.fillStyle = palette.veil;
    ctx!.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawOverlays(): void {
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    if (paused) {
      drawVeil();
      drawText("PAUSA", cx, cy, palette.text, 16);
    } else if (status === "ready") {
      drawText("DUELO PALA", cx, cy - 80, palette.playerText, 16);
      drawText("ESPACIO PARA SACAR", cx, cy + 60, palette.text, 16);
      drawText(
        "↑ ↓ / W S MOVER · ESPACIO GOLPE POTENTE",
        cx,
        cy + 100,
        palette.text,
        10,
      );
    } else if (status === "serve") {
      const playerScored = serveDir === 1;
      drawText(
        playerScored ? "¡PUNTO!" : "PUNTO CPU",
        cx,
        cy,
        playerScored ? palette.playerText : palette.cpuText,
        16,
      );
    } else if (status === "over") {
      drawVeil();
      drawText("GAME OVER", cx, cy - 40, palette.cpuText, 16);
      drawText(`PUNTUACIÓN ${score}`, cx, cy, palette.text, 16);
      drawText("ENTER PARA REINICIAR", cx, cy + 40, palette.text, 16);
    }
  }

  function frame(now: number): void {
    if (destroyed) return;
    rafId = requestAnimationFrame(frame);

    const dt = Math.min((now - (lastTime ?? now)) / 1000, MAX_DT);
    lastTime = now;
    if (!paused) {
      update(dt);
      emitStats();
    }
    draw();
  }

  function togglePause(): void {
    if (destroyed || (status !== "serve" && status !== "playing")) return;
    if (!paused) {
      keys.clear();
      smashAt = -Infinity;
    }
    setPaused(!paused);
  }

  function end(): void {
    if (destroyed || status === "over") return;
    setPaused(false);
    finish();
  }

  function restart(): void {
    if (destroyed) return;
    setPaused(false);
    status = "ready";
    score = 0;
    lives = START_LIVES;
    level = 1;
    playerGoals = 0;
    streak = 0;
    rallyHits = 0;
    aimError = 0;
    serveDir = 1;
    smashAt = -Infinity;
    popups = [];
    clearTrail();
    keys.clear();
    player.y = (HEIGHT - PADDLE_H) / 2;
    cpu.y = (HEIGHT - PADDLE_H) / 2;
    ball.x = (WIDTH - BALL_SIZE) / 2;
    ball.y = (HEIGHT - BALL_SIZE) / 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.speed = 0;
    gameOverSent = false;
    reported = null;
    emitStats();
  }

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed || ignoresKeys(e.target)) return;
    if (!paused) keys.add(e.key.toLowerCase());
    if (e.key === " " && !e.repeat && !paused) {
      if (status === "ready") launchBall(1);
      else if (status === "playing") smashAt = clock;
    } else if ((e.key === "p" || e.key === "P") && !e.repeat) {
      togglePause();
    } else if (e.key === "Enter" && status === "over") {
      restart();
    }
    if (["ArrowUp", "ArrowDown", " ", "Enter"].includes(e.key)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    if (destroyed) return;
    keys.delete(e.key.toLowerCase());
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  emitStats();
  rafId = requestAnimationFrame(frame);

  return {
    togglePause,
    end,
    restart,
    setSkin(skin, mode): void {
      palette = SKIN_PALETTES[skin][mode];
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
