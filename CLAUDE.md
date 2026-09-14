# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Comandos

```bash
npm run dev       # next dev (Turbopack por defecto en Next 16); reescribe el bloque de AGENTS.md
npm run build     # next build — el único chequeo de tipos real (tsconfig tiene noEmit)
npm start         # sirve el build de producción
npm run lint      # eslint (flat config, sin argumentos — lintea todo el repo, references/ incluido)
npm run db:types  # regenera lib/database.types.ts desde el proyecto Supabase (necesita login del CLI)
npx tsc --noEmit  # chequeo de tipos sin build completo
```

No hay test runner instalado: no existe script `test` ni dependencia de vitest/jest. No inventes uno; si hacen falta tests, es una decisión a plantearle antes al usuario. La verificación de una pantalla se hace en el browser con el MCP de Playwright.

`npm run lint` reporta ~18 errores y ~15 warnings **preexistentes**, todos en `references/`: son los `.jsx` del prototipo por CDN, donde React y cada componente son globals. Son esperados, no regresiones. Para verificar tu propio trabajo, acotá el lint al código real: `npx eslint app components lib`.

### Hook de formato

`.claude/settings.json` registra un `PostToolUse` sobre `Write|Edit` que corre `.claude/hooks/format-lint.sh`: pasa el archivo por Prettier y, si es JS/TS, por `eslint --fix`. Lo que ESLint no puede autocorregir vuelve como `additionalContext` para que lo arregles. Nunca falla duro. Consecuencia práctica: **no formatees a mano** — el hook lo hace, y un archivo puede verse distinto en disco inmediatamente después de que lo escribiste.

## Estructura del repo

La raíz de git es `D:\Curso_Claude` (el curso completo), no este directorio. Este proyecto es el subdirectorio `05-arcade-vault`. Los skills `spec` / `spec-impl` / `spec-juego` existen tanto a nivel del curso (`../.claude/skills/`) como acá (`.claude/skills/`).

Las capturas de Playwright (MCP) van a `.playwright-screenshots/` — el servidor MCP está configurado con `--output-dir` apuntando ahí y el directorio está en `.gitignore`. Pasá solo el nombre del archivo, no una ruta.

`.mcp.json` declara el MCP de Supabase (HTTP, apuntando al project ref del proyecto). Sirve para inspeccionar la base, correr SQL y leer advisors sin salir de la sesión.

### `references/` es referencia, nunca se compila

Está en `.prettierignore` y fuera del alcance de cualquier cambio. Tres cosas viven ahí:

| Carpeta                     | Qué es                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `references/templates/`     | El prototipo original: `Arcade Vault.html` carga React 18 UMD + Babel desde unpkg y trae cada `.jsx` con `<script type="text/babel">`. Sin bundler ni módulos: cada archivo define globals (`window.Nav = Nav`) y aliasea hooks para evitar redeclaraciones (`useStateB`, `useStateP`, …). `references/templates/home-about/` es la segunda tanda (home + acerca-de) y su `styles.css` es un superset exacto del otro. |
| `references/started-games/` | Los juegos originales de los que salen los motores: `02-asteroids`, `03-tetris`, `04-arkanoid`. Canvas 2D puro, sin dependencias, ya balanceados.                                                                                                                                                                                                                                                                      |
| `references/source-assets/` | Assets crudos — hoy el atlas de frutas de Snake y su `sprites.js` de coordenadas. Lo que se usa se copia a `public/`.                                                                                                                                                                                                                                                                                                  |

El prototipo es **fuente de verdad del diseño visual y del comportamiento**, no código a conectar al build.

## Arquitectura

Arcade Vault es un portal de arcade retro: jugar online y competir por puntaje. Next.js 16 App Router + React 19 + Tailwind CSS v4 + Supabase (Postgres). Doce juegos en el catálogo; **cuatro tienen motor real** y los otros ocho siguen simulados (el puntaje es un `setInterval` que suma un delta aleatorio).

### Rutas

| Ruta              | Qué es                                                    | Render                                                         |
| ----------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| `/`               | Home / landing de siete secciones                         | Server, `force-dynamic` (la rail de preview sale del catálogo) |
| `/juegos`         | Biblioteca: grilla + filtro por categoría                 | Server + isla `<Biblioteca>`                                   |
| `/juegos/[id]`    | Detalle: descripción, stats, top-10                       | Server completo, `force-dynamic`                               |
| `/jugar/[id]`     | Reproductor: CRT, HUD, pausa, guardado                    | Server → isla `<Reproductor>`                                  |
| `/salon`          | Salón de la Fama: tabs por juego, podio, tabla            | Server (una consulta) + isla `<Salon>`                         |
| `/acceso`         | Login falso (alias en localStorage)                       | Isla `<AuthForm>`                                              |
| `/acerca-de`      | Misión + formulario de contacto (Resend)                  | Server + isla `<ContactForm>`                                  |
| `/estilos`        | Referencia del tema. Borrable sin afectar nada.           | Server                                                         |
| `/supabase-check` | Autodiagnóstico de la conexión. Fuera del nav, `noindex`. | Server, `force-dynamic`                                        |

Puedes ver en 'references/implemented-games.md' la lista de juegos implementados cuando necesites implementar un juego.

Todo es Server Component por defecto. Las únicas islas `"use client"` son `nav`, `biblioteca`, `game-card`, `reproductor`, `game-canvas`, `salon`, `auth-form`, `about/contact-form`, `home/reveal` y `supabase-check/self-test`.

Las páginas que leen `scores` van con `export const dynamic = "force-dynamic"`: cachearlas mostraría el ranking anterior justo después de que alguien lo cambie, y un juego nuevo tiene que aparecer sin un deploy.

Las props de páginas y layouts vienen de **tipos globales generados**, no de interfaces a mano: `LayoutProps<"/">`, `PageProps<"/juegos/[id]">`. Se generan en `.next/types/` y solo existen después de una corrida de `dev`/`build`.

### Datos: qué vive en Postgres y qué no

```
app/**  →  lib/catalog.ts  ─┐
           lib/scores.ts   ─┴→ lib/supabase/server.ts → Postgres (games, scores)
                                 ↑ vistas: game_stats, leaderboard_entries

app/jugar/actions.ts (Server Action) → insert en scores  (única escritura de la app)
```

- **`games`** — el catálogo. `id` es el slug de la URL. `cat` y `color` tienen CHECK constraints que TypeScript no ve: `lib/catalog.ts` estrecha `string` → `Category` / `Accent` **una sola vez**, y nadie más toca ese tipo. `best` y `plays` **no son columnas**: salen de la vista `game_stats`, derivada de `scores`.
- **`scores`** — append-only. La vista `leaderboard_entries` devuelve el mejor puntaje por alias por juego. El orden es el del índice `scores_ranking_idx`: puntaje desc, y ante empate el más antiguo arriba (convención arcade + orden determinístico).
- **RLS está activo** con select público en ambas tablas e insert anónimo en `scores`. La defensa real son los CHECK constraints, no la Server Action: alguien puede pegarle a PostgREST directo. Está asumido en el SPEC 06. El rate limit por IP (`lib/rate-limit.ts`) vive solo en memoria del proceso y no es distribuido.
- Cuando la base no responde, `lib/catalog.ts` y `lib/scores.ts` **devuelven vacío en vez de lanzar**; el diagnóstico se hace en `/supabase-check`.
- Lo que **sigue siendo mock a propósito**: `LIVE_SCORES` y `TOP_TODAY` en `lib/data.ts` (el ticker de actividad del home) y los números de marketing del hero.
- La **sesión es falsa**: `lib/session.tsx` guarda `av_user` (`{ name }`, mayúsculas, ≤10 caracteres) en `localStorage`. Cualquiera entra. Un puntaje es la afirmación de un anónimo sobre sí mismo. `av_muted` guarda la preferencia de silencio del portal.

Tres clientes de Supabase, cada uno para una superficie, y **ninguno en una variable de módulo** (con Fluid Compute el proceso se reutiliza entre requests y un cliente global filtraría la sesión de un usuario al siguiente): `lib/supabase/server.ts` (Server Components / Actions; `cookies()` es async en Next 16), `lib/supabase/client.ts` (browser) y `lib/supabase/proxy.ts` (refresco del token).

**`proxy.ts` en la raíz, no `middleware.ts`**: en Next.js 16 la convención se renombró y `middleware.ts` está deprecada. La mayoría de los tutoriales de Supabase que circulan siguen desactualizados. Adentro de `lib/supabase/proxy.ts` no metas nada entre `createServerClient()` y la llamada a `getClaims()`: el resultado son deslogueos intermitentes e irreproducibles.

Variables de entorno en `.env.example`. Las dos de Supabase llevan `NEXT_PUBLIC_` **a propósito** (el cliente de browser no puede funcionar sin ellas; lo que protege la base es RLS). Las tres de Resend no lo llevan nunca. Sin `RESEND_API_KEY` en desarrollo, la Server Action de contacto entra en modo simulado y loguea en consola.

### Los motores de juego

El contrato vive en `lib/games/types.ts` y es lo único que un motor y React comparten:

- `GameSnapshot` = `{ score, level, status, lives?, extra? }`. `lives` solo para los juegos que tienen el concepto (ausente ⇒ el HUD oculta el slot ♥). `extra` es el stat propio de cada juego y viaja **ya formateado como string** por el motor — el HUD no sabe de qué salió.
- `EngineHandle` = `start / pause / resume / restart / end / setMuted / destroy`. El silencio es un método del handle, no un singleton global.
- `EngineOptions.onSnapshot` se llama **solo cuando algo cambió**, no en cada frame.

`lib/games/registry.ts` mapea id del catálogo → `import()` dinámico del motor. Los ocho juegos simulados no arrastran ningún motor en su bundle. `components/game-canvas.tsx` es el único lugar del repo que toca el DOM del juego; el mundo es fijo en **800×600** y el canvas se estira por CSS (nunca leas `canvas.width`: en HiDPI vale el doble).

Reglas que todo motor cumple:

- **Nada corre al importar el módulo.** Listeners, `requestAnimationFrame`, `new Audio()` y `new Image()` viven dentro de `start()` y se deshacen en `destroy()`. A nivel de módulo corren en el servidor y revientan el build con `Audio is not defined`.
- El motor **no dibuja HUD, ni pausa, ni game over, ni instrucciones**: todo eso lo pinta `<Reproductor>`.
- `Escape` y `P` las ata `<Reproductor>`; manejarlas también en el motor alterna la pausa dos veces por pulsación.
- El `dt` va topeado.

Motores hoy: `asteroides`, `tetris`, `arkanoid` (mouse + audio desde `public/sounds/`), `snake` (atlas de sprites desde `public/snake/fruits.png`; el único diseñado desde cero, no porteado).

### Agregar un juego nuevo

Son dos preguntas distintas y hay una herramienta para cada una. **Cuál** juego lo decide el subagente **`game-planner`** (`.claude/agents/game-planner.md`): lee el catálogo, los motores y el contrato del snapshot, los cruza con lo que ya se propuso, y devuelve una sola recomendación fundamentada. Su registro de sugerencias —propuestas, descartes y el porqué de cada uno— vive en `references/games-suggestions-todo.md`, y es lo que evita volver a evaluar el mismo candidato desde cero. **Cómo** se integra lo decide `/spec-juego`.

Hay un tercer camino para cuando el disparador es **un tema** y no un hueco del catálogo: el subagente **`game-jam`** (`.claude/agents/game-jam.md`). Recibe un tema (`el fondo del mar`, `gravedad`, `1985`), compara candidatos con los mismos criterios de encaje de `game-planner`, elige uno y lo deja diseñado y especificado en `specs/game-jam/<game-id>/`, en tres archivos: `01-brief.md` (por qué ese juego), `02-diseno.md` (reglas, balance y constantes) y `03-spec.md` (el spec completo en `Draft`). No entrevista —decide y argumenta cada hueco— y no escribe fuera de esa carpeta: **no** toca `specs/` raíz ni el registro de sugerencias. Promover un spec del jam es manual: se copia `03-spec.md` a `specs/NN-juego-<id>.md`, se lo pasa a `Aprobado` y recién ahí corre `/spec-impl`.

El cómo es mecánico en cinco archivos y difícil en uno solo (el motor). `/spec-juego` entrevista exactamente sobre esto:

| Archivo                                        | Qué cambia                                           |
| ---------------------------------------------- | ---------------------------------------------------- |
| `lib/games/<slug>/engine.ts`                   | nuevo: la fábrica `create<X>Engine(canvas, options)` |
| `lib/games/registry.ts`                        | una línea en `ENGINES`                               |
| `supabase/migrations/<ts>_add_game_<slug>.sql` | el `insert into public.games`                        |
| `app/globals.css`                              | `.cover-<slug>` (+ `::before` / `::after`)           |
| `components/reproductor.tsx`                   | solo si el juego necesita un slot de HUD nuevo       |
| `public/`                                      | sprites / audio, si el original trae binarios        |

**No se toca nunca**: `app/juegos/**`, `app/jugar/**`, `app/salon/**`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts`, `app/jugar/actions.ts`. Todo eso es catalog-driven y levanta el juego solo — hasta la tab del Salón de la Fama aparece sola. Si un pedido obliga a tocarlos, no es "un juego más": conviene partirlo en dos specs.

### Sistema visual

Usá **`/frontend-design`** para diseñar cualquier interfaz.

`app/globals.css` (~4000 líneas) es el tema completo, portado de `references/templates/styles.css`. La estructura importa:

- `@import "tailwindcss"` y **sin `tailwind.config.js`** — Tailwind v4 se configura del lado del CSS.
- Los tokens son custom properties sobre `:root`: `--bg`/`--bg-2`/`--bg-3`, `--ink`/`--ink-dim`/`--ink-faint`, acentos neón `--cyan #00f5ff`, `--magenta #ff006e`, `--yellow #f5ff00`, `--green #00ff88`, podio `--gold`/`--silver`/`--bronze`, y `--pixel` / `--mono`.
- `@theme inline` los reexpone como utilidades de Tailwind (`text-cyan`, `bg-bg-2`, `font-pixel`, …) y fija `--mono` como fuente por defecto.
- Las reglas de componentes viven en `@layer components` justamente para que las utilidades de Tailwind puedan pisarlas.
- Las fuentes (Press Start 2P, JetBrains Mono, Courier Prime) se cargan **self-hosted con `next/font`** en `app/layout.tsx`, que inyecta las variables `--font-*`. No hay `<link>` a Google Fonts.
- Las portadas de los juegos son **arte en CSS puro** (`.cover-bricks`, `.cover-tetro`, `.cover-snake`, …): cero assets de imagen. Las clases son estilo BEM y las pantallas contenedoras llevan prefijo `av-`.

Al portar una pantalla del prototipo la regla ha sido **no escribir CSS nuevo**: si falta una clase, se copia tal cual desde la referencia.

**El idioma de la UI es español** — nombres de pantallas, labels, textos, `toLocaleString("es-ES")`, fechas formateadas con `Intl` en `timeZone: "UTC"` fijo (servidor y browser formatean las mismas filas y sin zona fija se verían distintas). Mantenelo. Los comentarios del código también están en español.

## Método de trabajo: spec-driven

El proyecto sigue spec-driven design con los skills de `Klerith/fernando-skills`. Los nueve specs de `specs/` son el registro de decisiones del proyecto: **leelos antes de tocar un área que ya tenga spec** — explican el _por qué_, que el código no dice.

- `/spec <descripción>` entrevista al usuario y escribe `specs/NN-slug.md` en estado `Draft`. No escribe código.
- `/spec-juego <juego>` es la variante especializada para agregar un juego: mismas reglas de escritura, pero entrevista sobre el contrato del motor.
- `/spec-impl NN-slug` se niega a correr salvo que el estado del spec signifique **aprobado** (eso lo cambia el humano, nunca el agente); después crea la rama `spec-NN-slug` e implementa paso a paso, pausando para revisar el diff y sin commitear por su cuenta.

El estado del header de cada spec es texto libre y el repo usa varias palabras para lo mismo (`Completado`, `Implementado`, `Aceptado`, `Aprobado`). Un spec en `Aprobado` está listo para implementar; los demás ya lo están.

Cada spec se implementa en su rama `spec-NN-slug`, con un commit por paso (`P1 Fin`, `P2 Fin`, …) y se integra a `main` por pull request. Para cualquier feature sustancial, usá `/spec` antes de escribir código.

## Notas de Next.js 16

`AGENTS.md` (autogenerado — no lo borres, `next dev` lo vuelve a agregar) indica leer `node_modules/next/dist/docs/` antes de escribir código. Ya visto en este repo: `cookies()` y `headers()` son async, las props de página vienen de `LayoutProps`/`PageProps` generados, `middleware.ts` es ahora `proxy.ts`, y Tailwind v4 no tiene archivo de configuración.
