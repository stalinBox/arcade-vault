# SPEC 15 — Puntaje solo para usuarios autenticados

**Estado:** IMPLEMENTED
**Fecha:** 2026-11-16
**Depende de:** SPEC 07 (`scores`, `components/score-form.tsx`), SPEC 12 (Auth, `profiles`, `useCurrentUser`), SPEC 13 (política de insert de `scores`).

**Objetivo:** Solo los usuarios con sesión pueden guardar un puntaje, con su username fijo y ligado a su `user_id`; los invitados siguen jugando pero ven una invitación a iniciar sesión.

---

## 1. Por qué existe esta spec

Hoy `scores` acepta inserts de `anon` y `authenticated` (SPEC 13) y `ScoreForm` deja guardar a invitados con cualquier nombre. El leaderboard es suplantable y no hay forma de ligar un puntaje a su dueño. SPEC 12 dejó `scores.user_id` fuera de alcance; esta spec lo cierra.

---

## 2. Alcance

### Incluido

- Migración nueva (un solo archivo):
  - Columna `scores.user_id uuid references auth.users(id) on delete set null default auth.uid()`, nullable. Filas existentes quedan en `null`.
  - `drop policy "scores_insert_public"` y nueva política `scores_insert_authenticated` solo para `authenticated`. El check exige: el juego existe, `score` entre 0 y 1 000 000, `user_id = auth.uid()` y `player_name` igual al `username` del perfil del usuario.
  - `revoke insert on public.scores from anon` (anon conserva `select`).
- `components/score-form.tsx`:
  - Con sesión: sin input de nombre; muestra el username fijo y el botón de guardar. Una sola vez por partida (como hoy).
  - Sin sesión (con `score > 0`): mensaje "Inicia sesión para guardar tu puntaje" y enlace a `/auth?next=/jugar/<gameId>`.
  - Mientras `useCurrentUser()` es `undefined` (cargando): estado neutro, sin parpadeo del formulario ni del mensaje.
- `lib/scores-client.ts`: `saveScore` sigue enviando `player_name` (la política lo valida); `user_id` lo pone el default de la columna. Un error de RLS por sesión caducada se muestra como "Tu sesión expiró, vuelve a iniciar sesión".
- Regenerar `lib/supabase/database.types.ts`.
- Actualizar `CLAUDE.md` (Data layer: RLS de `scores`, `user_id`).
- Añadir la migración al procedimiento de prod en `docs/deploy-prod.md`.

### Fuera de alcance (otras specs)

- "Mis puntuaciones", perfil de usuario, editar o borrar puntajes.
- Backfill de `user_id` en filas antiguas (por nombre no es fiable).
- Anti-trampa o rate limit del puntaje (el score sigue siendo declarado por el cliente).
- Exigir login para jugar.
- Guardar el puntaje pendiente de un invitado y grabarlo tras el login (el de esa partida se pierde).
- Cambiar el username después del registro.

---

## 3. Modelo de datos

```sql
-- supabase/migrations/<ts>_scores_solo_autenticados.sql (ilustrativo)
alter table public.scores
  add column user_id uuid references auth.users (id) on delete set null default auth.uid();

drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_authenticated" on public.scores
  for insert to authenticated
  with check (
    exists (select 1 from public.games g where g.id = game_id)
    and score between 0 and 1000000
    and user_id = (select auth.uid())
    and player_name = (select p.username from public.profiles p where p.id = (select auth.uid()))
  );

revoke insert on public.scores from anon;
```

Tipo resultante en `database.types.ts`: `scores.Row.user_id: string | null`; en `Insert`, `user_id?: string | null`.

### Archivos

- Nuevo: `supabase/migrations/<ts>_scores_solo_autenticados.sql`
- Cambia: `components/score-form.tsx`, `lib/scores-client.ts`, `lib/supabase/database.types.ts`, `CLAUDE.md`, `docs/deploy-prod.md`
- Reutiliza: `useCurrentUser` (`lib/auth-client.ts`), `safeNext` (`lib/auth-redirect.ts`, ya valida `?next=`).

---

## 4. Plan de implementación

1. `npx supabase migration new scores_solo_autenticados`, escribir el SQL de §3 y aplicarlo (`npx supabase db push --remote`; fallback `apply_migration` y renombrar el archivo local a la versión registrada). Comprobar con `execute_sql` (solo lectura) políticas y grants de `scores`.
2. Regenerar `lib/supabase/database.types.ts`.
3. Reescribir `ScoreForm`: ramas cargando / invitado / sesión, y mensaje de sesión expirada en `saveScore`.
4. Prueba manual en los cinco juegos (`asteroids`, `blocks`, `paddle-duel`, `rompebloques`, `snake`): invitado ve mensaje y enlace; tras iniciar sesión vuelve a `/jugar/<id>` y guarda.
5. Actualizar `CLAUDE.md` y `docs/deploy-prod.md`. `npm run lint`, `npm run build` y `get_advisors` (security) limpios.
6. Humano: aplicar la migración en prod según `docs/deploy-prod.md`.

---

## 5. Criterios de aceptación

- [ ] Un insert anónimo a `scores` por la API REST responde 401/403.
- [ ] Un insert autenticado con `player_name` distinto del username es rechazado por RLS.
- [ ] Un insert autenticado con `user_id` de otro usuario es rechazado por RLS.
- [ ] Un insert autenticado válido guarda la fila con `user_id = auth.uid()` y `player_name = username`.
- [ ] El `select` público de `scores` sigue funcionando en `/inicio`, `/juego/[id]` y `/salon`.
- [ ] Las filas existentes siguen visibles con `user_id` en `null`.
- [ ] Un invitado con `score > 0` ve el mensaje y un enlace a `/auth?next=/jugar/<id>`, sin input de nombre.
- [ ] Tras iniciar sesión desde ese enlace, el usuario vuelve a `/jugar/<id>`.
- [ ] Un usuario con sesión no ve input de nombre, ve su username y guarda una sola vez por partida.
- [ ] Con la sesión caducada, guardar muestra "Tu sesión expiró, vuelve a iniciar sesión".
- [ ] `database.types.ts` incluye `user_id`.
- [ ] `get_advisors` (security) sin hallazgos nuevos; `npm run lint` y `npm run build` sin errores.

---

## 6. Decisiones

- **Sí:** nombre fijo = `profiles.username`, forzado en la política. Evita suplantar a otros jugadores; la UI sola no lo garantiza.
- **Sí:** restricción en RLS y grants, además de la UI. Quien llame a la API directo con la clave pública también queda bloqueado.
- **Sí:** `user_id` nullable con `on delete set null`. Conserva el ranking si se borra la cuenta y no obliga a inventar dueño para filas viejas.
- **Sí:** `default auth.uid()` más check `user_id = auth.uid()`. El cliente no puede falsear el dueño.
- **No:** bloquear el jugar a invitados. Se mantiene el concepto de portal con juego libre; solo se restringe guardar.
- **No:** guardar el puntaje pendiente tras el login. Añade estado entre páginas; spec aparte si se quiere.
- **No:** `player_name` editable. Descartado a favor del username fijo.

---

## 7. Riesgos

| Riesgo                                                                            | Mitigación                                                                                     |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Usuario sin fila en `profiles` (falló el trigger) no puede guardar.               | Mensaje de error claro; revisar `handle_new_user` si ocurre.                                   |
| El invitado pierde el puntaje de la partida al ir a iniciar sesión.               | Aceptado y registrado en Fuera de alcance.                                                     |
| Cualquier usuario logueado puede enviar un score falso (valor declarado).         | Anti-trampa fuera de alcance; el límite 0–1 000 000 sigue aplicando.                           |
| La migración no llega a prod: el formulario falla para todos allí.                | Paso 6 y `docs/deploy-prod.md`; `docs/prod-migration.sql` es un snapshot y no se sincroniza.   |
| Sesión en cookie y la política usa `auth.uid()`: cliente sin sesión válida falla. | `ScoreForm` solo habilita guardar con `useCurrentUser()` resuelto y maneja el error de sesión. |

---

## Lo que **no** entra en esta spec

Mis puntuaciones, backfill de `user_id`, anti-trampa o rate limit, login obligatorio para jugar, puntaje pendiente tras login, cambio de username.
