# SPEC 09 — ROMPEBLOQUES jugable en `/jugar/rompebloques` con su leaderboard

**Estado:** IMPLEMENTED
**Fecha:** 2026-11-11
**Depende de:** SPEC 01 (rutas `/juego/[id]` y `/jugar/[id]`, HUD `.player-hud`, marco `.crt`), SPEC 04 (clientes de Supabase, CLI), SPEC 05 (patrón de engine + player), SPEC 07 (tablas `games` y `scores`, `ScoreForm`, `GAME_PLAYERS`)
**Fuente de referencia:** `references/started-games/04-arkanoid/` (`game.js`, `index.html`, `style.css`, `assets/`, `specs/`). Esa carpeta no se modifica.

**Objetivo:** Portar el Arkanoid de `references/started-games/04-arkanoid/` como `ROMPEBLOQUES`, montarlo en `/jugar/rompebloques` y guardar sus puntuaciones en el ranking de la plataforma.

---

## 1. Alcance

### Incluido

- Módulo TS `lib/rompebloques/engine.ts` sin dependencias de DOM global: recibe el `<canvas>` y callbacks, devuelve un controlador.
- Port de las mecánicas de `game.js`: paleta, bola con rebote (ángulo máx. 60° en la paleta), bloques multi-golpe, 3 mapas, 3 dificultades, explosiones y estados `ready | playing | won | lost`.
- Sprites: `spritesheet-breakout.png` y las funciones de `assets/spritesheet.js` portadas a `lib/rompebloques/sprites.ts`. Los rectángulos de `SPRITES` y `EXPLOSION_FRAMES` se copian tal cual.
- Sonido: `ball-bounce.mp3` y `break-sound.mp3` con un único canal compartido (el nuevo corta al anterior).
- Componente cliente `components/rompebloques-player.tsx`: HUD de la plataforma + canvas dentro de `.crt`.
- HUD en vivo: `Puntuación`, `Vidas` y `Nivel`. El canvas no dibuja HUD.
- Botones `PAUSA` y `FIN` funcionales; tecla `P` alterna pausa.
- Callback `onGameOver({ score, level })` una vez por partida, al perder (`lost`), al ganar (`won`) o con `FIN`. Overlay `GAME OVER` / `¡GANASTE!` en el canvas; reinicio con `Enter` o botón `NUEVA PARTIDA`.
- Overlay `PAUSA` en el canvas mientras está pausado.
- Fila de `rompebloques` en `games` mediante migración versionada en `supabase/migrations/`. Sin tablas nuevas.
- Portada `.cover-rompebloques` en `app/globals.css` (base, `::after`, `::before`).
- Entrada `rompebloques: RompebloquesPlayer` en `GAME_PLAYERS` de `app/jugar/[id]/page.tsx`.
- Formulario de nombre al terminar la partida con `score > 0` (reutiliza `ScoreForm`); guarda en `scores` con `game_id = 'rompebloques'`.
- Ranking real en `/salon` y `/juego/rompebloques`; feed de la landing; tarjeta en `/biblioteca`. Salen solos de `games`/`scores`.
- Bloqueo del scroll con `←`, `→`, `Espacio` y `Enter`; limpieza total al desmontar (rAF, listeners y audio).

### NO incluido (otras specs)

- Autenticación y `user_id` en `scores`.
- Tablas, columnas o políticas RLS nuevas; reglas de puntuación por juego en la BD.
- Límite de frecuencia, moderación, filtro de nombres, Realtime, `service_role`.
- Controles táctiles y ratón. La etiqueta "TECLADO / TÁCTIL" de `/juego/[id]` no cambia.
- Power-ups, múltiples bolas, bloques que caen, mapas nuevos o editor de niveles.
- Sprites de daño para bloques multi-golpe (el bloque conserva su color hasta romperse).
- Los demás juegos de `references/started-games/`.
- Tests automatizados (el repo no tiene runner).
- El nombre "ARKANOID" o cualquier marca del original: el título visible es `ROMPEBLOQUES`.

---

## 2. Modelo de datos

Sin datos persistentes nuevos: `scores` y `games` (SPEC 07) se reutilizan tal cual.

### Fila del catálogo

Migración `supabase/migrations/<timestamp>_rompebloques.sql`, creada con `npx supabase migration new rompebloques`:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'rompebloques',
  'ROMPEBLOQUES',
  '<short: una línea>',
  '<long: 2–3 frases con solo las mecánicas del port>',
  'ARCADE',
  'cover-rompebloques',
  'cyan'
)
on conflict (id) do nothing;
```

### Engine (solo memoria)

```ts
// lib/rompebloques/engine.ts
export interface RompebloquesStats {
  score: number;
  lives: number;
  level: number; // 1..3
}

export interface RompebloquesCallbacks {
  onStats(stats: RompebloquesStats): void; // al cambiar y al iniciar; nunca cada frame
  onGameOver(result: { score: number; level: number }): void; // una vez por partida
  onPauseChange(paused: boolean): void;
}

export interface RompebloquesController {
  togglePause(): void; // sin efecto si la partida terminó
  end(): void; // dispara onGameOver
  restart(): void; // nueva partida; también con Enter o Espacio en fin de partida
  destroy(): void; // cancela rAF y listeners; idempotente
}

export function createRompebloques(
  canvas: HTMLCanvasElement,
  callbacks: RompebloquesCallbacks,
): RompebloquesController;
```

Reglas del port:

- Estado dentro de la closure, no en variables de módulo.
- Constantes que se conservan: `LEVELS` (3 mapas), `BLOCK_TYPES`, `DIFFICULTIES` (`easy` 300/160/5, `normal` 360/120/3, `hard` 440/90/2 — velocidad de bola, ancho de paleta, vidas), `LEVEL_SPEED_STEP = 0.10`, `MAX_BOUNCE_ANGLE = 60°`, `PADDLE_Y = 600`, `EXPLOSION_DURATION = 150` ms.
- Campo lógico 640×640 (como la referencia). Canvas interno fijo 800×600; el campo se dibuja con escala `600 / 640` y desplazamiento horizontal `100` px (`ctx.setTransform`). Escalado a pantalla solo con el CSS existente de `.crt-screen canvas`.
- `dt` limitado a 50 ms; `lastTime` se reinicia al reanudar.
- Sub-pasos de la bola: `steps = ceil(speed × dt / r)`, como la referencia.
- Un bloque por sub-paso (`return` tras la primera colisión), como la referencia.
- El bucle deja de avanzar la física en pausa y en `won`/`lost`; sigue dibujando para mostrar los overlays.
- `onStats` (estado final) se emite antes de `onGameOver`. Tras `onGameOver` no se emite `onStats` hasta `restart()`.
- Al pausar se pausa el sonido activo; al reanudar no se reanuda.
- Al perder una vida la fase vuelve a `ready` (la bola se pega a la paleta) y se emite `onStats`; si era la última vida, la fase es `lost` y se emite `onGameOver`.
- Al limpiar un mapa que no es el último: pasa al siguiente en `ready`, conservando puntos y vidas; `onStats` con el nuevo `level`.

### Controles

| Tecla       | Acción                                                                              |
| ----------- | ----------------------------------------------------------------------------------- |
| `←` / `→`   | Mover la paleta                                                                     |
| `Espacio`   | Lanzar la bola (en `ready`); reiniciar (en `won` / `lost`). Sin efecto en `playing` |
| `1` `2` `3` | Dificultad Fácil / Normal / Difícil (solo en `ready` antes del primer lanzamiento)  |
| `P`         | Pausa / reanudar                                                                    |
| `Enter`     | Reiniciar (solo en `won` / `lost`)                                                  |

Decisión: `Espacio` no pausa (en la referencia sí). `P` es el patrón de Asteroides y Bloques.

### Reglas de puntuación

- Cada bloque roto suma `maxHp × 10` (10 por bloque de 1 golpe, 20 por 2 golpes, 30 por 3 golpes). Sin bonus por nivel ni por vidas.
- Máximo teórico: 2 620 puntos (suma de los 3 mapas). Muy por debajo de 1 000 000: no hace falta clamp.
- Entero de 0 a 1.000.000 (`check` de `scores`).
- Nombre: 1–12 caracteres sin espacios sobrantes (lo valida `ScoreForm` y el `check`).

### Overlays en el canvas

- `ready`: texto `Pulsa Espacio para lanzar` y `Dificultad: <Fácil|Normal|Difícil> · 1/2/3 cambia`.
- `PAUSA`: velo oscuro + `PAUSA`.
- `lost`: `GAME OVER` + puntuación final.
- `won`: `¡GANASTE!` + puntuación final.

### Archivos

| Archivo                                              | Cambio                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `lib/rompebloques/engine.ts`                         | Nuevo. Port de `game.js`.                                                       |
| `lib/rompebloques/sprites.ts`                        | Nuevo. Port de `spritesheet.js`: `SPRITES`, `EXPLOSION_FRAMES`, carga y dibujo. |
| `public/games/rompebloques/spritesheet-breakout.png` | Nuevo. Copia de `assets/spritesheet-breakout.png`.                              |
| `public/games/rompebloques/sounds/ball-bounce.mp3`   | Nuevo. Copia de `assets/sounds/ball-bounce.mp3`.                                |
| `public/games/rompebloques/sounds/break-sound.mp3`   | Nuevo. Copia de `assets/sounds/break-sound.mp3`.                                |
| `components/rompebloques-player.tsx`                 | Nuevo, `"use client"`. HUD + canvas + `ScoreForm`.                              |
| `app/jugar/[id]/page.tsx`                            | Modificado. Entrada `rompebloques` en `GAME_PLAYERS`.                           |
| `app/globals.css`                                    | Modificado. `.cover-rompebloques`, `::after`, `::before`.                       |
| `supabase/migrations/<timestamp>_rompebloques.sql`   | Nuevo. Fila de `games`.                                                         |

`components/score-form.tsx` y el mapa `GAME_PLAYERS` ya existen (SPEC 08): no hay refactor compartido en este plan.

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

0. **Leer docs.** Antes de código de Next, leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `cacheComponents` (regla de `AGENTS.md`).
1. **Assets.** Copiar PNG y mp3 a `public/games/rompebloques/` (sin cambios de código). Crear `lib/rompebloques/sprites.ts` con `SPRITES`, `EXPLOSION_FRAMES` y `loadSprites(cb)` / `drawSprite` / `drawFrame` con la ruta `/games/rompebloques/spritesheet-breakout.png`. Compila sin usar aún.
2. **Motor: campo y física.** Crear `lib/rompebloques/engine.ts` con mapas, bloques, bola, paleta, colisiones, rebote y `clearLevel`. Sin callbacks todavía; prueba manual comparando con `references/started-games/04-arkanoid/index.html`.
3. **Motor: entrada, dificultad y sonido.** Listeners de `keydown` en `window` con `preventDefault()` en `←`, `→`, `Espacio` y `Enter`; teclas `1` `2` `3` y `P`. Sonido con `new Audio(...)` creado dentro de `createRompebloques`. Dibujo completo a 800×600 con el campo escalado y overlays `ready` / `PAUSA` / `lost` / `won`.
4. **Motor: callbacks y control.** `onStats`, `onGameOver` (una vez, en `lost`, `won` y `end()`), `onPauseChange`, y el controlador (`togglePause`, `end`, `restart`, `destroy`). `destroy()` cancela rAF, quita listeners y pausa el audio.
5. **Componente.** `components/rompebloques-player.tsx`: estado `stats` (`{ score: 0, lives: <de dificultad normal, 3>, level: 1 }` inicial), `paused`, `result`; `useEffect` crea y destruye el controlador (StrictMode). Cada `onStats` pone `result` a `null`. HUD con las clases existentes: `Jugador` = `INVITADO`, `Puntuación` (`es-ES`), `Vidas` (`♥` por vida), `Nivel` con dos dígitos. `PAUSA` ↔ `REANUDAR` (deshabilitado en fin de partida); `FIN` ↔ `NUEVA PARTIDA`; `blur()` tras pulsar cada botón. `SALIR` a `/juego/rompebloques`. `<ScoreForm gameId="rompebloques" score={result.score} />` si `result.score > 0`.
6. **Página.** En `app/jugar/[id]/page.tsx`, añadir `rompebloques: RompebloquesPlayer` a `GAME_PLAYERS`.
7. **Portada.** `.cover-rompebloques` en `app/globals.css`, junto a `.cover-blocks`. Base oscura con gradiente; `::after` con filas de bloques de los colores del sprite; `::before` con una bola y una paleta con glow neón.
8. **Migración.** `npx supabase migration new rompebloques`, pegar el SQL de la sección 2, `npx supabase db push --remote`. Si la CLI no tiene sesión: el usuario ejecuta `! npx supabase login` y se reintenta; alternativa `apply_migration` por MCP con el mismo SQL, dejando el archivo en git.
9. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [OK] `npm run build` termina sin errores.
- [OK] `npm run lint` termina sin errores nuevos.
- [OK] `supabase/migrations/` contiene exactamente un archivo nuevo con el SQL de la sección 2.
- [OK] `npx supabase db push --remote` termina sin error.
- [OK] La tabla `games` contiene una fila con `id = 'rompebloques'`, `cat = 'ARCADE'`, `color = 'cyan'`, y las filas previas intactas.
- [OK] `/biblioteca` muestra la tarjeta `ROMPEBLOQUES` con su portada, sin errores en consola.
- [OK] `/juego/rompebloques` muestra `ROMPEBLOQUES` y el ranking real; con cero filas, `Sin puntuaciones todavía`.
- [OK] `/jugar/rompebloques` muestra el HUD de la plataforma (`Jugador`, `Puntuación`, `Vidas`, `Nivel`) y el canvas dentro del marco CRT, sin HUD dibujado en el canvas.
- [OK] Ningún texto visible de la app (`/biblioteca`, `/juego/rompebloques`, `/jugar/rompebloques`, canvas) contiene "ARKANOID".
- [OK] El juego arranca solo al entrar: aparecen los bloques del mapa 1, la bola pegada a la paleta y el overlay `Pulsa Espacio para lanzar`.
- [OK] `←` y `→` mueven la paleta y no la sacan del campo.
- [OK] `Espacio` en `ready` lanza la bola hacia arriba.
- [OK] Las teclas `1`, `2` y `3` cambian la dificultad solo en `ready` antes del primer lanzamiento; con Fácil la paleta mide 160 px y hay 5 vidas.
- [OK] Un bloque gris necesita 3 golpes; un rosa, 2; el resto, 1.
- [OK] Romper un bloque suma 10, 20 o 30 según su dureza; el valor de `Puntuación` cambia en el mismo momento.
- [OK] Al romper un bloque aparece la animación de explosión de su color.
- [OK] Un rebote en el borde de la paleta lanza la bola con ángulo máximo de 60° respecto a la vertical.
- [OK] Si la bola cae por debajo, se pierde una vida, la bola vuelve a `ready` y `Vidas` baja en 1.
- [OK] Al limpiar el mapa 1 o 2, pasa al siguiente en `ready`, conservando puntos y vidas, y `Nivel` sube a `02` o `03`.
- [OK] La velocidad de la bola en el mapa 2 es un 10 % mayor que en el mapa 1, y en el mapa 3 un 20 % mayor.
- [OK] Limpiar el mapa 3 muestra `¡GANASTE!` y llama a `onGameOver` una vez.
- [OK] Perder la última vida muestra `GAME OVER` con la puntuación final y llama a `onGameOver` una vez (verificable con un `console.log` temporal que se elimina).
- [OK] `FIN` durante la partida produce el mismo overlay y la misma única llamada a `onGameOver`.
- [OK] `P` y el botón `PAUSA` pausan y reanudan desde el mismo punto; la bola no se mueve durante la pausa.
- [OK] `Espacio` no pausa la partida.
- [OK] `P` no hace nada tras el fin de partida; `PAUSA` está deshabilitado en fin de partida.
- [OK] `Enter` y `NUEVA PARTIDA` inician una partida limpia: mapa 1, `Puntuación 0`, `Vidas` de la dificultad elegida, `Nivel 01`, y el formulario desaparece.
- [OK] Con `score > 0` aparece el formulario; con `score = 0` no.
- [OK] Guardar con un nombre válido crea una fila en `scores` con `game_id = 'rompebloques'`, nombre sin espacios sobrantes y la puntuación de la partida.
- [OK] Tras guardar, `/salon` y `/juego/rompebloques` incluyen la puntuación al recargar.
- [OK] Si la inserción falla, se muestra el error y se puede reintentar sin perder el nombre.
- [OK] La landing muestra las últimas puntuaciones incluidas las de `rompebloques`.
- [OK] Con `←`, `→`, `Espacio` y `Enter`, la página no hace scroll; al salir, el bucle se detiene y el scroll vuelve.
- [OK] Con `reactStrictMode` en `npm run dev`, no hay dos bucles simultáneos (la bola no va al doble de velocidad).
- [OK] Al cambiar de página durante la partida, el sonido se detiene.
- [OK] Los demás juegos (`/jugar/asteroids`, `/jugar/blocks`, …) siguen funcionando igual.
- [OK] En 390 px, `/biblioteca`, `/salon`, `/juego/rompebloques` y `/jugar/rompebloques` no tienen scroll horizontal y el canvas conserva su relación 4:3.
- [OK] `grep -rn "service_role" app components lib proxy.ts` no devuelve resultados.
- [OK] `git status` no muestra cambios en `references/` ni `.env.local`.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. `npx supabase db push --remote` y `mcp__supabase__list_tables` (verbose) para confirmar la fila.
3. `npm run dev`: partida completa en `/jugar/rompebloques` recorriendo la sección 4; comparar con `references/started-games/04-arkanoid/index.html` abierto en otra pestaña (velocidad, puntos, ángulo de rebote).
4. Partida real: terminar con puntuación > 0, guardar con nombre, comprobar la fila en el panel y el ranking. Las filas de prueba se borran desde el panel de Supabase, nunca desde el código.
5. Navegar `/juego/rompebloques` → `/jugar/rompebloques` → `SALIR` varias veces y comprobar que no quedan bucles ni audio sonando.
6. Emulación a 390 px de ancho.

---

## 6. Decisiones tomadas y descartadas

- **Mismo patrón que Asteroides y Bloques** (SPEC 05/07/08). Engine en `lib/`, player cliente, callbacks hacia React. Descartado: lógica dentro del componente.
- **Título `ROMPEBLOQUES`, id `rompebloques`** (elegido por el usuario). `ARKANOID` es marca registrada. Descartados: `LADRILLOS` / `ladrillos`, `BREAKOUT` / `breakout` (nombre genérico usado también por Atari).
- **Pausa con `P`, `Espacio` no pausa** (elegido por el usuario). `Espacio` lanza y reinicia. Descartado: `Espacio` como pausa de la referencia, por coherencia con Asteroides y Bloques.
- **Selector de dificultad `1` `2` `3`** (elegido por el usuario). Port fiel. Descartado: fijar en Normal.
- **Tres mapas** (elegido por el usuario). Port fiel. Descartado: un solo mapa.
- **Sonido portado** (elegido por el usuario). Descartado: sin sonido como Bloques; el usuario prefirió conservarlo.
- **Sprites portados** (elegido por el usuario). Copia de la PNG y de los rectángulos de `spritesheet.js`. Descartado: formas de canvas, que pierden las explosiones.
- **`onGameOver` también al ganar** (elegido por el usuario). Así se puede guardar la puntuación de una partida ganada.
- **Campo 640×640 escalado a 600 px dentro de un canvas 800×600** (decisión propia). Reutiliza el marco 4:3 y el CSS existente sin tocar `.crt-screen`. Descartado: un canvas 640×640, que no cabe en el marco.
- **Categoría `ARCADE`, color `cyan`** (decisión propia). Bloques usa `magenta` y Asteroides `yellow`. Descartado: `green`.
- **Sin clamp de puntuación** (decisión propia). El máximo teórico es 2 620. Descartado: clamp a 1 000 000 de SPEC 08.

---

## 7. Riesgos identificados

- **Doble montaje en desarrollo (StrictMode).** Mitigación: `destroy()` idempotente y criterio específico.
- **Re-render por `onStats`.** Mitigación: emitir solo al cambiar, nunca por frame.
- **Carga asíncrona de sprites.** La bola no se dibuja hasta que carga la PNG. Mitigación: la cola de callbacks de `loadSprites` arranca el bucle solo cuando carga.
- **Sonido tras pausa o salida de página.** Mitigación: pausar el audio en `togglePause` y en `destroy()`.
- **Autoplay bloqueado por el navegador.** `play()` puede rechazar la promesa. Mitigación: `.catch(() => {})`, como la referencia.
- **Salto de tiempo tras pausa o pestaña en segundo plano.** Mitigación: `dt` máximo de 50 ms y `lastTime` reiniciado al reanudar.
- **Foco del teclado en botones del HUD.** `Espacio` reactivaría el botón en vez de lanzar la bola. Mitigación: `blur()` tras pulsarlos.
- **Divergencia con la referencia.** Mitigación: comparar lado a lado.
- **Spam y trampas en el ranking.** Aceptado hasta la spec de Auth (SPEC 07).

---

## What is **not** in this spec

- Auth, rate limit, moderación, Realtime.
- Cambios de esquema o RLS.
- Controles táctiles y ratón.
- Power-ups, múltiples bolas, mapas nuevos.
- El nombre "ARKANOID" o cualquier marca del original.

Cada uno, si entra, va en su propia spec.
