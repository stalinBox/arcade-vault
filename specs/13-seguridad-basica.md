# SPEC 13 — Seguridad básica: RLS endurecido, función expuesta, Auth y cabeceras HTTP

**Estado:** IMPLEMENTED
**Fecha:** 2026-11-15
**Depende de:** SPEC 04 (Supabase, `next.config.ts`), SPEC 07 (`scores`, RLS), SPEC 12 (Auth, dashboard).
**Fuente de referencia:** `references/security/security-checklist.md`, advisors de seguridad de Supabase, guía `headers` en `node_modules/next/dist/docs/`.

**Objetivo:** Cerrar los avisos de seguridad del checklist: política INSERT de `scores` con condición real, `rls_auto_enable()` no ejecutable por clientes, Auth endurecido (contraseña con minúsculas, mayúsculas, dígitos y símbolos) y cabeceras de seguridad en todas las rutas.

---

## 1. Alcance

Estado verificado el 2026-11-15 (MCP Supabase):

- RLS ya activo en `games`, `scores` y `profiles`.
- `scores_insert_public` usa `with check (true)` para `anon` y `authenticated`.
- `public.rls_auto_enable()` es la función del event trigger `ensure_rls` (creada desde el dashboard, no está en migraciones), `security definer` y ejecutable por `PUBLIC`, `anon` y `authenticated`.
- El advisor reporta `auth_leaked_password_protection`. El proyecto está en plan Free (la función solo existe en Pro).
- La contraseña mínima de 8 ya se valida en servidor (`MIN_PASSWORD = 8` en `app/auth/actions.ts`). No hay requisito de composición (minúsculas, mayúsculas, dígitos, símbolos) ni en servidor ni en dashboard.
- `next.config.ts` no define `headers()`. Ningún juego usa iframe, fullscreen ni gamepad.

### Incluido

- Verificar RLS activo en `games`, `scores` y `profiles` (ya lo está; queda como criterio).
- Reemplazar `with check (true)` de `scores_insert_public` por una condición explícita. Los invitados siguen guardando puntuaciones.
- `revoke execute` de `public.rls_auto_enable()` a `public, anon, authenticated`.
- Política de contraseña al registrarse: mínimo 8 y al menos una minúscula, una mayúscula, un dígito y un símbolo. Se exige en dos sitios: dashboard (Password Requirements = "Lowercase, uppercase letters, digits and symbols") y `signUp` en `app/auth/actions.ts` (mismo criterio, mensaje en español antes de llamar a Supabase).
- Texto de ayuda bajo el campo contraseña en la pestaña de registro de `components/auth-form.tsx` con los requisitos.
- Dashboard (manual): contraseña mínima 8 (confirmar), requisitos de composición, rate limit de sign-ups/sign-ins por IP, leaked password protection si el plan lo permite.
- Cabeceras en `next.config.ts` para `/(.*)`: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`.
- Actualizar `CLAUDE.md` (línea de RLS en la capa de datos + cabeceras en "Non-obvious setup").
- Protección de rutas con Proxy Next.js: información sobre proxy aquí: https://nextjs.org/docs/app/getting-started/proxy

Ejemplo: proxy.ts
```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url));
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

export const config = {
  matcher: '/about/:path*',
};
```
### NO incluido (otras specs)

- Content-Security-Policy (requiere nonces vía `proxy.ts` por el script inline de tema y los de Next).
- CAPTCHA (Turnstile/hCaptcha) en el registro.
- Rate limit de inserts en `scores` / anti-trampas de puntuación (validar el score en servidor, firmas).
- `scores.user_id` o insert solo para autenticados.
- Pasar a plan Pro de Supabase.
- SMTP propio para los correos de Auth.

---

## 2. Modelo de datos

Sin tablas nuevas. Migración `supabase/migrations/<timestamp>_seguridad_basica.sql` (`npx supabase migration new seguridad_basica`):

```sql
drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_public" on public.scores
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.games g where g.id = game_id)
    and player_name = btrim(player_name)
    and char_length(player_name) between 1 and 12
    and score between 0 and 1000000
  );

-- Función del event trigger ensure_rls (creada desde dashboard). El trigger sigue
-- funcionando: los event triggers no comprueban EXECUTE del rol que lanza el DDL.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

`lib/supabase/database.types.ts` no cambia (solo política y permisos).

Cabeceras (`next.config.ts`):

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

// En la config:
// async headers() { return [{ source: "/(.*)", headers: securityHeaders }]; }
```

Política de contraseña (`app/auth/actions.ts`, solo en `signUp`; `signIn` no valida composición):

```ts
const MIN_PASSWORD = 8;
// Mismo conjunto de símbolos que acepta Supabase Auth.
const PASSWORD_RULES = [
  /[a-z]/,
  /[A-Z]/,
  /[0-9]/,
  /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/,
];
const PASSWORD_MESSAGE =
  "La contraseña debe tener al menos 8 caracteres, con minúsculas, mayúsculas, números y símbolos.";

function isStrongPassword(p: string): boolean {
  return p.length >= MIN_PASSWORD && PASSWORD_RULES.every((re) => re.test(p));
}
```

- `ERROR_MESSAGES.weak_password` pasa a `PASSWORD_MESSAGE` (si Supabase rechaza por su cuenta, el usuario ve el mismo texto).
- Ayuda en el formulario (solo pestaña de registro): `Mín. 8 caracteres: minúsculas, mayúsculas, números y símbolos.` con las clases existentes de `app/globals.css`, enlazada al input con `aria-describedby`.

### Archivos

- Nuevo: `supabase/migrations/<timestamp>_seguridad_basica.sql`
- Cambia: `next.config.ts`, `app/auth/actions.ts`, `components/auth-form.tsx`, `CLAUDE.md`

---

## 3. Configuración manual (dashboard Supabase, la hace el humano)

1. **Authentication → Providers → Email:** contraseña mínima = 8 (confirmar que sigue así) y **Password Requirements** = "Lowercase, uppercase letters, digits and symbols".
2. **Authentication → Rate Limits:** sign-ups y sign-ins por IP = 30 por 5 min (o menor).
3. **Authentication → Providers → Email → Leaked password protection:** activar solo si el plan es Pro. En Free no existe → riesgo aceptado (§7); el advisor seguirá mostrándolo.

---

## 4. Plan de implementación

1. Leer la guía `headers` de `node_modules/next/dist/docs/`; añadir `headers()` a `next.config.ts`. `npm run build` ok y `curl -I` muestra las cabeceras.
2. Crear la migración con el SQL de §2; aplicarla con `npx supabase db push --remote` (fallback: `apply_migration` por MCP, manteniendo el fichero en git).
3. Verificar en BD: políticas, ACL de `rls_auto_enable`, RLS en las 3 tablas; advisors de seguridad.
4. Probar el guardado de puntuación como invitado y con sesión en `/jugar/snake`.
5. **Protección de rutas con Proxy Next.js**
6. Política de contraseña en `signUp` (`isStrongPassword`, `PASSWORD_MESSAGE`, `weak_password`) y texto de ayuda en `auth-form.tsx`. Probar registro con contraseña débil y fuerte.
7. Humano: pasos de §3.
8. Actualizar `CLAUDE.md`. `npm run lint` y `npm run build` limpios.

---

## 5. Criterios de aceptación

- [ ] `pg_class.relrowsecurity = true` para `games`, `scores` y `profiles`.
- [ ] `pg_policies`: `scores_insert_public` tiene `with_check` distinto de `true` e incluye el `exists` sobre `games`.
- [ ] El advisor de seguridad no reporta `rls_policy_always_true`, `anon_security_definer_function_executable` ni `authenticated_security_definer_function_executable`.
- [ ] `proacl` de `rls_auto_enable` sin `=X`, `anon=X` ni `authenticated=X`.
- [ ] Crear una tabla de prueba en `public` dentro de una transacción con rollback la deja con RLS activo (el event trigger sigue funcionando).
- [ ] Como `anon` (transacción con rollback): un insert válido funciona; `game_id` inexistente, `player_name` con espacios exteriores o `score` > 1 000 000 fallan.
- [ ] Guardar puntuación desde `ScoreForm` como invitado y con sesión sigue funcionando.
- [ ] `curl -I http://localhost:3000/inicio` (y `/jugar/snake`) devuelve las 5 cabeceras con los valores de §2.
- [ ] Registro con `abcdefgh`, `Abcdefgh`, `Abcdefg1` o `abcdef1!` muestra `PASSWORD_MESSAGE` sin llamar a Supabase; `Abcdef1!` llega a "revisa tu correo".
- [ ] Inicio de sesión de una cuenta existente con contraseña antigua (sin símbolos) sigue funcionando.
- [ ] La pestaña de registro muestra el texto de ayuda bajo la contraseña; la de inicio de sesión no.
- [ ] Dashboard: contraseña mínima 8, Password Requirements = minúsculas/mayúsculas/dígitos/símbolos y rate limit configurados (confirmado por el humano).
- [ ] `npm run lint` y `npm run build` sin errores.
- [ ] `CLAUDE.md` actualizado.

---

## 6. Decisiones

- **Check explícito en el INSERT de `scores`** en vez de solo autenticados: mantiene el juego como invitado. La condición duplica los CHECK de la tabla, pero deja la política autoexplicativa y quita el aviso del linter. Descartado: dejar `true` como riesgo aceptado.
- **Revocar EXECUTE de `rls_auto_enable`** en vez de pasarla a `security invoker` o borrarla: el event trigger necesita los privilegios del owner; revocar basta y no altera su definición (que no está en migraciones).
- **Leaked password protection documentada, no exigida:** el plan Free no la ofrece.
- **Composición de contraseña en dashboard y en servidor:** el dashboard es la barrera real (también cubre llamadas directas a la API de Auth); la validación en `signUp` da el mensaje en español antes de la petición, igual que ya se hace con el mínimo de 8. Mismo conjunto de símbolos que Supabase para que ambos coincidan.
- **Solo en registro:** `signIn` no valida composición; Supabase solo aplica los requisitos al crear o cambiar la contraseña, así las cuentas antiguas siguen entrando. Descartado: forzar cambio de contraseña a cuentas existentes (no hay flujo de cambio de contraseña, SPEC 12 lo dejó fuera).
- **Rate limit desde el dashboard, sin CAPTCHA:** cero código. CAPTCHA añade widget, clave y dependencia externa → otra spec.
- **Sin CSP:** el script inline de tema y los inline de Next exigen nonces en `proxy.ts`, con riesgo de romper Cache Components → spec propia.
- **HSTS sin `preload`:** reversible; los navegadores lo ignoran en `http://localhost`.

---

## 7. Riesgos

- **Leaked password protection sin activar (Free):** se aceptan contraseñas filtradas. Mitigación: mínimo 8 + composición obligatoria + rate limit; activarla si se pasa a Pro.
- **Cuentas creadas antes de esta spec** pueden tener contraseñas sin la composición exigida; no se fuerza su cambio.
- **Desfase servidor/dashboard:** si se cambia el requisito en el dashboard y no en `actions.ts` (o al revés), un mensaje no coincidirá con el rechazo real. `weak_password` mapeado a `PASSWORD_MESSAGE` evita errores genéricos.
- **HSTS en un dominio sin HTTPS completo:** bloquearía el acceso por http durante 2 años. Aplicar solo en un dominio con HTTPS en todos los subdominios; si no, quitar `includeSubDomains`.
- **`rls_auto_enable` recreada desde el dashboard** podría volver a conceder EXECUTE; el advisor lo volvería a detectar.
- **Spam de puntuaciones** sigue siendo posible (insert público): fuera de alcance, otra spec.

---

## Lo que **no** entra en esta spec

CSP, CAPTCHA, anti-trampas/rate limit de `scores`, `scores.user_id`, upgrade a Pro, SMTP propio.
