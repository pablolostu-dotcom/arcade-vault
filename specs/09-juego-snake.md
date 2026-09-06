# SPEC 09 — SNAKE: el cuarto juego jugable y el primero diseñado desde cero

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-09-06
> **Objective:** Diseñar un Snake completo —reglas, balance y motor— y montarlo en `/jugar/snake` como duodécimo juego del catálogo, con las frutas dibujadas desde un atlas de sprites recortado.

## Por qué existe este spec

Los tres juegos con motor que hay hoy son ports. `references/started-games/` traía el código, probado y balanceado, y el spec decidía **cómo adaptarlo** al chasis. Este no: no hay juego de referencia. Lo único que hay es `references/source-assets/snake-assets/` con un atlas de frutas de 3790×442 y un `sprites.js` con las coordenadas de sus 22 recortes. **Este spec diseña un juego, no adapta uno.** Las constantes que se escriben acá no se portan de ningún lado: se eligen.

La contracara es una buena noticia, y es grande: **este es el primer juego que no mueve el chasis.** Cada spec anterior tuvo que ensancharlo.

- El SPEC 05 inventó el contrato (`EngineHandle`, `EngineOptions`, `GameSnapshot`) y lo dejó dentro del motor de asteroides, con `tripleShot` adentro.
- El SPEC 07 lo hoisteó a `lib/games/types.ts` y volvió opcionales `lives` y `extra`, además de atar `P` a la pausa.
- El SPEC 08 le sumó `setMuted()`, la prop `muted` de `<GameCanvas>`, el botón de silencio del HUD y `pointer-events: auto`.

Snake no necesita nada de eso. `GameSnapshot` ya modela un juego sin vidas —Tetris lo estrenó— y ya tiene el slot `extra`. `EngineHandle` ya tiene `setMuted()`. `Escape` y `P` ya pausan desde React. `.game-canvas` ya es `aspect-ratio: 4 / 3`, y una grilla de 32×24 celdas de 25 px llena 800×600 exacto, sin bandas ni reencuadre. **`lib/games/types.ts`, `components/reproductor.tsx` y `components/game-canvas.tsx` no se tocan.** El único archivo compartido que cambia es `lib/games/registry.ts`, y cambia en una línea.

Las fricciones reales son otras cuatro:

1. **No hay código que porte el balance.** Tamaño de grilla, velocidad del tic, curva de aceleración, valor de cada fruta y fórmula del puntaje son decisiones, no constantes copiadas. Están todas en **Modelo de datos**, con su número.
2. **Los sprites rompen un precedente de tres specs.** El SPEC 05 descartó los sprites de asteroides, el SPEC 08 descartó el spritesheet de arkanoid, y hoy el repo **no tiene un solo archivo de imagen**: las once portadas del catálogo son arte CSS puro. Este spec mete el primero.
3. **Cargar una imagen rompe `start()` síncrono.** El contrato no modela un estado de carga y este spec no se lo agrega: el juego arranca igual y la fruta se dibuja como respaldo vectorial hasta que el atlas resuelve.
4. **`cover-<slug>` colisiona.** `serpentina` —la tarjeta mock de una Snake— ya usa `cover-snake`, con acento verde y `sort_order` 3. La clase nueva se llama `.cover-serpiente` y el acento es amarillo, para que las dos tarjetas no se lean como duplicadas.

## Alcance

**Dentro:**

- `lib/games/snake/engine.ts` — el motor completo: la grilla, la serpiente, el movimiento por tics, la cola de giros, las tres clases de fruta, la muerte por borde y por mordisco propio, y el dibujo, encapsulados en `createSnakeEngine(canvas, options)`.
- La cuarta fila de `ENGINES` en `lib/games/registry.ts`.
- `supabase/migrations/<ts>_add_game_snake.sql` — el `insert into public.games` de la duodécima fila.
- `.cover-serpiente` en `app/globals.css` — arte CSS puro, como las otras once portadas.
- `public/snake/fruits.png` — el atlas recortado a las 8 frutas que el juego usa, generado una sola vez desde `references/source-assets/snake-assets/fruits.png`.
- Dos efectos de sonido —comer y morir— con licencia CC0, en `public/sounds/snake/`, **o** sintetizados con WebAudio si no se consigue un par con licencia verificable. Los dos caminos están escritos en el paso 5.

**Fuera de alcance (para specs futuras):**

- **Obstáculos y paredes internas.** El tablero queda vacío salvo la serpiente y la fruta. Diseñar layouts de muros para un nivel que no tiene techo es un spec propio.
- **Las 6 verduras del atlas** (ajo, berenjena, brócoli, hongo, pimiento, maní). No entran al recorte ni al juego. Si más adelante se quiere riesgo negativo, va en otro spec.
- **Las otras 8 frutas del atlas** (banana, uva, frutilla, zanahoria, durazno, tomate, moras, uva2). Quedan en `references/`, sin recortar.
- **Controles táctiles y swipe.** Solo teclado, con el aviso que `.keyboard-notice` ya muestra en puntero grueso.
- **Récord personal en el HUD y modo dos jugadores.** Mismos recortes que el SPEC 05 y el SPEC 08.
- **Wrap por los bordes.** Se decidió que el borde mata; el wrap de asteroides no se replica.
- **Vidas.** Snake no tiene el concepto y el HUD ya sabe ocultar el slot.
- **Los ocho juegos simulados.** `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria` y `duelo-pixel` siguen con el puntaje simulado.
- **Fusionar o retirar `serpentina`.** La fila mock que describe una Snake se queda como está, con su `sort_order` 3, su acento verde y su `cover-snake`.
- **Sonido para asteroides y tetris, música de fondo o volumen graduable.** El silencio de dos estados del SPEC 08 alcanza.
- **Tests automatizados.** El repo no tiene test runner y este spec no instala uno.
- **Tocar `app/juegos/`, `app/jugar/`, `app/salon/`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts`, `app/jugar/actions.ts`, `lib/games/types.ts`, `components/reproductor.tsx` ni `components/game-canvas.tsx`.**

## Modelo de datos

No hay ningún cambio de esquema: el puntaje termina en `public.scores` con `game_id = 'snake'`, por el camino que abrió el SPEC 06. Lo que se introduce es la fila del catálogo, las reglas del juego y un atlas de sprites.

### La fila del catálogo

`games` tiene RLS activa y su única política es de SELECT: sin política de INSERT, la operación queda negada para todos. La fila entra por migración y por ningún otro camino.

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values ('snake', 'SNAKE',
        'Come fruta en una grilla que se te va cerrando.',
        'Una serpiente de luz recorre un tablero de treinta y dos por veinticuatro celdas buscando fruta. Cada bocado la alarga y le acelera el paso, de ciento cuarenta milisegundos por tic hasta sesenta. Las frutas raras valen cinco veces más que las comunes y cada una suma tantos puntos como celdas mida la serpiente: el tablero se cierra justo cuando más conviene seguir.',
        'ARCADE', 'cover-serpiente', 'yellow', 12);
```

`"long"` va siempre entre comillas: es palabra reservada. `sort_order` 12 es el más alto de hoy (11, `arkanoid`) más uno. `cat` y `color` salen de los valores de los CHECK constraints de `public.games`; no se agrega ninguno.

Agregar una fila **no** cambia el esquema: `npm run db:types` no hace falta en este spec.

### El contrato del motor

**No cambia nada.** `lib/games/types.ts` queda exactamente como está: el SPEC 07 volvió `lives` y `extra` opcionales, y el SPEC 08 sumó `setMuted()`. Snake nace importando de ahí.

```ts
// lib/games/snake/engine.ts
export function createSnakeEngine(canvas: HTMLCanvasElement, options: EngineOptions): EngineHandle;
```

```ts
// lib/games/registry.ts — la línea que se agrega
snake: () => import("./snake/engine").then((m) => m.createSnakeEngine),
```

Cómo llena cada motor el snapshot, con la fila nueva al final:

| Motor        | `lives` | `extra`                                                                        |
| ------------ | ------- | ------------------------------------------------------------------------------ |
| `asteroides` | `3 → 0` | `{ label: "Triple disparo", value: "3x · 4.2s" }`, solo con el power-up activo |
| `tetris`     | ausente | `{ label: "Líneas", value: "37" }`, siempre                                    |
| `arkanoid`   | `3 → 0` | `{ label: "Velocidad", value: "×1.21" }`, siempre                              |
| `snake`      | ausente | `{ label: "Largo", value: "24" }`, siempre — las celdas que ocupa la serpiente |

`lives` ausente ⇒ `<Reproductor>` oculta el slot `♥` solo, igual que con Tetris. `setMuted()` sí hace algo acá: es el primer juego mudo que deja de serlo, o el cuarto que se queda mudo, según cómo cierre el paso 5.

### El tablero

```ts
const CELL = 25;
const COLS = 32; // 32 × 25 = 800
const ROWS = 24; // 24 × 25 = 600
```

Divide exacto el mundo 800×600 de `components/game-canvas.tsx`, así que `.game-canvas` no cambia: su `aspect-ratio: 4 / 3` ya calza. Las coordenadas del motor son de celda (`{ col, row }`), no de píxel; el dibujo multiplica por `CELL`.

Origen arriba a la izquierda: `col` crece hacia la derecha, `row` hacia abajo.

### La serpiente

```ts
type Direction = "up" | "down" | "left" | "right";

type SnakeState = {
  /** La cabeza es body[0]. Crece por el frente y se recorta por atrás. */
  body: { col: number; row: number }[];
  direction: Direction; // la del último tic
  queue: Direction[]; // giros pendientes, máximo 2
  pendingGrowth: number; // celdas que faltan agregar
};

const START_LENGTH = 3;
const START_HEAD = { col: 16, row: 12 }; // centro del tablero
const START_DIRECTION: Direction = "right";
const QUEUE_MAX = 2;
```

Arranca con 3 celdas en fila mirando a la derecha, con la cabeza en `(16, 12)` y el cuerpo en `(15, 12)` y `(14, 12)`.

**El tic:** cada `tickMs` la serpiente consume un giro de la cola si hay uno, calcula la celda de adelante, y:

- si esa celda está fuera de `[0, COLS) × [0, ROWS)` → **muere**;
- si esa celda es parte de `body` **sin contar la última**, que se va a liberar en este mismo tic → **muere**;
- si esa celda tiene la fruta → come;
- si no → se mueve.

Mover es `body.unshift(nueva)` más `body.pop()`. Comer es `body.unshift(nueva)` sin `pop()`: una celda de crecimiento por fruta, siempre.

### La velocidad

```ts
const TICK_BASE = 140; // ms por tic al empezar
const TICK_STEP = 4; // ms que baja por cada fruta comida
const TICK_FLOOR = 60; // el piso: se llega a las 20 frutas
```

`tickMs = Math.max(TICK_FLOOR, TICK_BASE - fruitsEaten * TICK_STEP)`.

El acumulador de tiempo usa el `dt` del `requestAnimationFrame`, **topeado en 50 ms** como en los otros tres motores: con la pestaña en segundo plano, un `dt` de varios segundos ejecutaría decenas de tics de golpe y la serpiente aparecería estrellada contra una pared sin que nadie la haya visto moverse.

### Las frutas

Tres escalones, con su valor y su probabilidad:

| Escalón  | Frutas               | Valor | Probabilidad | Color del halo |
| -------- | -------------------- | ----- | ------------ | -------------- |
| `common` | manzana, cereza      | 10    | 70 %         | `#00ff88`      |
| `medium` | naranja, kiwi, limón | 25    | 25 %         | `#00f5ff`      |
| `rare`   | sandía, piña, melón  | 50    | 5 %          | `#ff006e`      |

Hay **una sola fruta en el tablero a la vez** y **no caduca**: se queda hasta que la serpiente la come. Al comerla se sortea el escalón por probabilidad, después la fruta dentro del escalón con probabilidad uniforme, y después la celda.

La celda sale de la **lista de celdas libres**, no de reintentos al azar: con la serpiente ocupando 700 de 768 celdas, un `while (ocupada) reintentar` puede tardar arbitrariamente. Construir el array de libres es un recorrido de 768 celdas una vez por fruta, y eso es gratis.

El halo del escalón se dibuja **siempre**, sprite o no: es lo que le dice al jugador de un vistazo cuánto vale la fruta que tiene delante, sin obligarlo a memorizar la tabla.

### El puntaje

```ts
const points = fruit.value * snake.body.length; // largo DESPUÉS de crecer
```

La primera manzana con la serpiente en 3 celdas suma `10 × 4 = 40`. Una sandía con 30 celdas suma `50 × 31 = 1550`. Una partida completa aterriza en el orden de los 10.000–20.000 puntos, que es el rango en el que el Salón de la Fama se lee bien al lado de los otros tres juegos.

El largo que multiplica es el **posterior** a crecer, para que sea el mismo número que el HUD muestra en el slot `Largo` cuando el puntaje sube. Cualquiera de las dos convenciones sirve; lo que no sirve es dejarla sin decidir.

### El nivel

```ts
const FRUITS_PER_LEVEL = 5;
const level = Math.floor(fruitsEaten / FRUITS_PER_LEVEL) + 1;
```

Sube cada 5 frutas y no tiene techo. Es la lectura del tramo de aceleración: el tic toca el piso a las 20 frutas, o sea a mitad del nivel 05.

### Los controles

```ts
const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

const PREVENT_DEFAULT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
```

Se usa `e.code`, como en los otros tres motores. Las cuatro flechas hacen `preventDefault()` para que jugar no scrollee la página; `WASD` no lo necesita.

**La cola de giros** es lo que evita las muertes injustas. La validación de 180° se hace contra **el último elemento de la cola, o contra `direction` si la cola está vacía** — nunca contra `direction` a secas:

- `keydown` con una dirección válida (ni igual ni opuesta a la referencia) → se agrega a `queue`, hasta `QUEUE_MAX = 2` elementos. Con la cola llena, la tecla se descarta.
- Cada tic consume **un** elemento con `queue.shift()`.

Sin la cola, dos pulsaciones dentro de un mismo tic se pisan y la segunda se valida contra una dirección que nunca llegó a aplicarse: con `direction = "right"`, pulsar `↑` y después `←` daría un giro de 180° y una muerte que el jugador no cometió. Validar contra el último de la cola cierra ese agujero.

La pausa **no** la ata el motor: `<Reproductor>` ya ata `Escape` y `P` desde el SPEC 07, y dos capas alternarían dos veces por pulsación.

### El atlas de sprites

Origen: `references/source-assets/snake-assets/fruits.png`, de 3790×442 y 572 KB, con las 22 frutas en la fila `y = 136…295`. Las coordenadas de cada recorte están en `references/source-assets/snake-assets/sprites.js`.

Se recorta **una sola vez** a las 8 frutas que el juego usa y se commitea el resultado en `public/snake/fruits.png`. El artefacto que entra al repo es el PNG; el script del recorte no queda.

Cada fruta se pega centrada en una celda de **170×160** —el ancho de la más ancha, el kiwi— así que el atlas mide **1360×160** y el índice de una fruta es todo lo que hace falta para dibujarla:

```ts
const SPRITE_W = 170;
const SPRITE_H = 160;
// sx = index * SPRITE_W, sy = 0
```

El orden y las coordenadas de origen, para que el recorte sea reproducible:

| Índice | Fruta      | Escalón  | Origen en `fruits.png`        |
| ------ | ---------- | -------- | ----------------------------- |
| 0      | apple      | `common` | `x 2786, y 136, w 110, h 160` |
| 1      | cherry     | `common` | `x 1066, y 136, w 110, h 160` |
| 2      | orange     | `medium` | `x 186, y 136, w 150, h 160`  |
| 3      | kiwi       | `medium` | `x 2068, y 136, w 170, h 160` |
| 4      | lemon      | `medium` | `x 2250, y 136, w 140, h 160` |
| 5      | watermelon | `rare`   | `x 1734, y 136, w 150, h 160` |
| 6      | pineapple  | `rare`   | `x 3454, y 136, w 150, h 160` |
| 7      | melon      | `rare`   | `x 3637, y 136, w 130, h 160` |

En pantalla la fruta se dibuja en un rectángulo de **28×26** centrado en su celda de 25 px: desborda un píxel y medio por lado, que es lo que hace que se lea dentro del marco CRT sin invadir la celda vecina.

### La paleta del motor

Constantes del motor, **nunca leídas del DOM** — un motor que necesita una hoja de estilos para dibujar falla en silencio. Es la misma regla del SPEC 05 y del SPEC 08.

| Elemento            | Color                       | De dónde sale                                    |
| ------------------- | --------------------------- | ------------------------------------------------ |
| Fondo               | `#000`                      | igual que los otros tres motores                 |
| Grilla              | `rgba(138, 143, 181, 0.07)` | `--ink-dim` casi apagado                         |
| Cabeza              | `#f5ff00` con `shadowBlur`  | `--yellow`, el acento del juego                  |
| Cuerpo              | `#f5ff00`, alpha 1.0 → 0.45 | el mismo amarillo, desvaneciéndose hacia la cola |
| Marco (el que mata) | `#ff006e`                   | `--magenta`, el límite se lee como peligro       |
| Halo `common`       | `#00ff88`                   | `--green`                                        |
| Halo `medium`       | `#00f5ff`                   | `--cyan`                                         |
| Halo `rare`         | `#ff006e`                   | `--magenta`                                      |

El `shadowBlur` va solo en la cabeza, en el marco y en el halo de la fruta. El cuerpo puede llegar a 100 segmentos y dibujar cien sombras por frame hunde los 60 fps; el degradado de alpha da la sensación de estela sin costo.

## Plan de implementación

1. **La migración del catálogo y la portada.** El `.sql` con el insert literal de arriba en `supabase/migrations/`, aplicado al proyecto remoto, más `.cover-serpiente` en `app/globals.css`: arte CSS puro, cero archivos de imagen. La serpiente amarilla serpentea en tres tramos con celdas cuadradas repartidas por posiciones porcentuales, igual que `.cover-tetris` reparte las suyas, con la cabeza girando hacia una fruta magenta y dos frutas más —una verde y una cyan— sobre una grilla apenas visible. `.cover-snake` (de SERPENTINA) **no se toca**: aquella es verde, con un cuerpo horizontal recto y un punto magenta; esta es amarilla, con recorrido y tres frutas.
   _Verificación:_ `/juegos` muestra doce tarjetas, SNAKE aparece bajo el filtro `ARCADE` y bajo `TODOS`, `/juegos/snake` renderiza el detalle con su portada, `/salon` muestra la tab nueva vacía, y `/jugar/snake` corre **con el puntaje simulado**, igual que los otros ocho. Nada se rompió porque nada nuevo se montó.

2. **El atlas recortado.** Un script de un solo uso con `sharp` —que ya está en `node_modules` como dependencia de Next— compone `public/snake/fruits.png` de 1360×160 a partir de las ocho coordenadas de la tabla, cada fruta centrada en su celda de 170×160 y con el fondo transparente intacto. El script vive en el directorio temporal de la sesión, no en el repo: el artefacto es el PNG.
   _Verificación:_ `public/snake/fruits.png` mide 1360×160, pesa menos de 120 KB, abrir `http://localhost:3000/snake/fruits.png` muestra las ocho frutas en fila y en el orden de la tabla, y el fondo es transparente y no negro.

3. **El motor, mudo** (`lib/games/snake/engine.ts`). Todo lo de **Modelo de datos**, dentro de `createSnakeEngine(canvas, options)`:
   - **Nada corre al importar el archivo.** Ni `new Image()`, ni `document.getElementById`, ni un `requestAnimationFrame`: un `new Image()` a nivel de módulo revienta el build en el servidor. Todos los efectos viven dentro de `start()`.
   - Los listeners de teclado se registran en `start()` sobre `window` y se quitan en `destroy()`. Hacen `preventDefault()` en las cuatro flechas y usan `e.code`.
   - El atlas se carga en `start()`: `new Image()`, `src = "/snake/fruits.png"`, y una bandera `atlasReady` que el `onload` pone en `true`. Mientras sea `false` —o si el PNG falla— la fruta se dibuja como un círculo relleno del color de su escalón. El juego es jugable en los dos casos. `destroy()` limpia `onload` y `onerror`.
   - `pause()` cancela el `requestAnimationFrame` y marca la bandera; `resume()` lo vuelve a pedir **y resetea `lastTime` a `null`**, para que el primer `dt` después de la pausa no sea el tiempo entero que estuvo pausada y la serpiente no dé diez tics de golpe. El acumulador del tic también se resetea.
   - `emitSnapshot()` guarda el último snapshot y **solo emite si algo cambió**. Puntaje, nivel y largo cambian al comer, no por frame.
   - Morir —por borde o por mordisco propio— llama a `onGameOver(score)` **una sola vez**, protegido por el `status`.
   - `end()` llama a esa misma función de muerte, para que el botón FIN y chocar terminen por un camino idéntico. No hay `lives` que forzar: el juego muere de una.
   - `restart()` vuelve a 3 celdas en el centro mirando a la derecha, 0 frutas, 0 puntos, tic 140 ms, nivel 1, cola vacía y una fruta nueva sorteada, y rearranca el loop.
   - `setMuted()` existe y todavía no hace nada: el audio entra en el paso 5.
   - El motor **no** dibuja HUD, ni overlay de pausa, ni overlay de game over, ni instrucciones: todo eso lo pinta `<Reproductor>`.

   _Verificación:_ `npx tsc --noEmit` pasa y `npx eslint lib` no reporta errores. El archivo todavía no lo importa nadie.

4. **El registro.** La línea de `snake` en `ENGINES`. Y nada más: `lib/games/types.ts`, `components/reproductor.tsx` y `components/game-canvas.tsx` no cambian.
   _Verificación:_ `/jugar/snake` se juega. La serpiente se mueve sola hacia la derecha desde el primer frame, gira con flechas y con WASD, no puede girar 180°, comer alarga una celda y acelera el tic, chocar contra el borde o contra sí misma abre el modal una sola vez, y el HUD muestra Jugador · Puntuación · Nivel · Largo, **sin** el slot de vidas. Los otros tres juegos con motor se comportan exactamente igual que antes.

5. **El audio.** Dos efectos: uno al comer (~150 ms) y uno al morir (~400 ms). El motor expone `playEat()` y `playDie()` por encima de la fuente, así que la fuente se elige acá y no cambia el resto del paso:
   - **Camino A, el preferido:** dos archivos con licencia CC0 o dominio público de un banco libre (Pixabay, freesound), descargados a `public/sounds/snake/eat.mp3` y `public/sounds/snake/die.mp3`. La URL de origen y la licencia se anotan en un comentario del motor, al lado de las constantes de audio. Se reproducen con el mismo patrón que el SPEC 08: pool fijo de 4 elementos con índice circular para `eat`, un solo elemento para `die`, `el.currentTime = 0; void el.play().catch(() => {})`, volumen `0.4`, y los elementos creados dentro de `start()`.
   - **Camino B, el respaldo:** si no se consigue un par con licencia verificable, los dos efectos se sintetizan con `AudioContext` —un blip corto y agudo al comer, un barrido descendente al morir— y **no entra ningún binario al repo**. Es literalmente el sonido del Snake de Nokia. El `AudioContext` se crea dentro de `start()`, se cierra en `destroy()`, y el volumen sale del mismo `0.4` a través de un `GainNode`.
   - En los dos caminos: **desbloqueo por gesto**, con una bandera `unlocked` que pasa a `true` en el primer `keydown` de la partida, y nada suena antes. `setMuted(true)` corta —no se llama a `play()` y lo que esté sonando se detiene— y `setMuted(false)` rehabilita sin reproducir nada. `destroy()` libera lo que haya: los cinco elementos del pool, o el `AudioContext`.
   - Cuál de los dos caminos se tomó se anota en la sección de decisiones de este spec al terminar el paso.

   _Verificación:_ comer suena, morir suena distinto, el botón `SILENCIO` los corta en el acto, el botón `SONIDO` los devuelve, la preferencia sobrevive a una recarga (`av_muted` ya existe desde el SPEC 08), y la consola no muestra ningún `NotAllowedError` de autoplay.

6. **Repaso final.** Las doce rutas de `/juegos/<id>` y `/jugar/<id>` responden 200, las pantallas anteriores se ven idénticas, y la consola queda limpia después de jugar una partida completa y de navegar cinco veces entre `/jugar/snake` y `/juegos`.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni errores de tipos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npx eslint app lib components` no reporta errores.
- [ ] `select id, sort_order from games order by sort_order` devuelve **doce** filas, con `snake` última en `sort_order` 12.
- [ ] `/juegos` muestra **doce** tarjetas y SNAKE aparece bajo el filtro `ARCADE` y bajo `TODOS`.
- [ ] `.cover-serpiente` es arte CSS puro y se distingue a simple vista de `.cover-snake` (SERPENTINA), que no fue modificada.
- [ ] `/juegos/snake` y `/jugar/snake` responden 200.
- [ ] `/salon` muestra una tab nueva con el ranking de SNAKE.
- [ ] `public/snake/fruits.png` mide 1360×160, pesa menos de 120 KB y tiene fondo transparente.
- [ ] Las ocho frutas del atlas están en el orden de la tabla: apple, cherry, orange, kiwi, lemon, watermelon, pineapple, melon.
- [ ] Con el atlas cargado, la fruta se dibuja con su sprite; bloqueando `/snake/fruits.png` en las devtools, el juego sigue siendo jugable y la fruta se dibuja como círculo del color de su escalón.
- [ ] El tablero es de 32×24 celdas de 25 px y llena el canvas sin bandas.
- [ ] La serpiente arranca con 3 celdas en el centro mirando a la derecha.
- [ ] Comer alarga la serpiente exactamente una celda, sea cual sea el escalón de la fruta.
- [ ] Comer una fruta `common` con la serpiente en 4 celdas suma exactamente 40 puntos.
- [ ] Hay siempre exactamente una fruta en el tablero, nunca dos, y nunca sobre una celda ocupada por la serpiente.
- [ ] La fruta no desaparece por tiempo: sigue ahí después de 30 segundos sin comerla.
- [ ] El halo de color del escalón se ve tanto con el sprite cargado como sin él.
- [ ] El tic arranca en 140 ms, baja 4 ms por fruta y se detiene en 60 ms a partir de la fruta 20.
- [ ] El slot Nivel pasa a 02 exactamente con la quinta fruta.
- [ ] El HUD muestra Jugador · Puntuación · Nivel · Largo, con los valores reales del motor, y **no** muestra el slot de vidas.
- [ ] Las flechas y `WASD` giran la serpiente; pulsar la dirección opuesta a la actual no hace nada.
- [ ] Pulsar `↑` e inmediatamente `←` con la serpiente yendo a la derecha ejecuta los dos giros en tics consecutivos, y **no** mata a la serpiente.
- [ ] Pulsar `←` `→` `↑` `↓` **no** scrollea la página.
- [ ] Chocar contra cualquiera de los cuatro bordes termina la partida.
- [ ] Morderse la propia cola termina la partida; entrar en la celda que la cola libera **en ese mismo tic** no.
- [ ] El canvas **no** dibuja HUD, ni overlay de pausa, ni overlay de game over, ni instrucciones.
- [ ] PAUSA congela el juego por completo y REANUDAR lo sigue desde donde estaba, sin un salto de varios tics proporcional al tiempo pausado.
- [ ] `Escape` y `P` pausan y reanudan igual que el botón.
- [ ] Dejar la pestaña en segundo plano un minuto y volver **no** mata a la serpiente contra una pared.
- [ ] El botón FIN termina la partida en el acto y abre el modal; chocar lo abre **una sola vez**.
- [ ] Guardar desde el modal inserta una fila en `scores` con `game_id = 'snake'`, y recargar `/juegos/snake` la muestra en el top-10 y actualiza `Mejor global` y `Partidas`.
- [ ] JUGAR DE NUEVO reinicia en 0 puntos, nivel 1, largo 3 y tic 140 ms.
- [ ] Comer suena y morir suena distinto; el botón `SILENCIO` los corta y `SONIDO` los devuelve.
- [ ] La consola **no** muestra ningún `NotAllowedError` ni warning de autoplay al cargar `/jugar/snake`.
- [ ] Navegar cinco veces entre `/jugar/snake` y `/juegos` no acelera el juego, ni duplica el puntaje, ni duplica el sonido.
- [ ] El motor de snake no aparece en el bundle compartido de `/jugar/[id]`, y los de asteroides, tetris y arkanoid tampoco.
- [ ] `/jugar/asteroides`, `/jugar/tetris` y `/jugar/arkanoid` se ven y se comportan exactamente igual que antes del spec.
- [ ] Los ocho juegos simulados siguen con el puntaje simulado y se ven exactamente igual que antes del spec.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna ruta.
- [ ] `lib/games/types.ts`, `components/reproductor.tsx`, `components/game-canvas.tsx`, `app/juegos/`, `app/jugar/`, `app/salon/`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts` y `app/jugar/actions.ts` no fueron modificados.

## Decisiones

- **Sí:** un solo spec, aunque el juego se diseñe desde cero. Snake son cinco reglas —grilla, fruta, crecimiento, aceleración, muerte por colisión—, no cincuenta. Partirlo en un spec de motor y otro de integración habría dejado un motor huérfano en el medio y duplicado la escritura, para un juego que además no mueve el chasis.
- **Sí:** una fila nueva `snake` en vez de darle motor a `serpentina`. Es el mismo criterio del SPEC 07 con `caida`/`tetris` y del SPEC 08 con `bloque-buster`/`arkanoid`: las tarjetas mock son el catálogo original y fusionarlas es un debate propio. La fila nueva deja clarísimo cuál de las dos es la jugable.
- **Sí:** `SNAKE` como título, con el nombre real del género, siguiendo el criterio de `ASTEROIDES`, `TETRIS` y `ARKANOID`. Los nombres inventados en español son de las tarjetas mock.
- **Sí:** acento `yellow`. `serpentina` es verde y `cover-snake` también, así que dos entradas verdes del mismo género se leerían como duplicados. Amarillo además combina con las frutas, y los otros dos amarillos del catálogo —`gloton` y `rocas`— son simulados.
- **Sí:** `.cover-serpiente` como nombre de clase, rompiendo la convención `cover-<slug>`. `cover-snake` ya está ocupado y la columna `cover` es un nombre de clase, no tiene por qué espejar el `id`. Un sufijo `-2` o `-game` no habría dicho nada dentro de seis meses.
- **Sí:** los sprites entran y el repo deja de estar libre de imágenes. Es lo contrario de lo que decidieron el SPEC 05 y el SPEC 08, y el motivo es que acá el asset **es** el punto de partida del pedido, no un accesorio del código de referencia. Una fruta dibujada con dos arcos no es lo mismo que una fruta.
- **Sí:** un atlas recortado a las 8 en vez del original de 572 KB o de ocho PNG sueltos. Una sola descarga, un solo `drawImage` con `sx = index * 170`, y menos de 120 KB. Ocho archivos sueltos habrían sido ocho descargas y ocho `Image` que precargar antes de dibujar.
- **Sí:** celdas de recorte uniformes de 170×160, aunque desperdicien transparencia en las frutas angostas. El ancho variable habría obligado a portar una tabla de coordenadas a mano; con la celda uniforme, el índice de la fruta es toda la información que el motor necesita.
- **No:** el script del recorte no queda en el repo. Es una transformación de un solo uso sobre un archivo que sigue estando en `references/`; el artefacto que importa es el PNG, y un script que corre una vez y nunca más es código muerto con `sharp` como dependencia declarada.
- **Sí:** el juego arranca antes de que el atlas cargue, con la fruta dibujada como respaldo vectorial. Evita agregar un estado `loading` al contrato que comparten los cuatro motores para un caso que tiene uno solo, evita la pantalla negra de esperar a `onload`, y hace que un 404 del PNG degrade el juego en vez de romperlo.
- **Sí:** el halo del escalón se dibuja siempre, debajo del sprite. Sin él, los tres escalones de valor serían una tabla que el jugador tiene que memorizar; con él, la rareza se lee de un vistazo y el sprite queda como lo que es, decoración con carácter.
- **Sí:** celda de 25 px y grilla de 32×24. Divide 800×600 exacto, así que `.game-canvas` no cambia y no hay bandas laterales ni reencuadre —el problema que el SPEC 07 tuvo con el tablero 300×600 de Tetris—. 768 celdas dan recorrido para una partida larga sin que la fruta de 25 px se vuelva ilegible.
- **Sí:** el borde mata. Es la regla canónica del género y la que le da sentido a un tablero grande: los bordes son la mitad de la dificultad. El wrap de asteroides habría dejado la cola propia como única forma de morir.
- **Sí:** la aceleración es continua y atada a la fruta, no escalonada por nivel. El jugador siente que lo que hace tiene consecuencia inmediata, en vez de descubrir un salto de velocidad al cruzar un contador que no ve. El piso de 60 ms está para que el juego siga siendo jugable con reflejos humanos.
- **Sí:** sin vidas. Es la regla del género, y el HUD ya sabe ocultar el slot desde el SPEC 07: `lives` ausente en el snapshot y cero cambios en `<Reproductor>`.
- **Sí:** puntaje `valor × largo`. Los dos ejes multiplican, así que una partida larga con frutas raras se despega de una partida larga a fuerza de manzanas, y el ranking deja de ser un conteo de frutas con empates arriba. Aterriza en el rango de 10.000–20.000, que es donde están los otros tres juegos.
- **Sí:** el largo que multiplica es el posterior a crecer. Cualquiera de las dos convenciones servía; dejarla sin decidir era lo único que no.
- **Sí:** tres escalones de valor por rareza. Le da a los 22 sprites del atlas una razón de existir más allá de la variedad visual y mete una decisión —desviarse por la sandía o no— en un juego que si no es puro reflejo.
- **No:** crecimiento por escalón (1 / 2 / 3 celdas). Acoplaba riesgo y recompensa de forma elegante, pero suma una constante y una regla más a un juego que ya tiene tres tablas; el halo de color ya comunica la rareza.
- **No:** caducidad de la fruta rara. Habría sido el diseño más dinámico y el más caro: obliga a definir el aviso visual del parpadeo, cuánto dura y qué aparece en su lugar. Nada desaparece sin aviso.
- **Sí:** nivel = `frutas / 5 + 1`, sin techo. `level` no es opcional en `GameSnapshot`, así que el slot se pinta igual: darle el significado del tramo de aceleración es más útil que dejarlo clavado en 01.
- **Sí:** `{ label: "Largo", value: "24" }` en el slot `extra`. Es el único de los tres candidatos que no es una función del conteo de frutas, y es el dato que explica por qué el tablero se está cerrando.
- **Sí:** flechas **y** `WASD`. Las dos convenciones están igual de instaladas en el género y atar las dos cuesta cuatro entradas más en un mapa.
- **Sí:** cola de hasta dos giros, validando cada uno contra el anterior de la cola. Una cola de uno que se pisa a sí misma reintroduce el bug que venía a arreglar: con la serpiente yendo a la derecha, `↑` seguido de `←` dentro del mismo tic validaría `←` contra `↑` y aplicaría un giro de 180° sobre la dirección real. Dos elementos y `shift()` por tic cierran los dos agujeros.
- **Sí:** la celda de la fruta sale de la lista de celdas libres. Reintentar al azar es más corto de escribir y tiene tiempo de ejecución no acotado justo cuando la partida está por terminar, que es el peor momento posible para un freeze.
- **Sí:** entra el sonido, buscado en un banco de licencia CC0. El pedido fue explícito y el chasis del SPEC 08 ya tiene todo: `setMuted()`, el botón del HUD y `av_muted` en `localStorage`.
- **No:** los efectos originales de Google Snake, la misma fuente que los sprites. Son assets de un juego comercial: no hay descarga estable ni licencia que permita redistribuirlos, y el spec habría prescrito algo que puede no existir el día que se implemente.
- **Sí:** respaldo sintetizado con WebAudio si no aparece un par CC0 verificable. Es lo que evita el TODO: el paso 5 se cierra por uno de los dos caminos y el criterio de aceptación está escrito sobre el resultado —comer suena, morir suena distinto— y no sobre el mecanismo. De paso, un blip sintetizado **es** el sonido del Snake de Nokia.
- **Sí:** el motor expone `playEat()` y `playDie()` por encima de la fuente. El desbloqueo por gesto, el volumen, `setMuted()` y la limpieza en `destroy()` se escriben una sola vez y no dependen de cuál de los dos caminos se tome.
- **Sí:** los colores son constantes del motor y no se leen del DOM, incluidos los tres halos de escalón.
- **Sí:** el `shadowBlur` va solo en la cabeza, el marco y el halo. El cuerpo puede llegar a cien segmentos y cien sombras por frame hunden los 60 fps; el degradado de alpha da la estela sin costo.
- **No:** obstáculos ni paredes internas. El nivel sube cada 5 frutas y no tiene techo: los muros se reordenarían cada pocos segundos debajo de una serpiente que ya está ahí, y resolverlo bien —cambiar el layout solo al morir— es diseñar un modo de juego, no agregar una constante.
- **No:** rebalancear después. Las constantes de este spec no vienen de un original probado, así que a diferencia de los SPEC 07 y 08 acá **sí** es esperable ajustarlas. Pero se ajustan con el juego andando y midiendo, en otro spec, no durante la implementación de este.

## Riesgos

| Riesgo                                                                                                                | Mitigación                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El balance sale de la nada y el juego resulta injugable o trivial: nunca fue probado                                  | Las constantes están todas juntas y nombradas en **Modelo de datos**, en un solo bloque del motor. Ajustarlas es cambiar números, no reescribir lógica. La sección de decisiones lo deja anotado como esperable.        |
| `new Image()` a nivel de módulo revienta el build con `Image is not defined` en el servidor                           | Nada del motor corre al importar el archivo: el `Image` se crea dentro de `start()`, y el registro carga con `import()` dinámico. Es la misma regla que el SPEC 08 aplicó a `new Audio()`.                              |
| El atlas no carga —404, red lenta, bloqueo— y el juego queda sin fruta visible                                        | La fruta se dibuja como círculo del color de su escalón mientras `atlasReady` sea `false`, y el `onerror` lo deja así para siempre. Hay un criterio de aceptación que lo verifica bloqueando el PNG.                    |
| El recorte sale con las frutas corridas, en otro orden, o con el fondo negro en vez de transparente                   | El paso 2 tiene la tabla de coordenadas de origen y su verificación es abrir el PNG y ver las ocho en el orden de la tabla. Hay tres criterios de aceptación sobre tamaño, peso y transparencia.                        |
| Dos pulsaciones dentro de un mismo tic producen un giro de 180° y una muerte que el jugador no cometió                | Cola de hasta dos giros, cada uno validado contra el último de la cola. Hay un criterio de aceptación con la secuencia exacta: `→`, `↑`, `←`.                                                                           |
| La serpiente muere al entrar en la celda que su propia cola libera en ese mismo tic                                   | La detección de mordisco propio excluye el último segmento de `body`, que se va a hacer `pop()` en el mismo tic. Hay un criterio de aceptación.                                                                         |
| Con la pestaña en segundo plano, el `dt` acumulado ejecuta decenas de tics de golpe y la serpiente aparece estrellada | El `dt` se topea en 50 ms como en los otros tres motores, y `resume()` resetea `lastTime` y el acumulador del tic. Hay un criterio de aceptación que deja la pestaña un minuto en segundo plano.                        |
| Con el tablero casi lleno, buscar celda libre por reintento al azar congela el juego un tiempo no acotado             | La celda sale de la lista de celdas libres, construida en un recorrido de 768 celdas una vez por fruta.                                                                                                                 |
| No aparece un par de efectos con licencia CC0 verificable y el paso 5 queda a medias                                  | El paso 5 está escrito con los dos caminos y el respaldo de WebAudio no depende de nada externo. El criterio de aceptación es sobre el resultado, no sobre el mecanismo.                                                |
| El audio nunca se desbloquea y el juego queda mudo sin decirlo                                                        | El desbloqueo se dispara con el primer `keydown`, y sin teclas la serpiente no cambia de dirección: el gesto llega en el primer segundo. Hay un criterio de aceptación sobre `NotAllowedError` en consola.              |
| El motor filtra `requestAnimationFrame`, listeners, el `Image` o el audio al navegar, y el juego corre al doble       | `destroy()` cancela el rAF, quita los listeners de teclado, limpia `onload`/`onerror` del `Image` y libera el audio; el `useEffect` de `<GameCanvas>` lo devuelve como cleanup. Hay un criterio que navega cinco veces. |
| `onSnapshot` dispara `setState` por frame y el HUD hunde el rendimiento                                               | El motor compara con el último snapshot y solo emite cuando algo cambió. Puntaje, nivel y largo cambian al comer, no por frame.                                                                                         |
| Dibujar cien segmentos con `shadowBlur` por frame hunde los 60 fps                                                    | El glow va solo en la cabeza, el marco y el halo de la fruta; el cuerpo usa un degradado de alpha.                                                                                                                      |
| SNAKE y SERPENTINA se confunden en `/juegos`: son dos tarjetas ARCADE de una serpiente                                | Acento amarillo contra verde, `.cover-serpiente` contra `.cover-snake` con dibujos distintos, y un criterio de aceptación que exige que se distingan a simple vista.                                                    |
| La migración se aplica dos veces y falla por clave primaria duplicada                                                 | `games.id` es la primary key: el segundo intento falla en vez de duplicar la tarjeta. `select id, sort_order from games order by sort_order` es el criterio de verificación.                                            |
| El motor de snake entra en el bundle compartido de `/jugar/[id]` y los once juegos restantes pagan su peso            | El registro usa `import()` dinámico, igual que los otros tres. Hay un criterio de aceptación sobre el build que verifica los cuatro motores.                                                                            |

## Lo que **no** entra en esta spec

- Motores para los ocho juegos simulados que quedan.
- Fusionar, renombrar o retirar la fila `serpentina` del catálogo.
- Obstáculos, paredes internas o layouts de nivel.
- Las 6 verduras y las 8 frutas restantes del atlas.
- Caducidad de la fruta, crecimiento por escalón o power-ups.
- Wrap por los bordes y vidas.
- Controles táctiles o swipe en pantalla.
- Récord personal en el HUD y modo dos jugadores.
- Música de fondo, volumen graduable o sonido para asteroides y tetris.
- Rebalancear las constantes con el juego andando.
- Tests automatizados.

Cada una de esas, si aparece, va en su propia spec.
