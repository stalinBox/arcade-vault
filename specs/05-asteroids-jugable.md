# SPEC 05 — Asteroids jugable en `/jugar/asteroids`

**Estado:** APPROVED
**Fecha:** 2026-11-10
**Depende de:** SPEC 01 (rutas `/juego/[id]` y `/jugar/[id]`, HUD `.player-hud`, marco `.crt`, `lib/games.ts`)
**Fuente de referencia:** `references/started-games/02-asteroids/` (`game.js`, `index.html`, `README.md`, `CLAUDE.md`). Esa carpeta no se modifica.

**Objetivo:** Portar el Asteroids de `references/started-games/02-asteroids/` a TypeScript y montarlo en `/jugar/asteroids`, de modo que el canvas notifique a React puntuación, vidas, nivel, pausa y fin de partida para alimentar el HUD de la página.

---

## 1. Alcance

### Incluido

- Port de `game.js` a un módulo TS sin dependencias de DOM global: recibe el `<canvas>` y callbacks, y devuelve un controlador.
- Componente cliente que renderiza el HUD de la plataforma y el canvas dentro del marco `.crt`.
- `/jugar/asteroids` carga el juego; los demás ids de `/jugar/[id]` siguen mostrando `CrtScreen` sin cambios.
- HUD de la página en vivo: puntuación, vidas y nivel salen del juego. Se elimina el HUD dibujado en el canvas.
- Botones `PAUSA` y `FIN` funcionales; tecla `P` alterna pausa.
- Callback `onGameOver({ score, level })` al quedarse sin vidas o al pulsar `FIN`. React lo guarda en estado local (sin persistir).
- Overlay `GAME OVER` en el canvas con la puntuación final, como en el original. `Enter` reinicia; el HUD muestra un botón de nueva partida.
- Overlay `PAUSA` en el canvas mientras está pausado.
- Bloquear el scroll de la página con flechas y `Espacio` mientras el juego está montado.
- Limpieza total al desmontar (bucle `requestAnimationFrame` y listeners de teclado).
- Renombrar el id del juego `rocas` a `asteroids` en `lib/games.ts` (rutas `/juego/asteroids` y `/jugar/asteroids`; `/juego/rocas` y `/jugar/rocas` dejan de existir y devuelven 404).
- Ajustar el copy de esa entrada (quitar la mención a OVNIs, que el juego no tiene).

### NO incluido (otras specs)

- Guardar la puntuación en Supabase o en cualquier almacenamiento (sin tablas ni inserts; `onGameOver` solo es el gancho).
- Sustituir el leaderboard mock ni "Mejor global" de `/juego/asteroids`.
- Controles táctiles. La etiqueta "TECLADO / TÁCTIL" de `/juego/[id]` no cambia.
- Sonido.
- Auto-pausa al perder foco o visibilidad de la pestaña.
- Convertir los otros 7 juegos del catálogo.
- Power-ups, OVNIs, estrella fugaz u otras mecánicas que el código del original no tenga.
- Nombre del jugador real (el HUD sigue mostrando `INVITADO`) y autenticación.
- Tests automatizados (el repo no tiene runner).

---

## 2. Modelo de datos

No hay datos persistentes. Estructuras nuevas, solo en memoria:

```ts
// lib/asteroids/engine.ts
export interface AsteroidsStats {
  score: number;
  lives: number;
  level: number;
}

export interface AsteroidsCallbacks {
  onStats(stats: AsteroidsStats): void; // al cambiar score, lives o level, y al iniciar partida
  onGameOver(result: { score: number; level: number }): void; // una vez por partida
  onPauseChange(paused: boolean): void;
}

export interface AsteroidsController {
  togglePause(): void; // sin efecto si la partida terminó
  end(): void; // equivale a perder todas las vidas: dispara onGameOver
  restart(): void; // nueva partida; también con Enter en game over
  destroy(): void; // cancela rAF y quita listeners; idempotente
}

export function createAsteroids(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks,
): AsteroidsController;
```

Constantes y reglas que se conservan del original (valores exactos de `game.js`):

- Canvas interno fijo 800×600; escalado solo con CSS (`width: 100%`, `max-width: 800px`, `aspect-ratio: 4 / 3`).
- `RADII = [0, 16, 30, 50]`, `SPEEDS = [0, 85, 55, 32]`, `POINTS = [0, 100, 50, 20]`.
- Puntos: grande 20, mediano 50, pequeño 100. 3 vidas. Invencibilidad al reaparecer con parpadeo.
- Estados internos: `'playing' | 'dead' | 'gameover'`. La pausa es un indicador aparte, no un estado nuevo del original.

Controles:

| Tecla     | Acción                        |
| --------- | ----------------------------- |
| `←` `→`   | Rotar                         |
| `↑`       | Propulsar                     |
| `Espacio` | Disparar                      |
| `P`       | Pausa / reanudar              |
| `Enter`   | Reiniciar (solo en game over) |

Archivos:

| Archivo                           | Cambio                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `lib/asteroids/engine.ts`         | Nuevo. Port de `game.js` (clases `Ship`, `Asteroid`, `Bullet`, `Particle` y bucle).           |
| `components/asteroids-player.tsx` | Nuevo, `"use client"`. HUD + canvas + conexión con el controlador.                            |
| `app/jugar/[id]/page.tsx`         | Modificado. Si `game.id === "asteroids"` renderiza `<AsteroidsPlayer />`; si no, el flujo actual. |
| `lib/games.ts`                    | Modificado. En la entrada de `rocas`: `id` → `asteroids` y `long` sin OVNIs. El resto igual.  |
| `app/globals.css`                 | Modificado si hace falta: estilo del `<canvas>` dentro de `.crt-screen`.                      |

---

## 3. Plan de implementación

Cada paso deja la app compilando (`npm run build`).

1. **Leer docs.** Antes de escribir código de Next, leer en `node_modules/next/dist/docs/` lo relativo a Client Components y a `cacheComponents` (regla de `AGENTS.md`).
2. **Port del motor.** Crear `lib/asteroids/engine.ts` con la lógica de `game.js` tipada, sin acceso a `document` ni a `window` fuera de `createAsteroids`. Reglas del port:
   - El canvas llega por parámetro; `ctx` se obtiene dentro de la función.
   - Listeners de `keydown`/`keyup` en `window`, guardados para poder quitarlos en `destroy()`.
   - `preventDefault()` sobre `ArrowLeft`, `ArrowRight`, `ArrowUp`, `Space` y `Enter`.
   - El `dt` del bucle se limita a un máximo (p. ej. 0.05 s) para que reanudar una pausa o volver a la pestaña no teletransporte objetos.
   - Eliminar `drawHUD` y `drawLifeIcon` (el HUD pasa a React).
   - Estado de juego encapsulado en la closure, no en variables globales de módulo (así dos montajes no comparten estado).
   - Sin callbacks ni efectos nuevos todavía. Prueba manual provisional: montarlo desde un componente de prueba y verificar que se juega igual que `references/.../index.html`.
3. **Callbacks y control.** Añadir `onStats`, `onGameOver`, `onPauseChange` y el controlador (`togglePause`, `end`, `restart`, `destroy`):
   - `onStats` se emite al iniciar, al sumar puntos, al perder vida y al cambiar de nivel (no en cada frame).
   - `onGameOver` se emite exactamente una vez por partida (por vidas = 0 o por `end()`).
   - En pausa se congelan `update`, el temporizador de respawn y la invencibilidad; el `draw` sigue dibujando con el overlay `PAUSA`. Al pausar se limpian las teclas retenidas.
   - `P` alterna pausa; `Enter` en `gameover` llama a `restart()`.
4. **Componente.** Crear `components/asteroids-player.tsx`:
   - Estado `stats`, `paused`, `result` (`null` hasta que termina la partida).
   - `useEffect` crea el controlador con `canvasRef` y lo destruye en el cleanup (compatible con doble montaje de StrictMode).
   - HUD con las mismas clases que hoy (`.player-hud`, `.hud-stat`, `.hud-actions`): `JUGADOR` = `INVITADO`, `PUNTUACIÓN` (formato `es-ES`), `VIDAS` (`♥` por vida restante), `NIVEL` con dos dígitos.
   - `PAUSA` alterna pausa y cambia a `REANUDAR` mientras está pausado; deshabilitado en game over.
   - `FIN` llama a `end()`; en game over se reemplaza por `NUEVA PARTIDA`, que llama a `restart()` y pone `result` a `null`.
   - `SALIR` sigue siendo `<Link href="/juego/asteroids">`.
   - El canvas va dentro de `.crt` / `.crt-screen`, con la barra inferior (`crt-bottom`) del `CrtScreen` actual.
5. **Página.** En `app/jugar/[id]/page.tsx`, rama `asteroids` → `<AsteroidsPlayer />`; el resto de ids conserva el JSX actual con `CrtScreen`. Mover las constantes `SCORE`/`LIVES`/`LEVEL` solo si dejan de usarse.
6. **Copy.** En `lib/games.ts`, cambiar `id: "rocas"` por `id: "asteroids"` y reescribir `long` sin la frase de los OVNIs. Buscar con `grep -rn "rocas" app components lib` que no queden enlaces al id viejo (`title`, `cover: "cover-rocas"` y la clase CSS `.cover-rocas` no cambian). Verificar `/juego/asteroids` y la biblioteca.
7. **Estilos.** Ajustar `app/globals.css` solo si el canvas no encaja en `.crt-screen` a 390 px y 1280 px (sin scroll horizontal, relación 4:3).
8. **Verificación final.** Ver sección 5.

---

## 4. Criterios de aceptación

- [ ] `npm run build` termina sin errores.
- [ ] `npm run lint` termina sin errores nuevos.
- [ ] `/jugar/asteroids` muestra el HUD de la plataforma y el canvas del juego dentro del marco CRT, sin HUD dibujado en el canvas.
- [ ] El juego arranca solo al entrar: aparecen asteroides grandes y la nave en el centro.
- [ ] `←` `→` rotan, `↑` propulsa y `Espacio` dispara.
- [ ] Con el foco en la página, las flechas y `Espacio` no hacen scroll.
- [ ] Destruir un asteroide grande suma 20, mediano 50 y pequeño 100; el valor de `PUNTUACIÓN` en el HUD cambia en el mismo momento.
- [ ] Un asteroide grande destruido se parte en medianos, y un mediano en pequeños.
- [ ] El HUD empieza en `VIDAS ♥ ♥ ♥` y `NIVEL 01`; al chocar pierde un `♥`.
- [ ] Tras perder una vida, la nave reaparece parpadeando y es invulnerable durante el tiempo del original.
- [ ] Limpiar todos los asteroides sube el `NIVEL` en el HUD.
- [ ] Pulsar `P` pausa: nada se mueve, el canvas muestra el overlay `PAUSA`, el botón dice `REANUDAR`. Pulsar `P` de nuevo continúa desde el mismo punto.
- [ ] El botón `PAUSA` hace lo mismo que `P`.
- [ ] Durante la pausa, el temporizador de respawn y la invencibilidad no avanzan.
- [ ] Al quedarse sin vidas, el canvas muestra el overlay `GAME OVER` con la puntuación final y `onGameOver` se llama exactamente una vez (verificable con un `console.log` temporal que se elimina).
- [ ] Pulsar `FIN` durante la partida produce el mismo `GAME OVER` y la misma única llamada a `onGameOver`.
- [ ] En `GAME OVER`, `Enter` inicia una partida nueva con puntuación 0, 3 vidas y nivel 1.
- [ ] En `GAME OVER`, el botón `NUEVA PARTIDA` hace lo mismo y `PAUSA` está deshabilitado.
- [ ] Pulsar `P` en `GAME OVER` no hace nada.
- [ ] `SALIR` navega a `/juego/asteroids`; volver a `/jugar/asteroids` empieza una partida limpia (sin teclas ni puntuación residuales).
- [ ] Al salir de `/jugar/asteroids`, el bucle se detiene (el `<canvas>` ya no se redibuja) y las flechas vuelven a hacer scroll en otras páginas.
- [ ] Con `reactStrictMode` activo en `npm run dev`, no hay dos bucles simultáneos (la nave no va al doble de velocidad).
- [ ] `/jugar/bloque-buster` (u otro id distinto de `asteroids`) sigue mostrando el `CrtScreen` y el HUD estático de antes.
- [ ] `/juego/asteroids` ya no menciona OVNIs; el leaderboard y "Mejor global" no cambian.
- [ ] En 390 px, `/jugar/asteroids` no tiene scroll horizontal y el canvas conserva relación 4:3.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en `/jugar/asteroids`.
- [ ] `git status` no muestra cambios dentro de `references/`.

---

## 5. Verificación

No hay test runner. Verificación por:

1. `npm run build` y `npm run lint`.
2. `npm run dev`, partida completa en `/jugar/asteroids` en escritorio recorriendo la sección 4: puntos por tamaño, vidas, nivel, pausa, `FIN`, `GAME OVER`, `Enter`.
3. Comparar el comportamiento con `references/started-games/02-asteroids/index.html` abierto en otra pestaña (velocidades, puntos, invencibilidad).
4. `console.log` temporal en `onGameOver` para contar llamadas; eliminarlo antes de commitear.
5. Navegar `/juego/asteroids` → `/jugar/asteroids` → `SALIR` varias veces y comprobar en el Performance/Console que no quedan bucles activos.
6. Revisar `/jugar/bloque-buster` y `/biblioteca` para confirmar que no hay regresiones.
7. Emulación a 390 px de ancho para el layout.

---

## 6. Decisiones tomadas y descartadas

- **Port a TypeScript con callbacks hacia React** (elegido por el usuario). Permite conectar HUD, pausa y fin de partida. Descartado: iframe a HTML estático (no se puede conectar el HUD sin `postMessage`) y copiar `game.js` tal cual en un `useEffect` (sin tipos ni limpieza clara).
- **Motor en `lib/asteroids/engine.ts`, sin React.** Separa la lógica del canvas de la UI y permite montar/desmontar con una sola función. Descartado: lógica dentro del componente (mezcla render y bucle).
- **Id del juego `asteroids` (renombrando `rocas`), sin entrada nueva** (elegido por el usuario). Reutiliza la entrada del catálogo con la misma temática y alinea la URL con el nombre del juego. Descartado: mantener `rocas` y añadir `asteroides` como noveno juego.
- **Copy de la entrada ajustado** (elegido). El texto actual promete OVNIs que el juego no tiene. Descartado: dejarlo igual.
- **Los otros 7 juegos conservan el placeholder** (elegido). Cada juego tiene su propia spec.
- **HUD de la página en vivo, sin HUD en el canvas** (elegido). Una sola fuente de verdad visual y se aprovecha el HUD que ya existe. Coste: el motor depende de que React pinte las stats. Descartado: dejar el HUD del canvas con el de la página estático.
- **`PAUSA` y `FIN` funcionales** (elegido). Los botones ya existen en el HUD; dejarlos decorativos confundiría.
- **`onGameOver({ score, level })` ahora, sin persistir** (elegido por el usuario). Deja el gancho para la spec de puntuaciones sin acoplar esta spec a Supabase. Cambio respecto a su respuesta inicial en la pregunta de alcance, aclarado después como requisito.
- **Overlay `GAME OVER` en el canvas + `Enter` + botón `NUEVA PARTIDA`** (elegido). Conserva el comportamiento original y añade el botón por accesibilidad. Descartado: panel React sobre el canvas (obliga a rediseñar el overlay).
- **Pausa con `P`, no con `Espacio`** (elegido). El usuario pidió primero pausar con `Espacio`; como `Espacio` dispara en el original, se acordó dejar `Espacio` para disparar y usar `P`. Descartado: disparo en `Z`/`Ctrl` (cambia los controles originales).
- **Sin auto-pausa por pérdida de foco** (elegido: no fue seleccionada). Se mitiga limitando `dt` al reanudar. Descartado por ahora: pausa al ocultar la pestaña.
- **Bloqueo de scroll con flechas y `Espacio`** (añadido, no era una pregunta). Sin él, jugar mueve la página; es requisito de usabilidad, no una función nueva.
- **Sin audio** (elegido). El original no tiene y no se pidió.
- **Sin controles táctiles** (elegido). Se difiere; la etiqueta "TECLADO / TÁCTIL" queda como está.
- **Canvas interno 800×600 escalado por CSS** (elegido). No cambia la lógica ni las colisiones del original y mantiene 4:3 en móvil.
- **Textos del overlay tal como en el original.** No se localizan en esta spec; si se quiere español, va aparte.
- **Estado de juego dentro de la closure de `createAsteroids`** (elegido). Evita estado compartido entre montajes (StrictMode, navegación repetida).

---

## 7. Riesgos identificados

- **Doble montaje en desarrollo (StrictMode).** Puede dejar dos bucles y dos juegos de listeners. Mitigación: `destroy()` idempotente en el cleanup del `useEffect` y criterio de aceptación específico.
- **Re-render excesivo por `onStats`.** Si se emitiera cada frame, el HUD re-renderiza a 60 Hz. Mitigación: emitir solo cuando cambia score, lives o level.
- **`P` y teclas retenidas al pausar.** Una tecla pulsada al pausar puede quedar "pegada" al reanudar. Mitigación: limpiar `keys` y `justPressed` al pausar y al terminar.
- **Salto de tiempo tras pausa o pestaña en segundo plano.** `requestAnimationFrame` se suspende y el siguiente `dt` es enorme. Mitigación: límite máximo de `dt` y reinicio de `lastTime` al reanudar.
- **`cacheComponents` y rutas estáticas.** `/jugar/[id]` usa `generateStaticParams`; el componente cliente no debe leer `window` durante el render. Mitigación: todo acceso a `window`/`document` dentro de `useEffect` y de `createAsteroids`.
- **Foco del teclado.** Si el usuario hace clic fuera del juego o en un botón del HUD, `Espacio` puede activar ese botón además de disparar. Mitigación: llamar a `blur()` en los botones del HUD tras pulsarlos y verificar en la prueba manual.
- **Divergencia con la referencia.** El port puede alterar velocidades o colisiones sin que nadie lo note. Mitigación: comparar lado a lado con `index.html` del original (sección 5, paso 3).
- **Orden de `onGameOver` y `onStats`.** Si el último `onStats` llega después de `onGameOver`, el HUD puede mostrar vidas ≠ 0 en game over. Mitigación: emitir `onStats` (vidas = 0) antes de `onGameOver`.

---

## What is **not** in this spec

- Guardar puntuaciones en Supabase ni en `localStorage`.
- Leaderboard real, "Mejor global" real y estadísticas de partidas.
- Controles táctiles.
- Sonido.
- Auto-pausa por foco o visibilidad.
- Los otros 7 juegos del catálogo.
- Mecánicas nuevas (power-ups, OVNIs, estrella fugaz).
- Nombre de jugador real y autenticación.

Cada uno, si entra, va en su propia spec.
