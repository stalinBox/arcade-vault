# SPEC 11 — Rendimiento de los juegos: bucle compartido, reposo real y CSS barato en `/jugar/*`

**Estado:** APPROVED
**Fecha:** 2026-11-15
**Depende de:** SPEC 05 (asteroids), SPEC 08 (blocks), SPEC 09 (rompebloques), SPEC 10 (snake), `specs/game-jam/paddle-duel/02-paddle-duel-plataforma.md` (paddle-duel). Patrón de engine + player y skins (`lib/skins.ts`).
**Fuente de referencia:** Ninguna. Diagnóstico propio sobre el código actual.

**Objetivo:** Reducir el uso de CPU/GPU y los tirones en los cinco juegos jugables parando sus bucles cuando no hay nada que animar y eliminando el CSS global caro bajo `/jugar/*`, con medición antes y después.

---

## 1. Por qué existe esta spec

Síntomas reportados, en todos los dispositivos y con cualquier skin: FPS bajos al jugar, input lag y consumo alto de CPU incluso en reposo. Que no dependa de la skin descarta `shadowBlur`/`ctx.filter` como causa principal. Hallazgos en el código:

- Los cinco engines llaman a `requestAnimationFrame` sin parar y redibujan el canvas completo en cada frame aunque el juego esté en pausa o terminado. Ninguno escucha `visibilitychange`.
- `.av-bg::before` (grid en perspectiva) anima `background-position` sin parar: obliga a repintar una capa fija a pantalla completa en cada frame, con `mask-image` y `transform: perspective`. Es la causa más probable del consumo en reposo.
- `.av-bg::after` (scanlines) usa `mix-blend-mode: overlay` a pantalla completa; `.crt-screen::after` usa `mix-blend-mode: multiply` encima del canvas, lo que fuerza mezcla en cada frame del juego.
- `.av-nav` usa `backdrop-filter: blur(8px)` en una barra `sticky`.

El input lag no está diagnosticado: la hipótesis es contención del hilo principal por el repintado continuo. El paso 1 lo mide; esta spec no promete arreglarlo por separado.

---

## 2. Alcance

### Incluido

- Paso de medición previa y posterior (DevTools Performance sobre `npm run build && npm run start`), con tabla antes/después por juego guardada en la descripción del PR.
- Nuevo `lib/game-loop.ts`: bucle compartido por los cinco engines, con parada en reposo y por pestaña oculta.
- Migración de `lib/asteroids/engine.ts`, `lib/blocks/engine.ts`, `lib/rompebloques/engine.ts`, `lib/snake/engine.ts` y `lib/paddle-duel/engine.ts` al bucle compartido.
- Política de reposo: el bucle se detiene en pausa, en fin de partida y con la pestaña oculta. Se redibuja un frame al entrar en reposo y al cambiar de skin o modo de color.
- CSS en `app/globals.css`, limitado a `/jugar/*` mediante `body:has(.av-player)`: sin animación del grid, sin scanlines globales, sin `backdrop-filter` en el nav.
- `.crt-screen::after` pasa de `mix-blend-mode: multiply` a mezcla normal (resultado visual idéntico: la scanline es negra con alpha, `multiply` con negro equivale a `normal`). Este cambio es global porque no altera el aspecto.

### NO incluido (otras specs)

- Optimizar el dibujo por frame dentro de los engines (`shadowBlur`, `ctx.filter`, gradientes, partículas, caché en canvas offscreen). Si tras esta spec los FPS en juego siguen bajos, va en una spec nueva con la medición como base.
- Cambiar el aspecto del resto del sitio (`/inicio`, `/biblioteca`, `/salon`, `/acerca`): el grid animado y las scanlines se mantienen allí.
- Reescribir los efectos para el resto del sitio con capas compuestas por GPU.
- Cambios de reglas de juego, skins, paletas, controles o HUD.
- Cambios en Supabase, esquema, RLS o ranking.
- Resolución del canvas / `devicePixelRatio`.
- Tests automatizados (el repo no tiene runner) y métricas en producción.

---

## 3. Modelo de datos

Sin datos persistentes nuevos. Solo un contrato en memoria:

```ts
// lib/game-loop.ts
export interface GameLoop {
  /** Programa un frame si el bucle está parado. Reinicia el ancla de tiempo: el primer dt tras despertar es 0. */
  wake(): void;
  /** Cancela el frame pendiente y los listeners. Idempotente. */
  destroy(): void;
}

/**
 * `frame(now)` se llama una vez por frame. Devuelve `true` para seguir,
 * `false` para entrar en reposo (el frame que devuelve `false` ya dibujó).
 * El bucle arranca solo al crearse; se para con la pestaña oculta y
 * despierta al volver a ser visible.
 */
export function createGameLoop(frame: (now: number) => boolean): GameLoop;
```

Reglas:

- Un frame devuelve `false` cuando el engine está en pausa o la partida terminó (el estado que cada engine ya llama `paused` / `over` / `lost` / `won` / `gameover`). Los estados de espera (`ready`, saque) no son reposo: siguen en bucle.
- Quien cambia el estado despierta el bucle: `togglePause`, `restart`, `end`, `setSkin`, y los handlers de teclado de cada engine cuando ya procesaban la tecla. `wake()` es idempotente y no apila frames.
- `destroy()` del engine llama a `loop.destroy()`; sigue siendo idempotente y limpia rAF y listeners.
- Los límites de `dt` por frame (`MAX_DT`, `MAX_FRAME_MS`, 50 ms) se conservan en cada engine.
- El bucle no conoce nada de canvas ni de juegos.

### Archivos

| Archivo                      | Cambio                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `lib/game-loop.ts`           | Nuevo. `createGameLoop`.                                                                                               |
| `lib/snake/engine.ts`        | Modificado. Usa `createGameLoop`; `frame` devuelve `false` en pausa/fin. `wake()` en pausa, restart, end, skin, input. |
| `lib/asteroids/engine.ts`    | Igual. Mantiene su `loop`/`draw` actuales dentro del `frame`.                                                          |
| `lib/blocks/engine.ts`       | Igual.                                                                                                                 |
| `lib/rompebloques/engine.ts` | Igual. El bucle arranca tras `loadSprites` como hasta ahora.                                                           |
| `lib/paddle-duel/engine.ts`  | Igual.                                                                                                                 |
| `app/globals.css`            | Modificado. Reglas `body:has(.av-player)` y `.crt-screen::after` sin `mix-blend-mode`.                                 |
| `components/*-player.tsx`    | Sin cambios: el contrato público de los controladores no cambia.                                                       |

---

## 4. Plan de implementación

Cada paso deja la app compilando (`npm run build`) y los juegos jugables.

0. **Leer docs.** Antes de tocar código de Next, revisar en `node_modules/next/dist/docs/` lo relativo a Client Components (regla de `AGENTS.md`). No se cambia routing ni caché.
1. **Medición previa (sin código).** `npm run build && npm run start`. En Chrome, DevTools → Performance, 10 s por caso: cada uno de los 5 juegos en juego, y cada uno en pausa. Anotar FPS medio, ms de scripting y de pintura por frame, y CPU. Con el panel Rendering → Paint flashing, anotar qué repinta sin parar en pausa. Desactivar `.av-bg` desde DevTools una vez para aislar su coste. La tabla va al borrador del PR.
2. **CSS.** En `app/globals.css`:
   - `body:has(.av-player) .av-bg::before { animation: none; }` y `body:has(.av-player) .av-bg::after { display: none; }`.
   - `body:has(.av-player) .av-nav { backdrop-filter: none; }`.
   - Quitar `mix-blend-mode: multiply` de `.crt-screen::after`.
   - Medir otra vez la pausa de un juego (los engines aún no paran): comprobar que el repintado fuera del canvas desaparece y que el aspecto del CRT no cambia en oscuro ni en claro.
3. **Bucle compartido + snake.** Crear `lib/game-loop.ts` y migrar `lib/snake/engine.ts`. Comprobar a mano: pausa → sin frames; `P` reanuda sin salto de tiempo; fin → overlay dibujado y sin frames; `Enter` reinicia; cambiar skin en pausa redibuja.
4. **Asteroids y blocks.** Migrar ambos con la misma regla.
5. **Rompebloques y paddle-duel.** Migrar ambos con la misma regla; respetar el arranque tras carga de sprites en rompebloques.
6. **Medición posterior.** Repetir el paso 1 y completar la tabla antes/después. Navegar `/juego/<id>` → `/jugar/<id>` → `SALIR` varias veces por juego: sin bucles duplicados.

---

## 5. Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores nuevos.
- [ ] Existe `lib/game-loop.ts` y los cinco engines lo usan; ninguno llama a `requestAnimationFrame` directamente.
- [ ] En pausa, en cada juego, DevTools Performance (5 s) no muestra `Animation Frame Fired` ni repintado fuera de eventos de usuario.
- [ ] En fin de partida, en cada juego, ocurre lo mismo que en pausa, con el overlay `GAME OVER` dibujado y visible.
- [ ] Con la pestaña oculta no se ejecuta ningún frame; al volver, la partida continúa sin salto de tiempo (primer `dt` = 0).
- [ ] `P` (o el control equivalente de cada juego), `Enter`, `NUEVA PARTIDA`, `PAUSA` y `FIN` funcionan igual que antes en los cinco juegos.
- [ ] Cambiar la skin o el modo claro/oscuro con el juego en pausa o terminado actualiza el canvas en el acto.
- [ ] En `/jugar/*` el grid de fondo no se anima, no hay scanlines globales y el nav no usa `backdrop-filter`. En `/inicio`, `/biblioteca`, `/salon`, `/juego/[id]` y `/acerca` el aspecto es el mismo que antes.
- [ ] El CRT (`.crt-screen`) se ve igual que antes en oscuro y en claro, con las scanlines visibles.
- [ ] Tabla antes/después en el PR: para cada uno de los 5 juegos, FPS medio, scripting + pintura por frame y CPU, en juego y en pausa.
- [ ] En juego, ningún juego baja de 50 FPS sostenidos durante 30 s en la máquina de medición, o la tabla muestra mejora sobre la línea base y el PR enlaza la spec de seguimiento.
- [ ] En pausa, la CPU de la pestaña queda cerca de 0 % (sin frames de animación ni repintado).
- [ ] Con `reactStrictMode` en `npm run dev`, no hay dos bucles simultáneos por juego.
- [ ] Una partida terminada con `score > 0` sigue mostrando `ScoreForm` y guarda en `scores` igual que antes (comprobado en al menos un juego).
- [ ] `git status` no muestra cambios en `references/`, `.env.local` ni `supabase/migrations/`.

---

## 6. Decisiones tomadas y descartadas

- **Medir y corregir en una sola spec.** Elegido por el usuario. Descartado: spec de solo auditoría (retrasa los arreglos cuyo origen ya es claro).
- **CSS caro apagado solo en `/jugar/*`.** Elegido por el usuario. Descartado: reescribirlo para todo el sitio (más trabajo y riesgo visual) y quitarlo del todo (pierde identidad).
- **Scope con `body:has(.av-player)`.** Decisión propia: CSS puro, sin JS ni cambios en `app/layout.tsx`. Descartado: marcar `<html>` desde un efecto del player (estado extra y parpadeo al montar).
- **`.crt-screen::after` sin `multiply` en todo el sitio.** Decisión propia: negro con alpha da el mismo resultado con `normal` y `multiply`, así que no hay cambio visual que justifique restringirlo.
- **Reposo = pausa, fin y pestaña oculta.** Elegido por el usuario. Descartado: bajar a 30 FPS en reposo (sigue consumiendo) y parar solo con pestaña oculta (sigue gastando en pausa).
- **Estados de espera (`ready`, saque) siguen en bucle.** Decisión propia: en rompebloques y paddle-duel el jugador mueve la pala antes de empezar y esos estados animan; pararlos exigiría despertar por cada tecla.
- **Bucle compartido `lib/game-loop.ts`.** Elegido por el usuario. Descartado: parchear cada engine (cinco copias de la misma lógica de visibilidad y reposo).
- **API `frame(now) => boolean` + `wake()`.** Decisión propia: es la superficie mínima; el engine decide cuándo hay reposo y el bucle solo programa frames.
- **Sin umbral fijo obligatorio, medición antes/después.** Elegido por el usuario. Se añade una cota de 50 FPS como referencia en la máquina de medición, con salida alternativa a una spec de seguimiento si no se alcanza.
- **Sin optimizar el dibujo por frame.** Decisión propia: el síntoma no depende de la skin, y mezclar la optimización de render con la de bucle y CSS impide atribuir la mejora.

---

## 7. Riesgos identificados

| Riesgo                                                                          | Mitigación                                                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Un cambio de estado olvida llamar a `wake()` y el juego queda congelado.        | Lista de `wake()` en la sección 3 y criterio de aceptación por cada control en los 5 juegos. |
| Salto de tiempo al despertar de pausa o pestaña oculta.                         | `wake()` reinicia el ancla; el primer `dt` es 0; se conservan los topes de `dt` actuales.    |
| Las mejoras del CSS y del bucle no bastan para FPS en juego (coste del dibujo). | Tabla del paso 6 como evidencia; spec de seguimiento sobre el dibujo por frame.              |
| `:has()` sin soporte en navegadores antiguos.                                   | Degradación aceptable: sin soporte, los efectos siguen como hoy.                             |
| Doble montaje en desarrollo (StrictMode) crea dos bucles.                       | `destroy()` idempotente y criterio específico.                                               |
| El input lag no era causado por el repintado.                                   | La medición del paso 1 lo revela; si persiste, spec propia con perfil de eventos de teclado. |
| Medir en `npm run dev` da cifras engañosas.                                     | La medición se hace siempre con `npm run build && npm run start`.                            |

---

## Lo que **no** entra en esta spec

- Optimización del dibujo por frame dentro de los engines.
- Cambio de aspecto fuera de `/jugar/*`.
- Reglas de juego, skins, controles, HUD.
- Supabase, RLS, ranking, autenticación.
- Tests automatizados y telemetría.

Cada uno, si entra, va en su propia spec.
