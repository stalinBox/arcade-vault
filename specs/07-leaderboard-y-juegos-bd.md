# SPEC 07 — Leaderboard y tabla de juegos en base de datos

**Estado:** APPROVED
**Fecha:** 2026-11-10
**Depende de:** SPEC 01 (`/salon`, `/juego/[id]`, `/jugar/[id]`, biblioteca, landing), SPEC 04 (cliente de navegador y servidor de Supabase, `supabase/` con CLI), SPEC 05 (juego Asteroides y su `gameOver` en `lib/asteroids/engine.ts`), SPEC 06 (título `ASTEROIDES`)

**Objetivo:** Que el catálogo de juegos y el leaderboard salgan de Supabase, con Asteroides como único juego, y que cada partida guarde su puntuación.

---

## 1. Alcance

### Incluido

- Tabla `games` con una sola fila: `asteroids`. Es el catálogo completo de la app.
- Tabla `scores` con las puntuaciones de las partidas guardadas.
- Políticas RLS: lectura pública de ambas tablas; inserción anónima en `scores` con restricciones; sin `UPDATE` ni `DELETE` para nadie.
- Migración versionada en `supabase/migrations/` aplicada con la CLI (`npx supabase db push`).
- Tipos generados en `lib/supabase/database.types.ts`.
- `lib/games.ts` pasa a leer el catálogo de la base. Se eliminan los 7 juegos mock (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) y la constante `GAMES`.
- Biblioteca (`/biblioteca`), salón de la fama (`/salon`), ficha (`/juego/[id]`), juego (`/jugar/[id]`) y landing muestran solo Asteroides. Los juegos no jugables no aparecen en la biblioteca, ni como tarjeta ni como estado bloqueado o próximamente.
- Salón y ficha leen el ranking de la base.
- Formulario de nombre al terminar una partida de Asteroides; guarda la puntuación en `scores`.
- Landing: el feed "puntuaciones en vivo" lee las últimas puntuaciones de la base.
- Eliminar `seededScores`, `PLAYERS` y `LIVE_SCORES` (datos mock).

### NO incluido (otras specs o cuando se creen los juegos)

- Autenticación y `user_id` en `scores` (spec de Auth). Hasta entonces, `player_name` es texto libre.
- Añadir los 7 juegos restantes a la base. Se crean uno a uno en su propia spec cuando existan; cada uno requiere su fila en `games` y su migración.
- Filtro de palabrotas, moderación, borrado o edición de puntuaciones.
- Límite de frecuencia (rate limit) de inserciones.
- Vista o función SQL de estadísticas. `best` y `plays` se calculan en la consulta de la app.
- Server Action para escribir puntuaciones. La escritura va directa desde el navegador con RLS.
- Clave `service_role` o cualquier uso privilegiado.
- Tests automatizados (el repo no tiene runner).
- Suscripciones en tiempo real (Realtime).

---

## 2. Modelo de datos

### Migración `supabase/migrations/<timestamp>_leaderboard_y_juegos.sql`

Crear con `npx supabase migration new leaderboard_y_juegos`.

```sql
create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan', 'magenta', 'green', 'yellow')),
  created_at timestamptz not null default now()
);

create table public.scores (
  id          bigint generated always as identity primary key,
  game_id     text not null references public.games (id),
  player_name text not null check (player_name = btrim(player_name) and char_length(player_name) between 1 and 12),
  score       integer not null check (score between 0 and 1000000),
  created_at  timestamptz not null default now()
);

create index scores_game_ranking_idx on public.scores (game_id, score desc, created_at asc);
create index scores_recent_idx on public.scores (created_at desc);

alter table public.games enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public" on public.games
  for select to anon, authenticated using (true);

create policy "scores_select_public" on public.scores
  for select to anon, authenticated using (true);

create policy "scores_insert_public" on public.scores
  for insert to anon, authenticated with check (true);

-- Sin políticas de UPDATE ni DELETE: nadie puede modificar ni borrar puntuaciones.

insert into public.games (id, title, short, long, cat, cover, color)
values (
  'asteroids',
  'ASTEROIDES',
  'Pulveriza asteroides en gravedad cero.',
  'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir asteroides en fragmentos cada vez más pequeños. Limpia el campo para subir de nivel.',
  'SHOOTER',
  'cover-asteroids',
  'yellow'
)
on conflict (id) do nothing;
```

Notas:

- `scores_insert_public` acepta cualquier `game_id` existente. La integridad la da la FK; los límites de puntuación y de nombre los dan los `check`.
- La inserción usa `anon` (clave publicable). Sin `service_role`.

### Datos de la app (no persistentes)

`lib/games.ts` mantiene el tipo `Game` y `CATS`, y pasa a leer las filas de `games`. El tipo `Game` no cambia. Campos calculados desde `scores`:

| Campo de `Game` | Origen                                                 |
| --------------- | ------------------------------------------------------ |
| `id` … `color`  | Tabla `games`                                          |
| `best`          | `max(score)` de `scores` del juego, o `0`              |
| `plays`         | `count(*)` de `scores` del juego, formateado (`12.4K`) |

Firmas:

```ts
// lib/supabase/database.types.ts — generado con `npx supabase gen types typescript --linked`

// lib/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "green" | "yellow";
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: GameColor;
  best: number;
  plays: string;
}
export const CATS: ("TODOS" | GameCategory)[]; // sin cambios
export async function getCatalog(): Promise<Game[]>; // servidor
export async function getGame(id: string): Promise<Game | null>; // servidor

// lib/scores.ts
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}
export async function getTopScores(
  gameId: string,
  limit?: number,
): Promise<ScoreRow[]>; // servidor
export async function getLatestScores(
  limit?: number,
): Promise<(ScoreRow & { game: string })[]>; // servidor
export async function saveScore(
  gameId: string,
  playerName: string,
  score: number,
): Promise<void>; // navegador
```

Reglas de datos:

- Límite de puntuación: entero de 0 a 1.000.000 (decisión del usuario).
- Nombre: sin espacios al inicio ni al final, de 1 a 12 caracteres. Sin filtro de contenido.
- Orden del ranking: `score` descendente, después `created_at` ascendente (empates: gana quien llegó antes).
- `date` en `ScoreRow` es `created_at` en formato `dd/mm/yyyy`. `rank` lo calcula la app, 1-based.

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

1. **Migración.** Crear el archivo SQL de la sección 2 con `npx supabase migration new leaderboard_y_juegos`. Aplicar con `npx supabase db push`. Si la CLI no tiene sesión, el usuario ejecuta `! npx supabase login` y luego el agente reintenta; alternativa: `apply_migration` por MCP con el mismo SQL, dejando el archivo en git.
2. **Tipos.** `npx supabase gen types typescript --linked > lib/supabase/database.types.ts`. Tipar `createBrowserClient<Database>` y `createServerClient<Database>` en `lib/supabase/client.ts` y `server.ts`.
3. **Acceso a datos.** Reescribir `lib/games.ts` (sin `GAMES`; añadir `getCatalog` y `getGame`) y `lib/scores.ts` (tipo `ScoreRow`, `getTopScores`, `getLatestScores` con cliente de servidor; `saveScore` con cliente de navegador). Leer antes `node_modules/next/dist/docs/` para `cookies()` y `cacheComponents`.
4. **Biblioteca.** `components/library.tsx` y `app/biblioteca/page.tsx` reciben el catálogo desde `getCatalog()` (servidor, dentro de `<Suspense>`, ver SPEC 04 sección 7). Con un solo juego, el filtro de categorías sigue igual.
5. **Salón y ficha.** `app/salon/page.tsx` y `app/juego/[id]/page.tsx` leen el catálogo y el ranking en servidor, dentro de `<Suspense>`. `components/hall-of-fame.tsx` recibe catálogo y filas por props en lugar de llamar a `seededScores`. Con cero filas muestra `Sin puntuaciones todavía`.
6. **Rutas de juego.** `app/jugar/[id]/page.tsx` y `app/juego/[id]/page.tsx`: `generateStaticParams` devuelve los ids de `getCatalog()`. Si el id no existe, `notFound()`. Verificar en la documentación de Next el comportamiento de `dynamicParams` antes de escribir.
7. **Formulario de puntuación.** En `components/asteroids-player.tsx`, al terminar la partida (`gameOver` del engine) y si `score > 0`, mostrar debajo del canvas un formulario `NOMBRE` (1–12 caracteres) y el botón `GUARDAR`. Estados: `idle` → `saving` → `saved` | `error`. Tras guardar, refrescar el ranking (`router.refresh()`). Si falla, muestra el error y permite reintentar sin perder el nombre. Una partida se guarda una sola vez.
8. **Landing.** `components/landing.tsx` recibe `getLatestScores(6)` y el catálogo por props desde la página de inicio (servidor, dentro de `<Suspense>`). Sustituye `LIVE_SCORES` y el `GAMES.slice(0, 6)`. Sin filas muestra `Sin puntuaciones todavía`.
9. **Limpieza.** Eliminar `PLAYERS`, `seededScores`, `LIVE_SCORES` y los imports huérfanos. `grep -rn "seededScores\|LIVE_SCORES\|PLAYERS\|GAMES\b" app components lib` sin resultados de datos mock.
10. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores nuevos.
- [ ] `supabase/migrations/` contiene exactamente un archivo nuevo con el SQL de la sección 2.
- [ ] `npx supabase db push` termina sin error.
- [ ] La tabla `games` contiene exactamente una fila, con `id = 'asteroids'`.
- [ ] Las tablas `games` y `scores` tienen RLS activo (`rowsecurity = true`).
- [ ] Con la clave publicable (rol `anon`), un `SELECT` sobre `scores` devuelve filas.
- [ ] Con la clave publicable, un `INSERT` en `scores` con `score = 1000001` falla.
- [ ] Con la clave publicable, un `INSERT` con `player_name` vacío o de 13 caracteres falla.
- [ ] Con la clave publicable, un `UPDATE` o `DELETE` sobre `scores` no afecta a ninguna fila.
- [ ] Con la clave publicable, un `INSERT` con `game_id = 'no-existe'` falla por la FK.
- [ ] `lib/supabase/database.types.ts` existe y `scores` aparece tipada.
- [ ] `lib/games.ts` no contiene `GAMES` ni ninguno de los 7 juegos mock.
- [ ] `/biblioteca` muestra una sola tarjeta, `ASTEROIDES`, desde la base, sin errores en consola.
- [ ] `/biblioteca` no muestra ninguna otra tarjeta: ni juegos no jugables, ni tarjetas bloqueadas, ni estados vacíos, ni filtros de categoría con juegos ausentes.
- [ ] La landing muestra solo Asteroides en el bloque de juegos.
- [ ] `/salon` muestra una sola pestaña, Asteroides, con el ranking real. Con cero filas muestra `Sin puntuaciones todavía`.
- [ ] `/juego/asteroids` muestra el ranking real y `ASTEROIDES` como título.
- [ ] `/juego/caida` (y cualquier id inexistente) responde 404.
- [ ] `/jugar/asteroids` abre el juego sin cambios visibles en la barra superior (`ASTEROIDES · CRT-83 · 60 HZ`).
- [ ] Al terminar una partida de Asteroides con `score > 0`, aparece el formulario; con `score = 0` no aparece.
- [ ] Guardar una puntuación con un nombre válido crea una fila en `scores` con `game_id = 'asteroids'`, el nombre sin espacios sobrantes y la puntuación de la partida.
- [ ] Tras guardar, el ranking de `/salon` y `/juego/asteroids` incluye la nueva puntuación al recargar.
- [ ] Si la inserción falla (por ejemplo, sin red), se muestra un mensaje de error y el botón permite reintentar sin perder el nombre.
- [ ] La landing muestra en `PUNTUACIONES EN VIVO` las últimas puntuaciones reales; sin filas muestra `Sin puntuaciones todavía`.
- [ ] `grep -rn "seededScores\|LIVE_SCORES\|PLAYERS" app components lib` no devuelve resultados.
- [ ] `grep -rn "service_role" app components lib proxy.ts` no devuelve resultados.
- [ ] En 390 px, `/biblioteca`, `/salon`, `/juego/asteroids` y la landing no tienen scroll horizontal.
- [ ] `git status` no muestra `.env.local` ni archivos fuera de `supabase/migrations/`, `lib/`, `app/` y `components/`.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. Migración: `npx supabase db push` y `mcp__supabase__list_tables` (verbose) para confirmar tablas, RLS y la fila de `games`.
3. Políticas: con la clave publicable, probar los casos de la sección 4 (SELECT ok; INSERT válido ok; INSERT con score 1000001, nombre vacío o de 13 caracteres, o `game_id` inexistente falla; UPDATE y DELETE no afectan filas). Usar `curl` contra la API REST con la clave publicable o `supabase-js` desde `npm run dev`. Las filas de prueba se borran desde el panel de Supabase, nunca desde el código.
4. `npm run dev`: recorrido manual de `/`, `/biblioteca`, `/salon`, `/juego/asteroids`, `/juego/caida`, `/jugar/asteroids`, en escritorio y a 390 px, con la consola abierta.
5. Partida real de Asteroides: terminar con puntuación > 0, guardar con nombre, comprobar la fila en el panel y el ranking actualizado.
6. Grep de la sección 3, paso 9, y `git status`.

---

## 6. Decisiones tomadas y descartadas

- **Catálogo = tabla `games`, solo Asteroides** (elegido por el usuario). Los demás juegos se añaden a la base cuando existan, cada uno en su spec. Descartado: mantener los 7 mock en código (dos fuentes de verdad, y la biblioteca mostraría juegos que no se pueden jugar).
- **Nombre libre sin Auth** (elegido por el usuario). `player_name` text. Se sustituye por `user_id` en la spec de Auth. Descartado: esperar a Auth (bloquea todo) y puntuaciones anónimas sin nombre (ranking ilegible).
- **Inserción anónima con RLS y límites** (elegido por el usuario). Descartado: Server Action (añade capa sin ganancia de seguridad sin `service_role`) y solo lectura (el juego no guardaría nada).
- **Escritura y lectura en la misma spec** (elegido por el usuario). Descartado: solo tablas y seed (la UI seguiría con mock).
- **Estado vacío honesto** (elegido por el usuario). Descartado: rellenar con mock (mezcla datos falsos con reales).
- **Límite 0–1.000.000** (elegido por el usuario). Descartado: sin límite superior.
- **Migración versionada + `db push`** (elegido por el usuario). Consistente con SPEC 04. Descartado: solo `apply_migration` por MCP (historial solo en remoto).
- **Sin RLS de UPDATE/DELETE** (elegido). Las puntuaciones son históricas; corregir se hace desde el panel de Supabase. Descartado: permitir borrar a anon.
- **Sin vista de estadísticas** (elegido). `best` y `plays` se calculan con consultas simples. Descartado: vista `game_stats` (un objeto más que mantener sin necesidad hoy).
- **Escritura directa desde el navegador** (elegido). Con RLS es el patrón oficial de Supabase; no hay secreto que proteger.
- **Tipos generados ahora** (elegido). SPEC 04 los dejó para esta spec.
- **`CATS` se mantiene en `lib/games.ts`** (elegido). Los valores de categoría los fija el `check` de `games.cat`; el filtro sigue en código hasta que haya más juegos.

---

## 7. Riesgos identificados

- **Pregeneración de rutas.** `/jugar/asteroids` y `/juego/asteroids` dependen de `getCatalog()` en `generateStaticParams`. Mitigación: paso 6; comprobar `dynamicParams` en la documentación de Next 16 antes de escribir.
- **Spam de puntuaciones.** Con `anon` y sin límite de frecuencia, cualquiera puede insertar filas válidas (hasta 1.000.000 cada una) y llenar el ranking. Mitigación: límites de los `check`, sin UPDATE/DELETE, moderación desde el panel. Riesgo aceptado hasta la spec de Auth.
- **Trampas en el cliente.** La puntuación la calcula el navegador; cualquiera puede enviar un número válido falso. Mitigación: límite superior; el ranking es informal. Riesgo aceptado hasta tener Auth o validación en servidor.
- **Nombres ofensivos.** Sin filtro. Mitigación: fuera de alcance; se revisa a mano desde el panel.
- **`cacheComponents` y lecturas dinámicas.** `getCatalog`, `getTopScores` y `getLatestScores` usan el cliente de servidor (lee cookies). Sin `<Suspense>` pueden romper el build. Mitigación: pasos 4, 5 y 8.
- **Caída de red al guardar.** La puntuación se pierde si no se envía. Mitigación: reintento con el nombre conservado. No se guarda en local.
- **Migración sobre base con datos.** `create table` no afecta a datos existentes; la fila de `asteroids` usa `on conflict do nothing`. Riesgo bajo.
- **Catálogo en base.** Añadir un juego exige migración (o insert). Es el coste aceptado al mover el catálogo a la base.
