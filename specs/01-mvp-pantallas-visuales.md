# SPEC 01 — MVP visual: las cinco pantallas del prototipo en el App Router

> **Status:** Implementado
> **Depends on:** —
> **Date:** 2026-08-24
> **Objective:** Portar las cinco pantallas del prototipo de `references/templates/` a rutas reales de Next.js 16, reproduciendo el diseño y el comportamiento de UI sin implementar ningún juego.

## Por qué existe este spec

`app/` es todavía el scaffold de `create-next-app`: no hay nada del producto. El sistema visual, en cambio, ya está portado — `app/globals.css` (1019 líneas) cubre **todos** los selectores de `references/templates/styles.css` (el diff de selectores es vacío) y `app/layout.tsx` ya carga Press Start 2P / JetBrains Mono y las capas `av-bg` / `av-noise`.

Lo que falta es la estructura de React: componentes, rutas y estado. Este spec construye exactamente eso reutilizando las clases CSS existentes. **No se escribe CSS nuevo** salvo que falte una clase, y en ese caso se copia tal cual desde el prototipo.

El prototipo no tiene rutas (serializa `{ name, id }` en `location.hash`) ni módulos (cada `.jsx` publica globals en `window`). Traducir eso al App Router es la decisión de diseño central de este spec.

## Alcance

**Dentro:**

- Las cinco pantallas del prototipo como rutas reales: biblioteca, detalle de juego, reproductor, salón de la fama y acceso.
- El nav superior con drawer mobile y el footer, visibles en las cinco rutas.
- Los datos mock de `references/templates/data.jsx` portados a TypeScript con tipos.
- La sesión falsa y el guardado de puntajes en `localStorage`, con las mismas claves que el prototipo (`av_user`, `av_scores`).
- La simulación de puntaje del reproductor (`setInterval` con delta aleatorio), la pausa y el modal de fin de juego.
- Una pantalla 404 propia para IDs de juego inexistentes.
- Diseño responsive: el CSS ya trae los breakpoints del prototipo, hay que verificarlos en cada ruta.

**Fuera de alcance (para specs futuras):**

- Cualquier juego jugable. El reproductor es una maqueta con puntaje simulado.
- Backend, base de datos o autenticación real. El login acepta cualquier credencial.
- Leer `av_scores` para alimentar rankings: se escribe y no se lee, igual que el prototipo.
- Filtros de biblioteca reflejados en la URL (`?cat=`, `?q=`): el estado es local.
- Assets de imagen para las portadas. Siguen siendo arte en CSS puro.
- Tests automatizados. No hay test runner en el repo y no se instala uno acá.
- Modificar o borrar `app/estilos/page.tsx`. Queda como está, accesible por URL y fuera del nav.

## Mapa de rutas

| Ruta | Pantalla | Origen en el prototipo |
|---|---|---|
| `/` | Biblioteca | `{ name: "biblioteca" }` |
| `/juegos/[id]` | Detalle del juego | `{ name: "detalle", id }` |
| `/jugar/[id]` | Reproductor | `{ name: "player", id }` |
| `/salon` | Salón de la Fama | `{ name: "salon" }` |
| `/acceso` | Acceso | `{ name: "auth" }` |

El `id` es el mismo slug de `GAMES` (`bloque-buster`, `caida`, `serpentina`, …).

## Modelo de datos

No hay datos nuevos: se porta el modelo del prototipo a TypeScript.

```ts
// lib/data.ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type Accent = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;        // slug de la URL
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;     // clase CSS: "cover-bricks", "cover-tetro", …
  color: Accent;
  best: number;
  plays: string;
};

export type ScoreRow = { rank: number; name: string; score: number; date: string };

export const GAMES: Game[];            // los 8 juegos, sin cambios
export const CATS: readonly string[];  // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
export const PLAYERS: readonly string[];
export function seededScores(seed: number, count?: number): ScoreRow[];
```

`seededScores` se copia **carácter por carácter** desde el prototipo (LCG `(s * 9301 + 49297) % 233280`). Las semillas también se preservan para que los números coincidan con el prototipo:

- Detalle: `seededScores(id.length * 17 + 3, 10)`
- Salón: `seededScores(tabId.length * 23 + 7, 12)`

Persistencia en `localStorage`, idéntica al prototipo:

```ts
// lib/session.tsx
type User = { name: string };  // clave "av_user"
type SavedScore = { game: string; score: number; name: string; at: number };  // clave "av_scores"
```

`av_scores` es un array append-only. Nada lo lee en este spec.

Convenciones:

- El idioma de la UI es español. Todos los números con `toLocaleString("es-ES")`.
- El nombre de usuario va en mayúsculas y truncado a 10 caracteres (`.toUpperCase().slice(0, 10)`).
- Los componentes interactivos llevan `"use client"`. Las páginas son Server Components que renderizan el marco y delegan la interactividad.
- Imports por alias: `@/lib/data`, `@/components/nav` (el `tsconfig` ya mapea `@/*` a la raíz).
- Props de páginas desde los tipos globales generados: `PageProps<"/juegos/[id]">`, con `params` como `Promise` (`const { id } = await params`).

## Plan de implementación

1. **`lib/data.ts`** — portar `references/templates/data.jsx`: tipos, `GAMES`, `CATS`, `PLAYERS`, `seededScores`. Sin `window.*`, con `export`. Verificación: `npx tsc --noEmit` pasa.
2. **`lib/session.tsx`** — `SessionProvider` (client) con `useSession()`: `user`, `signIn(name)`, `signOut()`, `saveScore(entry)`. Lee `av_user` en un `useEffect` (nunca durante el render, para no romper la hidratación) y escribe en `localStorage` en cada cambio. Todos los accesos van envueltos en `try/catch`.
3. **`components/site-footer.tsx`** — footer con el texto exacto del prototipo (`© 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0`), con clases del sistema visual en lugar de estilos inline.
4. **`components/nav.tsx`** — client. Nav (`av-nav`: logo, links, `coin-counter` con `CRÉDITOS · 03`, botón de sesión, hamburguesa) y drawer mobile (`av-mobile-backdrop` / `av-mobile-panel`). Los links son `<Link>`; el estado activo sale de `usePathname()` (`/` activo también en `/juegos/*` y `/jugar/*`). El botón de sesión muestra `NOMBRE ▾` y hace `signOut()` si hay usuario, o linkea a `/acceso` si no.
5. **Cablear `app/layout.tsx`** — envolver con `SessionProvider`, insertar `<Nav />`, `<main className="av-main">{children}</main>` y `<SiteFooter />`. No tocar las fuentes ni las capas `av-bg` / `av-noise`. Verificación: `/estilos` sigue rindiendo igual, ahora con el nav real encima.
6. **`components/game-card.tsx`** — client. Tarjeta con portada (`cover-bg` + la clase de `game.cover`), etiqueta de categoría, título, descripción corta, `score-badge` con `best` y botón JUGAR. El tilt por mouse escribe `el.style.transform` como en el prototipo y lo limpia en `onMouseLeave`. Toda la tarjeta navega a `/juegos/[id]`.
7. **`app/page.tsx` + `components/biblioteca.tsx`** — reemplazar el scaffold de `create-next-app`. La página (server) renderiza el hero (`av-hero` con `flicker` y `blink`); el componente client maneja buscador (`av-search`), chips de categoría (`av-chips`) y la grilla (`av-grid`), con el mismo filtro por categoría más título y el mismo estado vacío ("NO HAY RESULTADOS"). Verificación: el chip PUZZLE deja 1 tarjeta; buscar "zzz" muestra el estado vacío.
8. **`components/leaderboard.tsx`** — el top-10 del detalle (`leaderboard`, filas `lb-row` con `top1` / `top2` / `top3`). Recibe `rows: ScoreRow[]`, sin estado.
9. **`app/juegos/[id]/page.tsx`** — server. Busca el juego en `GAMES`; si no existe, `notFound()`. Renderiza `av-detail`: portada grande, tags, descripción larga, `stat-strip` (partidas / mejor global / dificultad) y las acciones (`JUGAR AHORA` → `/jugar/[id]`, `VOLVER AL VAULT` → `/`), más el `Leaderboard`. Añade `generateMetadata` con el título del juego. Verificación: `/juegos/caida` muestra CAÍDA con su top-10.
10. **`app/not-found.tsx`** — pantalla 404 con la estética del vault: título en `pixel`, mensaje y botón de vuelta a `/`. Reutiliza clases existentes, sin CSS nuevo. Verificación: `/juegos/inexistente` la muestra.
11. **`app/jugar/[id]/page.tsx` + `components/reproductor.tsx`** — la página (server) resuelve el juego o hace `notFound()`. El componente client porta `reproductor.jsx`: HUD (`player-hud` con jugador / puntuación / vidas / nivel), botones PAUSA · FIN · SALIR, el CRT (`crt`, `crt-screen`, `game-arena` con `grid-floor`, enemigos y nave, `crt-bottom`) y el overlay de pausa. El puntaje sube con el `setInterval` de 220 ms y el nivel cada ~2500 puntos. El nombre por defecto es el del usuario o `INVITADO`. Verificación: el puntaje sube solo y PAUSA lo congela.
12. **Modal de fin de juego** — dentro de `components/reproductor.tsx`: `modal-bd` / `modal` con puntuación final, input de iniciales (mayúsculas, 10 caracteres), botón GUARDAR PUNTUACIÓN que llama a `saveScore` y muestra `toast-saved`, y las acciones JUGAR DE NUEVO (resetea el estado) y VOLVER AL VAULT. Verificación: tras guardar, `localStorage.av_scores` tiene una entrada nueva con `at`.
13. **`app/salon/page.tsx` + `components/salon.tsx`** — la página (server) renderiza el encabezado (`hall-head`); el componente client maneja las tabs por juego (`hall-tabs`), el podio (`podium` con `gold` / `silver` / `bronze`) y la tabla (`hall-table`, filas `tr` con `animationDelay` escalonado). Si hay usuario, agrega las filas `you-label` y `you` con el rango y puntaje fabricados del prototipo (`8 + (id.length % 4)`, `rows[5].score - 2400`). Cierra con el botón de vuelta a la biblioteca. Verificación: cambiar de tab cambia el podio; sin sesión no aparece la fila amarilla.
14. **`app/acceso/page.tsx` + `components/auth-form.tsx`** — `auth-card` con tabs INICIAR SESIÓN / CREAR CUENTA (la de crear cuenta agrega el campo de correo con `slide-in`), campos de usuario y contraseña, botón principal, `JUGAR COMO INVITADO`, divisor `O CONTINÚA CON` y los dos botones sociales (decorativos, sin acción). Al enviar: `signIn(usuario || "PLAYER1")` y redirección a `/` con `useRouter()`. Verificación: entrar con cualquier usuario deja el nombre en el nav y sobrevive a un recargado.
15. **Repaso final** — recorrer las cinco rutas comparándolas con `references/templates/Arcade Vault.html` abierto al lado, en desktop y en mobile: que no falte ninguna clase, que el drawer abra y cierre, que no haya errores ni warnings de hidratación en consola.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni errores de tipos.
- [ ] `npx eslint app lib components` no reporta errores.
- [ ] Las cinco rutas (`/`, `/juegos/caida`, `/jugar/caida`, `/salon`, `/acceso`) responden 200 y muestran su pantalla.
- [ ] `app/page.tsx` ya no contiene nada del scaffold de `create-next-app` (ni logo de Next, ni links a Vercel).
- [ ] El nav y el footer se ven en las cinco rutas.
- [ ] El nav marca "Biblioteca" como activo en `/`, `/juegos/[id]` y `/jugar/[id]`, y "Salón de la Fama" en `/salon`.
- [ ] En un viewport de 480 px la hamburguesa abre el drawer y un click en el backdrop lo cierra.
- [ ] La biblioteca muestra las 8 tarjetas; el chip PUZZLE deja solo CAÍDA; buscar "zzz" muestra "NO HAY RESULTADOS".
- [ ] Pasar el mouse por una tarjeta la inclina, y al salir vuelve a su posición.
- [ ] Un click en una tarjeta lleva a `/juegos/<id>` del juego correcto.
- [ ] `/juegos/caida` muestra título, descripción larga, los tres stats y un top-10 de 10 filas con las tres primeras destacadas.
- [ ] Los puntajes de `/juegos/caida` son los mismos que muestra el prototipo para ese juego (misma semilla).
- [ ] `/juegos/inexistente` y `/jugar/inexistente` muestran la pantalla 404 propia, no una página en blanco.
- [ ] En `/jugar/caida` el puntaje sube solo, PAUSA lo congela y muestra el overlay "EN PAUSA", y REANUDAR lo descongela.
- [ ] FIN abre el modal con la puntuación final; GUARDAR PUNTUACIÓN muestra "▸ PUNTUACIÓN GUARDADA_" y agrega una entrada a `av_scores`.
- [ ] JUGAR DE NUEVO deja el puntaje en 0, las vidas en 3 y el nivel en 01.
- [ ] En `/salon` las tabs cambian el podio y la tabla; el podio muestra 02 · 01 · 03 con el oro al centro.
- [ ] Con sesión iniciada, `/salon` muestra las filas "TU MEJOR MARCA" y la fila amarilla con el nombre del usuario; sin sesión no aparecen.
- [ ] Entrar desde `/acceso` con cualquier usuario y contraseña redirige a `/` y el nav muestra el nombre en mayúsculas (máximo 10 caracteres).
- [ ] Recargar la página mantiene la sesión; el botón del nav la cierra y vuelve a mostrar "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" navega a `/` sin dejar sesión iniciada.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna de las cinco rutas.
- [ ] `app/globals.css` no tiene reglas nuevas, salvo clases faltantes copiadas del prototipo y documentadas en el commit.
- [ ] `app/estilos/page.tsx` sigue existiendo y renderizando.

## Decisiones

- **Sí:** rutas en español (`/juegos/[id]`, `/jugar/[id]`, `/salon`, `/acceso`). Toda la UI está en español; paths en inglés serían una inconsistencia gratuita.
- **No:** conservar el routing por `location.hash`. Pierde SSR, metadata por juego y links compartibles, que es justo lo que aporta el App Router.
- **Sí:** `localStorage` con las claves `av_user` y `av_scores` del prototipo, y auth falso. Mantiene compatibilidad con lo que ya guardó el prototipo y evita backend en un MVP visual.
- **No:** sesión solo en memoria. Perder el login al recargar haría imposible verificar la fila del usuario en el salón.
- **Sí:** mantener la simulación de puntaje con `setInterval`. Es la única forma de que el HUD, la pausa y el game-over se vean como en el prototipo sin escribir un juego.
- **No:** leer `av_scores` para alimentar los rankings. El prototipo no lo hace, y hacerlo abre preguntas de merge, deduplicación y orden que corresponden a otra spec.
- **Sí:** estado local para el buscador y los chips. Reflejarlos en la URL agrega `searchParams` y `router.replace` sin beneficio visible en un MVP.
- **Sí:** `notFound()` con `app/not-found.tsx` propio. El `return null` del prototipo deja una página en blanco, que con URLs reales es un bug visible.
- **Sí:** nav y footer en `app/layout.tsx`, visibles en las cinco rutas, como en el prototipo.
- **Sí:** reutilizar las clases de `app/globals.css` en lugar de escribir utilidades de Tailwind. El CSS ya cubre el 100% de los selectores del prototipo; duplicarlo en utilidades sería mantener dos sistemas.
- **Sí:** páginas como Server Components con islas client. Las semillas de `seededScores` son deterministas, así que las tablas se pueden renderizar en el servidor sin desincronizarse.
- **No:** borrar `app/estilos/page.tsx`. Sirve de referencia visual y no cuesta nada mantenerla; queda fuera del nav.
- **No:** instalar un test runner. El repo no tiene ninguno y la verificación de este spec es visual más `build` y `lint`.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| `Math.random()` y `Date.now()` en el reproductor rompen la hidratación si corren en el servidor | El reproductor es `"use client"` y el puntaje arranca en 0; los valores aleatorios solo se generan dentro de `useEffect`. |
| Leer `localStorage` durante el render del provider lanza en el servidor y desincroniza el nav | La lectura de `av_user` va en un `useEffect`; el primer render es siempre "sin sesión". |
| Falta alguna clase CSS y una pantalla queda a medio estilar | Antes de cada pantalla, verificar sus selectores contra `references/templates/styles.css`; si falta, copiar la regla tal cual y documentarlo. |
| El porte se desvía a rediseñar en lugar de portar | El prototipo es la fuente de verdad visual. Cualquier mejora de diseño va a otra spec. |
| `localStorage` deshabilitado (modo privado) | Todos los accesos en `try/catch`; la app funciona igual, solo no persiste. |

## Lo que **no** entra en esta spec

- Ningún juego jugable. El reproductor es una maqueta.
- Backend, base de datos, autenticación o registro real.
- Rankings alimentados por los puntajes guardados.
- Assets de imagen para las portadas.
- Tests automatizados.
- Rediseño de cualquier pantalla del prototipo.

Cada una de esas, si aparece, va en su propia spec.
