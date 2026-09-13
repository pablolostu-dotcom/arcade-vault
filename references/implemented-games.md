# Juegos implementados — Arcade Vault

Catálogo leído de la tabla `public.games` del proyecto Supabase (12 filas, orden por `sort_order`).

| ID              | Título        | Categoría | Descripción breve                                          | Color   |
| --------------- | ------------- | --------- | ---------------------------------------------------------- | ------- |
| `bloque-buster` | BLOQUE BUSTER | ARCADE    | Rebota la pelota y destruye muros de neón.                 | cyan    |
| `caida`         | CAÍDA         | PUZZLE    | Encaja las piezas antes de que el techo te aplaste.        | magenta |
| `serpentina`    | SERPENTINA    | ARCADE    | Crece sin morder tu propia cola.                           | green   |
| `gloton`        | GLOTÓN        | ARCADE    | Devora puntos y escapa de los fantasmas.                   | yellow  |
| `invasores`     | INVASORES     | SHOOTER   | Defiende el planeta de filas alienígenas.                  | green   |
| `rocas`         | ROCAS         | SHOOTER   | Pulveriza asteroides en gravedad cero.                     | yellow  |
| `ranaria`       | RANARIA       | ARCADE    | Cruza la autopista de pixeles.                             | green   |
| `duelo-pixel`   | DUELO PIXEL   | VERSUS    | Dos paletas. Una pelota. Reflejos máximos.                 | cyan    |
| `asteroides`    | ASTEROIDES    | SHOOTER   | Parte las rocas antes de que te partan a vos.              | cyan    |
| `tetris`        | TETRIS        | PUZZLE    | Encaja tetrominós y limpia líneas antes de tocar el techo. | cyan    |
| `arkanoid`      | ARKANOID      | ARCADE    | Rompe cinco muros de bloques con una paleta y una pelota.  | magenta |
| `snake`         | SNAKE         | ARCADE    | Come fruta en una grilla que se te va cerrando.            | yellow  |

Los cuatro últimos (`asteroides`, `tetris`, `arkanoid`, `snake`) son los que tienen motor real en
`lib/games/registry.ts`; los ocho primeros siguen con el puntaje simulado.
