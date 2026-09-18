# Juegos implementados — Arcade Vault

Catálogo leído de la tabla `public.games` del proyecto Supabase (13 filas, orden por `sort_order`).

| ID              | Título        | Categoría | Descripción breve                                          | Color   | Motor | Skins            |
| --------------- | ------------- | --------- | ---------------------------------------------------------- | ------- | ----- | ---------------- |
| `bloque-buster` | BLOQUE BUSTER | ARCADE    | Rebota la pelota y destruye muros de neón.                 | cyan    | —     | —                |
| `caida`         | CAÍDA         | PUZZLE    | Encaja las piezas antes de que el techo te aplaste.        | magenta | —     | —                |
| `serpentina`    | SERPENTINA    | ARCADE    | Crece sin morder tu propia cola.                           | green   | —     | —                |
| `gloton`        | GLOTÓN        | ARCADE    | Devora puntos y escapa de los fantasmas.                   | yellow  | —     | —                |
| `invasores`     | INVASORES     | SHOOTER   | Defiende el planeta de filas alienígenas.                  | green   | —     | —                |
| `rocas`         | ROCAS         | SHOOTER   | Pulveriza asteroides en gravedad cero.                     | yellow  | —     | —                |
| `ranaria`       | RANARIA       | ARCADE    | Cruza la autopista de pixeles.                             | green   | —     | —                |
| `duelo-pixel`   | DUELO PIXEL   | VERSUS    | Dos paletas. Una pelota. Reflejos máximos.                 | cyan    | —     | —                |
| `asteroides`    | ASTEROIDES    | SHOOTER   | Parte las rocas antes de que te partan a vos.              | cyan    | sí    | no (`setSkin` no-op) |
| `tetris`        | TETRIS        | PUZZLE    | Encaja tetrominós y limpia líneas antes de tocar el techo. | cyan    | sí    | **sí** — `clasico` · `neon` · `retro` |
| `arkanoid`      | ARKANOID      | ARCADE    | Rompe cinco muros de bloques con una paleta y una pelota.  | magenta | sí    | no (`setSkin` no-op) |
| `snake`         | SNAKE         | ARCADE    | Come fruta en una grilla que se te va cerrando.            | yellow  | sí    | no (`setSkin` no-op) |
| `abismo`        | ABISMO        | SHOOTER   | Rescata buzos del abismo antes de que se acabe el aire.    | magenta | —     | —                |

## Motores

Cuatro juegos tienen motor real en `lib/games/registry.ts`: `asteroides`, `tetris`, `arkanoid` y
`snake`. Los otros nueve siguen con el puntaje simulado (un `setInterval` en `<Reproductor>`).

`abismo` es la decimotercera fila del catálogo y entró por el SPEC 10, pero **todavía no tiene
motor**: su spec está en `Aprobado` y la implementación no corrió.

## Skins

El chasís de skins vive en `lib/games/types.ts` (`SkinId`, `SKIN_IDS`, `skin?` en `EngineOptions`,
`setSkin()` en `EngineHandle`) y el selector persistido en `components/reproductor.tsx`, bajo la
clave `av_skin` de `localStorage` — un mapa `{ [gameId]: SkinId }`, **una preferencia por juego**.

Las tres skins son siempre las mismas: `clasico` (la paleta que el motor ya tenía, el default),
`neon` (los acentos saturados, con glow) y `retro` (fósforo monocromo, la información en luminancia).

Solo `tetris` las tiene implementadas. `asteroides`, `arkanoid` y `snake` implementan `setSkin()`
como no-op, igual que los motores mudos implementan `setMuted()`: el botón del HUD aparece y cicla,
pero su paleta no cambia todavía. Cada uno es una corrida propia del subagente `skin-designer`.

El diseño y los ratios de contraste de las skins de `tetris` están en `specs/skins/tetris/`.
