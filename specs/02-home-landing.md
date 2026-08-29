# SPEC 02 — Home: la landing del vault en la raíz

> **Status:** APROBADO
> **Depends on:** SPEC 01
> **Date:** 2026-08-26
> **Objective:** Portar la landing de `references/templates/home-about/home.jsx` a la ruta `/`, moviendo la Biblioteca a `/juegos` y ampliando el nav a los cuatro links del prototipo nuevo.

## Por qué existe este spec

El SPEC 01 dejó las cinco pantallas del prototipo original funcionando, con la Biblioteca en `/`. El prototipo nuevo (`references/templates/home-about/`) mete una pieza que antes no existía: una **landing** de siete secciones (hero con siluetas flotantes, features, preview de juegos, stats, actividad en vivo, precios y CTA final) que ocupa la raíz, y un nav de cuatro links donde el logo apunta al home y la Biblioteca pasa a ser un destino más.

El CSS ya está resuelto del lado de la referencia: `references/templates/home-about/styles.css` es un **superset exacto** de `references/templates/styles.css` — 794 líneas agregadas, 0 quitadas, 0 modificadas. Contra `app/globals.css` el append es limpio: ninguno de los ~120 selectores nuevos ni de los 6 `@keyframes` nuevos (`bounce`, `float`, `shake`, `scorepop`, `tickin`, `pulse-led`) existe hoy.

Lo que falta es la estructura de React y la remodelación del mapa de rutas. Igual que en el SPEC 01: **no se escribe CSS nuevo**, se copian los bloques del template tal cual.

## Alcance

**Dentro:**

- La landing completa en `/`: hero, `// 01` features, `// 02` preview de juegos, stats, `// 03` actividad en vivo, `// 04` precios y CTA final.
- Las siluetas pixeladas flotantes del hero (8 SVGs) y los iconos pixel de las feature cards (4 SVGs), portados rect por rect.
- La animación `reveal` por sección (IntersectionObserver que agrega `.in`).
- Mudanza de la Biblioteca de `/` a `/juegos`, y reapuntado de todos los links internos que hoy van a `/`.
- Nav con los cuatro links del prototipo nuevo: Inicio, Biblioteca, Salón de la Fama, Acerca de — en desktop y en el drawer mobile.
- `/acerca-de` como stub "PRÓXIMAMENTE", para que el link del nav no caiga en un 404.
- Los datos del bloque de actividad (`LIVE_SCORES`, `TOP_TODAY`) como constantes tipadas en `lib/data.ts`.
- Los 794 renglones de CSS nuevo apendizados a `app/globals.css`, incluido el bloque GAMEPAD.

**Fuera de alcance (para specs futuras):**

- La pantalla **Acerca de** real (`references/templates/home-about/about.jsx`): hero de misión, highlights, divisor animado y formulario de contacto con la terminal de éxito. Va al SPEC 03. Acá solo queda el stub.
- El **gamepad** en pantalla. Su CSS se copia (`.gp-*`, `.dp-*`, `.score-pop`, `.rivet`, `.lg-key`, `.ab`) pero ningún componente lo usa todavía; ningún JSX de `home-about/` lo referencia.
- Alimentar el bloque de actividad con `av_scores`. Sigue siendo mock, igual que el resto.
- Cualquier juego jugable, backend o autenticación real. Sin cambios respecto del SPEC 01.
- Rediseñar la Biblioteca, el Detalle, el Reproductor, el Salón o el Acceso. Solo cambian de URL y de link de vuelta.
- Redirect o `rewrite` de compatibilidad desde `/` hacia `/juegos`. `/` es el home ahora, punto.

## Mapa de rutas

| Ruta | Pantalla | Estado | Origen en el prototipo |
|---|---|---|---|
| `/` | **Home (landing)** | **nueva** — hoy es la Biblioteca | `{ name: "home" }` |
| `/juegos` | Biblioteca | **mudada** desde `/` | `{ name: "biblioteca" }` |
| `/juegos/[id]` | Detalle del juego | sin cambios (solo el link de vuelta) | `{ name: "detalle", id }` |
| `/jugar/[id]` | Reproductor | sin cambios (solo el link de vuelta) | `{ name: "player", id }` |
| `/salon` | Salón de la Fama | sin cambios (solo el link de vuelta) | `{ name: "salon" }` |
| `/acceso` | Acceso | sin cambios (solo el redirect post-login) | `{ name: "auth" }` |
| `/acerca-de` | Acerca de | **nueva, stub** | `{ name: "about" }` |
| `/estilos` | Referencia visual | sin cambios, fuera del nav | — |

`/juegos` queda como índice de la sección y `/juegos/[id]` como su detalle: la jerarquía que el SPEC 01 dejó a medias.

Estado activo del nav, derivado de `usePathname()`:

| Link | Activo cuando |
|---|---|
| Inicio | `pathname === "/"` |
| Biblioteca | `pathname` empieza con `/juegos` o con `/jugar` |
| Salón de la Fama | `pathname === "/salon"` |
| Acerca de | `pathname === "/acerca-de"` |

El logo apunta a `/` (home), no a la Biblioteca.

## Modelo de datos

Sin estructuras nuevas de persistencia. Se agregan dos constantes mock a `lib/data.ts`, copiadas literal de los arrays inline de `home.jsx`:

```ts
// lib/data.ts — agregados

/** Fila del ticker "ÚLTIMAS PUNTUACIONES" del home. */
export type LiveScore = {
  player: string;   // "NEONFOX"
  game: string;     // "Caída" — texto libre, no un id de GAMES
  score: number;
  when: string;     // "hace 2 min" — literal, no se calcula
  color: Accent;    // clase neon-* de la columna del jugador
};

/** Fila de "TOP JUGADORES · HOY" del home. */
export type TopPlayer = {
  rank: number;
  player: string;
  score: number;
};

export const LIVE_SCORES: readonly LiveScore[];  // las 7 filas del prototipo
export const TOP_TODAY: readonly TopPlayer[];    // las 5 filas del prototipo
```

`Accent` ya existe (`"cyan" | "magenta" | "yellow" | "green"`) y cubre los cuatro valores que usa el ticker.

`game` es texto libre a propósito: el prototipo escribe `"Bloque Buster"`, `"Glotón"`, `"Rocas"` en capitalización de título, mientras `GAMES` los guarda en mayúsculas. No se cruza con `GAMES` ni se linkea.

El resto de los literales del home (los 4 features, los 3 stats, los 6 bullets y las 3 FAQ del bloque de precios) son **copy de UI**, no datos: viven inline en el componente que los renderiza, como en el prototipo.

Persistencia: sin cambios. `av_user` y `av_scores` siguen exactamente como los dejó el SPEC 01.

## Plan de implementación

1. **CSS** — apendizar a `app/globals.css` los dos bloques nuevos de `references/templates/home-about/styles.css`: líneas **930-1147** (HOME PAGE + ABOUT PAGE) y **1150-1725** (GAMEPAD + Theme variants + ACTIVITY + PRICING), verbatim, con los comentarios de sección incluidos. No tocar nada de lo que ya está. Verificación: `npm run build` pasa y las seis rutas actuales se ven idénticas a antes del append.

2. **`app/juegos/page.tsx`** — nueva. Mover ahí el contenido actual de `app/page.tsx` sin cambios (el `av-hero` con `flicker`/`blink` más `<Biblioteca />`) y agregar `metadata` con título "Biblioteca". `components/biblioteca.tsx` y `components/game-card.tsx` no se tocan. Verificación: `/juegos` muestra las 8 tarjetas y el chip PUZZLE sigue dejando solo CAÍDA.

3. **Reapuntar los links internos** — cambiar `/` por `/juegos` en los seis lugares que hoy apuntan a la Biblioteca:
   - `app/juegos/[id]/page.tsx` — "VOLVER AL VAULT"
   - `app/not-found.tsx` — "VOLVER AL VAULT"
   - `app/salon/page.tsx` — "VOLVER A LA BIBLIOTECA"
   - `components/reproductor.tsx` — "VOLVER AL VAULT" del modal de fin de juego
   - `components/auth-form.tsx` — los dos `router.push("/")` (login e invitado), que en el prototipo van a `biblioteca`

   Verificación: buscar `href="/"` en `app` y `components` solo devuelve el logo del nav (que ahora sí va al home).

4. **`lib/data.ts`** — agregar `LiveScore`, `TopPlayer`, `LIVE_SCORES` y `TOP_TODAY` con los valores exactos del prototipo. Verificación: `npx tsc --noEmit` pasa.

5. **`components/home/reveal.tsx`** — client. `<Reveal>` renderiza el elemento contenedor (`<section>` por default, configurable con `as`) con `className={"reveal " + className}` y le agrega `in` cuando un `IntersectionObserver` con `threshold: 0.12` lo intersecta, desobservándolo después. Observa **su propio ref**, no un `querySelectorAll` global — el prototipo barre el documento porque no tiene componentes. Los hijos se pasan como `children`, así que siguen renderizándose en el servidor.

6. **`components/home/floating-silhouettes.tsx`** — server, sin estado. Las 8 siluetas SVG (`s1` invasor cian, `s2` nave magenta, `s3` cangrejo amarillo, `s4` cruz verde, `s5` platillo violeta, `s6` moneda dorada, `s7` corazón rojo, `s8` D-pad celeste) dentro de `<div className="home-silos" aria-hidden="true">`. Cada `<rect>` se copia con sus coordenadas; `strokeWidth` en camelCase. Verificación: las 8 flotan en el hero con su color y su `animation-delay`.

7. **`components/home/feature-icon.tsx`** — server. Los 4 iconos pixel (`GAMEPAD`, `FREE`, `TROPHY`, `ROCKET`) con `fill="currentColor"`, tipados con una unión en lugar de un `string` libre. El `rect` de `width="0.5"` del gamepad y los `#0a0a0f` de recorte se copian tal cual.

8. **`components/home/mini-card.tsx`** — server. `<Link className="mini-card" href={"/juegos/" + game.id}>` con `mini-cover` → `cover-bg <game.cover>`, `mini-title` y `mini-cat`. Reemplaza el `<div onClick>` del prototipo: es un link real y no necesita ser client.

9. **`app/page.tsx` — hero + `// 01` features** — reemplazar la Biblioteca por el home. Hero: `home-hero` con `<FloatingSilhouettes />`, `hero-eyebrow` ("▸ INSERTA UNA MONEDA" + `blink`), el `home-title` de tres líneas (`line-1` / `line-2` / `line-3`), `home-sub`, los dos CTAs (`btn xl pulse` → `/juegos`, `btn xl magenta` → `/acceso`) y `hero-scroll`. Después, la sección `// 01` con `section-head` (kicker + `section-title` + `section-rule`) y el `feature-grid` de 4 tarjetas. `metadata` con el título del portal. Verificación: `/` muestra el hero a pantalla completa y las 4 feature cards con su color.

10. **`// 02` preview + stats** — `mini-rail` con `GAMES.slice(0, 6)` mapeado a `<MiniCard />`, el botón "VER TODOS LOS JUEGOS →" (`btn lg` → `/juegos`), y la sección `home-stats` con los 3 `stat-block` ("12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING"). Ambas envueltas en `<Reveal>`. Verificación: las 6 mini-tarjetas linkean al detalle correcto y las secciones aparecen al scrollear.

11. **`// 03` actividad en vivo** — `activity-grid` con dos `activity-card`: el `ticker` sobre `LIVE_SCORES` (filas `tick-row` con `animationDelay` de `i * 60` ms, montos con `toLocaleString("es-ES")`) y el `top-list` sobre `TOP_TODAY` (filas `top-row` con `top1`/`top2`/`top3`, `tp-rk` con `padStart(2, "0")`, y la `tp-fill` al `100 - i * 16` por ciento). El "VER SALÓN →" es un `<Link className="lb-link" href="/salon">`.

12. **`// 04` precios + CTA final** — `pricing-grid` con la `price-card` (label, nombre, `pc-amount` "$0 / SIEMPRE", `pc-tag`, los 6 bullets de `pc-list`, el CTA `btn xl pulse` a ancho completo → `/acceso`, `pc-foot` y el `pc-stamp` "FREE PLAY") y la `pricing-faq` con las 3 preguntas. Cierra con `home-final`: título, "INSERTAR MONEDA →" (`btn xl pulse final-cta` → `/juegos`) y `final-tag`. Verificación: el home entero renderiza sin `"use client"` en `app/page.tsx` — solo los `<Reveal>` son islas.

13. **`components/nav.tsx`** — pasar de 2 links a 4 (Inicio, Biblioteca, Salón de la Fama, Acerca de) en el nav y en el drawer, con la tabla de estado activo del mapa de rutas. El logo pasa a `/`. El link de Biblioteca pasa a `/juegos`. El resto del nav (coin-counter, botón de sesión, hamburguesa, backdrop) no se toca. Verificación: en cada una de las siete rutas se marca el link correcto, y en 480 px el drawer muestra los cuatro.

14. **`app/acerca-de/page.tsx`** — stub. `about-hero` con el `kicker` "▸ ACERCA DE", el `about-title` y un "PRÓXIMAMENTE" con `blink`, más un `btn lg` de vuelta a `/`. Solo clases que ya existen, cero CSS nuevo. Verificación: `/acerca-de` responde 200 y el link del nav no cae en el 404.

15. **Repaso final** — recorrer las siete rutas en desktop y en 480 px comparando el home contra `references/templates/home-about/home.jsx`: que no falte ninguna sección, que las siluetas floten, que el reveal dispare, que ningún link interno quede apuntando a la vieja Biblioteca en `/`, y que la consola no tenga errores ni warnings de hidratación.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni errores de tipos.
- [ ] `npx eslint app lib components` no reporta errores.
- [ ] Las siete rutas (`/`, `/juegos`, `/juegos/caida`, `/jugar/caida`, `/salon`, `/acceso`, `/acerca-de`) responden 200.
- [ ] `app/globals.css` contiene los 794 renglones nuevos y ningún selector duplicado: `@keyframes pulse`, `.divider`, `.fade-in`, `.slide-in`, `.spinner`, `.tw-label` y `.tw-section` siguen apareciendo una sola vez cada uno.
- [ ] `/` muestra el hero con el título de tres líneas, los dos CTAs y las 8 siluetas flotantes.
- [ ] `/` muestra las siete secciones en orden: hero, `// 01`, `// 02`, stats, `// 03`, `// 04`, CTA final.
- [ ] Las 4 feature cards muestran su icono pixel y cada una su color (cian, amarillo, magenta, verde).
- [ ] El `mini-rail` muestra 6 mini-tarjetas y un click en cada una lleva a `/juegos/<id>` del juego correcto.
- [ ] Las secciones con `reveal` arrancan invisibles y aparecen al entrar en viewport; una vez visibles, no vuelven a desaparecer al scrollear hacia atrás.
- [ ] El ticker muestra las 7 filas con los montos formateados en `es-ES` y el color de acento por jugador.
- [ ] El `top-list` muestra 5 filas, con las tres primeras destacadas y la barra decreciendo del 100 % al 36 %.
- [ ] "VER SALÓN →" navega a `/salon`; "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" a `/juegos`; "CREAR CUENTA" y "EMPEZAR GRATIS →" a `/acceso`.
- [ ] `app/page.tsx` no tiene `"use client"`: la única isla del home es `<Reveal>`.
- [ ] `/juegos` muestra la Biblioteca completa: 8 tarjetas, el chip PUZZLE deja solo CAÍDA, buscar "zzz" muestra "NO HAY RESULTADOS" y el tilt de las tarjetas sigue funcionando.
- [ ] Buscar `href="/"` en `app` y `components` solo devuelve el logo del nav.
- [ ] "VOLVER AL VAULT" en `/juegos/caida`, en el 404 y en el modal de fin de juego lleva a `/juegos`, no al home.
- [ ] Entrar desde `/acceso` (con usuario o como invitado) redirige a `/juegos`.
- [ ] El nav muestra los 4 links en desktop y los 4 más el de sesión en el drawer mobile.
- [ ] En `/` el link activo es "Inicio"; en `/juegos`, `/juegos/caida` y `/jugar/caida` es "Biblioteca"; en `/salon` es "Salón de la Fama"; en `/acerca-de` es "Acerca de".
- [ ] El logo del nav lleva a `/`.
- [ ] `/acerca-de` muestra el stub "PRÓXIMAMENTE" y no el 404.
- [ ] `/estilos` sigue existiendo y renderizando.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna de las siete rutas.
- [ ] En un viewport de 480 px el home no genera scroll horizontal y el `feature-grid`, el `mini-rail`, el `activity-grid` y el `pricing-grid` colapsan a una o dos columnas.

## Decisiones

- **Sí:** la Biblioteca se muda a `/juegos`. Reutiliza el segmento que `/juegos/[id]` ya ocupaba y deja la sección con índice y detalle bajo el mismo prefijo. `/biblioteca` habría dejado a `/juegos/[id]` sin índice.
- **No:** dejar la Biblioteca en `/` y mandar el home a `/inicio`. El prototipo nuevo pone el logo y el link "Inicio" en la raíz; esconder la landing contradice su razón de existir.
- **No:** redirect de compatibilidad de `/` a `/juegos`. `/` ahora es una pantalla real, no un alias.
- **Sí:** los CTAs son `<Link>` con clases de botón, no `<button>` + `router.push()`. Da links reales (prefetch, click con la rueda, indexables) y deja el home entero como Server Component salvo el `<Reveal>`.
- **Sí:** `<Reveal>` observa su propio ref. El `querySelectorAll(".reveal")` del prototipo existe porque ahí no hay componentes; replicarlo en React sería pelear con el ciclo de vida y romper si dos pantallas montan a la vez.
- **Sí:** `LIVE_SCORES` y `TOP_TODAY` como constantes mock en `lib/data.ts`, copiadas literal. Quedan junto al resto del mock y con tipos, sin inventar lógica.
- **No:** derivarlas de `GAMES` + `seededScores`. Cambiaría los números y los nombres que muestra el prototipo, que es la fuente de verdad visual.
- **No:** leer `av_scores` para el bloque de actividad. El SPEC 01 lo dejó explícitamente fuera de alcance y abre orden, deduplicación y estado vacío.
- **Sí:** el stat dice "12+" aunque `GAMES` tenga 8. Es copy de marketing del prototipo; corregirlo es rediseñar, y el spec porta.
- **Sí:** se copia el bloque GAMEPAD completo (~470 renglones) aunque ningún componente lo use. `app/globals.css` queda espejo exacto de `references/templates/home-about/styles.css`, que es lo que hace verificable el criterio del append y evita tener que volver a diffear cuando aparezca el componente.
- **Sí:** el `transitionDelay` inline de las feature cards y los stat blocks se copia igual, aunque en el prototipo no tenga efecto (esos elementos no transicionan `opacity`). Fidelidad al porte; si molesta, es una limpieza de otro spec.
- **Sí:** `/acerca-de` como stub "PRÓXIMAMENTE". El nav del prototipo trae los cuatro links; dejar uno cayendo en el 404 es un bug visible, y esconderlo se desvía del prototipo.
- **No:** implementar Acerca de y el formulario de contacto acá. Son otra pantalla completa con estado de formulario, validación y la terminal de éxito: es el SPEC 03.
- **Sí:** las siluetas y los iconos como componentes server sin estado. Son SVG puro sin interacción; no hay razón para que sean client.
- **Sí:** reutilizar las clases del CSS portado en lugar de utilidades de Tailwind, igual que el SPEC 01.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `.reveal { opacity: 0 }` deja seis de las siete secciones invisibles si el JS no corre (crawler sin JS, error de hidratación) | El hero, que es el contenido crítico, **no** lleva `reveal`. El `IntersectionObserver` se monta en el `useEffect` del `<Reveal>`, así que dispara en el primer paint; si el navegador no lo soporta, `<Reveal>` agrega `in` de entrada. |
| El append de CSS pisa una regla existente y rompe una pantalla del SPEC 01 | Ya está verificado: el diff contra `references/templates/styles.css` es 794 líneas agregadas y 0 modificadas, y contra `app/globals.css` no hay ni un selector ni un `@keyframes` en común. El paso 1 se verifica antes de escribir un solo componente. |
| Queda un link interno apuntando a `/` esperando la Biblioteca y el usuario cae en la landing | El paso 3 los enumera uno por uno y el criterio de aceptación es una búsqueda que solo debe devolver el logo del nav. |
| Las 8 siluetas más las scanlines y el grano del fondo hunden el frame rate en mobile | Son SVG con `animation: float` sobre `transform` (compuesto en GPU) y el contenedor tiene `pointer-events: none`. Si aparece jank medible, se recorta la cantidad en mobile por media query — pero no se anticipa. |
| Portar los SVG rect por rect y equivocar una coordenada deja una silueta deformada | Se comparan contra el prototipo abierto al lado en el paso 15. Son formas reconocibles: un error de coordenada se ve. |
| `Accent` no cubre algún color del ticker y hay que ensanchar el tipo | Verificado: los cuatro valores que usa `home.jsx` (`magenta`, `yellow`, `green`, `cyan`) son exactamente los de `Accent`. |

## Lo que **no** entra en esta spec

- La pantalla Acerca de real ni el formulario de contacto con la terminal de éxito.
- El componente gamepad, aunque su CSS se copie.
- El bloque de actividad alimentado por `av_scores`.
- Cualquier juego jugable, backend o autenticación real.
- Rediseño de la Biblioteca, el Detalle, el Reproductor, el Salón o el Acceso.
- Tests automatizados. El repo no tiene test runner y este spec no instala uno.

Cada una de esas, si aparece, va en su propia spec.
