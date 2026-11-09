# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A vanilla HTML5 Canvas implementation of the classic Asteroids arcade game. No build tools, no bundler, no dependencies—just HTML, CSS, and ES6+ JavaScript in a single file.

## Running the Game

**Quick start:** Open `index.html` directly in a browser (double-click), or use a local server:

```bash
npx serve .
```

Then visit `http://localhost:3000`. The game is fully playable immediately.

## Architecture: Single-File Game Loop

`game.js` (12KB) is the entire game logic, organized into clear functional sections:

### Entity Classes
- **Ship**: Player-controlled spaceship with rotation, thrust, shooting, lives, and invincibility timer after respawn
- **Asteroid**: Destructible objects that split into smaller pieces when hit (3 size tiers)
- **Bullet**: Projectiles fired from the ship
- **Particle**: Explosion debris (visual effect only)

### Game State
Global variables track:
- `ship`, `bullets`, `asteroids`, `particles` — active game objects
- `score`, `lives`, `level` — player stats
- `state` — one of `'playing'`, `'dead'`, `'gameover'`
- `deadTimer` — countdown to respawn after death

### Key Mechanics
- **Toroidal wrapping**: Objects wrap around canvas edges (space is a torus)
- **Collision detection**: Distance-based (check `dist()` utility)
- **Asteroid splitting**: Large → medium → small → despawn, each tier worth different points
- **Invincibility**: Player blinks for 3 seconds after respawn

### Game Flow
1. `initGame()` — spawn initial asteroids, reset ship/score/lives
2. `update(dt)` — each frame: handle input, update all entities, check collisions, handle deaths
3. `draw()` — render HUD (score, lives, level), ship, asteroids, bullets, particles
4. `loop(ts)` — requestAnimationFrame callback; calculates delta time and calls update/draw

### Input System
- `keys` object tracks currently held keys
- `justPressed` object tracks keys pressed this frame only
- `pressed(code)` helper checks key state

### Utilities
- `wrap(v, max)` — toroidal wrapping for positions
- `dist(a, b)` — distance between two objects
- `rand(min, max)` — random float; `randInt(min, max)` — random integer

## Common Tasks

**Add a new asteroid size tier:** Modify `RADII`, `SPEEDS`, `POINTS` arrays (indices 0–3), then update split logic in `Asteroid.split()`.

**Adjust game difficulty:** Tweak asteroid spawn count in `initGame()`, speed in `SPEEDS` array, or bullet speed in `Bullet`.

**Change visuals:** Edit canvas drawing code in `draw()` methods of each class, or HUD rendering in `drawHUD()`.

**Debug collision or movement:** Check `update()` logic for entity movement and collision detection; use console.log or pause/step through in browser DevTools.

## Notes

- Canvas is fixed 800×600; positions use world coordinates (no camera/viewport logic needed)
- No persistent game state—reload to restart
- Explosions and power-up mechanics were removed in recent commits; if restoring, check git history for the implementation
