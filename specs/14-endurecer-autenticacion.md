# SPEC 14 — Endurecer autenticación: origen fijo para redirects y allowlist de `type` en `/auth/confirm`

**Estado:** APPROVED
**Fecha:** 2026-11-16
**Depende de:** SPEC 12 (Auth, rutas `/auth/*`, dashboard), SPEC 13 (seguridad básica, `.env.template`).
**Fuente de referencia:** revisión de seguridad de autenticación del 2026-11-16 (`app/auth/actions.ts`, `app/auth/confirm/route.ts`, `app/auth/callback/route.ts`, `lib/auth-redirect.ts`, `proxy.ts`, `lib/supabase/*`).

**Objetivo:** Cerrar los dos hallazgos accionables de la revisión de Auth: el origen de los redirects deja de salir de headers controlados por el cliente y `/auth/confirm` solo acepta los tipos de OTP del registro.

---

## 1. Por qué existe esta spec

La revisión encontró 5 hallazgos. Dos se corrigen en código (1 y 2), uno se acepta (3), uno se difiere (4) y uno ya estaba diferido (5). Esta spec los deja todos registrados con su decisión, para que no se reabran sin motivo.

| #   | Severidad | Hallazgo                                                                                                                                                                               | Decisión                           |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | Media     | `getOrigin()` (`app/auth/actions.ts`) arma `emailRedirectTo` y el `redirectTo` de OAuth con `Origin`, `Host` y `x-forwarded-proto`. Un `Host` falso envenena el enlace del correo.     | **Se corrige**                     |
| 2   | Baja      | `/auth/confirm` castea `type` a `EmailOtpType` sin validar. `verifyOtp` acepta `recovery`, `magiclink`, `email_change`, etc. y abre sesión por una ruta pensada solo para el registro. | **Se corrige**                     |
| 3   | Baja      | Enumeración de cuentas: `signUp` responde "Ese usuario ya está en uso" (consulta a `profiles`) y "Ese correo ya está registrado".                                                      | **Se acepta**                      |
| 4   | Info      | La confirmación es un GET: un escáner o previsualizador de correo puede consumir el token.                                                                                             | **Fuera de alcance**               |
| 5   | Info      | No hay CSP (el script inline del tema necesita nonces).                                                                                                                                | **Fuera (ya diferido en SPEC 13)** |

---

## 2. Alcance

### Incluido

- `getOrigin()` en `app/auth/actions.ts` lee `process.env.NEXT_PUBLIC_SITE_URL` y deja de leer `Origin`, `Host` y `x-forwarded-proto`.
  - En producción (`NODE_ENV === "production"`) la variable es obligatoria: si falta, lanza un error claro (mismo estilo que los clientes de Supabase).
  - En desarrollo, si falta, usa `http://localhost:3000`.
  - Se normaliza quitando la `/` final.
- `NEXT_PUBLIC_SITE_URL` documentada en `.env.template` y en `CLAUDE.md` (lista de env vars).
- `app/auth/confirm/route.ts` acepta solo `type` ∈ `signup | email`. Cualquier otro valor (o ausente) redirige a `/auth?error=confirm` sin llamar a `verifyOtp`.
- Paso manual (humano, dashboard Supabase): comprobar que **Authentication → URL Configuration → Redirect URLs** no contiene wildcards (`*`) y que `Site URL` es la URL de producción. Se añaden `<SITE_URL>/auth/confirm` y `<SITE_URL>/auth/callback` si faltan.
- Actualizar `CLAUDE.md` (env vars y la línea de Auth con la regla del origen y del `type`).

### Fuera de alcance (otras specs)

- Mensajes genéricos o respuesta idéntica en `signUp` para evitar la enumeración (hallazgo 3: se acepta el riesgo).
- Página intermedia con botón "Confirmar" y `verifyOtp` por POST (hallazgo 4).
- Content-Security-Policy con nonces en `proxy.ts` (hallazgo 5, ya diferido en SPEC 13).
- Flujo de recuperar contraseña, cambio de correo o magic link (hoy no existen; si se añaden, su ruta propia valida su `type`).
- Rate limit propio o CAPTCHA en el registro (SPEC 13 los dejó fuera).

---

## 3. Modelo de datos

Esta feature no introduce estructuras de datos ni migraciones. Solo cambia una variable de entorno nueva y dos archivos de código.

```ts
// app/auth/actions.ts — forma esperada (ilustrativa)
async function getOrigin(): Promise<string> {
  // process.env.NEXT_PUBLIC_SITE_URL → sin "/" final
  // producción sin variable → throw Error("Falta NEXT_PUBLIC_SITE_URL. Revisa .env.local.")
  // desarrollo sin variable → "http://localhost:3000"
}

// app/auth/confirm/route.ts — forma esperada (ilustrativa)
const CONFIRM_TYPES = ["signup", "email"] as const; // subconjunto de EmailOtpType
```

Variable nueva (`.env.template`, `.env.local`, entorno de producción):

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Archivos

- Cambia: `app/auth/actions.ts`, `app/auth/confirm/route.ts`, `.env.template`, `CLAUDE.md`
- Sin archivos nuevos.

---

## 4. Plan de implementación

1. Añadir `NEXT_PUBLIC_SITE_URL` a `.env.template` y a `.env.local`. `npm run dev` sigue arrancando.
2. Reescribir `getOrigin()` en `app/auth/actions.ts` (sin `headers()`; quitar el import si queda sin uso). Prueba manual: registro por correo y OAuth en local; el enlace del correo apunta a `http://localhost:3000/auth/confirm`.
3. Allowlist de `type` en `app/auth/confirm/route.ts`. Prueba manual: `/auth/confirm?token_hash=x&type=recovery` redirige a `/auth?error=confirm`; el enlace real de registro sigue confirmando.
4. Humano: paso del dashboard (§2, Redirect URLs sin wildcards) y definir `NEXT_PUBLIC_SITE_URL` en el entorno de producción antes de desplegar.
5. Actualizar `CLAUDE.md`. `npm run lint` y `npm run build` limpios.

---

## 5. Criterios de aceptación

- [ ] `app/auth/actions.ts` no contiene `headers(`, `origin` ni `x-forwarded-proto` para construir redirects.
- [ ] Con `NEXT_PUBLIC_SITE_URL=https://ejemplo.test`, `emailRedirectTo` y el `redirectTo` de OAuth empiezan por `https://ejemplo.test/auth/`.
- [ ] Una petición con `Host: evil.test` o `Origin: https://evil.test` produce igualmente enlaces a `NEXT_PUBLIC_SITE_URL`.
- [ ] En `NODE_ENV=production` sin la variable, `signUp` y `signInWithOAuth` fallan con el error de configuración (no con un origen inventado).
- [ ] En desarrollo sin la variable, el registro usa `http://localhost:3000`.
- [ ] `GET /auth/confirm?token_hash=x&type=recovery` (y `magiclink`, `email_change`, `invite`) responde 307 a `/auth?error=confirm` sin llamar a `verifyOtp`.
- [ ] `GET /auth/confirm` sin `type` o sin `token_hash` responde 307 a `/auth?error=confirm`.
- [ ] El enlace de confirmación real de un registro nuevo sigue iniciando sesión y redirige a `/inicio`.
- [ ] El login con Google/GitHub sigue funcionando de punta a punta en local.
- [ ] Dashboard: Redirect URLs sin wildcards y `Site URL` = producción (confirmado por el humano).
- [ ] `.env.template` y `CLAUDE.md` mencionan `NEXT_PUBLIC_SITE_URL`.
- [ ] `npm run lint` y `npm run build` sin errores.

---

## 6. Decisiones

- **Sí:** `NEXT_PUBLIC_SITE_URL` como única fuente del origen. Los headers de la petición los controla el cliente; una variable de entorno no.
- **Sí:** obligatoria en producción, con fallback a `localhost` solo en desarrollo. Un fallback silencioso a los headers mantendría el agujero.
- **No:** `SITE_URL` sin prefijo `NEXT_PUBLIC_`. Solo se usa en servidor, pero se mantiene el nombre del hallazgo y el patrón de las otras variables de Supabase; no es un secreto.
- **Sí:** allowlist `signup | email` en `/auth/confirm`. Es el tipo que genera la plantilla "Confirm signup". Cada flujo futuro (recuperar contraseña, cambio de correo) tendrá su ruta con su propio `type`.
- **No:** validar `type` con una lista de todos los `EmailOtpType` excepto algunos. Una allowlist corta falla cerrado.
- **Se acepta (hallazgo 3):** mantener "Ese usuario ya está en uso". El `username` es público por diseño (`profiles` con select público) y el usuario necesita saber si el nombre está libre. El correo ya registrado depende de la config de Supabase y el riesgo es bajo en un portal de juegos. Se revisa si algún día hay datos sensibles.
- **Se difiere (hallazgo 4):** la confirmación por GET. Es un problema de disponibilidad (el token se consume), el usuario puede registrarse de nuevo o pedir reenvío. Una página intermedia añade UI y cambia el flujo de SPEC 12.
- **Se difiere (hallazgo 5):** CSP. Sigue en spec propia por el riesgo con Cache Components y los scripts inline.
- **Sí:** la verificación de Redirect URLs queda como criterio manual: la defensa real contra redirects abiertos en Supabase es esa lista, y el código no puede comprobarla.

---

## 7. Riesgos

| Riesgo                                                                                      | Mitigación                                                                                                                   |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Olvidar definir `NEXT_PUBLIC_SITE_URL` al desplegar: el registro y OAuth fallan.            | Error explícito en producción y paso 4 del plan. Mejor un fallo visible que un enlace envenenado.                            |
| `NEXT_PUBLIC_` se incrusta en el build: cambiar la URL exige reconstruir.                   | Documentarlo en `CLAUDE.md`. Para un solo dominio no es un problema.                                                         |
| Despliegues de preview (otro dominio) generarán enlaces a la URL de producción.             | Aceptado: la sesión de preview no se cierra en producción. Si se necesita, definir la variable por entorno en la plataforma. |
| Una allowlist demasiado estricta rompe un flujo legítimo si SPEC 12 usaba otro `type`.      | La plantilla "Confirm signup" envía `type=email` o `signup`; se prueba el enlace real en el paso 3.                          |
| Redirect URLs con wildcards en el dashboard siguen permitiendo redirects a dominios ajenos. | Criterio de aceptación manual y paso 4.                                                                                      |

---

## Lo que **no** entra en esta spec

Evitar la enumeración de usuario/correo, página intermedia de confirmación por POST, CSP, flujos de recuperar contraseña o magic link, CAPTCHA y rate limit propio.
