# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Comandos

```bash
npm run dev      # next dev (Turbopack); además reescribe el bloque nextjs-agent-rules en AGENTS.md
npm run build    # next build — el único chequeo de tipos real (tsconfig tiene noEmit)
npm start        # sirve el build de producción
npm run lint     # eslint (flat config, sin argumentos — lintea todo el repo)
npx tsc --noEmit # chequeo de tipos sin build completo
```

No hay test runner instalado: no existe script `test` ni dependencia de vitest/jest. No inventes uno; si hacen falta tests, es una decisión a plantearle antes al usuario.

`npm run lint` hoy reporta ~10 errores preexistentes en `templates/` (`react/jsx-no-undef` por `React`, `Nav`, `Library`, …). Esos archivos son un prototipo por CDN donde React y todos los componentes son globals: los errores son esperados, no regresiones. Al verificar tu propio trabajo, acotá el lint al código real (`npx eslint app`).

## Estructura del repo

La raíz de git es `D:\Curso_Claude` (el curso completo), no este directorio. Este proyecto es el subdirectorio `05-arcade-vault`; los skills `spec` / `spec-impl` viven a nivel del curso, en `../.claude/skills/`.

## Arquitectura

Arcade Vault es un portal de arcade retro (jugar online y competir por puntaje). Se está construyendo con Next.js 16 App Router + React 19 + Tailwind CSS v4, y `app/` **sigue siendo el scaffold intacto de create-next-app** (`app/layout.tsx`, `app/page.tsx`, `app/globals.css`). Todavía no existe nada del producto en `app/`.

### `templates/` es la referencia de diseño, no código que se compila

`templates/` contiene un prototipo completo y funcional de la app pensada, como página HTML standalone: `Arcade Vault.html` carga React 18 UMD + Babel desde unpkg y trae cada `.jsx` con `<script type="text/babel">`. No hay bundler, ni imports, ni módulos: cada archivo define globals y los publica con `window.Nav = Nav`, y aliasea los hooks para evitar redeclaraciones (`useState: useStateB`, `useStateP`, …).

Tratalo como fuente de verdad del comportamiento y del diseño visual al portar pantallas a `app/`. No lo conectes al build de Next.

Estructura del prototipo:

| Archivo | Rol |
|---|---|
| `data.jsx` | Datos mock: `GAMES` (8 juegos, cada uno con `id`, `title`, `cat`, `cover`, `color`, `best`, `plays`), la lista de filtros `CATS`, `PLAYERS`, y `seededScores(seed, count)` — un LCG determinístico que fabrica leaderboards |
| `app.jsx` | Raíz: routing, sesión y persistencia de puntajes |
| `nav.jsx` | Nav superior + drawer mobile |
| `biblioteca.jsx` | Grilla de biblioteca (tarjetas con tilt por mouse) y filtro por categoría |
| `detalle.jsx` | Detalle del juego: descripción, stats, top-10, "JUGAR AHORA" |
| `reproductor.jsx` | Reproductor: HUD (puntaje/vidas/nivel), pausa, game-over, guardar puntaje. **No hay ningún juego implementado**: el puntaje es un `setInterval` que suma un delta aleatorio |
| `salon.jsx` | Salón de la Fama: tabs por juego, podio y tabla |
| `styles.css` | Todo el sistema visual (950 líneas) |

Convenciones del prototipo que conviene preservar al portar:

- **Routing** es un objeto de estado, no rutas: `{ name: "biblioteca" }`, `{ name: "detalle", id }`, `{ name: "player", id }`, `{ name: "auth" }`, `{ name: "salon" }`. `app.jsx` lo serializa como JSON en `location.hash` y cada pantalla recibe una prop `navigate(route)`. Portarlo al App Router implica convertirlos en rutas reales (`/`, `/juegos/[id]`, `/jugar/[id]`, …) — es una decisión de diseño, así que confirmá la forma de las URLs antes de inventarla.
- **Persistencia** solo en `localStorage`: `av_user` (`{ name }`, en mayúsculas, ≤10 caracteres) y `av_scores` (array append-only de `{ ...entry, at: Date.now() }`). El auth es falso: cualquier usuario entra.
- **El idioma de la UI es español** (nombres de pantallas, labels, textos, `toLocaleString("es-ES")`). Mantenelo.
- **El sistema visual** vive en `templates/styles.css` como custom properties de CSS sobre `:root`: `--bg`/`--bg-2`/`--bg-3`, `--ink`/`--ink-dim`/`--ink-faint`, acentos neón `--cyan #00f5ff`, `--magenta #ff006e`, `--yellow #f5ff00`, `--green #00ff88`, podio `--gold`/`--silver`/`--bronze`, y dos fuentes: `--pixel` (Press Start 2P) y `--mono` (JetBrains Mono). Las portadas de los juegos son arte en CSS puro (`.cover-bricks`, `.cover-tetro`, `.cover-snake`, …), sin assets de imagen. Los nombres de clases son estilo BEM y las pantallas contenedoras llevan prefijo `av-`. Ojo con el desajuste a resolver: el prototipo es clases CSS sobre `:root`, mientras `app/globals.css` es Tailwind v4 con `@theme inline` y fuentes Geist.

## Método de trabajo: spec-driven

Según `README.md`, el proyecto sigue spec-driven design con los skills `/spec` y `/spec-impl` (de `Klerith/fernando-skills`, instalados en la raíz del curso).

- `/spec <descripción>` entrevista al usuario y luego escribe `specs/NN-slug.md` en estado `Draft`. No escribe código.
- `/spec-impl NN-slug` se niega a correr salvo que el estado del spec signifique **Approved** (eso lo cambia el humano, nunca el agente); después crea la rama `spec-NN-slug` e implementa paso a paso, pausando para revisar el diff y sin commitear por su cuenta.

`specs/` todavía no existe: la primera corrida de `/spec` lo crea junto con `specs/.spec-config.yml`. Para cualquier feature sustancial acá, usá `/spec` antes de escribir código.

## Notas de Next.js 16

`AGENTS.md` (autogenerado, no lo borres — `next dev` lo vuelve a agregar) indica leer `node_modules/next/dist/docs/` antes de escribir código. Dos cosas ya visibles en el scaffold que difieren de versiones anteriores de Next:

- Las props de páginas y layouts vienen de tipos globales generados, no de interfaces escritas a mano: `RootLayout({ children }: LayoutProps<"/">)`. Los tipos se generan en `.next/types/` y entran vía `tsconfig.include`, así que solo existen después de una corrida de `dev`/`build`.
- Tailwind v4: no hay `tailwind.config.js`. La configuración es del lado del CSS — `@import "tailwindcss"` más `@theme inline` en `app/globals.css`, con `@tailwindcss/postcss` como único plugin de PostCSS.
