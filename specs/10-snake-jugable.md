# SPEC 10 — SNAKE jugable en `/jugar/snake` con su leaderboard

**Estado:** APPROVED
**Fecha:** 2026-11-11
**Depende de:** SPEC 01 (rutas `/juego/[id]` y `/jugar/[id]`, HUD `.player-hud`, marco `.crt`), SPEC 04 (clientes de Supabase, CLI), SPEC 05 (patrón de engine + player), SPEC 07 (tablas `games` y `scores`, `ScoreForm`, `GAME_PLAYERS`)
**Fuente de referencia:** Ninguna. Diseño propio. Sprites de frutas: `references/source-assets/snake-assets/fruits.png` y `sprites.js` (recorte `SPRITE_ATLAS.fruits`, 22 frutas). Esa carpeta no se modifica.

**Objetivo:** Crear SNAKE como juego jugable en `/jugar/snake` con frutas de sprite y guardar sus puntuaciones en el ranking de la plataforma.

---

## 1. Alcance

### Incluido

- Módulo TS `lib/snake/engine.ts` sin dependencias de DOM global: recibe el `<canvas>` y callbacks, devuelve un controlador.
- Módulo TS `lib/snake/sprites.ts` con el mapa `FRUIT_SPRITES` (22 entradas `{ x, y, w, h }`) copiado de `sprites.js`, y la constante `FRUITS_SHEET_URL = "/games/snake/fruits.png"`.
- Asset: copia de `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png`.
- Mecánica: tablero de 20 × 20 celdas, paredes envolventes (al salir por un borde se reaparece por el opuesto), la serpiente muere solo al chocar consigo misma.
- Comida: una fruta a la vez, elegida al azar entre las 22 del atlas, todas con el mismo valor (10 puntos).
- Progresión: nivel 1 al inicio; cada 5 frutas comidas sube un nivel y la velocidad aumenta.
- Componente cliente `components/snake-player.tsx`: HUD de la plataforma + canvas dentro de `.crt`.
- HUD en vivo: `Puntuación` y `Nivel`. No hay vidas; no se muestra `Vidas`. El canvas no dibuja HUD.
- Botones `PAUSA` y `FIN` funcionales; tecla `P` alterna pausa.
- Callback `onGameOver({ score, level })` una vez por partida, al chocar (`lost`), al llenar el tablero (`won`) o con `FIN`. Overlay `GAME OVER` / `¡GANASTE!` en el canvas; reinicio con `Enter` o botón `NUEVA PARTIDA`.
- Overlay `PAUSA` en el canvas mientras está pausado; overlay `PULSA UNA FLECHA` en el estado inicial.
- Fila de `snake` en `games` mediante migración versionada en `supabase/migrations/`. Sin tablas nuevas.
- Portada: se reutiliza `.cover-snake` ya existente en `app/globals.css`. Sin cambios salvo que no encaje visualmente (se revisa en `/biblioteca`).
- Entrada `snake: SnakePlayer` en `GAME_PLAYERS` de `app/jugar/[id]/page.tsx`.
- Formulario de nombre al terminar la partida con `score > 0` (reutiliza `ScoreForm`); guarda en `scores` con `game_id = 'snake'`.
- Ranking real en `/salon` y `/juego/snake`; feed de la landing; tarjeta en `/biblioteca`. Salen solos de `games`/`scores`.
- Bloqueo del scroll con `←`, `→`, `↑`, `↓`, `Espacio` y `Enter`; limpieza total al desmontar (rAF y listeners).

### NO incluido (otras specs)

- Autenticación y `user_id` en `scores`.
- Tablas, columnas o políticas RLS nuevas; reglas de puntuación por juego en la BD.
- Límite de frecuencia, moderación, filtro de nombres, Realtime, `service_role`.
- Controles táctiles. La etiqueta "TECLADO / TÁCTIL" de `/juego/[id]` no cambia.
- Sonido y power-ups.
- Valor distinto por fruta, frutas con efectos o frutas malas.
- Modo con varias comidas simultáneas.
- Tests automatizados (el repo no tiene runner).

---

## 2. Modelo de datos

Sin datos persistentes nuevos: `scores` y `games` (SPEC 07) se reutilizan tal cual.

### Fila del catálogo

Migración `supabase/migrations/<timestamp>_snake.sql`, creada con `npx supabase migration new snake`:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'snake',
  'SNAKE',
  'Come, crece y no toques tu propia cola.',
  'Guía la serpiente por el tablero y come frutas para crecer. Las paredes se unen: si sales por un borde apareces en el opuesto. Termina al chocar contigo misma.',
  'ARCADE',
  'cover-snake',
  'green'
)
on conflict (id) do nothing;
```

### Engine (solo memoria)

```ts
// lib/snake/engine.ts
export interface SnakeStats {
  score: number;
  level: number;
}

export interface SnakeCallbacks {
  onStats(stats: SnakeStats): void; // al cambiar y al iniciar; nunca cada tick
  onGameOver(result: { score: number; level: number }): void; // una vez por partida
  onPauseChange(paused: boolean): void;
}

export interface SnakeController {
  togglePause(): void; // sin efecto si la partida terminó o no ha empezado
  end(): void; // dispara onGameOver (botón FIN)
  restart(): void;
  destroy(): void; // cancela rAF y listeners; idempotente
}

export function createSnake(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks,
): SnakeController;
```

Estado interno (dentro de la closure):

- `cols = 20`, `rows = 20`, celda de 24 px → canvas lógico de 480 × 480.
- `snake: { x, y }[]` (cabeza en índice 0), `dir`, `pendingDir`, `food: { x, y, sprite }`.
- `status: 'ready' | 'playing' | 'lost' | 'won'`, más `paused` como indicador aparte.
- `foodsEaten`, `level = floor(foodsEaten / 5) + 1`, `score = foodsEaten * 10`.
- `tickMs = max(60, 150 - (level - 1) * 10)`.

Reglas del engine:

- Estado `ready`: la serpiente de 3 segmentos está centrada, dirección derecha. Ninguna tecla de flecha la mueve hasta la primera pulsación, que inicia la partida con esa dirección.
- Cambio de dirección: se guarda en `pendingDir`; se aplica en el siguiente tick. No se acepta un giro de 180° respecto a la dirección aplicada.
- Movimiento por tick: la cabeza avanza una celda; si cruza un borde, aparece en el lado opuesto (módulo sobre `cols`/`rows`).
- Colisión: si la nueva cabeza coincide con un segmento del cuerpo, `status = 'lost'`. Si la serpiente come en ese tick, la cola no se retira, así que se comprueba contra el cuerpo completo.
- Comida: si la cabeza cae en la fruta, `foodsEaten += 1`, la serpiente crece y aparece una fruta nueva en una celda libre elegida al azar, con un sprite elegido al azar entre las 22 claves de `FRUIT_SPRITES`.
- Si no quedan celdas libres tras comer, `status = 'won'`.
- Al pausar y al terminar se descarta `pendingDir`.
- `onStats` (estado final) se emite antes de `onGameOver`.
- Sprites: se dibujan tras cargar `FRUITS_SHEET_URL`, ajustados a la celda sin deformar. Si la carga falla, la fruta se dibuja como círculo rojo; la partida sigue jugable.
- El bucle empieza cuando la imagen está lista o ha fallado.

### Controles

| Tecla           | Acción                                       |
| --------------- | -------------------------------------------- |
| `←` `→` `↑` `↓` | Cambiar dirección (primera pulsación inicia) |
| `P`             | Pausa / reanudar                             |
| `Enter`         | Reiniciar (solo en `lost` o `won`)           |

### Reglas de puntuación

- 10 puntos por fruta. Máximo teórico: 399 frutas × 10 = 3 990, muy por debajo del `check` de `scores` (1 000 000). No hace falta clamp.
- Nivel: `floor(frutas / 5) + 1`. Sin tope.
- Nombre: 1–12 caracteres sin espacios sobrantes (lo valida `ScoreForm` y el `check`).

### Archivos

| Archivo                                     | Cambio                                                              |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `lib/snake/engine.ts`                       | Nuevo. Engine del juego.                                            |
| `lib/snake/sprites.ts`                      | Nuevo. `FRUIT_SPRITES` y `FRUITS_SHEET_URL`.                        |
| `components/snake-player.tsx`               | Nuevo, `"use client"`. HUD + canvas + `ScoreForm`.                  |
| `app/jugar/[id]/page.tsx`                   | Modificado. Entrada `snake: SnakePlayer` en `GAME_PLAYERS`.         |
| `public/games/snake/fruits.png`             | Nuevo. Copia de `references/source-assets/snake-assets/fruits.png`. |
| `supabase/migrations/<timestamp>_snake.sql` | Nuevo. Fila de `games`.                                             |
| `app/globals.css`                           | Sin cambios (se reutiliza `.cover-snake`).                          |

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

0. **Leer docs.** Antes de código de Next, leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `cacheComponents` (regla de `AGENTS.md`).
1. **Assets.** Copiar `fruits.png` a `public/games/snake/fruits.png`. Crear `lib/snake/sprites.ts` con `FRUIT_SPRITES` (22 entradas copiadas de `sprites.js`) y `FRUITS_SHEET_URL`.
2. **Engine: movimiento.** Crear `lib/snake/engine.ts` con estado, tablero, movimiento, envoltura de bordes, cambio de dirección con `pendingDir` y colisiones. Sin dibujo ni callbacks todavía. Prueba manual con `console.log` temporal, eliminado al cerrar el paso.
3. **Engine: comida y progresión.** Comida al azar con sprite, crecimiento, nivel, velocidad, estado `won`.
4. **Engine: dibujo.** Tablero, serpiente, fruta con sprite, overlays `PULSA UNA FLECHA`, `PAUSA`, `GAME OVER`, `¡GANASTE!`.
5. **Engine: callbacks y control.** `onStats`, `onGameOver` (una sola vez), `onPauseChange`, `togglePause`, `end`, `restart`, `destroy`. Tecla `P`, `Enter` y bloqueo de scroll.
6. **Player.** `components/snake-player.tsx`: estado `stats`, `paused`, `result`; `useEffect` crea y destruye el controlador (StrictMode); HUD con las clases existentes; `<ScoreForm gameId="snake" score={…}/>` si `result.score > 0`; `SALIR` a `/juego/snake`.
7. **Migración.** `npx supabase migration new snake`, pegar el SQL de la sección 2, `npx supabase db push`. Si la CLI no tiene sesión: el usuario ejecuta `! npx supabase login` y se reintenta.
8. **Registro.** Añadir `snake: SnakePlayer` a `GAME_PLAYERS`. Comprobar `/biblioteca`, `/juego/snake`, `/jugar/snake`.
9. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores nuevos.
- [ ] `supabase/migrations/` contiene exactamente un archivo nuevo con el SQL de la sección 2.
- [ ] `npx supabase db push` termina sin error.
- [ ] La tabla `games` contiene una fila con `id = 'snake'` y las filas previas intactas.
- [ ] `/biblioteca` muestra la tarjeta `SNAKE` con la portada `.cover-snake`, sin errores en consola.
- [ ] `/juego/snake` muestra `SNAKE` y el ranking real; con cero filas, `Sin puntuaciones todavía`.
- [ ] `/jugar/snake` muestra el HUD de la plataforma (`Puntuación`, `Nivel`, sin `Vidas`) y el canvas dentro del marco CRT, sin HUD dibujado en el canvas.
- [ ] Al entrar, el tablero muestra la serpiente de 3 segmentos y el overlay `PULSA UNA FLECHA`, sin moverse.
- [ ] La primera flecha inicia la partida en esa dirección.
- [ ] Con la serpiente en movimiento hacia la derecha, pulsar `←` no la invierte (sin giro de 180°).
- [ ] Al salir por el borde derecho, la cabeza reaparece por el borde izquierdo en la misma fila (y análogamente en los otros tres bordes).
- [ ] Chocar con el propio cuerpo termina la partida (`GAME OVER`) y no con los bordes.
- [ ] Comer una fruta suma exactamente 10 puntos y añade un segmento.
- [ ] Cada fruta mostrada es uno de los 22 sprites de `FRUIT_SPRITES`, sin deformarse.
- [ ] Tras 5 frutas el HUD pasa a `Nivel 02` y el tick se acorta 10 ms; el tick nunca baja de 60 ms.
- [ ] `P` y el botón `PAUSA` pausan y reanudan desde el mismo punto; `P` no hace nada tras el fin de partida.
- [ ] Al terminar, aparece el overlay de fin y `onGameOver` se llama exactamente una vez (verificable con un `console.log` temporal que se elimina). `FIN` produce lo mismo.
- [ ] `Enter` y `NUEVA PARTIDA` inician una partida limpia.
- [ ] Con `score > 0` aparece el formulario; con `score = 0` no.
- [ ] Guardar con un nombre válido crea una fila en `scores` con `game_id = 'snake'`, nombre sin espacios sobrantes y la puntuación de la partida.
- [ ] Tras guardar, `/salon` y `/juego/snake` incluyen la puntuación al recargar.
- [ ] Si la inserción falla, se muestra el error y se puede reintentar sin perder el nombre.
- [ ] La landing muestra las últimas puntuaciones incluidas las de `snake`.
- [ ] Con las flechas, `Espacio` o `Enter`, la página no hace scroll; al salir, el bucle se detiene y el scroll vuelve.
- [ ] Con `reactStrictMode` en `npm run dev`, no hay dos bucles simultáneos.
- [ ] Los demás juegos (`/jugar/asteroids`, `/jugar/blocks`, `/jugar/rompebloques`) siguen funcionando igual.
- [ ] En 390 px, `/biblioteca`, `/salon`, `/juego/snake` y `/jugar/snake` no tienen scroll horizontal y el canvas conserva su relación de aspecto.
- [ ] `grep -rn "service_role" app components lib proxy.ts` no devuelve resultados.
- [ ] `git status` no muestra cambios en `references/` ni `.env.local`.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. `npx supabase db push` y `mcp__supabase__list_tables` (verbose) para confirmar la fila.
3. `npm run dev`: partida completa recorriendo la sección 4; comprobar envoltura de bordes, giro de 180° y colisión con el cuerpo.
4. Partida real: terminar con puntuación > 0, guardar con nombre, comprobar la fila en el panel y el ranking. Las filas de prueba se borran desde el panel de Supabase, nunca desde el código.
5. Navegar `/juego/snake` → `/jugar/snake` → `SALIR` varias veces y comprobar que no quedan bucles.
6. Emulación a 390 px de ancho.

---

## 6. Decisiones tomadas y descartadas

- **Paredes envolventes.** Elegido por el usuario. Descartado: paredes mortales (opción clásica, ofrecida y no elegida).
- **Solo el cuerpo mata.** Consecuencia de las paredes envolventes. Descartado: cuerpo que no mata (rompe la mecánica).
- **Una comida a la vez.** Elegido por el usuario al cerrar el alcance (mecánica base). Descartado: varias frutas simultáneas.
- **Todas las frutas valen 10.** Elegido por el usuario. Descartado: tabla de puntos por fruta (más reglas que documentar sin ganancia de jugabilidad).
- **HUD `Puntuación` + `Nivel`, sin vidas.** Elegido por el usuario. Descartado: 3 vidas (la serpiente no tiene vidas en el diseño clásico) y solo puntuación (sin progresión).
- **Nivel cada 5 frutas, −10 ms por nivel, mínimo 60 ms.** Decisión propia para dar progresión medible. Descartado: velocidad fija (sin progresión).
- **Tablero 20 × 20, celda 24 px, canvas 480 × 480.** Decisión propia: cuadrado, cabe en 390 px con escala CSS y deja margen de crecimiento.
- **Sprites copiados a `public/games/snake/`.** Elegido por el usuario. Convención de SPEC 09 (`public/games/rompebloques/`). Descartado: importar desde `references/` (no se sirve).
- **Dibujo sin sprites.** Descartado por el usuario: se pierde el arte de las frutas.
- **Reutilizar `.cover-snake`.** Ya existe en `app/globals.css`. Descartado: crear portada nueva sin necesidad.
- **Sin sonido.** Decisión propia: la referencia de sprites no trae audio y el alcance se mantiene mínimo.
- **Cat `ARCADE`, color `green`.** Decisión propia: el color verde ya define la identidad de `.cover-snake`.
- **Giro de 180° bloqueado.** Decisión propia: evita muerte instantánea por input rápido.

---

## 7. Riesgos identificados

- **Origen del arte.** `sprites.js` indica que las frutas vienen de Spriters Resource (Google Snake). Licencia de uso público no verificada. Mitigación: confirmar antes de desplegar; si no procede, sustituir el asset sin tocar el engine (solo `FRUIT_SPRITES` y el PNG).
- **Tablero lleno.** Con 400 celdas, la partida puede terminar en `won`. Mitigación: estado explícito y criterio de aceptación.
- **Giros rápidos en el mismo tick.** Dos flechas en un mismo tick pueden provocar un giro de 180°. Mitigación: `pendingDir` se valida contra la dirección aplicada y solo se guarda un cambio por tick.
- **Doble montaje en desarrollo (StrictMode).** Mitigación: `destroy()` idempotente y criterio específico.
- **Teclas pegadas tras pausa o fin.** Mitigación: descartar `pendingDir` al pausar y terminar.
- **Salto de tiempo tras pausa o pestaña en segundo plano.** Mitigación: `dt` máximo y reinicio del acumulador al reanudar.
- **Foco del teclado en botones del HUD.** Mitigación: `blur()` tras pulsarlos.
- **Spam y trampas en el ranking.** Aceptado hasta la spec de Auth (SPEC 07).

---

## What is **not** in this spec

- Auth, rate limit, moderación, Realtime.
- Cambios de esquema o RLS.
- Controles táctiles.
- Sonido, power-ups, frutas con efectos.
- Varias comidas simultáneas.

Cada uno, si entra, va en su propia spec.
