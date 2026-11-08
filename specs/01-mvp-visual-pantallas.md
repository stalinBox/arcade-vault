# SPEC 01 — MVP visual de Arcade Vault (pantallas sin juego)

**Estado:** Implemented
**Fecha:** 2026-11-08
**Depende de:** ninguna (primera spec)
**Fuente de diseño:** `references/templates/` (5 pantallas + nav + footer, React UMD)

**Objetivo:** Portar las 5 pantallas del template (biblioteca, detalle, reproductor, auth, salón de la fama) a Next.js App Router como UI visual navegable, sin lógica de juego.

---

## 1. Alcance

### Incluido

- Layout raíz con `av.css` (copia de `styles.css`) y fuentes Press Start 2P, Courier Prime, JetBrains Mono vía `next/font/google`.
- Nav superior con logo, enlaces Biblioteca / Salón de la Fama, indicador de créditos estático `CRÉDITOS · 03`, botón "Iniciar Sesión", menú móvil.
- Footer con copy del template (`© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`).
- Rutas:
  - `/` — biblioteca (buscador + filtro por categoría + tarjetas con tilt).
  - `/juego/[id]` — detalle de juego (descripción, mejores puntajes mock).
  - `/jugar/[id]` — marco CRT visual con HUD estático y controles de vista; sin simulación.
  - `/auth` — formulario visual de inicio de sesión / crear cuenta.
  - `/salon` — salón de la fama con tabs por juego y tabla mock.
- Datos mock tipados en `lib/`, portados de `data.jsx`.
- Copy en español, igual al template.

### NO incluido (otras specs)

- Cualquier juego: bucle, física, puntaje real, vidas, niveles, pausa funcional, game over. El temporizador `setInterval` de `reproductor.jsx` **no se porta**.
- Guardar puntajes (`av_scores`) y leer puntajes reales.
- Autenticación real, sesión, `localStorage` de usuario (`av_user`), cookies.
- Login con Google / GitHub, enlace de Términos funcional.
- Backend, API routes, base de datos, fetch de datos.
- Tests automatizados (el repo no tiene runner).
- Tailwind como sistema de estilos de las pantallas nuevas (se usa `av.css`).

---

## 2. Modelo de datos

Sin persistencia. Todo estático en memoria.

```ts
// lib/games.ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "green" | "yellow";

export interface Game {
  id: string;          // slug, ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;       // clase CSS, ej. "cover-bricks"
  color: GameColor;
  best: number;        // mejor puntaje mock
  plays: string;       // ej. "12.4K"
}

export const GAMES: Game[];          // 8 juegos de data.jsx
export const CATS: ("TODOS" | GameCategory)[];
```

```ts
// lib/scores.ts
export interface ScoreRow {
  rank: number;
  name: string;   // de PLAYERS
  score: number;
  date: string;   // "DD/MM/2026"
}

export function seededScores(seed: number, count?: number): ScoreRow[];
// Mismo algoritmo LCG que seededScores de data.jsx. Determinista.
```

Nombres de `GAMES`, `CATS`, `PLAYERS`, `seededScores` y campos: iguales al template.

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

1. **Datos.** Crear `lib/games.ts` y `lib/scores.ts` con tipos y datos portados de `data.jsx`. Sin UI.
2. **Estilos y layout.** Copiar `references/templates/styles.css` a `app/av.css`. Importarlo en `app/layout.tsx`. Cargar las 3 fuentes con `next/font/google` y exponerlas en las variables que usa el CSS. Quitar Geist de `layout.tsx`. Mantener `globals.css` (Tailwind) intacto. Reemplazar el contenido de `app/page.tsx` por placeholder.
3. **Shell.** Crear `components/nav.tsx` (`"use client"`, estado de menú móvil) y `components/footer.tsx`. Montarlos en `layout.tsx`. Enlaces con `next/link`; estado activo con `usePathname`.
4. **Biblioteca.** `components/game-card.tsx` (tilt con mousemove) y `components/library.tsx` (`"use client"`, `q` y `cat` con useState/useMemo). Montar en `app/page.tsx`.
5. **Detalle.** `app/juego/[id]/page.tsx` (server, `params` async). Si el id no existe, llamar `notFound()`. Componente de tabla de mejores puntajes reutilizable en paso 7.
6. **Reproductor.** `app/jugar/[id]/page.tsx` + `components/crt-screen.tsx`. HUD con valores fijos (puntaje 0, vidas 3, nivel 1). Botones de pausa/reinicio sin acción. Id inválido → `notFound()`.
7. **Auth.** `app/auth/page.tsx` + `components/auth-form.tsx` (`"use client"`, tabs `in`/`up`, campo email solo en `up`). Submit con `preventDefault` y nada más. Botones Google/GitHub y "Jugar como invitado" sin acción.
8. **Salón.** `app/salon/page.tsx` + `components/hall-of-fame.tsx` (`"use client"`, tab por juego, `seededScores`). Sin fila "tu posición".
9. **Pulido responsive.** Revisar 390px de ancho: sin scroll horizontal, menú móvil operativo, tablas legibles.
10. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [X] `npm run build` termina sin errores.
- [X] `npm run lint` termina sin errores nuevos.
- [X] `/` muestra las 8 tarjetas de `GAMES`.
- [X] Escribir en el buscador filtra tarjetas por título o `short` (sin distinguir mayúsculas).
- [X] Seleccionar una categoría distinta de `TODOS` muestra solo juegos de esa categoría.
- [X] Click en una tarjeta navega a `/juego/[id]` con URL real (sin `#`).
- [X] `/juego/bloque-buster` muestra título, descripción larga y tabla de 10 filas.
- [X] `/juego/no-existe` responde 404 de Next.
- [X] `/jugar/caida` muestra el marco CRT con HUD fijo y no cambia ningún valor tras 5 segundos.
- [X] `/jugar/no-existe` responde 404.
- [X] `/auth`: los tabs alternan entre INICIAR SESIÓN y CREAR CUENTA; el campo correo aparece solo en CREAR CUENTA.
- [X] `/auth`: enviar el formulario no cambia la URL ni guarda nada en `localStorage`.
- [X] `/salon`: cambiar de tab cambia la tabla y el título del juego.
- [X] Nav en todas las rutas muestra "Iniciar Sesión" y el enlace activo corresponde a la ruta.
- [X] En ancho 390px: menú hamburguesa abre y cierra el panel; no hay scroll horizontal en ninguna ruta.
- [X] Ninguna ruta lanza errores en consola del navegador.
- [X] No existe ningún `setInterval` ni lógica de puntaje en el código nuevo (`grep -r setInterval app components lib` no devuelve resultados).

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. `npm run start` y recorrido manual de las rutas de la sección 4 en desktop y 390px.
3. Consola del navegador sin errores.
4. `grep` de `setInterval` sobre el código nuevo.

---

## 6. Decisiones tomadas y descartadas

- **Next App Router en TSX** (elegido). Encaja con `CLAUDE.md` y el repo. Descartado: JSX en Next (sin tipado, choca con tsconfig); HTML estático en `public/` (no usa la arquitectura del repo).
- **Rutas reales de Next** (elegido). URLs compartibles y sin estado en hash. Descartado: hash router del template (frágil en Next, sin ganancia visual).
- **Reproductor = marco visual con HUD fijo** (elegido). Usuario excluyó el juego. Descartado: quitar la ruta (pierde el diseño); placeholder "próximamente" (pierde el diseño pedido).
- **Datos estáticos en `lib/`** (elegido). Sin backend ni fetch. Descartado: JSON en `public/` (mismo resultado, más cambios).
- **Auth solo visual, submit sin acción** (elegido). Descartado: mock con `localStorage` (anticipa la spec de auth); navegar sin guardar (cambia de pantalla sin sentido).
- **Nav siempre en "Iniciar Sesión"** (consecuencia de auth visual). Se omite el nombre de usuario y la fila "tu posición" del salón.
- **Salón con datos mock de `seededScores`** (elegido). Descartado: leer `av_scores` (vacío hasta que exista juego).
- **Botones sociales y "Términos" sin acción** (elegido). Descartado: deshabilitados con tooltip.
- **Fuentes del template vía `next/font`, `styles.css` copiado intacto** (elegido). Fidelidad visual. Descartado: reescribir en Tailwind v4 (más trabajo, menos fidelidad). Geist sale del layout.
- **Id inexistente → `notFound()`** (decisión propia, no preguntada). Evita pantallas rotas con id inválido.

---

## 7. Riesgos identificados

- **Choque de CSS.** `styles.css` puede chocar con el preflight de Tailwind v4 de `globals.css`. Mitigación: verificar visualmente el paso 2 antes de seguir.
- **Regla Turbopack de CSS.** `next.config.ts` enruta `*.css` por `@tailwindcss/turbopack`. Mitigación: confirmar en el paso 2 que `av.css` se sirve sin transformar.
- **Hidratación.** Las tarjetas con tilt y `seededScores` deben ser deterministas en server y client. Mitigación: `seededScores` sin `Math.random`; tilt solo en client.
- **Dependencia de `cacheComponents`.** Los `params` de rutas dinámicas son async. Mitigación: leer la doc de Next 16 en `node_modules/next/dist/docs/` antes de escribir las páginas (requisito de `AGENTS.md`).
