# SPEC 06 — Renombrar "ROCAS" a "ASTEROIDES" en toda la UI

**Estado:** IMPLEMENTED
**Fecha:** 2026-11-10
**Depende de:** SPEC 01 (catálogo `lib/games.ts`, `/juego/[id]`, `/jugar/[id]`, salón de la fama), SPEC 05 (el `id` del juego ya es `asteroids`; falta el título visible)

**Objetivo:** Que el juego se muestre como "ASTEROIDES" en cada pantalla y en el código de la app, sin ninguna aparición visible del nombre "ROCAS".

---

## 1. Alcance

### Incluido

- Título del juego en `lib/games.ts`: `title: "ROCAS"` → `title: "ASTEROIDES"`.
- Barra superior del juego en `components/asteroids-player.tsx`: `ROCAS · CRT-83 · 60 HZ` → `ASTEROIDES · CRT-83 · 60 HZ`.
- Feed mock de la landing en `components/landing.tsx`: entrada `g: "Rocas"` → `g: "Asteroides"`.
- Identificador de portada: `cover: "cover-rocas"` → `cover: "cover-asteroids"` en `lib/games.ts`, y clase `.cover-rocas` → `.cover-asteroids` en `app/globals.css` (tres reglas: base, `::after`, `::before`).
- Comentario de código en `components/hall-of-fame.tsx:14` que cita `caida/rocas` como ejemplo: se reescribe sin el nombre viejo.
- Verificación de que no queda ninguna aparición de "rocas" (sin distinguir mayúsculas) fuera de `specs/` y `references/`.

### NO incluido (otras specs o fuera de alcance)

- Cambiar el `id` del juego. Ya es `asteroids` desde SPEC 05.
- Cambiar rutas, lógica del juego, puntuaciones o leaderboard.
- Texto `long` de la entrada en `lib/games.ts`: solo la palabra `rocas` → `asteroides` (decisión del usuario, opción 1: así el grep de verificación queda en cero).
- Localizar al español los textos del overlay del canvas (`GAME OVER`, `PAUSA`); ya están fuera de SPEC 05.
- Modificar `specs/` (historial: SPEC 01 y SPEC 05 mencionan "rocas" y se dejan tal cual).
- Modificar `references/` (plantillas de origen; SPEC 05 no las toca).
- Renombrar la carpeta `references/started-games/02-asteroids/` ni cualquier otro archivo fuera de los listados.
- Datos reales de Supabase para el feed de la landing (sigue siendo mock).

---

## 2. Modelo de datos

No hay datos nuevos ni persistentes. El cambio es de cadenas y de un identificador CSS interno.

Archivos afectados:

| Archivo                           | Cambio                                                                      |
| --------------------------------- | --------------------------------------------------------------------------- |
| `lib/games.ts`                    | Modificado. `title` → `ASTEROIDES`; `cover` → `cover-asteroids`.            |
| `components/asteroids-player.tsx` | Modificado. Texto de la barra superior (línea ~110).                        |
| `components/landing.tsx`          | Modificado. `g: "Rocas"` → `g: "Asteroides"` en `LIVE_SCORES` (línea ~149). |
| `components/hall-of-fame.tsx`     | Modificado. Solo el comentario (línea ~14).                                 |
| `app/globals.css`                 | Modificado. `.cover-rocas` → `.cover-asteroids` (líneas ~490–507).          |

Forma del nombre en pantalla: `ASTEROIDES` en mayúsculas, como el resto de títulos del catálogo.

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

1. **Catálogo.** En `lib/games.ts`, cambiar `title` a `"ASTEROIDES"` y `cover` a `"cover-asteroids"`.
2. **Estilos de portada.** En `app/globals.css`, renombrar `.cover-rocas`, `.cover-rocas::after` y `.cover-rocas::before` a `.cover-asteroids*`. Sin cambiar las reglas de color ni de posición.
3. **Barra del juego.** En `components/asteroids-player.tsx`, cambiar `ROCAS · CRT-83 · 60 HZ` a `ASTEROIDES · CRT-83 · 60 HZ`.
4. **Landing.** En `components/landing.tsx`, cambiar `g: "Rocas"` a `g: "Asteroides"`.
5. **Comentario.** En `components/hall-of-fame.tsx`, reescribir el comentario de la línea 14 sin `caida/rocas`, manteniendo la razón (la semilla por posición evita tablas iguales).
6. **Barrido.** Ejecutar `grep -rni "rocas" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next --exclude-dir=specs --exclude-dir=references .` y confirmar cero resultados. Si aparece algo nuevo, decidir según la regla de la sección 1 antes de tocarlo.
7. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [X] `npm run build` termina sin errores.
- [X] `npm run lint` termina sin errores nuevos.
- [X] El grep del paso 6 no devuelve ninguna línea fuera de `specs/` y `references/` (coincidencia sin distinguir mayúsculas).
- [X] `/biblioteca` muestra la tarjeta del juego con el título `ASTEROIDES`.
- [X] La portada de esa tarjeta conserva el fondo estrellado y el triángulo amarillo (la clase `.cover-asteroids` se aplica; no hay regresión visual).
- [X] `/juego/asteroids` muestra `ASTEROIDES` como título de la ficha.
- [X] `/jugar/asteroids` muestra en la barra superior `ASTEROIDES · CRT-83 · 60 HZ`.
- [X] La landing muestra en el feed de puntuaciones en vivo la fila `VAULT_07` con juego `Asteroides`.
- [X] El salón de la fama sigue mostrando tablas distintas por juego (la semilla no cambió).
- [X] La URL sigue siendo `/juego/asteroids` y `/jugar/asteroids`; ninguna ruta cambia.
- [X] En 390 px, `/biblioteca` y `/juego/asteroids` no tienen scroll horizontal.
- [X] `git status` no muestra cambios dentro de `specs/` ni de `references/`.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. Grep de la sección 3, paso 6.
3. `npm run dev` y revisión visual de `/biblioteca`, `/juego/asteroids`, `/jugar/asteroids` y la landing (`/`), en escritorio y a 390 px.
4. Comprobar en el navegador que la portada de Asteroides tiene el mismo aspecto que antes del cambio (captura antes y después si hace falta).

---

## 6. Decisiones tomadas y descartadas

- **Forma en mayúsculas `ASTEROIDES`** (elegido). Coincide con el resto de títulos del catálogo (`CAÍDA`, etc.). Descartado: `Asteroides` (inconsistente con el catálogo) y `ASTEROIDS` (inglés, el resto del catálogo está en español).
- **Cambiar también el feed mock de la landing** (elegido). Evita que el nombre viejo aparezca en pantalla aunque sea dato ficticio.
- **Renombrar identificadores internos (`cover-rocas`, `.cover-rocas`)** (elegido). No son visibles, pero dejan el repo sin rastro del nombre viejo y facilitan el grep de verificación. Riesgo controlado por el criterio de portada.
- **No tocar `specs/`** (elegido). Son historial; SPEC 01 y SPEC 05 describen el cambio de `rocas` a `asteroids` tal como ocurrió.
- **No tocar `references/`** (elegido). Son plantillas de origen que SPEC 05 declara fuera de modificación.
- **No cambiar el `id`** (no aplica). Ya es `asteroids`; solo falta el título visible.

---

## 7. Riesgos identificados

- **Referencia CSS olvidada.** Si `cover: "cover-asteroids"` y la clase no coinciden, la tarjeta pierde el fondo. Mitigación: criterio de portada y grep final.
- **Desbordamiento del título.** `ASTEROIDES` es más largo que `ROCAS`; en tarjetas o en la barra de 390 px podría cortarse o forzar scroll. Mitigación: criterio de 390 px y revisión visual.
