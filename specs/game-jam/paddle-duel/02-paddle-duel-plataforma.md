# SPEC GJ-02 — DUELO PALA: jugable en `/jugar/paddle-duel` con su leaderboard

**Estado:** Borrador
**Fecha:** 2026-11-12
**Depende de:** SPEC 01 (rutas `/juego/[id]` y `/jugar/[id]`, HUD `.player-hud`, marco `.crt`), SPEC 04 (clientes de Supabase, CLI), SPEC 05 (patrón de engine + player), SPEC 07 (tablas `games` y `scores`, `ScoreForm`, `GAME_PLAYERS`), SPEC 10 (último player de referencia, `specs/10-snake-jugable.md`), `specs/game-jam/paddle-duel/01-paddle-duel-motor.md` (engine `lib/paddle-duel/engine.ts`)
**Fuente de referencia:** Sin referencia: diseño propio.

**Objetivo:** Montar el engine de DUELO PALA en `/jugar/paddle-duel` con el HUD de la plataforma, darlo de alta en el catálogo y guardar sus puntuaciones en el ranking.

---

## 1. Alcance

### Incluido

- Componente cliente `components/paddle-duel-player.tsx`: HUD de la plataforma + canvas 800 × 600 dentro de `.crt.crt-game`.
- HUD en vivo: `Jugador` (`INVITADO`), `Puntuación`, `Vidas` (corazones) y `Nivel`. Sin `Tiempo`.
- Botones `PAUSA`/`REANUDAR`, `FIN`/`NUEVA PARTIDA` y `SALIR` (a `/juego/paddle-duel`), con `blur()` tras pulsarlos.
- Formulario de nombre al terminar la partida con `score > 0` (reutiliza `ScoreForm` de `components/score-form.tsx`); guarda en `scores` con `game_id = 'paddle-duel'`.
- Fila de `paddle-duel` en `games` mediante migración versionada en `supabase/migrations/`. Sin tablas nuevas.
- Portada `.cover-paddle-duel` en `app/globals.css` (base, `::after`, `::before`), CSS puro.
- Entrada `"paddle-duel": PaddleDuelPlayer` en `GAME_PLAYERS` de `app/jugar/[id]/page.tsx`.
- Ranking real en `/salon` y `/juego/paddle-duel`; feed de la landing; tarjeta en `/biblioteca`. Salen solos de `games`/`scores`; no requieren código nuevo.
- Bloqueo del scroll (lo hace el engine) y limpieza total al desmontar (`destroy()`).
- Comprobación a 390 px de ancho.

### NO incluido (otras specs)

- Mecánicas, constantes, puntuación y dibujo del juego: `specs/game-jam/paddle-duel/01-paddle-duel-motor.md`.
- Autenticación y `user_id` en `scores`.
- Tablas, columnas o políticas RLS nuevas; reglas de puntuación por juego en la BD.
- Límite de frecuencia, moderación, filtro de nombres, Realtime, `service_role`.
- Controles táctiles. La etiqueta "TECLADO / TÁCTIL" de `/juego/[id]` no cambia.
- Refactor de `ScoreForm` o de `GAME_PLAYERS`: ya existen (SPEC 07–10).
- Reutilizar o modificar `.cover-duelo` (portada de plantilla sin juego asociado).
- Sonido y assets en `public/games/paddle-duel/` (el juego no usa ninguno).
- Tests automatizados (el repo no tiene runner).

---

## 2. Modelo de datos

Sin datos persistentes nuevos: `scores` y `games` (SPEC 07) se reutilizan tal cual.

### Fila del catálogo

Migración `supabase/migrations/<timestamp>_paddle_duel.sql`, creada con `npx supabase migration new paddle_duel` (el timestamp lo genera la CLI):

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  'paddle-duel',
  'DUELO PALA',
  'Duelo de palas contra la CPU: alarga el rally y encadena puntos.',
  'Mueve tu pala y devuelve la bola a la CPU: cada devolución seguida del rally vale más, y los puntos ganados en racha multiplican el premio. Pulsa Espacio justo antes del golpe para un tiro potente. Tienes tres vidas y la CPU mejora cada dos puntos que le ganas.',
  'VERSUS',
  'cover-paddle-duel',
  'cyan'
)
on conflict (id) do nothing;
```

### Engine (consumido, definido en el spec 01)

```ts
import {
  createPaddleDuel,
  type PaddleDuelController,
  type PaddleDuelStats, // { score, lives, level }
} from "@/lib/paddle-duel/engine";
```

### Player

```ts
// components/paddle-duel-player.tsx
"use client";
export function PaddleDuelPlayer(): JSX.Element;
```

Reglas del player (mismo patrón que `components/snake-player.tsx` y `components/rompebloques-player.tsx`):

- Estado React: `stats: PaddleDuelStats` (inicial `{ score: 0, lives: 3, level: 1 }`), `paused: boolean`, `result: PaddleDuelStats | null`.
- Un `useEffect` sin dependencias crea el controlador con el `<canvas>` del `ref` y lo destruye en el cleanup (seguro con StrictMode). El controlador se guarda en un `ref`.
- `onStats`: actualiza `stats` y pone `result = null` (el engine solo vuelve a emitir tras `restart()`, así se oculta el formulario al reiniciar).
- `onGameOver`: guarda `result` con `{ score, level }` y las vidas del último `stats`.
- `onPauseChange`: actualiza `paused`.
- HUD: `Puntuación` con `toLocaleString("es-ES")`; `Vidas` con clase `hud-stat lives` y `"♥".repeat(lives)`; `Nivel` con clase `hud-stat level` y dos dígitos (`01`…`10`).
- `PAUSA` deshabilitado si la partida terminó; muestra `REANUDAR` en pausa. `FIN` se sustituye por `NUEVA PARTIDA` al terminar. Cada handler llama a `e.currentTarget.blur()` antes de usar el controlador.
- `<canvas width={800} height={600}>` dentro de `.crt-screen`; escalado solo con el CSS existente `.crt-screen canvas`.
- Pie del CRT: `SEÑAL OK` y `DUELO PALA · CRT-83 · 60 HZ`.
- `<ScoreForm gameId="paddle-duel" score={result.score} />` solo si `result && result.score > 0`.

### Portada `.cover-paddle-duel`

- Base: degradado radial oscuro azul-cian (`#001a2a` → `#0a0a18`).
- `::before`: línea central discontinua vertical (`repeating-linear-gradient`) en blanco tenue y una rejilla de campo muy suave.
- `::after`: pala cian a la izquierda, pala magenta a la derecha, bola amarilla cerca de la pala cian y una estela de tres cuadrados amarillos de opacidad decreciente (el golpe potente), con `drop-shadow` cian.
- Diferente de `.cover-duelo` (que no se toca): incluye estela y fondo radial.

### Controles (los gestiona el engine)

| Tecla     | Acción                                          |
| --------- | ----------------------------------------------- |
| `↑` / `W` | Subir la pala                                   |
| `↓` / `S` | Bajar la pala                                   |
| `Espacio` | Primer saque en `ready`; golpe potente en juego |
| `P`       | Pausa / reanudar                                |
| `Enter`   | Reiniciar (solo en fin de partida)              |

### Reglas de puntuación

- Las define el spec 01. El engine limita la puntuación a 1 000 000 con `addScore`, así que nunca viola el `check` de `scores`.
- Nombre: 1–12 caracteres sin espacios sobrantes (lo valida `ScoreForm` y el `check`).

### Archivos

| Archivo                                           | Cambio                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| `components/paddle-duel-player.tsx`               | Nuevo, `"use client"`. HUD + canvas + `ScoreForm`.                                |
| `app/jugar/[id]/page.tsx`                         | Modificado. Import y entrada `"paddle-duel": PaddleDuelPlayer` en `GAME_PLAYERS`. |
| `app/globals.css`                                 | Modificado. `.cover-paddle-duel`, `::before`, `::after`.                          |
| `supabase/migrations/<timestamp>_paddle_duel.sql` | Nuevo. Fila de `games`.                                                           |

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`). Requisito: el spec 01 está implementado (`lib/paddle-duel/engine.ts` existe).

0. **Leer docs.** Antes de código de Next, leer en `node_modules/next/dist/docs/01-app/` lo relativo a Client Components (`01-getting-started/05-server-and-client-components.md`) y `cacheComponents` (regla de `AGENTS.md`).
1. **Player.** Crear `components/paddle-duel-player.tsx` siguiendo `components/rompebloques-player.tsx` (HUD con vidas): estado, `useEffect` con `destroy()`, HUD, botones con `blur()`, canvas 800 × 600, `ScoreForm`.
2. **Registro.** Importar `PaddleDuelPlayer` y añadir `"paddle-duel": PaddleDuelPlayer` a `GAME_PLAYERS`. Hasta aplicar la migración, la ruta no existe en `generateStaticParams`; el build sigue en verde.
3. **Portada.** Añadir `.cover-paddle-duel`, `::before` y `::after` en `app/globals.css`, junto a las demás `.cover-*`.
4. **Migración.** `npx supabase migration new paddle_duel`, pegar el SQL de la sección 2, `npx supabase db push --remote`. Si la CLI no tiene sesión: el usuario ejecuta `! npx supabase login` y se reintenta; alternativa `apply_migration` por MCP con el mismo SQL, dejando el archivo en git.
5. **Comprobación de rutas.** `npm run build` y revisar `/biblioteca`, `/juego/paddle-duel`, `/jugar/paddle-duel`.
6. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores nuevos.
- [ ] `supabase/migrations/` contiene exactamente un archivo nuevo con el SQL de la sección 2.
- [ ] `npx supabase db push --remote` (o `apply_migration` por MCP) termina sin error.
- [ ] La tabla `games` contiene una fila con `id = 'paddle-duel'`, `cat = 'VERSUS'`, `color = 'cyan'`, `cover = 'cover-paddle-duel'`, y las filas previas intactas.
- [ ] `/biblioteca` muestra la tarjeta `DUELO PALA` con la portada `.cover-paddle-duel` y aparece al filtrar por `VERSUS`, sin errores en consola.
- [ ] `/juego/paddle-duel` muestra `DUELO PALA` y el ranking real; con cero filas, `Sin puntuaciones todavía`.
- [ ] `/jugar/paddle-duel` muestra el HUD de la plataforma (`Jugador`, `Puntuación`, `Vidas`, `Nivel`, sin `Tiempo`) y el canvas dentro del marco CRT, sin HUD dibujado en el canvas.
- [ ] Al entrar, el juego aparece en `ready` con el overlay `ESPACIO PARA SACAR`, sin pulsar nada más.
- [ ] El HUD empieza en `0`, `♥♥♥` y `01`.
- [ ] Una devolución del jugador actualiza `Puntuación` en el HUD con el valor que muestra el popup.
- [ ] Un gol de la CPU quita un corazón del HUD.
- [ ] Dos goles del jugador cambian `Nivel` a `02` en el HUD.
- [ ] `P` y el botón `PAUSA` pausan y reanudan desde el mismo punto; el botón muestra `REANUDAR` en pausa; `P` no hace nada tras el fin de partida.
- [ ] Tras pulsar `PAUSA` con el ratón, `Espacio` y `Enter` llegan al juego y no reactivan el botón (`blur()`).
- [ ] Al perder la tercera vida aparece el overlay `GAME OVER` y `onGameOver` se llama exactamente una vez (verificable con un `console.log` temporal que se elimina). `FIN` produce lo mismo.
- [ ] Al terminar, `FIN` pasa a `NUEVA PARTIDA` y `PAUSA` queda deshabilitado.
- [ ] `Enter` y `NUEVA PARTIDA` inician una partida limpia; el HUD vuelve a `0`, `♥♥♥`, `01` y el formulario desaparece.
- [ ] Con `score > 0` aparece el formulario; con `score = 0` (por ejemplo `FIN` antes de puntuar) no.
- [ ] Guardar con un nombre válido crea una fila en `scores` con `game_id = 'paddle-duel'`, nombre sin espacios sobrantes y la puntuación de la partida.
- [ ] Tras guardar, `/salon` y `/juego/paddle-duel` incluyen la puntuación al recargar.
- [ ] Si la inserción falla, se muestra el error y se puede reintentar sin perder el nombre.
- [ ] La landing muestra las últimas puntuaciones incluidas las de `paddle-duel`.
- [ ] Con `↑`, `↓`, `Espacio` o `Enter`, la página no hace scroll; al pulsar `SALIR` el bucle se detiene y el scroll vuelve.
- [ ] Con `reactStrictMode` en `npm run dev`, no hay dos bucles simultáneos (la bola no va al doble de velocidad y la CPU no se mueve dos veces por frame).
- [ ] Los demás juegos (`/jugar/asteroids`, `/jugar/blocks`, `/jugar/rompebloques`, `/jugar/snake`) siguen funcionando igual.
- [ ] En 390 px, `/biblioteca`, `/salon`, `/juego/paddle-duel` y `/jugar/paddle-duel` no tienen scroll horizontal y el canvas conserva la relación 4:3.
- [ ] `grep -rn "service_role" app components lib proxy.ts` no devuelve resultados.
- [ ] `git status` no muestra cambios en `references/`, `.env.local`, `lib/supabase/database.types.ts` ni en `.cover-duelo`.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. `npx supabase db push --remote` y `mcp__supabase__list_tables` (verbose) o una consulta de lectura para confirmar la fila `paddle-duel`.
3. `npm run dev`: partida completa en `/jugar/paddle-duel` recorriendo la sección 4; comprobar que el HUD refleja puntos, vidas y nivel del engine.
4. Partida real: terminar con puntuación > 0, guardar con nombre, comprobar la fila en el panel y el ranking. Las filas de prueba se borran desde el panel de Supabase, nunca desde el código.
5. Navegar `/juego/paddle-duel` → `/jugar/paddle-duel` → `SALIR` varias veces y comprobar que no quedan bucles.
6. Emulación a 390 px de ancho en `/biblioteca`, `/salon`, `/juego/paddle-duel` y `/jugar/paddle-duel`.

---

## 6. Decisiones tomadas y descartadas

- **Mismo patrón que los demás juegos** (SPEC 05/07, 09, 10). Player cliente fino, engine en `lib/`. Descartado: lógica en el componente.
- **Catálogo en la tabla `games`** (SPEC 07). Una fila vía migración. Descartado: constantes en código.
- **Escritura directa desde el navegador con RLS** (SPEC 07). Sin `service_role`.
- **`ScoreForm` y `GAME_PLAYERS` ya compartidos.** `components/score-form.tsx` existe; no hay paso de refactor.
- **id `paddle-duel`, título `DUELO PALA`.** Lo fija la propuesta del `game-planner` (`references/games-suggestions-todo.md`). Nombre propio sin marcas. Descartado: nombres que remitan a juegos comerciales de palas.
- **Categoría `VERSUS`, color `cyan`.** Fijados por la propuesta; `VERSUS` no tiene ningún juego en el catálogo y el par `VERSUS`/`cyan` no está usado (`rompebloques` es `ARCADE`/`cyan`).
- **Portada nueva `.cover-paddle-duel`.** Convención `cover-<slug>`. Descartado: reutilizar `.cover-duelo` de la plantilla (nombre que no sigue la convención y sin la estela del golpe potente).
- **HUD con `Vidas` y `Nivel`, sin `Tiempo`.** Son los datos que el engine tiene; la partida no tiene límite de tiempo.
- **Migración `paddle_duel` con guion bajo.** Nombre de archivo seguro para la CLI; el `id` en la BD mantiene el guion (`paddle-duel`).
- **Clave entre comillas en `GAME_PLAYERS`.** El id lleva guion, así que la clave es `"paddle-duel"`.
- **`result` incluye las vidas.** Reutiliza el tipo `PaddleDuelStats` para no crear otro tipo; `ScoreForm` solo usa `score`.
- **Pausa con `P`.** Patrón de la plataforma; `Espacio` lo usa el juego.

---

## 7. Riesgos identificados

- **Doble montaje en desarrollo (StrictMode).** Mitigación: `destroy()` idempotente (spec 01) y criterio específico.
- **Re-render por `onStats`.** Mitigación: el engine solo emite al cambiar.
- **Foco del teclado en botones del HUD.** Mitigación: `blur()` tras pulsarlos; criterio específico porque `Espacio` activaría un botón enfocado.
- **Primer id con guion en el catálogo.** `/juego/[id]`, `/jugar/[id]` y `generateStaticParams` nunca han servido un id con `-`. Mitigación: criterios de rutas en build y en dev; si fallara, se corrige en la capa de rutas en un spec aparte, no cambiando el id.
- **Build antes de la migración.** `generateStaticParams` aún no devuelve `paddle-duel`. Mitigación: el registro en `GAME_PLAYERS` no rompe el build; la comprobación de rutas va después de la migración.
- **Spam y trampas en el ranking.** Aceptado hasta la spec de Auth (SPEC 07).
- **Puntuación sobre 1.000.000.** Evitado por el clamp de `addScore` en el engine (spec 01); el `check` rechazaría la inserción.
- **Portada demasiado parecida a `.cover-duelo`.** Mitigación: estela y fondo radial propios; revisar en `/biblioteca`.

---

## What is **not** in this spec

- Mecánicas y dibujo del juego (spec 01).
- Auth, rate limit, moderación, Realtime.
- Cambios de esquema o RLS.
- Controles táctiles, sonido, assets.

Cada uno, si entra, va en su propia spec.
