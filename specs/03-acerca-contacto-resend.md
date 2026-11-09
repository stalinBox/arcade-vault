# SPEC 03 — Pantalla Acerca de con formulario de contacto (Resend)

**Estado:** Approved
**Fecha:** 2026-11-09
**Depende de:** SPEC 01 (nav, layout, `globals.css`), SPEC 02 (patrón de página + `useReveal`)
**Fuente de diseño:** `references/templates/home-about/about.jsx` (y bloque `/* ===== ABOUT PAGE ===== */` de `references/templates/home-about/styles.css`)

**Objetivo:** Añadir "Acerca de" como último enlace de la navegación, con la página `/acerca` portada de `about.jsx`, cuyo formulario de contacto envía el mensaje por correo electrónico mediante Resend.

---

## 1. Alcance

### Incluido

- Enlace "Acerca de" como último elemento de la nav de escritorio (después de "Salón de la Fama") y del menú móvil (después de "Salón de la Fama", antes de "Iniciar Sesión").
- Ruta `/acerca` con la página completa de `about.jsx`: hero con misión, 3 tarjetas de highlight, divisor pixel, sección "CONTÁCTANOS" con tips y formulario.
- Formulario que valida en cliente (efecto `shake`) y en servidor (autoritativo), y envía el mensaje con Resend.
- Estados del formulario: reposo, enviando, enviado (terminal de éxito) y error (mensaje inline).
- Estilos del bloque `/* ===== ABOUT PAGE ===== */` del template añadidos a `app/globals.css`.
- Extraer `useReveal` de `components/landing.tsx` a `lib/use-reveal.ts` para reutilizarlo en About.
- Dependencia `resend` (SDK oficial).
- Copy en español, igual al template.

### NO incluido (otras specs)

- Guardar mensajes en base de datos o cualquier almacenamiento persistente.
- Protección anti-spam (captcha, honeypot, límite de envíos por IP).
- Configurar un dominio propio en Resend (se hace fuera del código; ver sección 2).
- Respuesta automática de confirmación al visitante.
- Autenticación o identificar al usuario logueado en el formulario.
- Cambios a la landing `/inicio` más allá de importar `useReveal`.
- Tests automatizados (el repo no tiene runner).

---

## 2. Modelo de datos

No hay datos persistentes nuevos.

Tipos de entrada y salida de la server action (`app/acerca/actions.ts`):

```ts
type ContactResult = { ok: true; name: string } | { ok: false; error: string };
```

Límites (caracteres, tras `trim()`): `name` 80, `email` 254, `msg` 2000.

Variables de entorno (en `.env.local`; `.env*` ya está en `.gitignore`):

| Variable | Obligatoria | Valor por defecto | Uso |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | Sí | — | Clave de API de Resend. Solo servidor, sin prefijo `NEXT_PUBLIC_`. |
| `CONTACT_TO_EMAIL` | Sí | — | Buzón que recibe los mensajes. |
| `CONTACT_FROM_EMAIL` | No | `Arcade Vault <onboarding@resend.dev>` | Remitente. Cambiar cuando haya dominio verificado. |

Correo enviado con `resend.emails.send`:

- `from`: `CONTACT_FROM_EMAIL` o el valor por defecto.
- `to`: `CONTACT_TO_EMAIL`.
- `reply_to`: correo del visitante.
- `subject`: `[Arcade Vault] Mensaje de {nombre}` (saltos de línea del nombre reemplazados por espacios).
- `text`: `Nombre: {nombre}\nCorreo: {correo}\n\n{mensaje}`.

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

1. **Hook compartido.** Crear `lib/use-reveal.ts` (`"use client"`) con el `useEffect` + `IntersectionObserver` de `components/landing.tsx`. Sustituir la función local en `landing.tsx` por el import. Verificar que `/inicio` se ve igual.
2. **Dependencia.** `npm install resend`.
3. **Server action.** Crear `app/acerca/actions.ts` (`"use server"`) con `sendContact(formData: FormData): Promise<ContactResult>`:
   - Lee `name`, `email`, `msg` del `FormData`, aplica `trim()`.
   - Rechaza campos vacíos, longitudes sobre el límite y correo que no cumpla `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Devuelve `{ ok: false, error }` sin llamar a Resend.
   - Si falta `RESEND_API_KEY` o `CONTACT_TO_EMAIL`, registra en log del servidor y devuelve error "El servicio de correo no está configurado.".
   - Crea el cliente `Resend` dentro de la función y envía el correo (sección 2).
   - Si Resend devuelve `error`, registra `[contacto] Resend: {name} {message}` y devuelve "No pudimos enviar tu mensaje. Inténtalo de nuevo.".
   - Éxito: `{ ok: true, name }`.
   - Prueba manual: sin variables → error de configuración. Con variables válidas → correo recibido.
4. **Componente.** Crear `components/about.tsx` (`"use client"`), portando `about.jsx` a TSX:
   - `useReveal()` de `lib/use-reveal.ts`.
   - Estado con `useState` para `sent` (nombre tras éxito), `error`, `shake` y `formKey` (para reiniciar campos no controlados).
   - `useTransition` para llamar a `sendContact(new FormData(form))`. Mientras corre, el botón se deshabilita y muestra "▶  ENVIANDO…".
   - Validación cliente: si `name`, `email` o `msg` están vacíos, `preventDefault`, activa `shake` 400 ms y no llama al servidor.
   - Inputs no controlados, con `maxLength` igual a los límites de la sección 2.
   - Error del servidor: se muestra en `<p className="contact-error">` dentro del formulario; no se borran los campos.
   - Éxito: se muestra la terminal (`terminal-success`) con el nombre en mayúsculas. "ENVIAR OTRO MENSAJE" pone `sent` a `null`, `error` a `null` e incrementa `formKey`.
   - Iconos `HighlightIcon` (HEART, BROWSER, PLANT) tipados con `type HlKind = "HEART" | "BROWSER" | "PLANT"`.
5. **Ruta.** Crear `app/acerca/page.tsx` (server) que renderiza `<About />`.
6. **Nav.** En `components/nav.tsx`:
   - Añadir `"acerca"` al tipo `Section`; `sectionOf("/acerca")` → `"acerca"`.
   - Insertar `<Link href="/acerca">Acerca de</Link>` después de Salón en `.links`.
   - Insertar el mismo enlace después de Salón en `.av-mobile-panel`, antes de Iniciar Sesión.
7. **Estilos.** Copiar `/* ===== ABOUT PAGE ===== */` (líneas 1071–1146 de `references/templates/home-about/styles.css`) al final de `app/globals.css`. Excluir `/* misc */` y `.divider`. Añadir `.contact-error` (color magenta, fuente pixel, 9px). Verificar que `@keyframes shake` y `@keyframes pxblink` queden definidos una sola vez.
8. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores nuevos.
- [ ] Nav de escritorio: los enlaces están en orden "Inicio", "Biblioteca", "Salón de la Fama", "Acerca de".
- [ ] Menú móvil (390px): "Acerca de" está después de "Salón de la Fama" y antes de "Iniciar Sesión", y abre `/acerca`.
- [ ] Click en "Acerca de" navega a `/acerca`. En esa ruta solo "Acerca de" tiene clase `active`.
- [ ] `/acerca` muestra, en orden: kicker "▸ ACERCA DE", título "ACERCA DE ARCADE VAULT", párrafo de misión, 3 tarjetas de highlight, divisor pixel, kicker "▸ CONTACTO", título "CONTÁCTANOS", 3 tips y formulario con NOMBRE, CORREO ELECTRÓNICO, MENSAJE y botón "▶  ENVIAR MENSAJE".
- [ ] Enviar con un campo vacío añade la clase `shake` al formulario y no hace petición al servidor (se ve en la pestaña Red).
- [ ] Correo con formato inválido (p. ej. `abc`) muestra "El correo no es válido." dentro del formulario.
- [ ] Sin `RESEND_API_KEY`, el envío muestra "El servicio de correo no está configurado." y los campos conservan lo escrito.
- [ ] Mientras se envía, el botón está deshabilitado y muestra "▶  ENVIANDO…".
- [ ] Envío correcto: llega un correo a `CONTACT_TO_EMAIL` con asunto `[Arcade Vault] Mensaje de {nombre}`, cuerpo con nombre, correo y mensaje, y "Responder" va al correo del visitante.
- [ ] Envío correcto muestra la terminal con "> MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, {NOMBRE}.".
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
- [ ] Con una `RESEND_API_KEY` inválida, el formulario muestra "No pudimos enviar tu mensaje. Inténtalo de nuevo.", conserva los campos y el servidor registra `[contacto] Resend:`.
- [ ] Un nombre de más de 80 caracteres o un mensaje de más de 2000 es rechazado por el servidor sin llamar a Resend.
- [ ] `grep -r "RESEND_API_KEY" .next/static` no devuelve resultados (la clave no llega al cliente).
- [ ] Al hacer scroll, cada `.reveal` de `/acerca` recibe la clase `in`.
- [ ] En 390px, `/acerca` no tiene scroll horizontal.
- [ ] `/inicio` sigue mostrando la misma landing tras extraer `useReveal`.
- [ ] Ninguna ruta lanza errores en la consola del navegador.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. `npm run start` con `.env.local` real (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`) y recorrido manual de la sección 4 en escritorio y 390px.
3. Repetir el envío sin variables y con una clave inválida para comprobar los mensajes de error.
4. `grep` de `RESEND_API_KEY` sobre `.next/static`.
5. Consola del navegador sin errores en `/`, `/inicio`, `/acerca`.

---

## 6. Decisiones tomadas y descartadas

- **Ruta `/acerca`** (elegido). Coherente con `/salon` y `/auth`. Descartado: `/about` (mezcla idiomas en las URLs).
- **"Acerca de" último en escritorio y móvil** (elegido). Mantiene paridad entre nav y menú. Descartado: solo en escritorio (rompe paridad).
- **Server Action para el envío** (elegido). Es el patrón de Next para formularios y no expone una API pública. Descartado: Route Handler `app/api/contact` (endpoint público sin necesidad).
- **SDK oficial `resend`** (elegido). Cubre tipos y errores de la API. Coste: una dependencia. Descartado: `fetch` directo a `api.resend.com` (menos código, pero acopla a detalles de la API).
- **Validación en cliente y servidor** (elegido). El cliente da el efecto `shake` del template; el servidor es la validación que cuenta. Descartado: solo cliente (inseguro).
- **Remitente `onboarding@resend.dev`** (elegido por ahora). Permite probar sin DNS; solo entrega al correo de la cuenta Resend. Descartado: dominio propio ahora (requiere DNS). Se cambia con `CONTACT_FROM_EMAIL` sin tocar código.
- **Destino por variable de entorno** (elegido). El correo no queda en el repo público. Descartado: correo fijo en el código.
- **Sin persistencia de mensajes** (elegido). Sin capa de datos en el proyecto; el buzón es el registro. Descartado: guardar en base de datos.
- **Sin anti-spam** (elegido, decisión del usuario). Riesgo aceptado (sección 7). Descartados por ahora: honeypot, captcha, límite por IP (requiere estado).
- **Error inline conservando campos** (elegido). El usuario sabe que no llegó y puede reintentar. Descartado: mostrar la terminal de éxito igual (engaña al usuario).
- **`reply_to` = correo del visitante** (elegido). Responder desde el buzón contesta al visitante.
- **`useReveal` compartido** (elegido). Evita duplicar el `IntersectionObserver` en dos páginas. Descartado: copiarlo en `about.tsx`.
- **Copy y diseño literales del template** (elegido). Es un port, no un rediseño. Descartado: invocar `/frontend-design` para rediseñar (fuera de alcance; el diseño ya existe).
- **Inputs no controlados con `formKey`** (elegido). Menos estado que duplicar cada campo en React. Descartado: inputs controlados (más código, sin beneficio aquí).

---

## 7. Riesgos identificados

- **Spam sin protección.** Cualquiera puede enviar mensajes y consumir la cuota de Resend. Mitigación: aceptado por decisión del usuario; anti-spam en spec futura.
- **Sin dominio verificado, solo llega al correo de la cuenta Resend.** Mitigación: documentar en el README (o en la spec de despliegue) que hay que verificar un dominio antes de publicar, y configurar `CONTACT_FROM_EMAIL`.
- **Fuga de la clave de API al cliente.** Mitigación: sin prefijo `NEXT_PUBLIC_`, y verificación con `grep` sobre `.next/static`.
- **Mensaje perdido si Resend cae.** No hay reintento ni almacenamiento. Mitigación: error visible y campos conservados para reintentar.
- **Doble envío por doble click.** Mitigación: botón deshabilitado durante `isPending`.
- **Contenido oculto sin JS.** `.reveal` empieza oculto y solo se muestra con `in`. Mismo riesgo que SPEC 02; aceptable para MVP.

---

## What is **not** in this spec

- Guardar mensajes en base de datos.
- Anti-spam (captcha, honeypot, límite por IP).
- Dominio propio verificado en Resend (configuración externa).
- Respuesta automática de confirmación al visitante.

Cada uno, si entra, va en su propia spec.
