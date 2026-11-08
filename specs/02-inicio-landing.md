# SPEC 02 — Pantalla Inicio (landing) en la navegación

**Estado:** Implemented
**Fecha:** 2026-11-08
**Depende de:** SPEC 01 (nav, layout, `lib/games.ts`, `globals.css`)
**Fuente de diseño:** `references/templates/home-about/home.jsx` y `nav.jsx`

**Objetivo:** Añadir la opción "Inicio" como primer enlace de la navegación, junto a Biblioteca, que lleva a una landing portada de `home.jsx` en la ruta `/inicio`.

---

## 1. Alcance

### Incluido

- Enlace "Inicio" como primer elemento de la nav de escritorio (antes de Biblioteca) y del menú móvil.
- Ruta `/inicio` con la landing completa de `home.jsx`: hero, "¿Por qué Arcade Vault?", "Juegos disponibles ahora", stats, "Actividad en vivo", "Precios" con FAQ y CTA final.
- Estilos del bloque `/* ===== HOME PAGE ===== */` de `references/templates/home-about/styles.css` añadidos a `app/globals.css`.
- Logo de la nav enlaza a `/inicio` (igual que el template).
- Copy en español, igual al template.

### NO incluido (otras specs)

- Sección "Acerca de" (`about.jsx`, enlace "Acerca de", ruta `/acerca` o similar, bloque CSS `.about-*`). Explícitamente fuera.
- Mover Biblioteca de `/`. La biblioteca sigue en `/`.
- Datos reales: stats, actividad en vivo y top jugadores siguen siendo texto fijo.
- Autenticación real, estado de usuario logueado en la nav (sigue "Iniciar Sesión").
- Cualquier lógica de juego.
- Tests automatizados (el repo no tiene runner).

---

## 2. Modelo de datos

Sin persistencia ni datos nuevos.

- Tarjetas "Juegos disponibles ahora": reutilizan `GAMES` de `lib/games.ts` (primeros 6, `slice(0, 6)`).
- Stats, ítems de actividad, top jugadores, precios y FAQ: arrays literales dentro de `components/landing.tsx`, con el mismo contenido que `home.jsx`.

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

1. **Estilos.** Copiar el bloque `/* ===== HOME PAGE ===== */` (líneas 930–1147 de `references/templates/home-about/styles.css`) al final de `app/globals.css`. Excluir cualquier regla `.about-*`. Verificar que `.reveal` y `.in` queden definidos.
2. **Componente landing.** Crear `components/landing.tsx` (`"use client"`), portando `home.jsx`:
   - `useReveal` → `useEffect` con `IntersectionObserver` sobre `.reveal`.
   - `FloatingSilhouettes`, `MiniCard` y `FeatureIcon` como componentes en el mismo archivo.
   - `navigate({ name })` → `<Link href>` con las rutas reales (ver sección 4).
3. **Ruta.** Crear `app/inicio/page.tsx` (server) que renderiza `<Landing />`.
4. **Nav.** En `components/nav.tsx`:
   - Añadir `"inicio"` al tipo `Section`; `sectionOf("/inicio")` → `"inicio"`.
   - Insertar `<Link href="/inicio">Inicio</Link>` antes de Biblioteca en `.links` y en `.av-mobile-panel`.
   - Cambiar `href` del logo de `/` a `/inicio`.
   - `/` sigue mapeando a `"biblioteca"`.
5. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores nuevos.
- [ ] Nav de escritorio: los enlaces están en orden "Inicio", "Biblioteca", "Salón de la Fama".
- [ ] Menú móvil (390px): "Inicio" es el primer enlace del panel y abre `/inicio`.
- [ ] Click en "Inicio" navega a `/inicio`. En esa ruta solo "Inicio" tiene clase `active`.
- [ ] Click en el logo navega a `/inicio`.
- [ ] `/` sigue mostrando la biblioteca con las 8 tarjetas de `GAMES`, sin cambios.
- [ ] `/inicio` muestra, en orden: hero con "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA", "¿POR QUÉ ARCADE VAULT?" con 4 tarjetas, "JUEGOS DISPONIBLES AHORA" con 6 mini-tarjetas, stats, "ACTIVIDAD EN VIVO", "PRECIOS" con FAQ de 3 ítems, "¿LISTO PARA JUGAR?".
- [ ] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS" e "INSERTAR MONEDA" llevan a `/`.
- [ ] "CREAR CUENTA" y "EMPEZAR GRATIS" llevan a `/auth`.
- [ ] "VER SALÓN" lleva a `/salon`.
- [ ] Click en una mini-tarjeta lleva a `/juego/[id]` con el id de ese juego.
- [ ] Al hacer scroll, cada `.reveal` recibe la clase `in` al entrar en pantalla.
- [ ] En 390px, `/inicio` no tiene scroll horizontal.
- [ ] `grep -ri "acerca\|about" app/inicio components/landing.tsx` no devuelve resultados.
- [ ] Ninguna ruta lanza errores en la consola del navegador.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. `npm run start` y recorrido manual de la sección 4 en escritorio y 390px.
3. Consola del navegador sin errores en `/`, `/inicio`, `/salon`, `/auth`.
4. `grep` de la sección 4 sobre el código nuevo.

---

## 6. Decisiones tomadas y descartadas

- **Inicio en `/inicio`** (elegido). Biblioteca sigue en `/` y no cambian las URLs de SPEC 01. Descartado: mover Biblioteca a `/biblioteca` y dar `/` a Inicio (obliga a cambiar URLs y enlaces ya aprobados en SPEC 01).
- **Landing completa de `home.jsx`** (elegido). Es la pantalla que pidió el usuario. Descartado: solo hero + preview (deja la pantalla incompleta frente al template).
- **Datos de la landing como texto fijo** (elegido). Coherente con SPEC 01 (datos mock estáticos). Descartado: derivar stats y top de `lib/scores.ts` (inventa lógica nueva que no se pidió).
- **Logo enlaza a `/inicio`** (decisión propia, sigue el template). Cambia un comportamiento de SPEC 01 (antes iba a `/`). Descartado: dejarlo en `/` (inconsistente con la nav nueva donde Inicio es la portada).
- **Estilos en `app/globals.css`** (elegido). Mismo criterio que SPEC 01: no se crea archivo CSS aparte. Descartado: `home.css` separado.
- **Sección "Acerca de" excluida** (decisión del usuario). Se omite enlace, ruta y CSS.
- **Reutilizar `GAMES`** para las mini-tarjetas (elegido). Evita duplicar datos. Descartado: array literal de `home.jsx`.
- **Componente `"use client"`** (elegido). Necesario por `useEffect` e `IntersectionObserver`.

---

## 7. Riesgos identificados

- **Contenido oculto sin JS.** `.reveal` empieza oculto y solo se muestra al añadirse `in` por JS. Si el JS no carga, las secciones quedan invisibles. Mitigación: aceptable para un MVP visual; revisar si el template define un fallback.
- **Dos enlaces a `/`.** Inicio (`/inicio`) y Biblioteca (`/`) tienen destinos distintos pero el logo y los botones "EXPLORAR JUEGOS" van a la biblioteca. Puede confundir el estado activo si cambia el mapeo de `sectionOf`. Mitigación: criterio de aceptación de "solo Inicio activo en `/inicio`".
