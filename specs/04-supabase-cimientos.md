# SPEC 04 — Cimientos de Supabase en Next.js

**Estado:** Implemented
**Fecha:** 2026-11-09
**Depende de:** SPEC 01 (estructura `app/`, `lib/`), SPEC 03 (patrón de variables de entorno en `.env.template` / `.env.local`)
**Fuente de referencia:** guía "Setting up Server-Side Auth for Next.js" de Supabase (`@supabase/ssr`) y `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`

**Objetivo:** Dejar la app conectada al proyecto Supabase `wocydpxpwcejsqwnqzgy` con clientes de navegador y servidor, proxy de refresco de sesión y CLI inicializada, sin tablas ni cambios visibles de UI.

---

## 1. Alcance

### Incluido

- Dependencias `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.template` (placeholders) y `.env.local` (valores reales).
- Cliente de navegador: `lib/supabase/client.ts`.
- Cliente de servidor (cookies de Next): `lib/supabase/server.ts`.
- Proxy de sesión `proxy.ts` en la raíz: refresca el token con `supabase.auth.getClaims()` y reescribe las cookies. No redirige ni protege ninguna ruta.
- CLI de Supabase vía `npx supabase`: `supabase init` (carpeta `supabase/` con `config.toml` y `migrations/` vacía) y `supabase link --project-ref wocydpxpwcejsqwnqzgy`.
- Verificación de conexión con una ruta temporal de smoke test, que se elimina antes de commitear.
- Nota breve en el README sobre las variables nuevas y el flujo de la CLI.

### NO incluido (otras specs)

- Autenticación real (registro, login, logout, estado de usuario en la nav, `/auth` funcional).
- Tablas, políticas RLS y migraciones con contenido.
- Reemplazar `lib/games.ts` o `lib/scores.ts` por datos de Supabase.
- Tipos generados (`supabase gen types`, `database.types.ts`).
- Protección de rutas o redirecciones desde el proxy.
- Supabase local con Docker (`supabase start`).
- Clave `service_role` o cualquier uso privilegiado del servidor.
- Endpoint permanente de salud (`/api/health`).
- Tests automatizados (el repo no tiene runner).

---

## 2. Modelo de datos

No hay datos persistentes ni tablas nuevas. El esquema de la base queda vacío.

Variables de entorno (`.env.local`; `.env*` ya está en `.gitignore`):

| Variable                               | Obligatoria | Uso                                                                                                 |
| -------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Sí          | `https://wocydpxpwcejsqwnqzgy.supabase.co`. Pública por diseño.                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí          | Clave publicable (`sb_publishable_...`). Pública por diseño; la seguridad la dan las políticas RLS. |

`.env.template` mantiene el formato actual (`NOMBRE={PLACEHOLDER}`), añadiendo:

```
NEXT_PUBLIC_SUPABASE_URL={TU_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY={TU_PUBLISHABLE_KEY}
```

Firmas de los módulos nuevos:

```ts
// lib/supabase/client.ts — "use client"-safe, sin cookies de Next
export function createClient(): SupabaseClient;

// lib/supabase/server.ts — solo servidor
export async function createClient(): Promise<SupabaseClient>;

// proxy.ts (raíz)
export async function proxy(request: NextRequest): Promise<NextResponse>;
export const config: { matcher: string[] };
```

Matcher del proxy: todas las rutas excepto `_next/static`, `_next/image`, `favicon.ico` y archivos de imagen (`svg|png|jpg|jpeg|gif|webp`).

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

1. **Dependencias.** `npm install @supabase/supabase-js @supabase/ssr`.
2. **Variables de entorno.** Añadir las dos variables a `.env.template` con placeholders. Crear/actualizar `.env.local` con la URL del proyecto y la clave publicable (obtenerla del panel de Supabase o con la herramienta MCP `get_publishable_keys`). No commitear `.env.local`.
3. **Cliente de navegador.** Crear `lib/supabase/client.ts` con `createBrowserClient` de `@supabase/ssr` leyendo las dos variables.
4. **Cliente de servidor.** Crear `lib/supabase/server.ts` con `createServerClient`, `await cookies()` de `next/headers` y `getAll` / `setAll`. El `setAll` captura el error de escritura desde Server Components (el proxy refresca la sesión).
5. **Proxy.** Antes de escribir, leer `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. Crear `proxy.ts` en la raíz con `createServerClient` sobre `request`/`response`, llamar `await supabase.auth.getClaims()` sin usar el resultado para redirigir, y devolver la respuesta con las cookies actualizadas. Exportar el `matcher` de la sección 2. Verificar que `/`, `/inicio`, `/salon`, `/acerca` y `/auth` siguen cargando.
6. **Smoke test temporal.** Crear `app/api/supabase-smoke/route.ts` (sin commitear) que construye el cliente de servidor y hace `fetch` a `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` con la cabecera `apikey`. Debe responder HTTP 200 con `{ ok: true }`. Probar con `npm run dev`, luego eliminar el archivo y la carpeta `app/api/`.
7. **CLI.** `npx supabase init` (aceptar los valores por defecto, sin generar archivos de VS Code/IntelliJ) y `npx supabase link --project-ref wocydpxpwcejsqwnqzgy` (el usuario ejecuta el login con `! npx supabase login` si hace falta). Confirmar que `supabase/migrations/` existe y está vacía. Comprobar que `supabase/.gitignore` generado cubre `.temp` y `.env`.
8. **README.** Añadir una sección corta (en español) con las dos variables y los comandos `npx supabase link` / `npx supabase migration new`.
9. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [X] `npm run build` termina sin errores.
- [X] `npm run lint` termina sin errores nuevos.
- [X] `package.json` lista `@supabase/supabase-js` y `@supabase/ssr` en `dependencies`.
- [X] `.env.template` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con placeholders, sin valores reales.
- [X] `git status` no muestra `.env.local` como archivo a commitear.
- [X] Existen `lib/supabase/client.ts`, `lib/supabase/server.ts` y `proxy.ts`; ningún otro archivo de código nuevo fuera de `supabase/`.
- [X] La ruta temporal de smoke test respondió HTTP 200 con `{ ok: true }` en `npm run dev` y fue eliminada (`app/api/` no existe).
- [X] Con las variables ausentes, el cliente falla con un error claro al construirse (no un `undefined` silencioso).
- [X] `/`, `/inicio`, `/salon`, `/acerca` y `/auth` cargan igual que antes, sin errores en la consola del navegador.
- [X] El formulario de `/acerca` (SPEC 03) sigue enviando correos.
- [X] La respuesta de una ruta incluye las cookies `sb-*` solo cuando existe una sesión (sin sesión no se crean cookies).
- [X] `supabase/config.toml` y `supabase/migrations/` (vacía) existen y `npx supabase link` terminó sin error.
- [X] `grep -r "service_role" app lib proxy.ts .env.template` no devuelve resultados.
- [X] `grep -r "RESEND_API_KEY" .next/static` sigue sin resultados (el proxy no filtra variables de servidor al cliente).

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. `npm run dev` con `.env.local` real y `curl -i http://localhost:3000/api/supabase-smoke` mientras exista la ruta temporal (paso 6).
3. Recorrido manual de `/`, `/inicio`, `/salon`, `/acerca` y `/auth` en escritorio, con la consola del navegador abierta.
4. Enviar un mensaje de prueba desde `/acerca` para comprobar que el proxy no rompió la Server Action.
5. `ls supabase/migrations`, `git status` y los `grep` de la sección 4.

---

## 6. Decisiones tomadas y descartadas

- **Alcance: solo cimientos** (elegido). Auth, juegos y puntuaciones son dominios distintos; cada uno va en su spec. Descartado: cimientos + Auth o + tablas (spec demasiado grande, toca varias pantallas).
- **`@supabase/supabase-js` + `@supabase/ssr`** (elegido). Patrón oficial del App Router con sesión por cookies. Descartado: solo `supabase-js` (sin cookies en servidor; complica Auth futura).
- **Clave publicable (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)** (elegido). Es el nombre actual en la documentación de Supabase. Descartado: la clave legacy `anon` (nomenclatura en retirada).
- **Proxy de sesión ahora, sin redirecciones** (elegido). Así la spec de Auth solo añade UI y lógica de rutas. Coste: código sin efecto visible hasta entonces. Descartado: añadirlo con Auth (menos código muerto, pero mezcla infraestructura y UI).
- **`getClaims()` en el proxy** (elegido). Verifica el token localmente y es lo que recomienda Supabase para proteger páginas. Descartado: `getSession()` (no revalida el token en servidor).
- **Archivo `proxy.ts`, no `middleware.ts`** (elegido). En Next 16 `middleware` está deprecado y renombrado a `proxy`.
- **CLI con `npx`, sin dependencia local** (elegido). Evita una dependencia de desarrollo pesada. Descartado: `npm i -D supabase` (fija versión, aumenta `node_modules`).
- **`supabase init` + `link` ahora** (elegido). Deja el repo listo para migraciones versionadas en git. Descartado: migraciones solo por MCP `apply_migration` (el historial vive solo en el remoto) y posponer todo a la spec de datos.
- **Sin tipos generados** (elegido). Con el esquema vacío no aportan. Se generan en la spec de tablas.
- **Smoke test temporal, no commiteado** (elegido). Prueba la conexión real sin dejar superficie pública. Descartado: `/api/health` permanente (endpoint público sin necesidad) y verificar solo con `build` + `lint` (no prueba conexión).
- **Smoke test contra `/auth/v1/health`** (elegido). `getClaims()` y `getUser()` sin sesión no hacen red, así que no probarían la conexión.
- **Cliente nuevo por llamada en servidor** (elegido). Lo exige el modelo de cookies por petición; no se guarda un singleton global.

---

## 7. Riesgos identificados

- **`cacheComponents` activo.** Leer `cookies()` en `lib/supabase/server.ts` es acceso dinámico; en una página o componente con caché y sin `<Suspense>` puede fallar el build. Mitigación: esta spec no usa el cliente de servidor en ninguna página; la spec de Auth debe envolver su uso en `<Suspense>` o en rutas dinámicas y revisar `node_modules/next/dist/docs/` antes.
- **Proxy en todas las rutas.** Cada petición ejecuta `getClaims()`. Sin sesión no hay red, pero cualquier error del proxy afecta a todo el sitio. Mitigación: el `matcher` excluye estáticos; el paso 5 y el criterio de aceptación verifican las cinco rutas y la Server Action de `/acerca`.
- **Clave pública en el cliente.** `NEXT_PUBLIC_*` llega al bundle. Es esperado, pero con tablas sin RLS cualquiera podría leerlas. Mitigación: la spec de tablas debe activar RLS en cada tabla desde su migración; esta spec no crea ninguna.
- **Fuga de la clave `service_role`.** Mitigación: no se usa ni se documenta aquí; criterio de aceptación con `grep`.
- **`supabase link` requiere sesión del usuario.** El agente no puede iniciar sesión por sí solo. Mitigación: el paso 7 indica que el usuario ejecuta `! npx supabase login`.
- **El `project_ref` ya está en `.mcp.json` (público en el repo).** No es secreto, pero tampoco debe acompañarse de claves. Mitigación: las claves solo viven en `.env.local`.

---

## What is **not** in this spec

- Registro, login o cualquier flujo de autenticación.
- Tablas, RLS y migraciones con contenido.
- Sustituir los datos mock de `lib/games.ts` y `lib/scores.ts`.
- Tipos generados de la base de datos.
- Protección de rutas o redirecciones.
- Supabase local con Docker.
- Endpoint permanente de salud.

Cada uno, si entra, va en su propia spec.
