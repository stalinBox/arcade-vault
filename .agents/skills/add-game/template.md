# Template — spec de un juego + leaderboard

Referencia que consulta `/add-game` al escribir. Forma, no texto literal: sustituir cada `<placeholder>`, borrar bloques condicionales que no apliquen. Estructura y orden de secciones heredados de `/spec` (`.agents/skills/spec/template.md`); contenido invariante sacado de SPEC 05, 06 y 07.

Placeholders: `<slug>` (id en BD y URL, p. ej. `asteroids`), `<Game>` (PascalCase, p. ej. `Asteroids`), `<TITLE>` (título visible en mayúsculas), `<NN>` (número del spec).

---

````markdown
# SPEC <NN> — <TITLE> jugable en `/jugar/<slug>` con su leaderboard

**Estado:** Borrador
**Fecha:** <YYYY-MM-DD, de `date +%F`>
**Depende de:** SPEC 01 (rutas `/juego/[id]` y `/jugar/[id]`, HUD `.player-hud`, marco `.crt`), SPEC 04 (clientes de Supabase, CLI), SPEC 05 (patrón de engine + player), SPEC 07 (tablas `games` y `scores`, `ScoreForm`)<, otras>
**Fuente de referencia:** `references/started-games/<carpeta>/` (`game.js`, `index.html`, …). Esa carpeta no se modifica. <o: «Sin referencia: diseño propio.»>

**Objetivo:** <Una sola frase: portar/crear <TITLE>, montarlo en `/jugar/<slug>` y guardar sus puntuaciones en el ranking de la plataforma.>

---

## 1. Alcance

### Incluido

- Módulo TS `lib/<slug>/engine.ts` sin dependencias de DOM global: recibe el `<canvas>` y callbacks, devuelve un controlador.
- Componente cliente `components/<slug>-player.tsx`: HUD de la plataforma + canvas dentro de `.crt`.
- HUD en vivo: <puntuación, vidas, nivel — solo los que el juego tiene>.
- Botones `PAUSA` y `FIN` funcionales; tecla `P` alterna pausa. <Ajustar si el juego ya usa `P`.>
- Callback `onGameOver({ score, level })` una vez por partida; overlay de fin de partida y reinicio con `Enter` o botón `NUEVA PARTIDA`.
- Fila de `<slug>` en `games` mediante migración versionada en `supabase/migrations/` (`npx supabase db push`). Sin tablas nuevas.
- Portada `.cover-<slug>` en `app/globals.css` (base, `::after`, `::before`).
- Registro del player en el mapa `id → componente` de `app/jugar/[id]/page.tsx`.
- Formulario de nombre al terminar la partida con `score > 0` (reutiliza `ScoreForm`); guarda en `scores` con `game_id = '<slug>'`.
- Ranking real en `/salon` y `/juego/<slug>`; feed de la landing; tarjeta en `/biblioteca`. Salen solos de `games`/`scores`; no requieren código nuevo.
- Bloqueo del scroll con las teclas que use el juego; limpieza total al desmontar (rAF y listeners).
- <Solo si falta> Refactor compartido: ver Plan, paso 1.

### NO incluido (otras specs)

- Autenticación y `user_id` en `scores`.
- Tablas, columnas o políticas RLS nuevas; reglas de puntuación por juego en la BD.
- Límite de frecuencia, moderación, filtro de nombres, Realtime, `service_role`.
- Controles táctiles. La etiqueta "TECLADO / TÁCTIL" de `/juego/[id]` no cambia.
- <Sonido / power-ups / mecánicas de la referencia que se descartan.>
- Los demás juegos de `references/started-games/`.
- Tests automatizados (el repo no tiene runner).

---

## 2. Modelo de datos

Sin datos persistentes nuevos: `scores` y `games` (SPEC 07) se reutilizan tal cual.

### Fila del catálogo

Migración `supabase/migrations/<timestamp>_<slug>.sql`, creada con `npx supabase migration new <slug>`:

```sql
insert into public.games (id, title, short, long, cat, cover, color)
values (
  '<slug>',
  '<TITLE>',
  '<short>',
  '<long>',
  '<ARCADE|PUZZLE|SHOOTER|VERSUS>',
  'cover-<slug>',
  '<cyan|magenta|green|yellow>'
)
on conflict (id) do nothing;
```

### Engine (solo memoria)

```ts
// lib/<slug>/engine.ts
export interface <Game>Stats { score: number; /* lives, level si aplican */ }

export interface <Game>Callbacks {
  onStats(stats: <Game>Stats): void; // al cambiar y al iniciar; nunca cada frame
  onGameOver(result: { score: number; level: number }): void; // una vez por partida
  onPauseChange(paused: boolean): void;
}

export interface <Game>Controller {
  togglePause(): void; // sin efecto si la partida terminó
  end(): void; // dispara onGameOver
  restart(): void;
  destroy(): void; // cancela rAF y listeners; idempotente
}

export function create<Game>(
  canvas: HTMLCanvasElement,
  callbacks: <Game>Callbacks,
): <Game>Controller;
```

Reglas del port:

- Estado dentro de la closure, no en variables de módulo.
- `dt` limitado (p. ej. 0.05 s); `lastTime` se reinicia al reanudar.
- Al pausar y al terminar se limpian las teclas retenidas.
- `onStats` (estado final) se emite antes de `onGameOver`.
- <Constantes exactas de la referencia que se conservan: tamaños de canvas, velocidades, puntos.>

### Controles

| Tecla   | Acción                             |
| ------- | ---------------------------------- |
| <…>     | <…>                                |
| `P`     | Pausa / reanudar                   |
| `Enter` | Reiniciar (solo en fin de partida) |

### Reglas de puntuación

- Entero de 0 a 1.000.000 (`check` de `scores`). <Cómo se garantiza que el juego no lo supere.>
- Nombre: 1–12 caracteres sin espacios sobrantes (lo valida `ScoreForm` y el `check`).

### Archivos

| Archivo                                      | Cambio                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `lib/<slug>/engine.ts`                       | Nuevo. Port / implementación del juego.                                 |
| `components/<slug>-player.tsx`               | Nuevo, `"use client"`. HUD + canvas + `ScoreForm`.                      |
| `app/jugar/[id]/page.tsx`                    | Modificado. Entrada `<slug>` en el mapa de players.                     |
| `app/globals.css`                            | Modificado. `.cover-<slug>*`.                                           |
| `supabase/migrations/<timestamp>_<slug>.sql` | Nuevo. Fila de `games`.                                                 |
| `components/score-form.tsx`                  | <Nuevo, solo si falta. `ScoreForm` extraído de `asteroids-player.tsx`.> |
| `components/asteroids-player.tsx`            | <Modificado, solo si hay refactor. Importa `ScoreForm`.>                |

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

0. **Leer docs.** Antes de código de Next, leer en `node_modules/next/dist/docs/` lo relativo a Client Components y `cacheComponents` (regla de `AGENTS.md`).
1. <Solo si falta> **Refactor compartido.** Mover `ScoreForm` de `components/asteroids-player.tsx` a `components/score-form.tsx` con props `{ gameId, score }` (usa `saveScore(gameId, …)` de `lib/scores-client.ts`); en `app/jugar/[id]/page.tsx` sustituir `if (game.id === "asteroids")` por un mapa `id → componente`. Asteroides debe comportarse igual.
2. **Engine.** Crear `lib/<slug>/engine.ts` con las reglas del port. Sin callbacks todavía; prueba manual comparando con `references/…/index.html`.
3. **Callbacks y control.** `onStats`, `onGameOver`, `onPauseChange` y el controlador.
4. **Player.** `components/<slug>-player.tsx`: estado `stats`, `paused`, `result`; `useEffect` crea y destruye el controlador (StrictMode); HUD con las clases existentes; `<ScoreForm gameId="<slug>" score={…}/>` si `result.score > 0`; `SALIR` a `/juego/<slug>`.
5. **Portada.** `.cover-<slug>` en `app/globals.css`.
6. **Migración.** `npx supabase migration new <slug>`, pegar el SQL de la sección 2, `npx supabase db push`. Si la CLI no tiene sesión: el usuario ejecuta `! npx supabase login` y se reintenta; alternativa `apply_migration` por MCP con el mismo SQL, dejando el archivo en git.
7. **Registro.** Añadir `<slug>` al mapa de players. Comprobar `/biblioteca`, `/juego/<slug>`, `/jugar/<slug>`.
8. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores nuevos.
- [ ] `supabase/migrations/` contiene exactamente un archivo nuevo con el SQL de la sección 2.
- [ ] `npx supabase db push` termina sin error.
- [ ] La tabla `games` contiene una fila con `id = '<slug>'` y las filas previas intactas.
- [ ] `/biblioteca` muestra la tarjeta `<TITLE>` con su portada, sin errores en consola.
- [ ] `/juego/<slug>` muestra `<TITLE>` y el ranking real; con cero filas, `Sin puntuaciones todavía`.
- [ ] `/jugar/<slug>` muestra el HUD de la plataforma y el canvas dentro del marco CRT, sin HUD dibujado en el canvas.
- [ ] El juego arranca solo al entrar.
- [ ] <Un criterio booleano por control y por regla de puntuación del juego.>
- [ ] `P` y el botón `PAUSA` pausan y reanudan desde el mismo punto; `P` no hace nada tras el fin de partida.
- [ ] Al terminar, aparece el overlay de fin y `onGameOver` se llama exactamente una vez (verificable con un `console.log` temporal que se elimina). `FIN` produce lo mismo.
- [ ] `Enter` y `NUEVA PARTIDA` inician una partida limpia.
- [ ] Con `score > 0` aparece el formulario; con `score = 0` no.
- [ ] Guardar con un nombre válido crea una fila en `scores` con `game_id = '<slug>'`, nombre sin espacios sobrantes y la puntuación de la partida.
- [ ] Tras guardar, `/salon` y `/juego/<slug>` incluyen la puntuación al recargar.
- [ ] Si la inserción falla, se muestra el error y se puede reintentar sin perder el nombre.
- [ ] La landing muestra las últimas puntuaciones incluidas las de `<slug>`.
- [ ] Con las teclas del juego, la página no hace scroll; al salir, el bucle se detiene y el scroll vuelve.
- [ ] Con `reactStrictMode` en `npm run dev`, no hay dos bucles simultáneos.
- [ ] Los demás juegos (`/jugar/asteroids`, …) siguen funcionando igual.
- [ ] En 390 px, `/biblioteca`, `/salon`, `/juego/<slug>` y `/jugar/<slug>` no tienen scroll horizontal y el canvas conserva su relación de aspecto.
- [ ] `grep -rn "service_role" app components lib proxy.ts` no devuelve resultados.
- [ ] `git status` no muestra cambios en `references/` ni `.env.local`.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. `npx supabase db push` y `mcp__supabase__list_tables` (verbose) para confirmar la fila.
3. `npm run dev`: partida completa recorriendo la sección 4; comparar con `references/…/index.html` (velocidades, puntos).
4. Partida real: terminar con puntuación > 0, guardar con nombre, comprobar la fila en el panel y el ranking. Las filas de prueba se borran desde el panel de Supabase, nunca desde el código.
5. Navegar `/juego/<slug>` → `/jugar/<slug>` → `SALIR` varias veces y comprobar que no quedan bucles.
6. Emulación a 390 px de ancho.

---

## 6. Decisiones tomadas y descartadas

- **Mismo patrón que Asteroides** (SPEC 05/07). Engine en `lib/`, player cliente, callbacks hacia React. Descartado: lógica dentro del componente.
- **Catálogo en la tabla `games`** (SPEC 07). Una fila por juego, vía migración. Descartado: constantes en código.
- **Escritura directa desde el navegador con RLS** (SPEC 07). Sin `service_role`.
- **`ScoreForm` y mapa de players compartidos.** <Solo si se extrajo: evita duplicar el formulario y la rama `if` por juego.>
- **Pausa con `P`.** <Justificación; ajustar si choca con los controles del juego.>
- <Decisiones propias de este juego, cada una con su motivo y lo descartado.>

---

## 7. Riesgos identificados

- **Doble montaje en desarrollo (StrictMode).** Mitigación: `destroy()` idempotente y criterio específico.
- **Re-render por `onStats`.** Mitigación: emitir solo al cambiar.
- **Teclas pegadas tras pausa.** Mitigación: limpiar teclas al pausar y terminar.
- **Salto de tiempo tras pausa o pestaña en segundo plano.** Mitigación: `dt` máximo.
- **Foco del teclado en botones del HUD.** Mitigación: `blur()` tras pulsarlos.
- **Divergencia con la referencia.** Mitigación: comparar lado a lado.
- **Spam y trampas en el ranking.** Aceptado hasta la spec de Auth (SPEC 07).
- **Puntuación sobre 1.000.000.** <Cómo se evita; el `check` rechazaría la inserción.>
- <Riesgos propios del juego.>

---

## What is **not** in this spec

- Auth, rate limit, moderación, Realtime.
- Cambios de esquema o RLS.
- Controles táctiles.
- <Lo descartado del juego.>

Cada uno, si entra, va en su propia spec.
````

---

## Reglas al rellenar

- Quitar todo bloque `<Solo si …>` que no aplique; si el refactor ya existe, la fila de `score-form.tsx` y el paso 1 desaparecen y los pasos se renumeran.
- Una frase por idea; nombres concretos; sin TODOs.
- Los criterios específicos del juego (controles, puntos, niveles) deben ser booleanos y tomados de la referencia, no inventados.
