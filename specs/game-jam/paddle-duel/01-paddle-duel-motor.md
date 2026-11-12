# SPEC GJ-01 — DUELO PALA: motor del juego en `lib/paddle-duel/engine.ts`

**Estado:** Borrador
**Fecha:** 2026-11-12
**Depende de:** SPEC 01 (marco `.crt`, escalado `.crt-screen canvas`), SPEC 04 (base del proyecto), SPEC 05 (patrón de engine + player), SPEC 07 (rango de `scores.score` 0–1 000 000), SPEC 09 (física de paleta y bola con sub-pasos, `specs/09-rompebloques-jugable.md`), SPEC 10 (último patrón de engine, `specs/10-snake-jugable.md`)
**Fuente de referencia:** Sin referencia: diseño propio.

**Objetivo:** Crear el motor de DUELO PALA, un duelo de palas contra la CPU con vidas, niveles y puntos por rally y racha, como módulo TS autónomo que dibuja en un `<canvas>` y avisa a React mediante callbacks.

---

## 1. Alcance

### Incluido

- Módulo TS `lib/paddle-duel/engine.ts` sin dependencias de DOM global salvo los listeners de teclado en `window` (mismo patrón que `lib/snake/engine.ts`): recibe el `<canvas>` y callbacks, devuelve un controlador.
- Campo horizontal 800 × 600: pala del jugador a la izquierda (cian), pala de la CPU a la derecha (magenta), bola cuadrada (amarilla), línea central discontinua.
- Física: rebote en techo y suelo, rebote en las palas con ángulo según el punto de impacto (máx. 55°), aceleración por golpe, sub-pasos contra el túnel.
- Golpe potente: `Espacio` pulsado justo antes del contacto devuelve la bola más rápida y duplica los puntos del golpe.
- CPU con velocidad máxima, error de puntería y retorno al centro que dependen del nivel.
- Vidas (3), nivel (1–10), puntuación por rally y por racha de puntos ganados, con clamp a 1 000 000.
- Estados `ready | serve | playing | over`, más `paused` como indicador aparte.
- Overlays en el canvas: `ready`, `serve` (`¡PUNTO!` / `PUNTO CPU`), `PAUSA`, `GAME OVER`; textos flotantes de puntos, racha y golpe potente.
- Callbacks `onStats`, `onGameOver`, `onPauseChange` y controlador `togglePause`, `end`, `restart`, `destroy`.
- Bloqueo del scroll con `↑`, `↓`, `Espacio` y `Enter`.

### NO incluido (otras specs)

- Componente `components/paddle-duel-player.tsx`, HUD, `ScoreForm`, fila en `games`, portada `.cover-paddle-duel` y entrada en `GAME_PLAYERS`: todo en `specs/game-jam/paddle-duel/02-paddle-duel-plataforma.md`.
- Modo de dos jugadores locales u online.
- Controles táctiles y ratón.
- Sonido, sprites e imágenes: todo se dibuja con primitivas de canvas.
- Power-ups, varias bolas, obstáculos en el campo.
- Marcador de goles dibujado en el canvas (ver sección 6).
- Tests automatizados (el repo no tiene runner).

---

## 2. Modelo de datos

Sin datos persistentes. Todo vive en memoria dentro de la closure de `createPaddleDuel`.

### Fila del catálogo

No aplica en este spec. La fila de `games` (`id = 'paddle-duel'`, `cat = 'VERSUS'`, `color = 'cyan'`) se define en `specs/game-jam/paddle-duel/02-paddle-duel-plataforma.md`.

### Engine (solo memoria)

```ts
// lib/paddle-duel/engine.ts
export interface PaddleDuelStats {
  score: number;
  lives: number; // 3..0
  level: number; // 1..10
}

export interface PaddleDuelCallbacks {
  onStats(stats: PaddleDuelStats): void; // al iniciar y al cambiar; nunca cada frame
  onGameOver(result: { score: number; level: number }): void; // una vez por partida
  onPauseChange(paused: boolean): void;
}

export interface PaddleDuelController {
  togglePause(): void; // sin efecto en 'ready' y 'over'
  end(): void; // fuerza 'over' y dispara onGameOver (botón FIN); sin efecto si ya terminó
  restart(): void; // nueva partida limpia en 'ready'
  destroy(): void; // cancela rAF y listeners; idempotente
}

export function createPaddleDuel(
  canvas: HTMLCanvasElement,
  callbacks: PaddleDuelCallbacks,
): PaddleDuelController;
```

### Constantes

| Constante               | Valor                             | Uso                                                          |
| ----------------------- | --------------------------------- | ------------------------------------------------------------ |
| `WIDTH` × `HEIGHT`      | 800 × 600                         | Tamaño interno del canvas (4:3, como Asteroides y Bloques)   |
| `PADDLE_W` × `PADDLE_H` | 12 × 90                           | Tamaño de ambas palas                                        |
| `PLAYER_X` / `CPU_X`    | 32 / 756                          | Borde izquierdo de cada pala                                 |
| `PLAYER_SPEED`          | 440 px/s                          | Velocidad de la pala del jugador                             |
| `BALL_SIZE`             | 10                                | Lado de la bola cuadrada                                     |
| `BALL_BASE_SPEED`       | `340 + 25 × (level − 1)` px/s     | Velocidad de saque                                           |
| `BALL_HIT_GAIN`         | 1.04                              | Multiplicador de velocidad por cada golpe de pala            |
| `BALL_MAX_SPEED`        | 900 px/s                          | Tope de velocidad de la bola                                 |
| `MAX_BOUNCE_ANGLE`      | 55°                               | Ángulo máximo de salida desde una pala                       |
| `SMASH_WINDOW`          | 0.15 s                            | Ventana de `Espacio` antes del contacto para golpe potente   |
| `SMASH_GAIN`            | 1.3                               | Multiplicador de velocidad del golpe potente                 |
| `CPU_SPEED`             | `250 + 30 × (level − 1)` px/s     | Velocidad máxima de la pala de la CPU                        |
| `CPU_AIM_ERROR`         | `max(8, 48 − 4 × (level − 1))` px | Error de puntería máximo, sorteado en cada golpe del jugador |
| `SERVE_DELAY`           | 1.0 s                             | Pausa entre un punto y el siguiente saque                    |
| `START_LIVES`           | 3                                 | Vidas iniciales                                              |
| `MAX_LEVEL`             | 10                                | Nivel máximo                                                 |
| `MAX_SCORE`             | 1 000 000                         | Tope de puntuación (clamp)                                   |
| `MAX_DT`                | 0.05 s                            | Límite de `dt` por frame                                     |

### Estado interno (dentro de la closure)

- `player: { y }`, `cpu: { y, target }`, `ball: { x, y, vx, vy, speed }`.
- `status: 'ready' | 'serve' | 'playing' | 'over'`, `paused: boolean`, `serveTimer`, `serveDir: -1 | 1`.
- `score`, `lives`, `level`, `playerGoals`, `streak` (puntos ganados seguidos sin conceder), `rallyHits` (devoluciones del jugador en el rally actual).
- `keys: Set<string>` (teclas retenidas), `smashAt` (marca de tiempo del último `Espacio`, en segundos del reloj del juego).
- `popups: { text, x, y, ttl, color }[]` para textos flotantes.
- `rafId`, `lastTime`, `destroyed`, `gameOverSent`.

### Reglas del engine

- Estado en la closure, no en variables de módulo. Sin imports de React.
- `ready`: palas centradas, bola en el centro quieta, overlay `DUELO PALA` + `ESPACIO PARA SACAR` + `↑ ↓ / W S MOVER · ESPACIO GOLPE POTENTE`. El jugador puede mover su pala. `Espacio` lanza el primer saque hacia la CPU.
- Saque: bola en el centro, dirección horizontal `serveDir`, ángulo aleatorio en ±20°, velocidad `BALL_BASE_SPEED(level)`. `rallyHits = 0`.
- `serve`: tras cada punto, la bola desaparece y durante `SERVE_DELAY` se muestra `¡PUNTO!` (cian) o `PUNTO CPU` (magenta); luego saca automáticamente hacia el lado que concedió el punto. Las palas se pueden mover durante `serve`.
- Movimiento del jugador: `↑`/`W` sube, `↓`/`S` baja, a `PLAYER_SPEED`; la pala no sale del campo (clamp a `[0, HEIGHT − PADDLE_H]`).
- Paredes: si la bola toca techo o suelo, `vy` invierte su signo y la bola se recoloca dentro del campo.
- Sub-pasos: `steps = ceil(speed × dt / (BALL_SIZE / 2))`; en cada sub-paso se mueve la bola y se comprueban paredes, palas y goles.
- Colisión con pala: solo si la bola se mueve hacia esa pala y los rectángulos se solapan. La bola se recoloca en la cara de la pala. `offset = clamp((centroBola − centroPala) / (PADDLE_H / 2), −1, 1)`; ángulo de salida `offset × MAX_BOUNCE_ANGLE`; `speed = min(speed × BALL_HIT_GAIN, BALL_MAX_SPEED)`; `vx` cambia de sentido.
- Golpe potente: si el jugador golpea la bola y `ahora − smashAt ≤ SMASH_WINDOW`, `speed = min(speed × SMASH_GAIN, BALL_MAX_SPEED)`, el golpe suma el doble de puntos de rally y aparece el popup `¡POTENTE!`. `smashAt` se anula tras usarse. `Espacio` en `playing` no hace nada más.
- CPU: solo persigue cuando la bola va hacia ella; su objetivo es `ball.y + aimError`, con `aimError` sorteado en `±CPU_AIM_ERROR(level)` en cada devolución del jugador. Cuando la bola se aleja, vuelve hacia el centro a la mitad de `CPU_SPEED`. Zona muerta de 6 px para no temblar. Nunca supera `CPU_SPEED(level)` y no sale del campo.
- Gol del jugador: la bola sale por el borde derecho (`x > WIDTH`). `playerGoals += 1`, `streak += 1`, se suman puntos de gol, `level = min(MAX_LEVEL, 1 + floor(playerGoals / 2))`, `serveDir = 1` (saca hacia la CPU), estado `serve`, `onStats`.
- Gol de la CPU: la bola sale por el borde izquierdo (`x + BALL_SIZE < 0`). `lives −= 1`, `streak = 0`. Si `lives === 0`, estado `over`; si no, `serveDir = −1` (saca hacia el jugador), estado `serve`. `onStats` en ambos casos.
- Fin: al pasar a `over` se emite `onStats` con el estado final y después `onGameOver({ score, level })`, una sola vez por partida (`gameOverSent`). Tras `onGameOver` no se emite `onStats` hasta `restart()`.
- `end()`: desde `ready`, `serve` o `playing` (pausado o no) pasa a `over` con la misma secuencia. Si ya está en `over`, no hace nada.
- `restart()`: vuelve a `ready` con `score = 0`, `lives = 3`, `level = 1`, `playerGoals = 0`, `streak = 0`, palas centradas, sin popups, `paused = false`; emite `onPauseChange(false)` si estaba pausado y `onStats` con los valores iniciales.
- Pausa: `togglePause()` y `P` alternan `paused` en `serve` y `playing`; sin efecto en `ready` y `over`. Al pausar se vacía `keys` y se anula `smashAt`; al reanudar `lastTime` se reinicia para que no haya salto. En pausa no avanzan física, CPU, `serveTimer` ni popups; se sigue dibujando con el overlay `PAUSA`.
- Al pasar a `over` también se vacía `keys`.
- `dt = min((now − lastTime) / 1000, MAX_DT)`.
- `destroy()`: cancela el rAF, quita los listeners de `keydown` y `keyup` y marca `destroyed`; una segunda llamada no hace nada. Ningún callback se llama tras `destroy()`.
- El bucle arranca al crear el controlador; la partida empieza en `ready`.
- `onStats` se emite al crear (valores iniciales), al cambiar `score`, `lives` o `level`, y en `restart()`. Nunca por frame.

### Controles

| Tecla     | Acción                                                                  |
| --------- | ----------------------------------------------------------------------- |
| `↑` / `W` | Subir la pala                                                           |
| `↓` / `S` | Bajar la pala                                                           |
| `Espacio` | En `ready`: primer saque. En `playing`: golpe potente si llega a tiempo |
| `P`       | Pausa / reanudar (solo en `serve` y `playing`)                          |
| `Enter`   | Reiniciar (solo en `over`)                                              |

`↑`, `↓`, `Espacio` y `Enter` llaman a `preventDefault()` para no hacer scroll. `W`, `S` y `P` no lo necesitan.

### Reglas de puntuación

- Devolución del jugador: `10 × min(rallyHits, 10)` puntos, donde `rallyHits` cuenta las devoluciones del jugador en el rally actual tras sumar esta (1.ª = 10, 2.ª = 20 … 10.ª y siguientes = 100). Con golpe potente, el doble.
- Gol del jugador: `500 × min(streak, 5)` puntos, con `streak` ya incrementado (1.º seguido = 500 … 5.º y siguientes = 2 500). Si `streak ≥ 2` aparece el popup `RACHA ×N`.
- Gol de la CPU: no resta puntos; `streak` vuelve a 0.
- Las devoluciones de la CPU no puntúan.
- Toda suma pasa por `addScore(n)`: `score = min(MAX_SCORE, score + n)`. El juego no tiene tope de duración, así que el clamp es obligatorio. La puntuación es siempre un entero.
- Popup `+N` junto a la pala del jugador en cada devolución y en el centro en cada gol.

### Dibujo

- Fondo `#05050f`; línea central discontinua (segmentos de 12 px, hueco de 12 px, 2 px de ancho) en blanco al 25 %.
- Pala del jugador cian `#00f5ff`, pala de la CPU magenta `#ff006e`, bola amarilla `#f5ff00`, con `shadowBlur` 12 del mismo color.
- Tras un golpe potente, la bola deja una estela de 4 posiciones previas con opacidad decreciente hasta el siguiente golpe.
- Textos con `16px "Press Start 2P", monospace`, centrados. Popups suben 30 px y se desvanecen en 0.8 s.
- Overlays `PAUSA` y `GAME OVER` con velo negro al 60 %. `GAME OVER` muestra la puntuación final y `ENTER PARA REINICIAR`.
- El canvas no dibuja puntuación, vidas ni nivel (HUD de la plataforma, spec 02).

### Archivos

| Archivo                     | Cambio                               |
| --------------------------- | ------------------------------------ |
| `lib/paddle-duel/engine.ts` | Nuevo. Motor completo de DUELO PALA. |

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

0. **Leer docs.** Leer `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` (el engine solo se importa desde un Client Component) y el resto de guías que apliquen (regla de `AGENTS.md`). Releer `lib/snake/engine.ts` y `lib/rompebloques/engine.ts` como modelo del patrón.
1. **Esqueleto.** Crear `lib/paddle-duel/engine.ts` con tipos exportados, constantes, estado en la closure, bucle rAF con `dt` limitado, listeners de teclado y `destroy()` idempotente. Dibuja fondo, línea central y palas.
2. **Física.** Movimiento del jugador, saque, bola con sub-pasos, rebote en paredes y palas con ángulo, aceleración, goles.
3. **CPU.** Persecución con velocidad máxima, error de puntería, zona muerta y retorno al centro según nivel.
4. **Puntuación y progresión.** `addScore` con clamp, puntos por rally y por racha, vidas, nivel, estados `serve` y `over`, golpe potente.
5. **Overlays y popups.** `ready`, `serve`, `PAUSA`, `GAME OVER`, `+N`, `RACHA ×N`, `¡POTENTE!`, estela.
6. **Callbacks y controlador.** `onStats` solo al cambiar, `onGameOver` una vez y después de `onStats`, `onPauseChange`, `togglePause`, `end`, `restart`. Tecla `P`, `Enter` y bloqueo de scroll.
7. **Verificación.** Montaje temporal descrito en la sección 5; al terminar se borra.

---

## 4. Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores nuevos.
- [ ] `lib/paddle-duel/engine.ts` exporta `createPaddleDuel`, `PaddleDuelStats`, `PaddleDuelCallbacks` y `PaddleDuelController` con las firmas de la sección 2.
- [ ] El módulo no tiene variables de estado a nivel de módulo (solo constantes) ni imports de React.
- [ ] Al crear el controlador se dibuja el campo 800 × 600 en `ready` con el overlay `ESPACIO PARA SACAR` y la bola quieta; `onStats` se llama con `{ score: 0, lives: 3, level: 1 }`.
- [ ] En `ready`, `↑`/`↓` y `W`/`S` mueven la pala del jugador.
- [ ] `Espacio` en `ready` saca la bola hacia la CPU.
- [ ] `↑` y `W` suben la pala, `↓` y `S` la bajan, y la pala nunca sale del campo.
- [ ] La bola rebota en techo y suelo sin salir del campo.
- [ ] Golpear la bola con el extremo superior de la pala la devuelve hacia arriba, con el centro sale casi horizontal y con el extremo inferior hacia abajo; el ángulo no supera 55°.
- [ ] Cada golpe de pala aumenta la velocidad de la bola un 4 % y nunca supera 900 px/s.
- [ ] A velocidad máxima la bola no atraviesa ninguna pala (sub-pasos).
- [ ] La primera devolución del jugador en un rally suma 10, la segunda 20, y a partir de la décima suma 100 por golpe.
- [ ] Pulsar `Espacio` hasta 0.15 s antes del contacto produce `¡POTENTE!`, acelera la bola ×1.3 y suma el doble de puntos de ese golpe; pulsarlo antes de esa ventana no tiene efecto.
- [ ] Un gol del jugador suma 500; el segundo seguido 1 000; a partir del quinto seguido 2 500; aparece `RACHA ×N` desde el segundo.
- [ ] Un gol de la CPU resta una vida, no resta puntos y reinicia la racha (el siguiente gol del jugador vuelve a valer 500).
- [ ] Tras cada punto se muestra `¡PUNTO!` o `PUNTO CPU` durante 1 s y la bola se saca sola hacia quien concedió el punto.
- [ ] El nivel sube a 2 tras 2 goles del jugador, a 3 tras 4, y no pasa de 10; en cada nivel la CPU y el saque son más rápidos.
- [ ] La CPU falla algunas bolas en nivel 1 (error de puntería visible) y solo se mueve hacia la bola cuando esta va hacia ella.
- [ ] Con la tercera vida perdida, el estado pasa a `over`, se dibuja `GAME OVER` con la puntuación final y `onStats` (estado final) se llama antes de `onGameOver`.
- [ ] `onGameOver` se llama exactamente una vez por partida, también con `end()`; `end()` tras el fin no hace nada.
- [ ] `onStats` no se llama en frames sin cambios (comprobable con un `console.log` temporal que se elimina).
- [ ] `P` y `togglePause()` pausan y reanudan desde el mismo punto en `serve` y `playing`, emiten `onPauseChange` y muestran `PAUSA`; no tienen efecto en `ready` ni en `over`.
- [ ] Tras una pausa larga o con la pestaña en segundo plano, la bola no salta (`dt` limitado a 0.05 s).
- [ ] Mantener `↑` al pausar no deja la pala moviéndose al reanudar.
- [ ] `Enter` en `over` y `restart()` inician una partida limpia en `ready` con `onStats({ score: 0, lives: 3, level: 1 })`; `Enter` fuera de `over` no hace nada.
- [ ] `↑`, `↓`, `Espacio` y `Enter` no hacen scroll de la página mientras el engine está activo.
- [ ] `destroy()` detiene el bucle y los listeners; llamarlo dos veces no lanza error y después no se llama ningún callback.
- [ ] La puntuación se suma solo con `addScore`, que la limita a 1 000 000 (comprobable forzando temporalmente una suma grande, cambio que se elimina).
- [ ] El canvas no dibuja puntuación, vidas ni nivel.
- [ ] `git status` solo muestra `lib/paddle-duel/engine.ts` como cambio de este spec; no queda el montaje temporal.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. Montaje temporal: un Client Component de prueba (por ejemplo `app/dev-paddle-duel/page.tsx`) con `<canvas width={800} height={600}>` que crea el engine en un `useEffect`, registra los callbacks con `console.log` y llama a `destroy()` al desmontar. Se borra antes de cerrar el spec y no se commitea.
3. `npm run dev`: recorrer la sección 4 en ese montaje; comprobar ángulos, aceleración, puntos de rally, golpe potente, racha, vidas, niveles y overlays.
4. Forzar temporalmente `START_LIVES = 1` y un `addScore(2_000_000)` para comprobar `over` y el clamp; revertir.
5. Desmontar y remontar el componente de prueba varias veces y comprobar en la consola que no quedan dos bucles.

---

## 6. Decisiones tomadas y descartadas

- **Mismo patrón que los demás juegos** (SPEC 05/07, 09, 10). Engine en `lib/`, callbacks hacia React. Descartado: lógica dentro del componente.
- **Duelo contra CPU con vidas en vez de partida a N goles.** Una partida a 7 goles da puntuaciones casi fijas; con 3 vidas la partida dura mientras el jugador aguante y el ranking premia la habilidad. Descartado: primero a 7 o 11.
- **Puntos por rally creciente y por racha de goles.** Tema pedido («puntos por rally y racha»). Premia rallies largos y no conceder. Descartado: puntuar solo goles (poco rango en el ranking).
- **Golpe potente con `Espacio`.** Mecánica propia que añade habilidad sin teclas extra y diferencia el juego de un duelo de palas clásico. Descartado: efecto por movimiento de la pala (difícil de leer con teclado).
- **CPU con error de puntería sorteado por golpe.** Hace a la CPU batible en niveles bajos y más precisa al subir. Descartado: CPU perfecta con velocidad limitada (o imbatible o demasiado fácil).
- **Nivel cada 2 goles, tope 10.** Progresión visible en partidas cortas; el tope evita velocidades injugables. Descartado: nivel por tiempo.
- **Saque hacia quien concedió el punto.** Da al jugador la iniciativa de defender tras perder una vida. Descartado: saque siempre hacia el jugador.
- **Sin marcador de goles en el canvas.** El patrón de la plataforma prohíbe HUD en el canvas; `Vidas` y la racha (popups) ya dan la información. Descartado: marcador grande arriba en el centro.
- **Clamp en `addScore`.** La partida no tiene final por diseño; el `check` de `scores` rechazaría más de 1 000 000.
- **Canvas 800 × 600.** Mismo tamaño que Asteroides y Bloques; el campo horizontal encaja en 4:3. Descartado: 16:9 (rompe el marco CRT existente).
- **Controles `↑`/`↓` y `W`/`S`.** Las dos manos habituales. Descartado: `←`/`→` (no tienen sentido en un campo horizontal).
- **Pausa con `P`.** Patrón de la plataforma; `Espacio` queda para el saque y el golpe potente.
- **`Enter` reinicia solo en `over`.** Igual que Snake. Descartado: `Espacio` también reinicia (podría reiniciar sin querer al intentar un golpe potente).
- **Sin sonido ni assets.** Alcance mínimo; todo con primitivas de canvas.
- **Bola cuadrada.** Estética retro coherente con el resto del catálogo y colisión rectángulo-rectángulo simple.

---

## 7. Riesgos identificados

- **Túnel a alta velocidad.** Mitigación: sub-pasos de medio lado de bola y colisión solo en el sentido de avance.
- **Bola atrapada rebotando casi en vertical.** Mitigación: ángulo máximo 55° y saque en ±20°.
- **CPU imbatible o trivial.** Mitigación: constantes en una tabla y criterio de que falle en nivel 1; ajustar valores sin tocar la estructura.
- **Partidas infinitas con puntuaciones enormes.** Mitigación: clamp en `addScore` y velocidad creciente por nivel.
- **Doble montaje en desarrollo (StrictMode).** Mitigación: `destroy()` idempotente; se verifica en el spec 02.
- **Re-render por `onStats`.** Mitigación: emitir solo al cambiar.
- **Teclas pegadas tras pausa o fin.** Mitigación: vaciar `keys` y anular `smashAt`.
- **Salto de tiempo tras pausa o pestaña en segundo plano.** Mitigación: `dt` máximo y reinicio de `lastTime` al reanudar.
- **Fuente `Press Start 2P` no cargada al primer frame.** Mitigación: `monospace` como respaldo; el texto se redibuja cada frame.
- **Montaje temporal olvidado en el repo.** Mitigación: criterio de `git status`.

---

## What is **not** in this spec

- Player, HUD, `ScoreForm`, migración, portada y registro en `GAME_PLAYERS` (spec 02).
- Dos jugadores, online, táctil, ratón.
- Sonido, sprites, power-ups.
- Auth, rate limit, moderación, Realtime, cambios de esquema o RLS.

Cada uno, si entra, va en su propia spec.
