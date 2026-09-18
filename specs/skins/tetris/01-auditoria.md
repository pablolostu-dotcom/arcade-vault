# Auditoría de skins — la foto del antes

> **Fecha:** 2026-09-18
> **Juego auditado a fondo:** `tetris`
> **Alcance de la foto:** todo el catálogo

Este documento es la foto del repo **antes** de que exista el chasís de skins. No propone nada: mide.

## El chasís de skins no existe

`lib/games/types.ts` tiene hoy 56 líneas y **ningún rastro de skins**:

- **No** hay `SkinId` ni `SKIN_IDS`.
- `EngineOptions` (línea 52) tiene exactamente dos campos: `onSnapshot` y `onGameOver`.
- `EngineHandle` (línea 34) tiene siete métodos: `start`, `pause`, `resume`, `restart`, `end`, `setMuted`, `destroy`. No hay `setSkin`.

`components/reproductor.tsx` no conoce la palabra «skin»: su única preferencia persistida es `av_muted` (constante `MUTED_KEY`, línea 31). `components/game-canvas.tsx` baja al motor una sola prop de presentación, `muted` (línea 37), con el patrón ref + efecto + aplicación previa a `start()`.

Conclusión: esta corrida tiene que construir **P0 y P1 completos**, no solo P2.

## Cumplimiento del catálogo

El catálogo tiene **13 filas** en `public.games` (`CLAUDE.md` todavía dice doce: `abismo` entró después, por el SPEC 10, y no tiene motor). De esas 13, **4 tienen motor real** en `lib/games/registry.ts`.

| Juego           | Motor                    | `clasico` | `neon` | `retro` |
| --------------- | ------------------------ | --------- | ------ | ------- |
| `asteroides`    | sí (`ENGINES`, línea 17) | no        | no     | no      |
| `tetris`        | sí (`ENGINES`, línea 18) | no        | no     | no      |
| `arkanoid`      | sí (`ENGINES`, línea 19) | no        | no     | no      |
| `snake`         | sí (`ENGINES`, línea 20) | no        | no     | no      |
| `abismo`        | no (fila del SPEC 10)    | —         | —      | —       |
| `bloque-buster` | no (simulado)            | —         | —      | —       |
| `caida`         | no (simulado)            | —         | —      | —       |
| `serpentina`    | no (simulado)            | —         | —      | —       |
| `gloton`        | no (simulado)            | —         | —      | —       |
| `invasores`     | no (simulado)            | —         | —      | —       |
| `rocas`         | no (simulado)            | —         | —      | —       |
| `ranaria`       | no (simulado)            | —         | —      | —       |
| `duelo-pixel`   | no (simulado)            | —         | —      | —       |

Los nueve juegos sin motor no dibujan nada: su puntaje es un `setInterval` en `<Reproductor>`. **No son elegibles para skins** y el guion «—» no es una deuda, es un no-aplica.

## Las paletas hardcodeadas, archivo y línea

### `lib/games/tetris/engine.ts` — el juego de esta corrida

| Constante     | Línea | Valor literal                                                                                                      |
| ------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| `COLORS`      | 51–61 | `[null, "#00f5ff", "#f5ff00", "#aa00ff", "#00ff88", "#ff006e", "#00a2ff", "#ff7700", "#8a8fb5"]` — I O T S Z J L N |
| `GRID_LINE`   | 63    | `"rgba(0, 245, 255, 0.08)"`                                                                                        |
| `HIGHLIGHT`   | 64    | `"rgba(255, 255, 255, 0.12)"`                                                                                      |
| `GHOST_ALPHA` | 65    | `0.2`                                                                                                              |
| fondo         | 369   | `ctx.fillStyle = "#000"` dentro de `draw()` — literal suelto, sin constante                                        |

No hay un solo `shadowBlur` en el motor de Tetris: **la skin `clasico` no tiene glow**, y eso también se extrae literal.

El comentario de las líneas 44–50 deja escrita la regla que esta corrida no puede romper: la paleta se escribe a mano **y no se lee de `:root` con `getComputedStyle`**, porque un motor que necesita una hoja de estilos para dibujar falla en silencio.

### Los otros tres motores (no se tocan sus colores en esta corrida)

| Motor        | Constantes de paleta                                                                                           | Líneas               |
| ------------ | -------------------------------------------------------------------------------------------------------------- | -------------------- |
| `asteroides` | `COLORS` (`space`, `ship`, `asteroid`, `bullet`, `powerUp`, `thrust`, `particle(alpha)`)                       | 36–45                |
| `arkanoid`   | `BLOCK_COLORS` (7 colores), `PADDLE_COLOR`, `BALL_COLOR`, `HIGHLIGHT`, `"#000"` suelto; `shadowBlur = 14`      | 72–85, 499–522       |
| `snake`      | los tres `halo` de fruta, `BG`, `GRID`, `SNAKE_COLOR`, `FRAME_COLOR`; `GLOW_HALO` / `GLOW_HEAD` / `GLOW_FRAME` | 84–86, 130–133, 515+ |

Los tres reciben en esta corrida un `setSkin()` **no-op** y nada más. Sus colores quedan exactamente donde están.

## Los tokens de `app/globals.css`

El portal es **dark-only**: `:root` declara `color-scheme: dark` (línea 12) y **no hay una sola media query `prefers-color-scheme` en las ~4000 líneas del archivo**. No existe un tema claro que considerar: los motores pintan siempre sobre negro.

Tokens disponibles (los únicos hex que una skin puede citar sin argumentar):

| Token         | Hex       | Token       | Hex       |
| ------------- | --------- | ----------- | --------- |
| `--bg`        | `#0a0a0f` | `--cyan`    | `#00f5ff` |
| `--bg-2`      | `#0f0f18` | `--magenta` | `#ff006e` |
| `--bg-3`      | `#15151f` | `--yellow`  | `#f5ff00` |
| `--ink`       | `#e6e9ff` | `--green`   | `#00ff88` |
| `--ink-dim`   | `#8a8fb5` | `--gold`    | `#ffcf3a` |
| `--ink-faint` | `#4a4f70` | `--silver`  | `#c7d0e0` |
|               |           | `--bronze`  | `#d97a3a` |

Nótese que **no hay token violeta, azul ni naranja**. Las piezas T, J y L de Tetris ya usan hex fuera de la paleta del portal desde el SPEC 07 (`#aa00ff`, `#00a2ff`, `#ff7700`), y eso condiciona el diseño de `neon`.

## Ratios de la paleta actual contra `#000`

Calculados con `ratio = 20·L + 1` (luminancia relativa de WCAG contra negro).

| Elemento                          | Hex efectivo | Ratio      | Piso  | ¿Pasa? |
| --------------------------------- | ------------ | ---------- | ----- | ------ |
| O — amarillo                      | `#f5ff00`    | 19.19:1    | 4.5:1 | sí     |
| S — verde                         | `#00ff88`    | 15.66:1    | 4.5:1 | sí     |
| I — cian                          | `#00f5ff`    | 15.50:1    | 4.5:1 | sí     |
| L — naranja                       | `#ff7700`    | 7.89:1     | 4.5:1 | sí     |
| J — azul                          | `#00a2ff`    | 7.61:1     | 4.5:1 | sí     |
| N — tuerca                        | `#8a8fb5`    | 6.68:1     | 4.5:1 | sí     |
| Z — magenta                       | `#ff006e`    | 5.48:1     | 4.5:1 | sí     |
| **T — violeta**                   | `#aa00ff`    | **4.15:1** | 4.5:1 | **no** |
| **grilla** `rgba(0,245,255,0.08)` | `#001414`    | **1.11:1** | 3:1   | **no** |

Dos números por debajo del piso, los dos **heredados**. Ninguno se corrige: `clasico` se extrae literal y una corrección sería una regresión respecto de lo que el jugador ya conoce. Los dos quedan anotados en `## Lo que no entra` de `03-spec.md`.
