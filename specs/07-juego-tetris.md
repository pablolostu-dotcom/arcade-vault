# SPEC 07 — TETRIS: el segundo juego jugable del vault

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-09-05
> **Objective:** Portar el Tetris de `references/started-games/03-tetris/` a un motor de canvas en TypeScript y montarlo en `/jugar/tetris` como décimo juego del catálogo, generalizando de paso el contrato del motor que el SPEC 05 dejó atado a asteroides.

## Por qué existe este spec

El SPEC 05 dejó una promesa escrita en su sección de decisiones: un registro `id → motor` con import dinámico existe "aunque hoy tenga una sola fila", porque es "la diferencia entre 'el segundo juego es una línea' y 'el segundo juego vuelve a tocar `<Reproductor>`'". Este es el spec que cobra esa promesa — y el que descubre las dos cosas que el SPEC 05 no podía saber con un solo juego montado.

En `references/started-games/03-tetris/` hay un Tetris completo: 332 líneas de canvas 2D sin dependencias, con rotación con wall kicks, ghost piece, vista previa de la siguiente pieza, soft y hard drop, puntuación clásica y niveles que aceleran la caída. Está probado y balanceado. **Este spec no diseña un juego: lo adapta.**

La adaptación tiene cuatro fricciones reales, y son las que justifican que esto sea un spec y no una línea en `ENGINES`:

1. **El contrato del motor está escrito para asteroides.** `GameSnapshot` vive dentro de `lib/games/asteroides/engine.ts` y tiene `tripleShot` adentro — un power-up que solo existe en ese juego. `registry.ts`, `components/game-canvas.tsx` y `components/reproductor.tsx` importan los tres tipos desde ahí. El segundo motor no puede nacer importando del primero.
2. **Tetris no tiene vidas, y el HUD del portal pinta un slot `♥` fijo.** Lo que Tetris sí tiene y asteroides no es un contador de líneas, que es además el que gobierna el nivel y la velocidad de caída.
3. **El tablero es 300×600 y el mundo del chasis es 800×600.** `components/game-canvas.tsx` tiene `WORLD_W = 800` y `WORLD_H = 600` como constantes de módulo, y `.game-canvas` es `aspect-ratio: 4 / 3`. Un tablero 1:2 no entra en un marco 4:3 sin decidir qué pasa alrededor.
4. **El juego trae DOM propio que el portal ya provee.** `index.html` tiene un sidebar con `SCORE / LINES / LEVEL`, un segundo `<canvas>` para la vista previa, un overlay compartido para PAUSA y GAME OVER con botón "Reiniciar", y un toggle de tema claro/oscuro con `localStorage`. El reproductor ya tiene HUD, overlay de pausa, modal de fin de partida y JUGAR DE NUEVO.

Hay además un detalle del código de referencia que conviene decir en voz alta, porque el README lo contradice: **`PIECES` tiene ocho entradas, no siete.** La octava es `N (tuerca)`, un anillo 3×3 gris (`[[8,8,8],[8,0,8],[8,8,8]]`), y `randomPiece()` sortea `1..8`, así que sale con la misma probabilidad que una I o una T. El README dice "las 7 piezas estándar". Manda el código.

## Alcance

**Dentro:**

- `lib/games/types.ts` — los tres tipos compartidos (`GameSnapshot`, `EngineHandle`, `EngineOptions`) hoisteados fuera de asteroides, con `lives` y `extra` opcionales.
- `lib/games/tetris/engine.ts` — el port completo de `game.js` a TypeScript: el tablero, las ocho piezas, la rotación con wall kicks, el ghost, la vista previa, el loop y el estado, encapsulados en `createTetrisEngine(canvas, options)`.
- La segunda fila de `ENGINES` en `lib/games/registry.ts`.
- `supabase/migrations/<ts>_add_game_tetris.sql` — el `insert into public.games` de la décima fila.
- `.cover-tetris` en `app/globals.css` — arte CSS puro, como las otras nueve portadas.
- Cambios en `components/reproductor.tsx`: el slot de vidas se muestra solo si el motor lo reporta, el slot `extra` reemplaza al contador fijo de triple disparo, la tecla `P` pausa junto a `Escape`, y el subtítulo del aviso de teclado se vuelve genérico.
- El repintado del motor con la paleta neón del portal.

**Fuera de alcance (para specs futuras):**

- **Los otros ocho juegos simulados.** `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria` y `duelo-pixel` siguen exactamente con el puntaje simulado.
- **Fusionar o retirar `caida`.** La fila mock que describe un Tetris se queda como está, con su `sort_order` 2, su acento magenta y su `cover-tetro`.
- **Dimensiones de mundo por juego.** `components/game-canvas.tsx` sigue con `WORLD_W = 800` y `WORLD_H = 600` fijos y `.game-canvas` sigue en 4:3.
- **El toggle claro/oscuro** del juego de referencia y su clave `tetris-theme`.
- **Sonido.** El juego de referencia no tiene audio y este spec no lo inventa, por la misma razón que el SPEC 05: agregarlo es diseñar la política de autoplay y el control de silencio.
- **Hold piece, bolsa de 7, lock delay, T-spins** o cualquier mecánica moderna que el original no implementa.
- **Rebalancear.** `LINE_SCORES`, `dropInterval`, los wall kicks y la probabilidad de cada pieza se portan con sus valores.
- **Controles táctiles en pantalla.** Solo teclado, con el aviso que ya existe.
- **Récord personal en el HUD.**
- **Tests automatizados.** El repo no tiene test runner y este spec no instala uno.
- **Tocar `app/juegos/`, `app/jugar/`, `app/salon/`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts` ni `app/jugar/actions.ts`.** Todo eso es catalog-driven: el juego aparece solo, y la tab del Salón también.

## Modelo de datos

No hay ninguna estructura persistida nueva ni ningún cambio de esquema: el puntaje termina en `public.scores` con `game_id = 'tetris'`, por el mismo camino que abrió el SPEC 06. Lo que se introduce es la fila del catálogo y el contrato generalizado del motor.

### La fila del catálogo

`games` tiene RLS activa y su única política es de SELECT: sin política de INSERT, la operación queda negada para todos. La fila entra por migración y por ningún otro camino.

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values ('tetris', 'TETRIS',
        'Encaja tetrominós y limpia líneas antes de tocar el techo.',
        'Ocho piezas caen sobre un pozo de diez columnas y veinte filas: rótalas con wall kicks, proyéctalas con la pieza fantasma y encástralas sin dejar huecos. Cada diez líneas sube el nivel y la caída se acelera hasta el límite. La partida termina cuando la pieza que aparece ya no encuentra sitio.',
        'PUZZLE', 'cover-tetris', 'cyan', 10);
```

`"long"` va siempre entre comillas: es palabra reservada. `sort_order` 10 es el más alto del seed (9, `asteroides`) más uno. `cat` y `color` salen de los valores de los CHECK constraints; no se agrega ninguno.

Agregar una fila **no** cambia el esquema: `npm run db:types` no hace falta en este spec.

### El contrato del motor

Los tres tipos se mudan a un módulo propio y `GameSnapshot` deja de conocer power-ups:

```ts
// lib/games/types.ts
export type GameStatus = "playing" | "dead" | "gameover";

/** Lo único que un motor le cuenta a React. */
export type GameSnapshot = {
  score: number;
  level: number;
  status: GameStatus;
  /** Solo los juegos que tienen el concepto. Ausente ⇒ el HUD oculta el slot ♥. */
  lives?: number;
  /** El stat propio del juego. Ausente ⇒ el HUD no lo pinta. */
  extra?: { label: string; value: string };
};

export type EngineHandle = {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void; // el botón FIN: fuerza el game over
  destroy(): void; // cancela el rAF y quita los listeners
};

export type EngineOptions = {
  /** Se llama SOLO cuando algún valor del snapshot cambió, no en cada frame. */
  onSnapshot(snapshot: GameSnapshot): void;
  onGameOver(finalScore: number): void;
};
```

Cada motor llena lo suyo:

| Motor        | `lives` | `extra`                                                                                  |
| ------------ | ------- | ---------------------------------------------------------------------------------------- |
| `asteroides` | `3 → 0` | `{ label: "Triple disparo", value: "3x · 4.2s" }`, solo mientras el power-up está activo |
| `tetris`     | ausente | `{ label: "Líneas", value: "37" }`, siempre                                              |

```ts
// lib/games/tetris/engine.ts
export function createTetrisEngine(canvas: HTMLCanvasElement, options: EngineOptions): EngineHandle;
```

```ts
// lib/games/registry.ts — la línea que se agrega
tetris: () => import("./tetris/engine").then((m) => m.createTetrisEngine),
```

`lib/games/asteroides/engine.ts` deja de declarar los tres tipos: `registry.ts`, `game-canvas.tsx` y `reproductor.tsx` actualizan su import a `lib/games/types.ts`. No se deja un reexport de compatibilidad.

### Constantes del port

Se portan con sus valores: `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, `LINE_SCORES = [0, 100, 300, 500, 800]`, `dropInterval = max(100, 1000 − (level − 1) × 90)`, `level = floor(lines / 10) + 1`, hard drop +2 por celda, soft drop +1 por fila, wall kicks `[0, −1, +1, −2, +2]`, ghost a `globalAlpha = 0.2`, y las **ocho** piezas con su sorteo uniforme.

El encuadre dentro del mundo 800×600, con el conjunto tablero + vista previa centrado:

```ts
const WORLD_W = 800; // el mundo del chasis, sin cambios
const WORLD_H = 600;
const BOARD_X = 170; // tablero: x 170..470 (COLS × BLOCK = 300)
const BOARD_Y = 0; //           y 0..600   (ROWS × BLOCK = 600)
const NEXT_X = 510; // vista previa: 120×120, a 40px del tablero
const NEXT_Y = 60;
```

Las bandas de `0..170` y `630..800` quedan en negro. El motor sigue razonando en coordenadas del mundo, igual que asteroides: **cero cambios de física**.

## Plan de implementación

1. **La migración del catálogo y la portada.** El `.sql` con el insert literal de arriba en `supabase/migrations/`, aplicado al proyecto remoto, más `.cover-tetris` en `app/globals.css`: arte CSS puro, cero archivos de imagen — el pozo oscuro, un muro de bloques apilados con huecos en la base y una pieza I en `--cyan` cayendo con su fantasma tenue encima. `.cover-tetro` (de CAÍDA) no se toca.
   _Verificación:_ `/juegos` muestra diez tarjetas, TETRIS aparece bajo el filtro `PUZZLE` y bajo `TODOS`, `/juegos/tetris` renderiza el detalle con su portada, `/salon` muestra la tab nueva vacía, y `/jugar/tetris` corre **con el puntaje simulado**, igual que los otros ocho. Nada se rompió porque nada nuevo se montó.

2. **Hoistear los tipos** a `lib/games/types.ts`, con `lives` y `extra` opcionales. `lib/games/asteroides/engine.ts` importa de ahí y deja de exportarlos; `registry.ts`, `components/game-canvas.tsx` y `components/reproductor.tsx` actualizan su import. El motor de asteroides emite `lives` como hasta ahora y `tripleShot` pasa a `extra`, con el formateo (`3x · 4.2s`) hecho en el motor en vez de en el HUD. La comparación de igualdad de `emitSnapshot()` compara `extra.value` como string, que ya viene redondeado a un decimal.
   _Verificación:_ `npx tsc --noEmit` pasa, `npx eslint app lib components` no reporta errores, y `/jugar/asteroides` se comporta **exactamente** igual que antes: mismo HUD, mismas vidas, mismo contador `3x` apareciendo y desapareciendo. Este paso no cambia comportamiento.

3. **El motor** (`lib/games/tetris/engine.ts`). Port de `game.js` a TypeScript dentro de `createTetrisEngine(canvas, options)`:
   - El tablero, `randomPiece`, `collide`, `rotateCW`, `tryRotate`, `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece` y `spawn` se portan **sin cambios de lógica**, tipados, tomando `ctx` del closure.
   - **Nada corre al importar el archivo.** El `init()` de la última línea de `game.js` desaparece; todo efecto vive dentro de `start()`.
   - Los listeners de teclado se registran en `start()` sobre `window` y se quitan en `destroy()`. Hacen `preventDefault()` en `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` y `Space` para que jugar no scrollee la página.
   - `pause()` cancela el `requestAnimationFrame`; `resume()` lo vuelve a pedir **y resetea `lastTime` a `null`**, para que el primer `dt` después de la pausa no sea el tiempo entero que estuvo pausado. El `dt` queda topeado en 50 ms, igual que en asteroides — sin ese tope, una pestaña en segundo plano vacía `dropAccum` de golpe.
   - `emitSnapshot()` guarda el último snapshot y **solo emite si algo cambió**. Sin esto, React re-renderiza 60 veces por segundo para mostrar el mismo número.
   - Se **eliminan** `updateHUD()` y los `getElementById` de `#score`, `#lines`, `#level`, `#overlay`, `#restart-btn` y `#next-canvas`: el HUD lo pinta React y la vista previa se dibuja en la banda derecha del mismo canvas.
   - Se **elimina** el overlay propio de PAUSA y GAME OVER, y el botón Reiniciar. Al entrar en game over el motor deja de actualizar y llama `onGameOver(score)` **una sola vez**.
   - Se **elimina** el toggle claro/oscuro y su clave `tetris-theme` en `localStorage`.
   - `drawGrid()` deja de leer `--grid-line` con `getComputedStyle`: el color pasa a ser una constante del motor.
   - `end()` marca game over en el acto y dispara el mismo camino que un `spawn()` que colisiona, para que el botón FIN y perder terminen idénticos.
   - `restart()` es el `init()` original más volver a arrancar el loop.

   _Verificación:_ `npx tsc --noEmit` pasa y `npx eslint lib` no reporta errores. El archivo todavía no lo importa nadie.

4. **El registro y el reproductor.** La línea de `tetris` en `ENGINES`, más los ajustes de `<Reproductor>`:
   - `lives` pasa de `number` a `number | null`: arranca en `3` sin motor y en `null` con motor, y se llena con `snapshot.lives ?? null`. El slot `♥ Vidas` se renderiza **solo si `lives !== null`**. Los ocho simulados siguen mostrando `♥ ♥ ♥`.
   - El bloque condicional de `tripleShot` se reemplaza por uno genérico que renderiza `snapshot.extra` cuando viene, con su `label` y su `value`. El estado `tripleShot` desaparece.
   - La tecla `P` se suma a `Escape` en el efecto que ya existe, y solo corre con motor: los ocho simulados tienen que comportarse igual que antes.
   - El subtítulo del aviso de teclado pasa a ser genérico ("Conecta uno para jugar"); el título ya usa `game.title`, así que se adapta solo.
   - `restart()` resetea `lives` a `withEngine ? null : 3`.
   - `.game-canvas` **no cambia**: sigue en 4:3, sin `pointer-events` y sin foco. Tetris se juega solo con teclado.

   _Verificación:_ `/jugar/tetris` se juega: las piezas caen, `←` `→` mueven, `↑` y `X` rotan con wall kicks, `↓` es soft drop, `Espacio` es hard drop y no scrollea la página, la vista previa se ve a la derecha del tablero, el HUD muestra Jugador · Puntuación · Líneas · Nivel y **no** muestra el slot de vidas. `/jugar/asteroides` sigue mostrando vidas y el contador `3x`. `/jugar/caida` sigue simulado y sin cambios visibles.

5. **Paleta y avisos.** Repintar el motor con los acentos del portal, declarados como constantes (**nunca leídos del DOM**: un motor que necesita una hoja de estilos para dibujar falla en silencio): I `#00f5ff` (`--cyan`), O `#f5ff00` (`--yellow`), T `#aa00ff`, S `#00ff88` (`--green`), Z `#ff006e` (`--magenta`), J `#00a2ff`, L `#ff7700`, y la tuerca en `#8a8fb5` (`--ink-dim`), como los asteroides. La grilla en `rgba(0,245,255,0.08)`, el fondo del pozo en negro y el brillo superior de cada bloque (`rgba(255,255,255,0.12)`) se conserva del original. El aviso de puntero grueso ya existe en `globals.css` y no se toca: solo cambia su subtítulo en `<Reproductor>`.
   _Verificación:_ el juego se lee como parte del portal dentro del marco CRT; en un viewport táctil simulado aparece "TETRIS REQUIERE TECLADO" y en uno de escritorio no.

6. **Repaso final.** Las diez rutas de `/juegos/<id>` y `/jugar/<id>` responden 200, las pantallas anteriores se ven idénticas, y la consola queda limpia después de jugar una partida completa y de navegar cinco veces entre `/jugar/tetris` y `/juegos`.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni errores de tipos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npx eslint app lib components` no reporta errores.
- [ ] `select id, sort_order from games order by sort_order` devuelve **diez** filas, con `tetris` última en `sort_order` 10.
- [ ] `/juegos` muestra **diez** tarjetas y TETRIS aparece bajo el filtro `PUZZLE` y bajo `TODOS`.
- [ ] `.cover-tetris` es arte CSS puro: no se agregó ningún archivo de imagen al repo.
- [ ] `/juegos/tetris` y `/jugar/tetris` responden 200.
- [ ] `/salon` muestra una tab nueva con el ranking de TETRIS.
- [ ] `lib/games/types.ts` existe y `GameSnapshot` **no** menciona `tripleShot`.
- [ ] En `/jugar/tetris` las piezas caen solas, `←` y `→` mueven, `↑` y `X` rotan, `↓` acelera la caída y `Espacio` la proyecta hasta el fondo.
- [ ] Pulsar `↑`, `↓` o `Espacio` **no** scrollea la página.
- [ ] Una rotación pegada a la pared desplaza la pieza hasta 2 columnas antes de descartarse (wall kicks).
- [ ] La pieza fantasma se dibuja translúcida en la posición de aterrizaje de la pieza actual.
- [ ] La vista previa de la pieza siguiente se dibuja a la derecha del tablero, dentro del mismo canvas.
- [ ] Sale la pieza `N (tuerca)` — el anillo 3×3 — con la misma frecuencia que las otras siete.
- [ ] Completar 1 / 2 / 3 / 4 líneas suma 100 / 300 / 500 / 800 multiplicado por el nivel; el hard drop suma 2 por celda y el soft drop 1 por fila.
- [ ] El nivel sube cada 10 líneas y la caída se acelera; a partir del nivel 11 el intervalo se queda en 100 ms.
- [ ] El HUD de React muestra Jugador · Puntuación · **Líneas** · Nivel, con los valores reales del motor.
- [ ] El HUD **no** muestra el slot `♥ Vidas` en `/jugar/tetris`, y **sí** lo muestra en `/jugar/asteroides` y en los ocho simulados.
- [ ] El canvas **no** dibuja ningún HUD, ni overlay de pausa, ni overlay de game over, ni botón de reinicio.
- [ ] No existe ningún toggle de tema ni se escribe la clave `tetris-theme` en `localStorage`.
- [ ] PAUSA congela el juego por completo y REANUDAR lo sigue desde donde estaba, sin un salto proporcional al tiempo pausado.
- [ ] `Escape` y `P` pausan y reanudan igual que el botón.
- [ ] El botón FIN termina la partida en el acto y abre el modal.
- [ ] Que una pieza nueva no encuentre sitio abre el modal **una sola vez** con el puntaje real.
- [ ] Guardar desde el modal inserta una fila en `scores` con `game_id = 'tetris'`, y recargar `/juegos/tetris` la muestra en el top-10 y actualiza `Mejor global` y `Partidas`.
- [ ] JUGAR DE NUEVO reinicia el juego en 0 puntos, 0 líneas, nivel 1 y tablero vacío.
- [ ] En `/jugar/asteroides` el HUD sigue mostrando vidas y el contador `3x · N.Ns` mientras el power-up está activo, exactamente igual que antes de este spec.
- [ ] `/jugar/caida` y los otros siete siguen con el puntaje simulado y se ven exactamente igual que antes del spec.
- [ ] Navegar cinco veces entre `/jugar/tetris` y `/juegos` no acelera el juego ni duplica el puntaje.
- [ ] El motor de tetris no aparece en el bundle compartido de `/jugar/[id]`, y el de asteroides tampoco.
- [ ] En un viewport con `pointer: coarse` aparece "TETRIS REQUIERE TECLADO"; en escritorio no.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna ruta.
- [ ] `app/juegos/`, `app/jugar/`, `app/salon/`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts` y `app/jugar/actions.ts` no fueron modificados.

## Decisiones

- **Sí:** una fila nueva `tetris` en vez de darle motor a `caida`. `caida` describe con precisión este juego, pero es una de las nueve tarjetas mock del catálogo original y tiene su propio acento, su propia portada y su `sort_order` 2. Darle motor implicaría también decidir qué hacer con su título inventado, y ese es el mismo debate de fusionar dos filas — que merece su spec. La fila nueva dice exactamente qué es y deja clarísimo cuál de las dos tarjetas es la jugable.
- **Sí:** `TETRIS` como título, con el nombre real del juego, siguiendo el criterio de `ASTEROIDES`. Los nombres inventados en español son de las tarjetas mock; los juegos portados llevan el suyo.
- **Sí:** acento `cyan`, el color de la pieza I en el original. Deja `magenta` para `caida`, que es la otra tarjeta de piezas que caen: dos entradas del mismo género con el mismo acento se leen como duplicados.
- **Sí:** hoistear los tres tipos a `lib/games/types.ts` con `lives` y `extra` opcionales. Es lo que hace que el tercer juego no tenga que discutir esto otra vez. La alternativa de acumular un campo por juego (`tripleShot`, `lines`, `bricks`, …) convierte `GameSnapshot` en la unión de todos los HUD posibles del catálogo.
- **No:** un reexport de compatibilidad en `lib/games/asteroides/engine.ts`. Son tres imports en tres archivos: actualizarlos cuesta menos que dejar una capa que nadie va a borrar.
- **Sí:** el motor formatea `extra.value` a string. Que el HUD sepa que `3x · 4.2s` sale de un número de segundos es exactamente el acoplamiento que este spec vino a cortar, y la comparación de igualdad del snapshot se vuelve una comparación de strings, sin redondeos especiales.
- **Sí:** el mundo sigue siendo 800×600 y el tablero de 300×600 va centrado, con la vista previa en la banda derecha. Hacer las dimensiones configurables por juego significa tocar `components/game-canvas.tsx` y `.game-canvas`, que son el chasis compartido de los diez juegos, para resolver un problema que se resuelve con dos constantes dentro del motor nuevo. Además la banda derecha le da sitio natural a la vista previa, que en el original era un segundo `<canvas>` del DOM.
- **Sí:** la vista previa se dibuja en el canvas y el contador de líneas en el HUD de React. La vista previa es un elemento de juego —cambia decisiones del jugador—; el contador de líneas es información de partida, y esa la pinta React en todo el portal.
- **Sí:** la pieza `N (tuerca)` se porta. La regla del proyecto es no rebalancear: las constantes se portan con sus valores. Está en el código que funciona, sale con probabilidad uniforme y le da identidad propia frente a un Tetris genérico. El README del juego dice "7 piezas estándar" y se equivoca.
- **Sí:** `P` y `Escape` pausan las dos. El jugador que viene del original encuentra su tecla y el que viene del portal, la suya; el overlay que se ve es siempre el de React.
- **Sí:** el HUD, el overlay, el botón Reiniciar y el toggle de tema se **eliminan**, no se ocultan. Es la misma decisión del SPEC 05: código muerto que dibuja encima es peor que código borrado. El toggle además no tiene dónde vivir — el portal tiene un solo tema y diseñar un modo claro para la paleta neón es un spec entero.
- **Sí:** los colores son constantes del motor y no se leen del DOM. `drawGrid()` del original lee `--grid-line` con `getComputedStyle`, una variable que en `app/globals.css` no existe: importado tal cual, el motor dibujaría la grilla con un `strokeStyle` vacío y en silencio.
- **No:** rebalancear nada. `LINE_SCORES`, la curva de `dropInterval`, los wall kicks y el sorteo uniforme de las ocho piezas se portan con sus valores. Si el juego resulta difícil o fácil, se ajusta después, con el juego andando y midiendo.
- **No:** hold piece, bolsa de 7, lock delay ni T-spins. El original no las implementa y agregarlas es diseñar un juego distinto del que está probado.
- **No:** sonido, controles táctiles ni récord personal en el HUD, por las mismas razones que el SPEC 05.

## Riesgos

| Riesgo                                                                                                       | Mitigación                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hoistear los tipos rompe asteroides en silencio: el HUD deja de mostrar el contador `3x` o las vidas         | El paso 2 es un paso propio del plan, sin cambio de comportamiento, y su verificación es explícitamente "asteroides se comporta exactamente igual". Hay criterios de aceptación separados para el slot de vidas y el de `extra`. |
| El slot de vidas queda oculto también para los ocho juegos simulados                                         | `lives` arranca en `3` cuando no hay motor y solo pasa a `null` con motor. Hay un criterio de aceptación que lo verifica en los ocho.                                                                                            |
| El tablero 1:2 dentro del mundo 4:3 deja el juego chico o descentrado dentro del marco CRT                   | El conjunto tablero + vista previa se centra con constantes concretas (`BOARD_X = 170`, `NEXT_X = 510`) y ocupa 460 de los 800 de ancho. Las bandas quedan negras y las scanlines del CRT les caen encima igual.                 |
| El motor filtra `requestAnimationFrame` o listeners de teclado al navegar, y las piezas caen al doble        | `destroy()` cancela el rAF y quita los listeners; el `useEffect` de `<GameCanvas>` lo devuelve como cleanup. Hay un criterio que lo verifica navegando cinco veces.                                                              |
| Se importa el motor en un Server Component y el build revienta con `document is not defined`                 | Nada del motor corre al importar el archivo: el `init()` de la última línea del original desaparece y todo efecto vive dentro de `start()`. El registro carga con `import()` dinámico.                                           |
| Con la pestaña en segundo plano, `dropAccum` acumula minutos y al volver la pieza se hunde de golpe          | El `dt` se topea en 50 ms como en asteroides, y `resume()` resetea `lastTime` a `null`.                                                                                                                                          |
| `onSnapshot` dispara `setState` en cada frame y el HUD hunde el rendimiento del juego                        | El motor compara con el último snapshot y solo emite cuando algo cambió. Con `extra.value` ya formateado como string, la comparación es exacta.                                                                                  |
| Las flechas y el Espacio scrollean la página mientras se juega                                               | `preventDefault()` en las cinco teclas del juego, registrado y quitado junto con el motor.                                                                                                                                       |
| `P` pausa mientras el jugador escribe sus iniciales en el modal de fin de partida                            | `togglePause` ya sale temprano cuando `over` es `true`, así que la tecla no hace nada con el modal abierto. El criterio de aceptación de guardar el puntaje lo cubre de punta a punta.                                           |
| La migración se aplica dos veces y falla por clave primaria duplicada                                        | `games.id` es la primary key: el segundo intento falla en vez de duplicar la tarjeta. `select id, sort_order from games order by sort_order` es el criterio de verificación.                                                     |
| El motor de tetris entra en el bundle compartido de `/jugar/[id]` y los nueve juegos restantes pagan su peso | El registro usa `import()` dinámico, igual que asteroides. Hay un criterio de aceptación sobre el build que verifica los dos motores.                                                                                            |

## Lo que **no** entra en esta spec

- Motores para los ocho juegos simulados que quedan.
- Fusionar, renombrar o retirar la fila `caida` del catálogo.
- Dimensiones de mundo o `aspect-ratio` configurables por juego en `components/game-canvas.tsx`.
- El modo claro/oscuro del juego de referencia.
- Hold piece, bolsa de 7, lock delay, T-spins o cualquier mecánica que el original no implementa.
- Sonido, música o control de volumen.
- Controles táctiles en pantalla.
- Récord personal en el HUD.
- Tests automatizados.

Cada una de esas, si aparece, va en su propia spec.
