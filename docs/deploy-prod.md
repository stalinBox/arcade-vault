# Despliegue a producción (Supabase)

Runbook para el humano. Claude no tiene acceso a prod (`.mcp.json` apunta solo a dev). No compartir URL, keys ni passwords de prod con Claude.

## Alcance

Solo se migra la **estructura** de las tablas y los **datos de `games`** (5 juegos). Ambos viajan con `supabase/migrations/` (9 archivos): son solo DDL más `insert into public.games` (verificado: ninguna migración inserta en otra tabla).

- **No se migra ningún otro dato:** `scores`, `auth.users` y `profiles` quedan vacíos en prod. No hay dump ni copia de datos desde dev.
- **Estructura incluida:** tablas `games`, `scores`, `profiles`, con sus políticas RLS, grants, función `handle_new_user` y trigger `on_auth_user_created`. Sin esto la app no es segura ni crea perfiles.
- **Fuera de las migraciones:** la config de Auth (paso 4) se hace a mano en el dashboard; no es estructura ni datos.

## 0. Preparación

1. `PROD_REF` (Settings → General) y DB password de prod (Database → reset si no la guardaste).
2. Mismo Postgres que dev (`major_version = 17` en `supabase/config.toml`).
3. `.env.prod` local, git-ignored, solo con URL y publishable key. Nunca `service_role`.

## 1. Estructura

```bash
npx supabase login
npx supabase link --project-ref <PROD_REF>   # confirmar que es prod
npx supabase db push --dry-run               # debe listar las 9 migraciones
npx supabase db push
npx supabase migration list                  # local == remote
npx supabase link --project-ref wocydpxpwcejsqwnqzgy   # volver a dev
```

Mientras el CLI apunte a prod, `db push --remote` (CLAUDE.md) empuja a prod. Volver a dev al terminar.
Fallback sin CLI: pegar `docs/prod-migration.sql` completo en el SQL Editor de prod (una sola vez, proyecto vacío; corre en una transacción). Es el estado final de las **8 primeras** migraciones: después pegar también `supabase/migrations/20261116210026_scores_solo_autenticados.sql` (SPEC 15). No mezclar con `db push` después: el historial de migraciones de prod quedaría vacío y `db push` intentaría recrear las tablas. Para reconciliar, marcar cada versión con `npx supabase migration repair --status applied <versión>`.

## 2. Verificación (SQL Editor de prod)

```sql
select id, title, cat, color, cover from games order by id;
-- 5 filas: asteroids, blocks, paddle-duel, rompebloques, snake

-- el resto de tablas debe estar vacío
select (select count(*) from scores) scores, (select count(*) from profiles) profiles;  -- 0, 0

-- grants: solo select en games/profiles; scores: anon solo select, authenticated select+insert (SPEC 15)
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated')
order by 2,1,3;

-- RLS: todo true
select relname, relrowsecurity from pg_class
where relnamespace='public'::regnamespace and relkind='r';

-- política de insert de scores: solo scores_insert_authenticated, rol authenticated (SPEC 15)
select policyname, roles, cmd from pg_policies where tablename='scores';

-- scores.user_id: uuid, nullable, default auth.uid()
select is_nullable, column_default from information_schema.columns
where table_schema='public' and table_name='scores' and column_name='user_id';

-- trigger de profiles
select tgname from pg_trigger
where tgrelid='auth.users'::regclass and not tgisinternal;  -- on_auth_user_created

-- rls_auto_enable: false
select has_function_privilege('anon','public.rls_auto_enable()','execute');
-- si true: revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

Dashboard → Advisors (security y performance). Esperado: `auth_leaked_password_protection` si el plan es Free.

## 3. Hosting

Variables de entorno (no en git):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → prod
- `NEXT_PUBLIC_SITE_URL=https://<dominio>` (se inlinea al compilar; cambiarla exige rebuild; falta = error en producción)
- `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, opcional `CONTACT_FROM_EMAIL` (dominio verificado en Resend)

Las migraciones van **antes** del primer build: `generateStaticParams` lee `games`.

## 4. Auth (dashboard prod)

1. **URL Configuration:** Site URL = `https://<dominio>`. Redirect URLs sin wildcards: `https://<dominio>/auth/confirm` y `https://<dominio>/auth/callback`. Sin localhost.
2. **Providers → Email:** Confirm email ON, mínimo 8, Password Requirements = minúsculas, mayúsculas, dígitos y símbolos (SPEC 13). Leaked password protection solo en Pro.
3. **Email Templates → Confirm signup:**
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}`
4. **Rate Limits:** sign-ups y sign-ins por IP ≤ 30 / 5 min.
5. **SMTP propio** (Resend: `smtp.resend.com`, 465, user `resend`, pass = API key, remitente de dominio verificado). El SMTP por defecto casi no envía y solo a miembros del equipo.
6. **OAuth Google y GitHub:** apps nuevas para prod. Callback `https://<PROD_REF>.supabase.co/auth/v1/callback`. Google con consentimiento publicado. Secrets solo en el dashboard.
7. Replicar cualquier otro ajuste hecho en dev (JWT expiry, CAPTCHA, MFA).

## 5. Smoke test

1. `/inicio`, `/biblioteca`, `/salon` muestran los 5 juegos.
2. Registro con contraseña fuerte → llega correo → `/auth/confirm` → sesión → fila en `profiles`.
3. Invitado con score > 0 ve "Inicia sesión para guardar tu puntaje"; con sesión guarda con su username → aparece en `/juego/<id>` con `user_id` (SPEC 15).
4. Login con Google y GitHub.
5. Formulario de `/acerca` envía correo.
6. Deben fallar: insert anónimo en `scores` (401), insert con sesión y `player_name` ≠ username, score > 1 000 000, update/delete sobre `scores` (REST con publishable key).
7. `curl -sI https://<dominio>` muestra los headers de seguridad.

## 6. Después

- CLI de vuelta en dev.
- Guardar DB password y keys de prod en un gestor de secretos.
- Free no tiene PITR: `supabase db dump` antes de cada push cuando ya haya datos reales.
- Cada migración nueva: probar en dev, luego `db push` a prod por el humano.

## Rollback

- Prod vacío: `drop schema public cascade` y reaplicar migraciones, o recrear el proyecto.
- Con datos reales: migraciones forward-only. Dump antes de cada push.
