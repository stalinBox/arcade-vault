// Port of references/started-games/02-asteroids/game.js.
// No DOM access outside createAsteroids(); all game state lives in its closure.
// Colors come from the active skin palette (lib/asteroids/skins.ts).

import {
  DEFAULT_COLOR_MODE,
  DEFAULT_SKIN,
  type ColorMode,
  type SkinId,
} from "@/lib/skins";
import { SKIN_PALETTES, type Palette } from "./skins";

const W = 800;
const H = 600;

const RADII = [0, 16, 30, 50]; // by size 1, 2, 3
const SPEEDS = [0, 85, 55, 32];
const POINTS = [0, 100, 50, 20];

type Keys = Record<string, boolean | undefined>;
type Point = { x: number; y: number };

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

/** Glow for the next draw calls; a palette with glow 0 turns it off. */
function setGlow(ctx: CanvasRenderingContext2D, pal: Palette, color: string) {
  ctx.shadowBlur = pal.glow;
  ctx.shadowColor = color;
}

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    const SPEED = 520;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, pal: Palette) {
    ctx.fillStyle = pal.bullet;
    setGlow(ctx, pal, pal.bullet);
    if (pal.pixel) {
      const s = this.radius * 2;
      ctx.fillRect(
        Math.round(this.x - this.radius),
        Math.round(this.y - this.radius),
        s,
        s,
      );
      return;
    }
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Irregular polygon
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D, pal: Palette) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = pal.asteroid;
    ctx.lineWidth = pal.lineWidth;
    ctx.lineJoin = pal.pixel ? "miter" : "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    if (pal.asteroidFill) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = pal.asteroidFill;
      ctx.fill();
    }
    setGlow(ctx, pal, pal.asteroid);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  dead = false;

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Keys) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;

    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D, pal: Palette) {
    if (this.dead) return;
    // Blink while invincible after respawn
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = pal.ship;
    ctx.lineWidth = pal.lineWidth;
    ctx.lineJoin = pal.pixel ? "miter" : "round";
    setGlow(ctx, pal, pal.ship);

    // Classic silhouette: triangle with rear notch
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.stroke();

    // Thruster flame
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = pal.flame;
      setGlow(ctx, pal, pal.flame);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Particle (explosion) ──────────────────────────────────────────────────────
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, pal: Palette) {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(${pal.particleRgb},${alpha.toFixed(2)})`;
    ctx.lineWidth = pal.particleWidth;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Engine ────────────────────────────────────────────────────────────────────
type GameState = "playing" | "dead" | "gameover";

export interface AsteroidsStats {
  score: number;
  lives: number;
  level: number;
}

export interface AsteroidsCallbacks {
  /** On score, lives or level change, and when a game starts. */
  onStats(stats: AsteroidsStats): void;
  /** Once per game. */
  onGameOver(result: { score: number; level: number }): void;
  onPauseChange(paused: boolean): void;
}

export interface AsteroidsController {
  /** No effect once the game is over. */
  togglePause(): void;
  /** Same as losing every life: fires onGameOver. */
  end(): void;
  /** Starts a new game. */
  restart(): void;
  /** Cancels the loop and removes listeners. Idempotent. */
  destroy(): void;
  /** Swaps the palette in place; the match is untouched. */
  setSkin(skin: SkinId, mode: ColorMode): void;
}

export interface AsteroidsOptions {
  skin?: SkinId;
  mode?: ColorMode;
}

export function createAsteroids(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
  { skin = DEFAULT_SKIN, mode = DEFAULT_COLOR_MODE }: AsteroidsOptions = {},
): AsteroidsController {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  let palette: Palette = SKIN_PALETTES[skin][mode];

  // Input
  const keys: Keys = {};
  const justPressed: Keys = {};

  function clearKeys() {
    for (const k in keys) keys[k] = false;
    for (const k in justPressed) justPressed[k] = false;
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "KeyP" && !e.repeat) togglePause();
    justPressed[e.code] = !keys[e.code];
    keys[e.code] = true;
    if (
      ["Space", "ArrowUp", "ArrowLeft", "ArrowRight", "Enter"].includes(e.code)
    )
      e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function pressed(code: string) {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  // Game state
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: GameState = "playing";
  let deadTimer = 0;
  let paused = false;
  let destroyed = false;
  let lastStats: AsteroidsStats | null = null;

  function emitStats() {
    if (
      lastStats &&
      lastStats.score === score &&
      lastStats.lives === lives &&
      lastStats.level === level
    )
      return;
    lastStats = { score, lives, level };
    callbacks.onStats({ ...lastStats });
  }

  function setPaused(value: boolean) {
    if (paused === value) return;
    paused = value;
    clearKeys();
    lastTime = null; // next dt is 0, no jump after resuming
    callbacks.onPauseChange(paused);
  }

  function togglePause() {
    if (destroyed || state === "gameover") return;
    setPaused(!paused);
  }

  function gameOver() {
    state = "gameover";
    clearKeys();
    emitStats(); // lives = 0 reaches React before onGameOver
    callbacks.onGameOver({ score, level });
  }

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    spawnAsteroids(4);
    setPaused(false);
    lastStats = null; // always announce the start of a game
    emitStats();
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    ship.reset();
    spawnAsteroids(3 + level);
    emitStats();
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      gameOver();
    } else {
      state = "dead";
      deadTimer = 2;
      emitStats();
    }
  }

  function update(dt: number) {
    if (state === "gameover") {
      if (pressed("Enter")) initGame();
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    if (pressed("Space")) bullets.push(...ship.tryShoot());

    ship.update(dt, keys);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);

    // Bullet vs asteroid
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);
    emitStats();

    // Ship vs asteroid
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Level cleared
    if (asteroids.length === 0) nextLevel();
  }

  function drawOverlay(title: string, sub: string) {
    const c = ctx!;
    c.textAlign = "center";
    c.fillStyle = palette.title;
    setGlow(c, palette, palette.title);
    c.font = "bold 46px monospace";
    c.fillText(title, W / 2, H / 2 - 18);
    c.shadowBlur = 0;
    c.font = "18px monospace";
    c.fillStyle = palette.subtitle;
    c.fillText(sub, W / 2, H / 2 + 22);
  }

  function draw() {
    const c = ctx!;
    const pal = palette;
    c.shadowBlur = 0;
    c.fillStyle = pal.board;
    c.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw(c, pal));
    asteroids.forEach((a) => a.draw(c, pal));
    bullets.forEach((b) => b.draw(c, pal));
    ship.draw(c, pal);
    c.shadowBlur = 0;

    if (state === "gameover")
      drawOverlay("GAME OVER", `PUNTAJE: ${score}   —   ENTER PARA REINICIAR`);
    else if (paused) drawOverlay("PAUSA", "P PARA REANUDAR");
  }

  // Main loop
  let lastTime: number | null = null;
  let rafId = 0;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  initGame();
  rafId = requestAnimationFrame(loop);

  return {
    togglePause,
    end() {
      if (destroyed || state === "gameover") return;
      setPaused(false);
      if (!ship.dead) {
        explode(ship.x, ship.y, 14);
        ship.dead = true;
      }
      lives = 0;
      gameOver();
    },
    restart() {
      if (!destroyed) initGame();
    },
    setSkin(nextSkin, nextMode) {
      palette = SKIN_PALETTES[nextSkin][nextMode];
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
