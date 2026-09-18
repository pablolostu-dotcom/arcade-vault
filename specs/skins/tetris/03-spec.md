# SPEC 11 — Skins de TETRIS: el chasís de temas del vault y sus tres primeras paletas

> **Status:** Aceptado
> **Depends on:** SPEC 05, SPEC 07
> **Date:** 2026-09-18
> **Objective:** Meter en el contrato del motor un eje de skins —`clasico`, `neon` y `retro`— con su selector persistido por juego en el HUD, y estrenarlo en `tetris` sin cambiar un píxel de lo que el juego se ve hoy.

## Por qué existe este spec

El portal tiene cuatro motores y cada uno pinta con una paleta hardcodeada en constantes de módulo sueltas: `COLORS` en `tetris` y `asteroides`, `BLOCK_COLORS` + `PADDLE_COLOR` + `BALL_COLOR` en `arkanoid`, `SNAKE_COLOR` + `FRAME_COLOR` + `GRID` + `BG` en `snake`. Son buenas paletas, y ése es el problema: **el jugador no puede elegir otra**, y un vault de arcade retro sin fósforo verde le está dejando plata en la mesa.

Este spec hace dos cosas que conviene no confundir.

1. **Construye el chasís.** `SkinId` en `lib/games/types.ts`, `skin` en `EngineOptions`, `setSkin()` en `EngineHandle`, la prop en `<GameCanvas>` y el selector persistido en `<Reproductor>`. Después de esto **nada cambia visualmente en ningún juego**: los cuatro motores siguen pintando igual y tres de ellos implementan `setSkin()` como no-op, igual que `tetris` implementa hoy `setMuted()` como no-op porque es mudo. El precedente está escrito en los comentarios de `types.ts` (líneas 40–47) y este spec lo sigue al pie.
2. **Estrena el chasís en `tetris`.** Tres paletas diseñadas y medidas en `specs/skins/tetris/02-diseno.md`, con la auditoría del antes en `01-auditoria.md`.

La fricción real es una sola, y es lo que hace que este juego sea el difícil: **Tetris tiene ocho piezas que hoy se distinguen solo por matiz**, y `retro` es monocromo por definición. La salida no es «elegir ocho verdes»: con ocho entidades, un piso de 4.5:1 y saltos de 1.5:1 haría falta un rango de `4.5 × 1.5⁷ = 76.89:1`, y contra `#000` el máximo posible es `21:1`. Se resuelve con un segundo eje que no es color: **cuatro luminancias × dos tratamientos de relleno** (bloque sólido y anillo hueco). Ese segundo eje es el único cambio de dibujo que este spec le hace al motor.

La segunda decisión que vale la pena adelantar: **`clasico` se extrae literal.** Los ocho hex de `COLORS`, el `GRID_LINE`, el `HIGHLIGHT`, el `GHOST_ALPHA` y el `#000` de la línea 369 se mueven al record sin tocar ni uno. Dos de esos valores están **por debajo del piso de contraste** (el violeta de la T a 4.15:1 y la grilla a 1.11:1) y **se dejan como están**: corregirlos cambiaría lo que el jugador ya conoce, y el criterio de fracaso de este trabajo es exactamente ése.

## Alcance

**Dentro:**

- `lib/games/types.ts` — `SkinId`, `SKIN_IDS`, `skin?: SkinId` en `EngineOptions`, `setSkin(skin: SkinId): void` en `EngineHandle`.
- `lib/games/asteroides/engine.ts`, `lib/games/arkanoid/engine.ts`, `lib/games/snake/engine.ts` — un `setSkin() {}` no-op en cada handle, con su comentario. **Sus colores no se tocan.**
- `components/game-canvas.tsx` — la prop `skin`, con el mismo patrón ref + efecto + aplicación previa a `start()` que ya tiene `muted`.
- `components/reproductor.tsx` — el botón de skin en `.hud-actions` y la persistencia en `av_skin`, un mapa `{ [gameId]: SkinId }` en una sola clave de `localStorage`.
- `lib/games/tetris/engine.ts` — el record `SKINS` con las tres paletas, el `setSkin()` real, el anillo hueco y el contorno del fantasma.

**Fuera de alcance (para specs futuras):**

- **Las skins de `asteroides`, `arkanoid` y `snake`.** Cada una es una corrida propia del subagente `skin-designer`. En este spec los tres son no-op.
- **Una cuarta skin.** `SKIN_IDS` son tres y el selector es un botón que cicla; una skin más es otro spec.
- **Persistir la skin en Postgres.** Las skins no tocan `games` ni `scores`, no hay migración y `npm run db:types` no entra. La preferencia vive en `localStorage`, igual que `av_muted` y `av_user`.
- **Una skin global del portal.** `av_skin` es por juego a propósito: elegir `retro` en Tetris no puede cambiarle la paleta a Snake.
- **Que las skins alcancen al CSS del portal** (tarjetas, `.cover-*`, marco CRT, HUD). Este spec no toca `app/globals.css`.
- **Los nueve juegos sin motor.** `abismo`, `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria` y `duelo-pixel` no dibujan nada: el botón de skin solo aparece con motor, igual que el de silencio.
- **Corregir los dos valores de `clasico` que no llegan al piso.** Ver `## Lo que **no** entra`.
- **Tests automatizados.** El repo no tiene test runner y este spec no instala uno.
- **Tocar `app/juegos/`, `app/jugar/`, `app/salon/`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts`, `app/jugar/actions.ts` ni `app/globals.css`.**

## El contrato del motor

### Lo que se agrega a `lib/games/types.ts`

```ts
export type SkinId = "clasico" | "neon" | "retro";
export const SKIN_IDS: readonly SkinId[] = ["clasico", "neon", "retro"];
```

`EngineOptions` suma `skin?: SkinId` —la skin inicial, con `clasico` por default— y `EngineHandle` suma `setSkin(skin: SkinId): void`, que cambia la paleta **en caliente**: la partida no se reinicia y el próximo frame ya sale con la paleta nueva.

Son dos cosas y no una porque cubren dos momentos distintos. `skin` en las opciones evita el parpadeo del primer frame cuando el jugador tiene `retro` guardado: el motor se crea después de un `import()` dinámico, y un `setSkin()` imperativo llamado al montar encontraría `engineRef` en `null`. Es el mismo argumento que `<GameCanvas>` ya deja escrito para `muted` en sus líneas 30–36.

`setSkin()` cubre el cambio posterior, cuando el jugador toca el botón con la partida en curso.

### La forma de una paleta de Tetris

Vive en `lib/games/tetris/engine.ts` y no se exporta: es un detalle del motor.

```ts
type SkinPiece = { color: string; hollow: boolean };

type TetrisPalette = {
  bg: string;
  grid: string;
  highlight: string;
  ghostAlpha: number;
  ghostStroke: string | null; // null ⇒ el fantasma es relleno, como en clasico
  glow: number; // shadowBlur; 0 ⇒ sin glow
  pieces: readonly (SkinPiece | null)[]; // 0 sin usar; 1..8 = I O T S Z J L N
};

const SKINS: Record<SkinId, TetrisPalette> = {
  /* los tres valores completos están en 02-diseno.md */
};
```

Las constantes `COLORS`, `GRID_LINE`, `HIGHLIGHT` y `GHOST_ALPHA` desaparecen: quedan huérfanas y se borran.

### Los dos cambios de dibujo

Son los únicos, y los dos son inertes con `clasico`.

1. **El anillo hueco.** `drawBlock()` consulta `hollow` de la pieza. Si es `false` pinta el `fillRect` de siempre; si es `true` pinta cuatro rectángulos que forman un marco de `max(2, size/6)` de espesor. Las ocho piezas de `clasico` y de `neon` son `hollow: false`, así que el dibujo es bit a bit el de hoy.
2. **El contorno del fantasma.** Si `ghostStroke` es `null`, el fantasma se dibuja con el camino de siempre (la pieza a `ghostAlpha`). Si es un color, se dibuja como `strokeRect` de 2 px de ese color. `clasico` lo tiene en `null`.

El `glow` se aplica **solo a la pieza activa y a la pieza siguiente**, nunca a los bloques asentados ni al fantasma ni a la grilla, y solo si `glow > 0`. Con `clasico` y `retro` en `0` no se toca `shadowBlur` en ningún frame.

### Lo que este spec no cambia del contrato

`GameSnapshot` no se toca: la skin es entrada del motor, no salida. El HUD no se entera de qué paleta se está usando más allá del label de su propio botón. `Escape` y `P` las sigue atando `<Reproductor>`. Nada corre al importar un módulo de motor. La paleta sigue siendo **constantes del motor y nunca leída del DOM**: no hay `getComputedStyle` ni lectura de custom properties en runtime, por la misma razón que el comentario de las líneas 44–50 de `tetris/engine.ts` ya deja escrita.

### Dónde vive la preferencia

Una sola clave de `localStorage`, `av_skin`, con un mapa por juego:

```json
{ "tetris": "retro", "snake": "neon" }
```

Una clave y no `av_skin_<id>` porque así es **una lectura, un `JSON.parse` y un efecto espejo**, calcado de `av_muted`. Se lee **en un efecto y nunca durante el render**: leerlo en el render rompe la hidratación y lanza en el servidor.

Un `gameId` sin entrada, un valor que no está en `SKIN_IDS`, un JSON corrupto, un `localStorage` deshabilitado por modo privado o un valor que no es un objeto caen todos a `clasico`.

## Plan de implementación

1. **P0 — El chasís de tipos.** Agregar `SkinId`, `SKIN_IDS`, `skin?` en `EngineOptions` y `setSkin()` en `EngineHandle` en `lib/games/types.ts`, y el `setSkin() {}` no-op en los handles de `asteroides`, `arkanoid` y `snake`. Verificación: `npx tsc --noEmit` pasa, y el juego se ve exactamente igual porque ningún motor usa todavía el campo.
2. **P1 — El conducto y el selector.** La prop `skin` en `<GameCanvas>` (ref + efecto + `EngineOptions.skin` al crear) y, en `<Reproductor>`, el estado `skin`, los dos efectos de `av_skin` y el botón que cicla las tres. Verificación: en el browser, ciclar el botón no rompe nada aunque los cuatro motores sigan en no-op, y recargar la página conserva la elección.
3. **P2 — Las tres paletas de Tetris.** El record `SKINS` en `lib/games/tetris/engine.ts` con `clasico` llenada moviendo los literales que ya estaban, borrar las cuatro constantes huérfanas, el `setSkin()` real, el anillo hueco y el contorno del fantasma. Verificación: jugar las tres skins en `/jugar/tetris` y sacar una captura de cada una.
4. **P3 — Verificar.** `npx tsc --noEmit`, `npx eslint app components lib`, las tres capturas y la tabla de ratios de `02-diseno.md` con todos los números por encima de su piso.

## Criterios de aceptación

- [ ] `npx tsc --noEmit` termina sin errores.
- [ ] `npx eslint app components lib` termina sin errores ni warnings.
- [ ] Con `av_skin` vacío, `/jugar/tetris` arranca en `clasico` y los ocho hex que pinta son los mismos que pintaba antes de este spec.
- [ ] El HUD muestra el botón de skin **solo** en los cuatro juegos con motor, igual que el de silencio.
- [ ] Pulsar el botón cicla `CLÁSICO → NEÓN → RETRO → CLÁSICO` y la paleta cambia **sin reiniciar la partida**: el puntaje, el nivel, las líneas y la posición de la pieza siguen iguales.
- [ ] Recargar `/jugar/tetris` conserva la skin elegida.
- [ ] Elegir `retro` en `/jugar/tetris` y entrar a `/jugar/snake` deja a Snake en `clasico`.
- [ ] Con `localStorage` deshabilitado, `/jugar/tetris` carga en `clasico` y no lanza ningún error en consola.
- [ ] En `retro`, las ocho piezas son distinguibles entre sí: cuatro luminancias con ≥ 1.5:1 entre vecinas y dos tratamientos de relleno.
- [ ] En `neon` y en `retro`, todas las piezas están en ≥ 4.5:1 contra `#000` y el fantasma en ≥ 3:1.
- [ ] Los motores de `asteroides`, `arkanoid` y `snake` se ven idénticos a como se veían antes de este spec, en cualquier valor de `av_skin`.
- [ ] En `neon`, `shadowBlur` se aplica como máximo a 16 celdas por frame (la pieza activa y la siguiente).

## Decisiones

- **Sí:** `clasico` se extrae literal, incluidos sus dos valores por debajo del piso. El criterio de aceptación más fuerte es que introducir skins no cambie lo que ya se veía.
- **No:** corregir el violeta de la T (`#aa00ff`, 4.15:1) en `clasico`. Sí se corrige en `neon`, donde es una paleta nueva y el piso manda.
- **Sí:** conservar los ocho matices de `clasico` en `neon`, saturados. Reasignar matices le haría perder al jugador la lectura de pieza que ya trae.
- **No:** limitar `neon` a los hex de `app/globals.css`. **No hay token violeta, azul ni naranja** en `:root`, y esas tres piezas ya usan hex fuera de la paleta del portal desde el SPEC 07. `#c04dff`, `#00b4ff` y `#ff9100` son los tres colores heredados llevados al piso de contraste sin salirse de su matiz. Los otros cinco sí son tokens (`--cyan`, `--yellow`, `--green`, `--magenta`, `--silver`).
- **Sí:** el segundo eje de `retro` es el relleno (sólido contra anillo hueco). Es lo único que da ocho combinaciones distinguibles con un solo matiz, y es una diferencia de forma: sobrevive al monocromo y al daltonismo por igual.
- **No:** ocho luminancias en `retro`. `4.5 × 1.5⁷ = 76.89:1` contra un máximo de `21:1`: no existe.
- **Sí:** `#a0ffa0` —verde lavado con blanco— como tope de la rampa de `retro`. Verde puro tope da 15.30:1 y con ese techo los cuatro escalones no cierran; lavado sube a 17.31:1 y sí. Sigue siendo un solo matiz.
- **Sí:** el fantasma pasa a contorno en `neon` y `retro`, con `ghostStroke`. El relleno a `alpha` hereda la luminancia de la pieza y con la más oscura no llega ni a 1.7:1. `clasico` lo deja en `null` y sigue igual.
- **Sí:** la grilla queda **exenta** del piso estructural de 3:1 en las tres skins. No delimita nada —eso lo hacen las bandas negras del mundo y el marco CRT del reproductor— y a 3:1 competiría con los bloques por atención. En `clasico` además está prohibido cambiarla.
- **Sí:** `glow` solo en la pieza activa y la siguiente. Un tablero lleno son 200 celdas y el comentario de la línea 465 de `arkanoid` ya dejó escrito lo que 200 `shadowBlur` por frame le hacen a los 60 fps. El tope acá son 16.
- **No:** `shadowBlur` en `retro`. El halo del fósforo ya lo pone el marco CRT; duplicarlo emborronaría la luminancia, que es el único canal que carga información en esa skin.
- **Sí:** `av_skin` es un mapa por juego en una sola clave. Una preferencia global sería un bug: la paleta de Snake no tiene nada que ver con la de Tetris.
- **No:** `av_skin_<id>`, una clave por juego. Un mapa es una lectura y un `JSON.parse`, calcado de `av_muted`.
- **Sí:** el selector es un botón que cicla, con la skin actual como label. Un `<select>` necesitaría CSS nuevo en `app/globals.css`, y la regla del repo al portar pantallas ha sido no escribir CSS nuevo. El botón reusa `.btn ghost`, la misma clase del botón de silencio.
- **Sí:** las skins son entrada del motor y no salida. `GameSnapshot` no crece.
- **No:** leer los colores de `:root` con `getComputedStyle`. Un motor que necesita una hoja de estilos para dibujar falla en silencio, y el comentario de las líneas 44–50 de `tetris/engine.ts` ya rechazó ese camino una vez.
- **Sí:** `asteroides`, `arkanoid` y `snake` implementan `setSkin()` como no-op. Es el precedente exacto de `setMuted()` en los motores mudos, ya argumentado en `types.ts`.
- **Sí:** este spec toca `components/game-canvas.tsx`, que no es un archivo que el subagente escriba normalmente. Es inevitable: `EngineOptions` lo construye únicamente `<GameCanvas>`, y sin ese conducto el campo `skin` quedaría huérfano. El cambio es de cuatro líneas y estrictamente análogo al de `muted`.

## Riesgos

| Riesgo                                                                                 | Mitigación                                                                                                                                       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mover las constantes a `SKINS` cambia sin querer lo que se ve en `clasico`.            | `clasico` se llena copiando los literales, y `hollow: false` + `ghostStroke: null` + `glow: 0` dejan los dos caminos nuevos de dibujo inertes.   |
| `JSON.parse` de `av_skin` devuelve algo que no es un objeto (`"null"`, `"5"`).         | La lectura valida que el valor recuperado sea un `string` presente en `SKIN_IDS` antes de usarlo, y todo va dentro de un `try/catch`.            |
| El efecto espejo pisa con `clasico` la preferencia guardada durante el montaje.        | El flag `skinHydrated`, idéntico a `mutedHydrated`: el espejo no escribe hasta que la lectura terminó.                                           |
| El glow de `neon` hunde los fps con el tablero lleno.                                  | El glow se aplica solo a la pieza activa y a la siguiente: 16 celdas como máximo, contra las 200 que tiene un tablero completo.                  |
| El anillo hueco se ve como un bloque sólido con `NEXT_BLOCK` chico en la vista previa. | El espesor es `max(2, size/6)`: con `size = 30` son 5 px de marco sobre 28 px de bloque, y el hueco central mide 18 px.                          |
| Un jugador con `retro` guardado ve un frame en `clasico` antes de que aplique la skin. | La skin inicial viaja en `EngineOptions.skin`, aplicada en la creación del motor y no con un `setSkin()` posterior. Mismo argumento que `muted`. |

## Lo que **no** entra en esta spec

- **Corregir el violeta de la T de `clasico`** (`#aa00ff`, 4.15:1 contra un piso de 4.5:1). Es el único color del juego por debajo del piso de información y se queda como está. `neon` lo resuelve en su propia paleta con `#c04dff` (5.75:1).
- **Corregir la grilla de `clasico`** (`rgba(0, 245, 255, 0.08)`, 1.11:1 contra un piso estructural de 3:1). Está exenta por diseño, y en `clasico` además es intocable.
- **Las skins de los otros tres motores.** `asteroides`, `arkanoid` y `snake` quedan en no-op. Cada uno es una corrida propia.
- **Skins para los nueve juegos sin motor.** No dibujan nada.
- **Una skin que alcance al CSS del portal.** El marco CRT, el HUD, las tarjetas y las portadas `.cover-*` no cambian con la skin.
- **Sincronizar la preferencia entre dispositivos.** `localStorage` y nada más.
- **Un selector de skin fuera del reproductor** (en el Detalle del juego o en la Biblioteca).

Cada una de esas, si aterriza, va en su propia spec.
