# SPEC 08 — BLOQUES jugable en `/jugar/blocks` con su leaderboard

**Estado:** APPROVED
**Fecha:** 2026-11-11
**Depende de:** SPEC 01 (rutas `/juego/[id]` y `/jugar/[id]`, HUD `.player-hud`, marco `.crt`), SPEC 04 (clientes de Supabase, CLI), SPEC 05 (patrón de engine + player), SPEC 07 (tablas `games` y `scores`, `saveScore`, formulario de puntuación)
**Fuente de referencia:** `references/started-games/03-claude-tetris/` (`game.js`, `index.html`, `README.md`, `CLAUDE.md`). Esa carpeta no se modifica.

**Objetivo:** Portar el juego de piezas que caen de `references/started-games/03-claude-tetris/` como `BLOQUES`, montarlo en `/jugar/blocks` y guardar sus puntuaciones en el ranking de la plataforma.

---

## 1. Alcance

### Incluido

- Módulo TS `lib/blocks/engine.ts` sin dependencias de DOM global: recibe el `<canvas>` y callbacks, devuelve un controlador.
- Port tal cual de las mecánicas de `game.js`: 7 piezas, rotación horaria con wall kick `[0, -1, 1, -2, 2]`, pieza fantasma con alpha 0.2, soft drop, hard drop, limpieza de líneas, niveles y velocidad.
- Vista previa de la siguiente pieza dibujada dentro del mismo canvas (panel `SIGUIENTE` a la derecha del tablero).
- Componente cliente `components/blocks-player.tsx`: HUD de la plataforma + canvas dentro de `.crt`.
- HUD en vivo: `Puntuación`, `Líneas` y `Nivel`. El juego no tiene vidas; no se muestra `Vidas`.
- Botones `PAUSA` y `FIN` funcionales; tecla `P` alterna pausa.
- Callback `onGameOver({ score, level })` una vez por partida; overlay `GAME OVER` en el canvas y reinicio con `Enter` o botón `NUEVA PARTIDA`.
- Overlay `PAUSA` en el canvas mientras está pausado.
- Fila de `blocks` en `games` mediante migración versionada en `supabase/migrations/` (`npx supabase db push`). Sin tablas nuevas.
- Portada `.cover-blocks` en `app/globals.css` (base, `::after`, `::before`).
- Refactor compartido: `ScoreForm` extraído a `components/score-form.tsx` y mapa `id → componente` en `app/jugar/[id]/page.tsx` (ver Plan, paso 1).
- Formulario de nombre al terminar la partida con `score > 0` (reutiliza `ScoreForm`); guarda en `scores` con `game_id = 'blocks'`.
- Ranking real en `/salon` y `/juego/blocks`; feed de la landing; tarjeta en `/biblioteca`. Salen solos de `games`/`scores`; no requieren código nuevo.
- Bloqueo del scroll con `←`, `→`, `↑`, `↓`, `Espacio` y `Enter`; limpieza total al desmontar (rAF y listeners).

### NO incluido (otras specs)

- Autenticación y `user_id` en `scores`.
- Tablas, columnas o políticas RLS nuevas; reglas de puntuación por juego en la BD.
- Límite de frecuencia, moderación, filtro de nombres, Realtime, `service_role`.
- Controles táctiles. La etiqueta "TECLADO / TÁCTIL" de `/juego/[id]` no cambia.
- Sonido (la referencia no tiene).
- Mecánicas que la referencia no tiene: hold, SRS completo, T-spins, combos, bolsa de 7 piezas, lock delay.
- El nombre "TETRIS" o cualquier marca del juego original: el título visible es `BLOQUES`.
- Panel DOM lateral de la referencia (`SCORE`/`LINES`/`LEVEL`/`CONTROLS`) y su overlay HTML: el HUD es el de la plataforma y los overlays van en el canvas.
- Modificador vertical de `.crt-screen` o cualquier cambio de layout del marco CRT.
- Los demás juegos de `references/started-games/`.
- Tests automatizados (el repo no tiene runner).

---

## 2. Modelo de datos

Sin datos persistentes nuevos: `scores` y `games` (SPEC 07) se reutilizan tal cual.

### Fila del catálogo

Migración `supabase/migrations/<timestamp>_blocks.sql`, creada con `npx supabase migration new blocks`:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'blocks',
  'BLOQUES',
  'Encaja piezas y limpia líneas.',
  'Siete piezas caen sobre un pozo de 10×20. Gíralas, encájalas y completa filas para borrarlas. Cada 10 líneas sube el nivel y la caída se acelera.',
  'PUZZLE',
  'cover-blocks',
  'magenta'
)
on conflict (id) do nothing;
```

### Engine (solo memoria)

```ts
// lib/blocks/engine.ts
export interface BlocksStats {
  score: number;
  lines: number;
  level: number;
}

export interface BlocksCallbacks {
  onStats(stats: BlocksStats): void; // al cambiar y al iniciar partida; nunca cada frame
  onGameOver(result: { score: number; level: number }): void; // una vez por partida
  onPauseChange(paused: boolean): void;
}

export interface BlocksController {
  togglePause(): void; // sin efecto si la partida terminó
  end(): void; // dispara onGameOver
  restart(): void; // nueva partida; también con Enter en game over
  destroy(): void; // cancela rAF y listeners; idempotente
}

export function createBlocks(
  canvas: HTMLCanvasElement,
  callbacks: BlocksCallbacks,
): BlocksController;
```

Reglas del port:

- Estado dentro de la closure, no en variables de módulo.
- Constantes de `game.js` que se conservan: `COLS = 10`, `ROWS = 20`, `COLORS` (los 7 hex), `PIECES` (las 7 matrices), `LINE_SCORES = [0, 100, 300, 500, 800]`, kicks `[0, -1, 1, -2, 2]`, ghost alpha `0.2`, `dropInterval` inicial `1000` ms.
- Constante que cambia: `BLOCK = 28` (la referencia usa 30) para que el tablero quepa en el canvas 4:3.
- Canvas interno fijo 800×600, el mismo que Asteroides; escalado solo con el CSS existente de `.crt-screen canvas`.
- Disposición: tablero 280×560 con origen en `(260, 20)`; panel `SIGUIENTE` a la derecha del tablero (etiqueta + pieza en una caja de 4×4 celdas de 28 px). Nada más se dibuja fuera del tablero.
- Rejilla tenue del tablero (`#22222e`, 0.5 px) y resalte superior de cada bloque, como en `drawGrid` / `drawBlock`.
- El bucle no avanza en pausa ni tras el fin de partida. La referencia sigue llamando a `requestAnimationFrame` después de `endGame()` dentro de `loop`; el port no lo replica.
- `dt` limitado a 100 ms por frame; `lastTime` se reinicia al reanudar.
- El engine no guarda teclas retenidas: cada `keydown` (incluida la autorrepetición del sistema) es una acción, como en la referencia.
- `onStats` (estado final) se emite antes de `onGameOver`. Tras `onGameOver` no se emite `onStats` hasta `restart()`.
- `end()` y la colisión al aparecer una pieza comparten la misma ruta de fin de partida.
- Overlays dibujados en el canvas con los textos de Asteroides: `GAME OVER` + puntuación final, y `PAUSA`.

### Controles

| Tecla     | Acción                                      |
| --------- | ------------------------------------------- |
| `←` / `→` | Mover la pieza una columna                  |
| `↑` / `X` | Rotar en sentido horario (con wall kick)    |
| `↓`       | Soft drop: baja una fila (+1); fija si toca |
| `Espacio` | Hard drop: cae al fondo (+2 por celda)      |
| `P`       | Pausa / reanudar                            |
| `Enter`   | Reiniciar (solo en fin de partida)          |

### Reglas de puntuación

- Líneas: `LINE_SCORES[n] × nivel` por `n` filas completadas a la vez (100 / 300 / 500 / 800 en nivel 1).
- Soft drop: +1 por fila bajada con `↓`. Hard drop: +2 por celda recorrida.
- Nivel: `floor(lines / 10) + 1`. Intervalo de caída: `max(100, 1000 − (nivel − 1) × 90)` ms.
- Fin de partida: la pieza nueva colisiona al aparecer, o se pulsa `FIN`.
- Entero de 0 a 1.000.000 (`check` de `scores`). Cada suma se limita en el engine: `score = Math.min(score + puntos, 1_000_000)`. La partida sigue; el marcador se queda en 1.000.000.
- Nombre: 1–12 caracteres sin espacios sobrantes (lo valida `ScoreForm` y el `check`).

### Archivos

| Archivo                                      | Cambio                                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `components/score-form.tsx`                  | Nuevo, `"use client"`. `ScoreForm` extraído de `asteroids-player.tsx`.                   |
| `components/asteroids-player.tsx`            | Modificado. Importa `ScoreForm` y le pasa `gameId="asteroids"`.                          |
| `app/jugar/[id]/page.tsx`                    | Modificado. Mapa `GAME_PLAYERS` (`id → componente`) en lugar del `if`; entrada `blocks`. |
| `lib/blocks/engine.ts`                       | Nuevo. Port del juego.                                                                   |
| `components/blocks-player.tsx`               | Nuevo, `"use client"`. HUD + canvas + `ScoreForm`.                                       |
| `app/globals.css`                            | Modificado. `.cover-blocks`, `.cover-blocks::after`, `.cover-blocks::before`.            |
| `supabase/migrations/<timestamp>_blocks.sql` | Nuevo. Fila de `games`.                                                                  |

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

0. **Leer docs.** Antes de código de Next, leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `cacheComponents` (regla de `AGENTS.md`).
1. **Refactor compartido.** Mover `ScoreForm` de `components/asteroids-player.tsx` a `components/score-form.tsx` con props `{ gameId: string; score: number }`; usa `saveScore(gameId, …)` de `lib/scores-client.ts`. Comportamiento idéntico (estados `idle` → `saving` → `saved` | `error`, `router.refresh()`, reintento sin perder el nombre). En `app/jugar/[id]/page.tsx` sustituir `if (game.id === "asteroids")` por `const GAME_PLAYERS: Record<string, ComponentType> = { asteroids: AsteroidsPlayer }`; ids sin player siguen con el `CrtScreen` actual. El nombre no es `PLAYERS` para no chocar con el grep de limpieza de SPEC 07. Asteroides debe comportarse igual.
2. **Engine.** Crear `lib/blocks/engine.ts` con las reglas del port: tablero, piezas, colisión, rotación, drops, líneas, nivel, dibujo en 800×600 con panel `SIGUIENTE`. Listeners de `keydown` en `window`; `preventDefault()` en `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Space` y `Enter`. Sin callbacks todavía; prueba manual comparando con `references/started-games/03-claude-tetris/index.html`.
3. **Callbacks y control.** `onStats` (al iniciar, al sumar puntos, al cambiar líneas o nivel), `onGameOver`, `onPauseChange`, clamp a 1.000.000 y el controlador (`togglePause`, `end`, `restart`, `destroy`). Overlays `PAUSA` y `GAME OVER` en el canvas.
4. **Player.** `components/blocks-player.tsx`: estado `stats` (`{ score: 0, lines: 0, level: 1 }` inicial), `paused`, `result`; `useEffect` crea y destruye el controlador (StrictMode). Cada `onStats` pone `result` a `null` (el engine no emite `onStats` tras `onGameOver` hasta reiniciar, así `Enter` también limpia el formulario). HUD con las clases existentes: `Jugador` = `INVITADO`, `Puntuación` (`es-ES`), `Líneas`, `Nivel` con dos dígitos. `PAUSA`/`REANUDAR` deshabilitado en fin de partida; `FIN` ↔ `NUEVA PARTIDA`; `blur()` tras pulsar cada botón. `SALIR` a `/juego/blocks`. Barra inferior `BLOQUES · CRT-83 · 60 HZ`. `<ScoreForm gameId="blocks" score={result.score} />` si `result.score > 0`.
5. **Portada.** `.cover-blocks` en `app/globals.css`, junto a `.cover-asteroids`:
   - Base: `linear-gradient(180deg, #1a0020, #0a0a18)`.
   - `::after`: filas de bloques en la parte inferior con `linear-gradient` en `var(--magenta)`, `var(--cyan)`, `var(--yellow)` y `var(--green)`; la fila superior de la pila tiene un hueco; `drop-shadow` neón.
   - `::before`: pieza T en `var(--magenta)` cayendo en la parte superior, con `text-shadow`/`box-shadow` de glow.
6. **Migración.** `npx supabase migration new blocks`, pegar el SQL de la sección 2, `npx supabase db push`. Si la CLI no tiene sesión: el usuario ejecuta `! npx supabase login` y se reintenta; alternativa `apply_migration` por MCP con el mismo SQL, dejando el archivo en git.
7. **Registro.** Añadir `blocks: BlocksPlayer` a `GAME_PLAYERS`. Comprobar `/biblioteca`, `/juego/blocks`, `/jugar/blocks`.
8. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores nuevos.
- [ ] `supabase/migrations/` contiene exactamente un archivo nuevo con el SQL de la sección 2.
- [ ] `npx supabase db push` termina sin error.
- [ ] La tabla `games` contiene una fila con `id = 'blocks'`, `cat = 'PUZZLE'`, `color = 'magenta'`, y las filas previas intactas.
- [ ] `/biblioteca` muestra la tarjeta `BLOQUES` con su portada, sin errores en consola.
- [ ] `/juego/blocks` muestra `BLOQUES` y el ranking real; con cero filas, `Sin puntuaciones todavía`.
- [ ] `/jugar/blocks` muestra el HUD de la plataforma (`Jugador`, `Puntuación`, `Líneas`, `Nivel`, sin `Vidas`) y el canvas dentro del marco CRT.
- [ ] El canvas solo dibuja el tablero 10×20, la pieza fantasma, la pieza activa y el panel `SIGUIENTE`; no dibuja puntuación, líneas ni nivel.
- [ ] Ningún texto visible de la app (`/biblioteca`, `/juego/blocks`, `/jugar/blocks`, canvas) contiene "TETRIS".
- [ ] El juego arranca solo al entrar: aparece una pieza arriba y el panel `SIGUIENTE` muestra otra.
- [ ] `←` y `→` mueven la pieza una columna y no la sacan del tablero.
- [ ] `↑` y `X` rotan en sentido horario; pegada a la pared, la rotación desplaza la pieza si un kick de ±1 o ±2 columnas lo permite.
- [ ] `↓` baja la pieza una fila y suma 1 punto.
- [ ] `Espacio` deja caer la pieza hasta la posición de la pieza fantasma y suma 2 puntos por celda recorrida.
- [ ] En nivel 1, completar 1, 2, 3 o 4 filas a la vez suma 100, 300, 500 u 800 puntos; en nivel 2, el doble.
- [ ] Al llegar a 10 líneas, `Nivel` pasa a `02` y la caída se acelera.
- [ ] `Líneas` en el HUD cambia en el mismo momento en que se borran filas.
- [ ] La puntuación nunca supera 1.000.000 (revisable en el código: todas las sumas pasan por el clamp).
- [ ] Cuando una pieza nueva colisiona al aparecer, la partida termina.
- [ ] `P` y el botón `PAUSA` pausan y reanudan desde el mismo punto; la pieza no cae durante la pausa; `P` no hace nada tras el fin de partida.
- [ ] Al terminar, aparece el overlay `GAME OVER` con la puntuación final y `onGameOver` se llama exactamente una vez (verificable con un `console.log` temporal que se elimina). `FIN` produce lo mismo.
- [ ] Tras el fin de partida, el tablero deja de cambiar (no siguen cayendo ni fijándose piezas).
- [ ] `Enter` y `NUEVA PARTIDA` inician una partida limpia: tablero vacío, `Puntuación 0`, `Líneas 0`, `Nivel 01`, y el formulario desaparece.
- [ ] Con `score > 0` aparece el formulario; con `score = 0` no.
- [ ] Guardar con un nombre válido crea una fila en `scores` con `game_id = 'blocks'`, nombre sin espacios sobrantes y la puntuación de la partida.
- [ ] Tras guardar, `/salon` y `/juego/blocks` incluyen la puntuación al recargar.
- [ ] Si la inserción falla, se muestra el error y se puede reintentar sin perder el nombre.
- [ ] La landing muestra las últimas puntuaciones incluidas las de `blocks`.
- [ ] Con `←`, `→`, `↑`, `↓` y `Espacio`, la página no hace scroll; al salir, el bucle se detiene y el scroll vuelve.
- [ ] Con `reactStrictMode` en `npm run dev`, no hay dos bucles simultáneos (la pieza no cae al doble de velocidad).
- [ ] `/jugar/asteroids` sigue funcionando igual, incluido su formulario de puntuación con `game_id = 'asteroids'`.
- [ ] `app/jugar/[id]/page.tsx` no contiene `game.id === "asteroids"`.
- [ ] En 390 px, `/biblioteca`, `/salon`, `/juego/blocks` y `/jugar/blocks` no tienen scroll horizontal y el canvas conserva su relación 4:3.
- [ ] `grep -rn "service_role" app components lib proxy.ts` no devuelve resultados.
- [ ] `grep -rn "seededScores\|LIVE_SCORES\|PLAYERS\b" app components lib` no devuelve resultados.
- [ ] `git status` no muestra cambios en `references/` ni `.env.local`.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. `npx supabase db push` y `mcp__supabase__list_tables` (verbose) para confirmar la fila.
3. `npm run dev`: partida completa en `/jugar/blocks` recorriendo la sección 4; comparar con `references/started-games/03-claude-tetris/index.html` abierto en otra pestaña (velocidad de caída, puntos, wall kicks).
4. Partida real: terminar con puntuación > 0, guardar con nombre, comprobar la fila en el panel y el ranking. Las filas de prueba se borran desde el panel de Supabase, nunca desde el código.
5. Partida real de Asteroides con puntuación > 0 y guardado, para confirmar el refactor de `ScoreForm`.
6. Navegar `/juego/blocks` → `/jugar/blocks` → `SALIR` varias veces y comprobar que no quedan bucles.
7. Emulación a 390 px de ancho.

---

## 6. Decisiones tomadas y descartadas

- **Mismo patrón que Asteroides** (SPEC 05/07). Engine en `lib/`, player cliente, callbacks hacia React. Descartado: lógica dentro del componente.
- **Catálogo en la tabla `games`** (SPEC 07). Una fila por juego, vía migración. Descartado: constantes en código.
- **Escritura directa desde el navegador con RLS** (SPEC 07). Sin `service_role`.
- **`ScoreForm` y mapa de players compartidos** (elegido). Hoy `ScoreForm` vive dentro de `asteroids-player.tsx` y la página elige el player con un `if`. Extraerlos evita duplicar el formulario y una rama `if` por juego. Descartado: copiar `ScoreForm` en `blocks-player.tsx`.
- **Mapa llamado `GAME_PLAYERS`** (elegido). `PLAYERS` choca con el grep de limpieza de datos mock de SPEC 07.
- **Título `BLOQUES`, id `blocks`** (elegido por el usuario tras descartar "TETRIS"). El usuario pidió primero conservar "TETRIS". Se descartó porque es la marca de un juego concreto; las mecánicas de género se mantienen. Descartados: `stack`/`APILA`, `falling-blocks`/`CAÍDA LIBRE`.
- **`PUZZLE` + `magenta`** (elegido). Asteroides usa `yellow`; el color diferencia la tarjeta. Descartados: `cyan`, `green`.
- **Port tal cual** (elegido por el usuario). Piezas, kicks, ghost, puntos y velocidad idénticos a `game.js`. Descartado: quitar pieza fantasma o puntos de drop.
- **HUD `Puntuación` / `Líneas` / `Nivel`** (elegido por el usuario). El juego no tiene vidas; `Líneas` ocupa su hueco. Descartado: solo puntuación y nivel.
- **Siguiente pieza dentro del canvas** (elegido por el usuario). Un solo canvas, sin piezas de HUD nuevas. Descartados: segundo canvas en el HUD, quitar la vista previa.
- **Canvas 800×600 con tablero centrado y `BLOCK = 28`** (elegido por el usuario). Reutiliza el marco 4:3 y el CSS de Asteroides sin cambios. Descartado: modificador vertical de `.crt-screen` con `BLOCK = 30` (CRT distinto por juego y más CSS).
- **Clamp a 1.000.000 en el engine** (elegido por el usuario). El HUD y el ranking coinciden y el `check` nunca rechaza. Descartados: clamp solo al guardar (lo visto y lo guardado difieren) y fin de partida al llegar.
- **Overlays en el canvas con los textos de Asteroides** (elegido por el usuario: `GAME OVER`, `PAUSA`). Consistencia entre juegos. Descartado: `FIN DE PARTIDA` en español; y el overlay HTML de la referencia.
- **Pausa con `P`** (de la referencia). No choca con ningún control del juego.
- **`Enter` para reiniciar** (añadido para igualar a Asteroides). La referencia solo tenía el botón `Reiniciar`.
- **Sin teclas retenidas en el engine** (de la referencia). Las acciones van por `keydown` con autorrepetición del sistema; no hay estado que limpiar al pausar.
- **Copy del catálogo** (aprobado por el usuario). Solo describe mecánicas reales del port.
- **Portada "pila de bloques neón"** (elegida por el usuario). Descartado: rejilla con una pieza I.

---

## 7. Riesgos identificados

- **Doble montaje en desarrollo (StrictMode).** Mitigación: `destroy()` idempotente y criterio específico.
- **Re-render por `onStats`.** Mitigación: emitir solo al cambiar, nunca por frame.
- **Bucle vivo tras el fin de partida (bug de la referencia).** `loop` vuelve a pedir frame después de `endGame()`. Mitigación: el bucle no avanza en fin de partida; criterio específico.
- **Salto de tiempo tras pausa o pestaña en segundo plano.** Mitigación: `dt` máximo de 100 ms y `lastTime` reiniciado al reanudar.
- **Foco del teclado en botones del HUD.** `Espacio` reactivaría el botón en vez de hacer hard drop. Mitigación: `blur()` tras pulsarlos.
- **Regresión de Asteroides por el refactor.** Mitigación: paso 1 aislado y verificación 5.
- **`result` que no se limpia al reiniciar con `Enter`.** Asteroides lo limpia con `lives > 0`, que aquí no existe. Mitigación: cada `onStats` limpia `result` (paso 4).
- **Divergencia con la referencia.** Mitigación: comparar lado a lado.
- **Spam y trampas en el ranking.** Aceptado hasta la spec de Auth (SPEC 07).
- **Puntuación sobre 1.000.000.** Mitigación: clamp en cada suma del engine; el `check` no llega a rechazar.

---

## What is **not** in this spec

- Auth, rate limit, moderación, Realtime.
- Cambios de esquema o RLS.
- Controles táctiles.
- Sonido, hold, SRS completo, T-spins, combos, bolsa de 7, lock delay.
- El nombre "TETRIS" o cualquier marca del original.
- Cambios de layout del marco CRT.

Cada uno, si entra, va en su propia spec.
