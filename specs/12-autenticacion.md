# SPEC 12 — Autenticación: registro, login, OAuth y sesión en la nav

**Estado:** APPROVED
**Fecha:** 2026-11-15
**Depende de:** SPEC 01 (pantalla `/auth` visual, `components/auth-form.tsx`), SPEC 04 (clientes `lib/supabase/*`, `proxy.ts`), SPEC 07 (`scores`, `components/score-form.tsx`).
**Fuente de referencia:** guía "Server-Side Auth for Next.js" de Supabase (`@supabase/ssr`), `node_modules/next/dist/docs/01-app/02-guides/authentication.md` y `authentication-with-cache-components.md`.

**Objetivo:** Hacer funcional `/auth` con registro e inicio de sesión por email+contraseña y por Google/GitHub sobre Supabase Auth, con nombre de usuario en `public.profiles` y la sesión visible en la nav.

---

## 1. Alcance

### Incluido

- Registro con usuario + email + contraseña. Confirmación de correo obligatoria: tras registrarse se muestra "revisa tu correo" y no hay sesión hasta confirmar.
- Inicio de sesión con email + contraseña.
- Inicio de sesión / registro con Google y GitHub (OAuth de Supabase).
- Cierre de sesión desde la nav (escritorio y panel móvil).
- Tabla `public.profiles` (1 fila por usuario de `auth.users`) creada por trigger, con `username` único.
- Usuario derivado automáticamente para cuentas OAuth (sin pantalla extra).
- Rutas `app/auth/confirm/route.ts` (enlace del correo de confirmación) y `app/auth/callback/route.ts` (retorno OAuth).
- Redirección tras login a `?next=` (solo rutas internas) o `/inicio`. `/auth` con sesión activa redirige a `/inicio`.
- Nav: con sesión muestra `@usuario` y botón `SALIR`; sin sesión, `Iniciar Sesión` enlazando a `/auth?next=<ruta actual>`.
- `ScoreForm` prellena el nombre con el usuario cuando hay sesión (editable). Invitados igual que hoy.
- "JUGAR COMO INVITADO" pasa a ser enlace a `/biblioteca`.
- Mensajes de error en español para los casos conocidos.
- Configuración manual del dashboard de Supabase documentada en esta spec.
- Actualizar `CLAUDE.md` (fila `/auth` y sección de datos).

### NO incluido (otras specs)

- Recuperación / cambio de contraseña.
- Cambiar el nombre de usuario o editar perfil; página "mi cuenta".
- `scores.user_id`, "mis puntuaciones" o cualquier cambio de esquema/RLS en `scores`.
- Proteger rutas o redirigir desde `proxy.ts` (sigue sin proteger nada).
- Login por nombre de usuario (solo email).
- Magic link, otros proveedores OAuth, 2FA.
- Borrar cuenta.
- SMTP propio (Resend) para los correos de auth: se documenta como mitigación, no se implementa.
- Cambiar `supabase/config.toml` para el stack local.
- Tests automatizados (el repo no tiene runner).

---

## 2. Modelo de datos

Migración nueva `supabase/migrations/<timestamp>_auth_profiles.sql` (`npx supabase migration new auth_profiles`):

```sql
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text not null unique check (username ~ '^[a-z0-9_]{3,12}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);
-- Sin INSERT/UPDATE/DELETE para clientes: solo el trigger escribe.
```

Función `public.handle_new_user()` (`security definer`, `set search_path = ''`, `execute` revocado a `anon`/`authenticated`) + trigger `on_auth_user_created after insert on auth.users`:

- Base = primer valor no vacío de `raw_user_meta_data->>'username'` (registro por email), `->>'user_name'` (GitHub), parte local de `email` (Google).
- Saneado: minúsculas, se eliminan caracteres fuera de `[a-z0-9_]`, recorte a 12. Si queda con < 3 caracteres, base = `jugador`.
- Unicidad: si choca, sufijo numérico (`kai1`, `kai2`…) recortando la base para no pasar de 12.
- Nunca lanza error por usuario repetido: el registro no falla por carrera.

Contratos TS:

```ts
// lib/auth-client.ts (cliente)
export type CurrentUser = { id: string; username: string } | null;
export function useCurrentUser(): CurrentUser | undefined; // undefined = cargando

// app/auth/actions.ts (servidor)
export type AuthState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "check-email"; email: string };
```

Reglas:

- Usuario: 3–12 caracteres, `[a-z0-9_]`, guardado en minúsculas. 12 = máximo de `scores.player_name`, así el prellenado siempre es válido.
- Contraseña: mínimo 8 caracteres (validado en servidor y en el dashboard).
- `next`: válido solo si empieza por `/` y no por `//`; si no, `/inicio`. Helper `safeNext()` en `lib/auth-redirect.ts`, usado por acciones, rutas y página.
- Regenerar `lib/supabase/database.types.ts` tras la migración.

---

## 3. Configuración manual (dashboard Supabase, la hace el humano)

1. **Authentication → URL Configuration:** Site URL `http://localhost:3000`; Redirect URLs `http://localhost:3000/**` (+ dominio de producción si existe).
2. **Authentication → Providers:** Email con "Confirm email" activado y contraseña mínima 8. Google y GitHub activados con Client ID/Secret de apps creadas en Google Cloud y GitHub (callback `https://wocydpxpwcejsqwnqzgy.supabase.co/auth/v1/callback`).
3. **Authentication → Email Templates → Confirm signup:** enlace `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}`.

---

## 4. Plan de implementación

1. **Migración `profiles` + trigger.** Crear la migración del §2, aplicar con `npx supabase db push --remote` (fallback `apply_migration` MCP), regenerar `database.types.ts`, revisar `get_advisors` (security) sin avisos nuevos. Prueba: crear usuario desde el dashboard → aparece fila en `profiles`.
2. **Redirecciones y rutas de retorno.** `lib/auth-redirect.ts` (`safeNext`). `app/auth/confirm/route.ts`: `verifyOtp({ type, token_hash })` y redirige a `safeNext(next)`; si falla, `/auth?error=confirm`. `app/auth/callback/route.ts`: `exchangeCodeForSession(code)` y misma redirección; si falla, `/auth?error=oauth`.
3. **Acciones de servidor email.** `app/auth/actions.ts` (`"use server"`, cliente de `lib/supabase/server.ts`): `signUp` (valida formato, comprueba usuario libre en `profiles`, `auth.signUp` con `options.data.username` y `emailRedirectTo` = origen + `/auth/confirm`), `signIn` (`signInWithPassword` → `redirect(safeNext)`). (`signOut` no es server action: ver paso 6). Origen desde `headers()`. Errores mapeados a español.
4. **`/auth` funcional.** `app/auth/page.tsx`: patrón página delgada (`<Suspense>` + loader async) que lee usuario con el cliente de servidor y redirige a `/inicio` si hay sesión; pasa `next` y `error` de `searchParams` al form. `components/auth-form.tsx`: `useActionState` con `signIn`/`signUp`, campo `Usuario` solo en "CREAR CUENTA", login con `Correo electrónico`, estado pendiente en el botón, `role="alert"` para errores, vista "REVISA TU CORREO" tras registro, invitado → `<Link href="/biblioteca">`.
5. **OAuth.** Acción `signInWithOAuth(provider, next)` con `redirectTo` = origen + `/auth/callback?next=…` y `redirect(data.url)`. Botones GOOGLE/GITHUB llaman a la acción.
6. **Sesión en la nav.** `lib/auth-client.ts`: `useCurrentUser()` con el cliente de navegador (`getUser` + `onAuthStateChange`, lee `username` de `profiles`; vuelve a comprobar en cada cambio de ruta porque el login por server action no dispara `onAuthStateChange`). `components/nav.tsx`: `@usuario` + `SALIR` (`auth.signOut()` del cliente de navegador → `router.push("/inicio")` + `router.refresh()`) o `Iniciar Sesión` → `/auth?next=<pathname>`, en escritorio y panel móvil. Mientras carga, no parpadea al estado incorrecto (slot reservado). Estilos con clases existentes de `app/globals.css`; tokens si hace falta un ajuste en modo claro.
7. **Prellenado en `ScoreForm`.** `components/score-form.tsx` usa `useCurrentUser()` y, si hay usuario y el campo está vacío, lo prellena. Sigue editable.
8. **Documentación.** `CLAUDE.md`: fila `/auth` (auth real), `profiles` en "Data layer", rutas `/auth/confirm` y `/auth/callback`.

---

## 5. Criterios de aceptación

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] Existe `public.profiles` con RLS: select público; insert/update/delete desde `anon`/`authenticated` fallan.
- [ ] `get_advisors` (security) no muestra avisos nuevos por `profiles` ni `handle_new_user`.
- [ ] Registrar `kai_01` + email + contraseña de 8 muestra "REVISA TU CORREO" y no inicia sesión.
- [ ] Iniciar sesión antes de confirmar muestra un error en español de correo sin confirmar.
- [ ] El enlace del correo lleva a `/auth/confirm`, inicia sesión y redirige a `/inicio` (o al `next` original).
- [ ] Tras confirmar, `profiles` tiene una fila con `username = 'kai_01'`.
- [ ] Registrar con un usuario ya existente muestra "Ese usuario ya está en uso" sin llamar a `signUp`.
- [ ] Usuario `ab`, `KAI!` o de 13 caracteres es rechazado con mensaje; contraseña de 7 también.
- [ ] Email+contraseña incorrectos muestran "Correo o contraseña incorrectos".
- [ ] Login con Google y con GitHub vuelve a la app con sesión iniciada y crea fila en `profiles` con usuario válido (`^[a-z0-9_]{3,12}$`).
- [ ] Dos cuentas OAuth con la misma base obtienen usuarios distintos (sufijo numérico).
- [ ] Con sesión, la nav muestra `@usuario` y `SALIR` en escritorio y panel móvil; sin sesión, `Iniciar Sesión`.
- [ ] `SALIR` cierra sesión y la nav vuelve a `Iniciar Sesión` sin recargar manualmente.
- [ ] Desde `/salon`, `Iniciar Sesión` → login → vuelve a `/salon`.
- [ ] `/auth?next=//evil.com` y `/auth?next=https://evil.com` redirigen a `/inicio` tras login.
- [ ] Visitar `/auth` con sesión redirige a `/inicio`.
- [ ] Con sesión, al terminar una partida con `score > 0`, el campo nombre aparece prellenado con el usuario y se puede editar y guardar.
- [ ] Sin sesión, `ScoreForm` funciona igual que antes (campo vacío, guardado como invitado).
- [ ] "JUGAR COMO INVITADO" lleva a `/biblioteca`.
- [ ] Recargar la página mantiene la sesión (cookies refrescadas por `proxy.ts`).
- [ ] La pantalla `/auth` y la nav se leen bien en modo claro y oscuro.

---

## 6. Decisiones

- **Sí:** Supabase Auth con `@supabase/ssr`. Ya instalado y con proxy de refresco (SPEC 04).
- **Sí:** email+contraseña y OAuth Google/GitHub en la misma spec. Decisión del usuario; los botones ya existen en el diseño.
- **No:** magic link. Cambia el diseño del form y no se pidió.
- **Sí:** `public.profiles` creada por trigger `security definer`. Clientes no pueden escribirla; el perfil existe siempre que exista el usuario.
- **No:** usuario en `user_metadata` solo. No garantiza unicidad ni es consultable para comprobar disponibilidad.
- **Sí:** login solo por email. Resolver usuario→email abriría enumeración de correos.
- **Sí:** confirmación de correo obligatoria con `/auth/confirm` + `verifyOtp(token_hash)`. Funciona aunque el correo se abra en otro dispositivo (el flujo PKCE por `code` no).
- **Sí:** usuario OAuth derivado automáticamente con sufijo. Evita una pantalla y un estado intermedio "sin usuario".
- **Sí:** trigger nunca falla por usuario repetido; la comprobación previa en `signUp` da el mensaje amable y el sufijo cubre la carrera.
- **Sí:** formato 3–12 `[a-z0-9_]` en minúsculas. Encaja con `player_name` (≤ 12) y evita duplicados por mayúsculas.
- **Sí:** server actions (`app/auth/actions.ts`) con `useActionState`. Mismo patrón que `sendContact` en `/acerca`.
- **Sí:** sesión en la nav desde el cliente (`useCurrentUser`). La nav ya es client component en el layout; leer cookies en el layout obligaría a un hueco dinámico con Cache Components en todas las páginas.
- **Sí:** `SALIR` cierra sesión en el navegador, no con server action. Un `signOut` en servidor borra las cookies pero no dispara `onAuthStateChange`, y la nav se quedaba con `@usuario` (cambio acordado durante la implementación).
- **Sí:** `await connection()` en `createClient()` de `lib/supabase/server.ts`, antes de `cookies()`. Con sesión, auth-js comprueba la caducidad con `Date.now()` y Cache Components lo rechaza al prerenderizar con cookies (`blocking-prerender-current-time` en todas las rutas con datos). Coste: el prefetch ya no adelanta esos datos; el esqueleto sigue siendo instantáneo (cambio acordado durante la implementación).
- **Sí:** `ScoreForm` solo prellena. Sin cambios en `scores`; `user_id` va en otra spec.
- **Sí:** `next` validado (empieza por `/`, no por `//`). Evita open redirect.
- **No:** reset de contraseña, editar perfil, proteger rutas. Otras specs.
- **No:** `NEXT_PUBLIC_SITE_URL`. El origen se toma de `headers()` en la acción.

---

## 7. Riesgos

| Riesgo                                                                                         | Mitigación                                                                                                      |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| SMTP integrado de Supabase limita a pocos correos/hora: confirmaciones que no llegan al probar | Probar con pocas cuentas; si molesta, configurar SMTP de Resend en el dashboard (fuera de esta spec).           |
| Plantilla de correo o Redirect URLs mal configuradas → enlace rompe                            | §3 documenta valores exactos; `/auth?error=confirm` muestra mensaje en vez de pantalla en blanco.               |
| Apps OAuth sin configurar → botones fallan                                                     | La acción devuelve error en español si Supabase no da `url`; email+contraseña sigue funcionando.                |
| Trigger con error bloquea todo registro                                                        | Probar en paso 1 creando usuario desde el dashboard antes de tocar UI; función sin `raise` en el camino normal. |
| Flash de "Iniciar Sesión" antes de cargar la sesión en la nav                                  | `useCurrentUser` devuelve `undefined` mientras carga y la nav reserva el slot sin texto.                        |
| Teclas del motor capturadas al editar el nombre prellenado                                     | `ScoreForm` ya hace `stopPropagation`; no se cambia.                                                            |

---

## Lo que **no** entra en esta spec

- Recuperación o cambio de contraseña.
- Editar usuario / perfil, borrar cuenta.
- `scores.user_id` y "mis puntuaciones".
- Protección de rutas.
- Login por usuario, magic link, otros proveedores, 2FA.
- SMTP propio para correos de auth.

Cada uno, si llega, va en su propia spec.
