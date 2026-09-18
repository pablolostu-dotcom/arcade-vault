# Auditoría de skins del vault — antes de ABISMO

> **Fecha:** 2026-09-18
> **Juego de esta corrida:** `abismo`
> **Chasís de skins:** **existe** desde el SPEC 11 (`specs/skins/tetris/03-spec.md`, estado `Aceptado`).

## La foto del catálogo

Trece juegos en `games`, **cinco con motor real** en `lib/games/registry.ts` y ocho simulados (su puntaje es un `setInterval`). Solo los cinco con motor pueden tener skins: los otros no dibujan nada.

| Juego        | Motor                                                                                                        | `clasico` | `neon` | `retro` |
| ------------ | ------------------------------------------------------------------------------------------------------------ | --------- | ------ | ------- |
| `asteroides` | `lib/games/asteroides/engine.ts`                                                                             | —         | —      | —       |
| `tetris`     | `lib/games/tetris/engine.ts`                                                                                 | ✅        | ✅     | ✅      |
| `arkanoid`   | `lib/games/arkanoid/engine.ts`                                                                               | —         | —      | —       |
| `snake`      | `lib/games/snake/engine.ts`                                                                                  | —         | —      | —       |
| `abismo`     | `lib/games/abismo/engine.ts`                                                                                 | —         | —      | —       |
| los otros 8  | simulados (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`) | n/a       | n/a    | n/a     |

Tres de los cinco motores —`asteroides`, `arkanoid`, `snake`— implementan `setSkin()` como **no-op** (líneas 662, 666 y 755 respectivamente), que es el estado previsto por el SPEC 11 y el mismo criterio con el que los motores mudos implementan `setMuted()`.

## El estado del chasís

Todo construido. Esta corrida **no lo toca**; solo lo audita.

| Pieza                                | Dónde                                       | Estado                                                                       |
| ------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------- |
| `SkinId` / `SKIN_IDS`                | `lib/games/types.ts:24` y `:27`             | ✅ `"clasico" \| "neon" \| "retro"`, `clasico` primero                       |
| `EngineOptions.skin`                 | `lib/games/types.ts` (fin del archivo)      | ✅ opcional, ausente ⇒ `clasico`                                             |
| `EngineHandle.setSkin`               | `lib/games/types.ts` (líneas 55–65)         | ✅ con el comentario que autoriza el no-op                                   |
| Prop `skin` de `<GameCanvas>`        | `components/game-canvas.tsx:44`             | ✅ + `skinRef` y el efecto que llama `engineRef.current?.setSkin` (`:69–75`) |
| Skin inicial al crear el motor       | `components/game-canvas.tsx:109–111`        | ✅ viaja en `EngineOptions`, no en un `setSkin()` posterior                  |
| Selector en el HUD                   | `components/reproductor.tsx:285–297`        | ✅ botón que cicla `SKIN_IDS`, con `aria-label`                              |
| Persistencia `av_skin` **por juego** | `components/reproductor.tsx:38`, `:124–159` | ✅ `{ [gameId]: SkinId }` en una sola clave, leída en efecto                 |

O sea: **P0 y P1 del plan de skins ya están hechos.** Lo único que falta para `abismo` es P2.

## Lo que está roto hoy en `main`

`npx tsc --noEmit` falla:

```
lib/games/abismo/engine.ts(1132,3): error TS2741: Property 'setSkin' is missing in type '{ start(): void; pause(): void; resume(): void; restart(): void; end(): void; setMuted(next: boolean): void; destroy(): void; }' but required in type 'EngineHandle'.
```

`abismo` entró por el SPEC 10 en paralelo al SPEC 11 y es **el único de los cinco motores que no implementa `setSkin`**. Esta corrida cierra el agujero implementándolo de verdad, no con un no-op.

## La paleta actual de `abismo`

Constantes de módulo sueltas en `lib/games/abismo/engine.ts`, líneas **171–194**. Son, literalmente, la futura skin `clasico`.

| Línea | Constante           | Valor                       | Qué pinta                               |
| ----- | ------------------- | --------------------------- | --------------------------------------- |
| 171   | `COLOR_DEEP_TOP`    | `#001018`                   | tope del degradado de agua              |
| 172   | `COLOR_DEEP_BOTTOM` | `#000000`                   | el abismo, fondo del degradado          |
| 173   | `COLOR_AIR`         | `rgba(0, 245, 255, 0.06)`   | la banda de aire sobre `SURFACE_Y`      |
| 174   | `COLOR_SURFACE`     | `#00f5ff`                   | la línea de agua (2 px), con glow       |
| 175   | `COLOR_SEABED`      | `rgba(138, 143, 181, 0.18)` | la silueta del lecho marino             |
| 176   | `COLOR_BUBBLE`      | `rgba(0, 245, 255, 0.10)`   | las 40 burbujas de fondo                |
| 177   | `COLOR_SUB`         | `#ff006e`                   | el casco del jugador                    |
| 178   | `COLOR_SUB_ALARM`   | `#ffa8c8`                   | el casco parpadeando con el tanque bajo |
| 179   | `COLOR_CARGO_ON`    | `#00ff88`                   | una luz de bodega ocupada               |
| 180   | `COLOR_CARGO_OFF`   | `rgba(0, 255, 136, 0.18)`   | una plaza de bodega vacía               |
| 181   | `COLOR_DIVER`       | `#00ff88`                   | los buzos, con glow                     |
| 182   | `COLOR_TORPEDO`     | `#ff006e`                   | el torpedo del jugador                  |
| 183   | `COLOR_SHARK`       | `#8a8fb5`                   | el tiburón                              |
| 184   | `COLOR_ESUB`        | `#f5ff00`                   | el submarino enemigo                    |
| 185   | `COLOR_ETORPEDO`    | `#f5ff00`                   | el torpedo enemigo                      |
| 192   | `GLOW_SUB`          | `12`                        | `shadowBlur` del casco                  |
| 193   | `GLOW_SURFACE`      | `10`                        | `shadowBlur` de la línea de agua        |
| 194   | `GLOW_DIVER`        | `8`                         | `shadowBlur` de los buzos               |

Los puntos de uso, para que ninguno quede huérfano: `848–849`, `856`, `860`, `870–872`, `879`, `903`, `912–913`, `936`, `952–954`, `984`, `1005`, `1019`, `1023`.

### El presupuesto de sombras del SPEC 10

Escrito en el comentario de las líneas 187–191 y repetido en `drawEnemies()` (970–974): **el `shadowBlur` va solo en el submarino, en la línea de agua y en los buzos** —cinco sombras por frame como techo, con `DIVER_MAX_ON_SCREEN = 3`—. **No va** en los enemigos (`ENEMY_MAX = 10`), ni en los torpedos (2 propios + hasta 4 enemigos), ni en las burbujas (`BUBBLE_COUNT = 40`). Cien sombras por frame hunden los 60 fps. Ninguna de las tres skins puede mover esa regla; lo único que varía por skin es **cuánto** blur llevan esos tres elementos.

## La paleta de los otros cuatro motores

Para la próxima corrida, ya ubicada:

| Motor        | Constantes                                                                         | Líneas           |
| ------------ | ---------------------------------------------------------------------------------- | ---------------- |
| `asteroides` | `COLORS` (objeto)                                                                  | 36               |
| `arkanoid`   | `BLOCK_COLORS` (`Record<BlockColor, string>`), `PADDLE_COLOR`, `BALL_COLOR`        | 72, 82, 83       |
| `snake`      | `BG`, `GRID`, `SNAKE_COLOR`, `FRAME_COLOR`, `GLOW_HEAD`, `GLOW_FRAME`, `GLOW_HALO` | 130–133, 144–146 |
| `tetris`     | `SKINS: Record<SkinId, TetrisPalette>` — **ya migrado**                            | 90               |

## Los tokens de los que salen los colores

`app/globals.css`, `:root` (líneas 12–33). El portal es **dark-only**: `color-scheme: dark`, `--bg: #0a0a0f`, y no hay una sola consulta `prefers-color-scheme` en el archivo. Los motores pintan sobre el `#000` del canvas, así que todos los ratios de esta corrida se miden contra negro.

| Token         | Valor     | Ratio contra `#000` |
| ------------- | --------- | ------------------- |
| `--cyan`      | `#00f5ff` | 15.50:1             |
| `--magenta`   | `#ff006e` | 5.48:1              |
| `--yellow`    | `#f5ff00` | 19.19:1             |
| `--green`     | `#00ff88` | 15.66:1             |
| `--ink`       | `#e6e9ff` | 17.46:1             |
| `--ink-dim`   | `#8a8fb5` | 6.68:1              |
| `--ink-faint` | `#4a4f70` | 2.64:1              |
| `--silver`    | `#c7d0e0` | 13.53:1             |
