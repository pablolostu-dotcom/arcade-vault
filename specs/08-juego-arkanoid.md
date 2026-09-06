# SPEC 08 — ARKANOID: el tercer juego jugable y el primero con sonido

> **Status:** Aceptado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-09-05
> **Objective:** Portar el Arkanoid de `references/started-games/04-arkanoid/` a un motor de canvas en TypeScript y montarlo en `/jugar/arkanoid` como undécimo juego del catálogo, abriéndole paso de paso al portal al control con mouse y al audio.

## Por qué existe este spec

El SPEC 07 dejó el chasis en su mejor forma hasta ahora: `GameSnapshot` con `lives` y `extra` opcionales, `<Reproductor>` con el slot de vidas condicional y la pausa por `Escape` y `P`, y el registro con dos filas. El tercer juego prueba si eso alcanza.

En `references/started-games/04-arkanoid/` hay un Arkanoid completo: 268 líneas de canvas 2D sin dependencias, con paleta, pelota, colisiones AABB, tres vidas, cinco niveles de patrones distintos, animación de explosión al romper un bloque y dos efectos de sonido. Está probado y balanceado. **Este spec no diseña un juego: lo adapta.**

Una buena noticia primero, porque cambia el tamaño del trabajo: **el canvas del original es 800×600, exactamente el mundo del chasis.** `components/game-canvas.tsx` tiene `WORLD_W = 800` y `WORLD_H = 600`, y `.game-canvas` es `aspect-ratio: 4 / 3`. No hay nada que reencuadrar, a diferencia del tablero 300×600 de Tetris. Y `P` y `Escape` ya pausan desde el SPEC 07, así que las teclas del original ya están cubiertas por el portal.

Las fricciones reales son otras cuatro, y son las que justifican que esto sea un spec y no una línea en `ENGINES`:

1. **Es el primer juego con mouse, y `.game-canvas` es `pointer-events: none`.** El original mueve la paleta con `mousemove` sobre el canvas, y el README lo lista como el control principal. La regla que lo bloquea la comparten los tres juegos con motor.
2. **Es el primer juego con audio, y el portal nunca reprodujo un sonido.** Eso son tres decisiones nuevas de golpe: la política de autoplay del navegador, dónde vive el control de silencio, y cómo llega ese control desde React hasta adentro del motor. Ninguna de las tres está modelada en `EngineHandle` ni en `EngineOptions`.
3. **El juego tiene estado de victoria y el portal no.** Al limpiar el nivel 5, el original dibuja `¡Completaste el juego!`. `GameStatus` conoce `"playing" | "dead" | "gameover"` y nada más.
4. **Todo el dibujo sale de un spritesheet PNG de 30 KB** — paleta, pelota, siete colores de bloque y veintiocho frames de explosión — y el repo no tiene un solo asset de imagen: hasta las once portadas del catálogo son arte CSS puro.

Hay además tres cosas del código de referencia que conviene decir en voz alta, porque su `README.md` y su `CLAUDE.md` las cuentan mal. **Manda el código:**

- **La paleta mide 81 px de ancho, no 162.** `const paddle = { x: 0, y: 560, w: 81, h: 14 }`. El sprite del spritesheet sí es de 162, pero `drawSprite` lo dibuja a media escala. El `CLAUDE.md` del juego documenta `w: 162`, que haría la paleta el doble de ancha y el juego mucho más fácil.
- **El rebote contra un bloque no detecta el lado del impacto:** es un `ball.vy = -ball.vy` seco, pase lo que pase. Una pelota que entra por el costado de un bloque sale hacia arriba igual.
- **El rebote en la paleta no depende de dónde pegue:** invierte `vy` y deja `vx` intacto. No hay control de ángulo, así que las trayectorias son mucho más deterministas que en un Arkanoid comercial.

Las tres se portan tal cual. La regla del proyecto es no rebalancear.

## Alcance

**Dentro:**

- `lib/games/arkanoid/engine.ts` — el port completo de `game.js` y `levels.js` a TypeScript: la paleta, la pelota, los bloques, las colisiones, las tres vidas, los cinco niveles y las explosiones, encapsulados en `createArkanoidEngine(canvas, options)`, dibujado vectorialmente con la paleta del portal.
- La tercera fila de `ENGINES` en `lib/games/registry.ts`.
- `supabase/migrations/<ts>_add_game_arkanoid.sql` — el `insert into public.games` de la undécima fila.
- `.cover-arkanoid` en `app/globals.css` — arte CSS puro, como las otras diez portadas.
- `.game-canvas` pasa de `pointer-events: none` a `pointer-events: auto` en `app/globals.css`.
- `EngineHandle` suma `setMuted(muted: boolean)` en `lib/games/types.ts`; `lib/games/asteroides/engine.ts` y `lib/games/tetris/engine.ts` lo implementan como no-op.
- `components/game-canvas.tsx` suma una prop `muted` y la aplica al motor al crearlo y en cada cambio.
- `components/reproductor.tsx` suma el botón de silencio en `hud-actions`, con la preferencia en `localStorage` bajo `av_muted`.
- `public/sounds/ball-bounce.mp3` y `public/sounds/break-sound.mp3` — los dos únicos binarios que entran al repo.

**Fuera de alcance (para specs futuras):**

- **El spritesheet PNG.** `assets/spritesheet-breakout.png` no entra: el motor dibuja vectorial, como el de asteroides.
- **Los otros ocho juegos simulados.** `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria` y `duelo-pixel` siguen exactamente con el puntaje simulado.
- **Fusionar o retirar `bloque-buster`.** La fila mock que describe un Arkanoid se queda como está, con su `sort_order` 1, su acento cyan y su `cover-bricks`.
- **El selector de nivel del overlay de pausa.** Los cinco botones que se clickean sobre el canvas no se portan, ni al canvas ni al HUD.
- **Un estado de victoria en el contrato.** `GameStatus` no cambia y el modal de fin de partida sigue diciendo `FIN DEL JUEGO` se gane o se pierda.
- **Música de fondo, volumen graduable o sonido en los otros dos motores.** Solo los dos efectos del original, con un silencio de dos estados.
- **Power-ups.** El Arkanoid comercial los tiene; este juego de referencia no, y agregarlos es diseñar un juego distinto.
- **Rebalancear.** `PADDLE_SPEED`, `BASE_BALL_VX`, `BASE_BALL_VY`, los cinco multiplicadores de velocidad, los 10 puntos por bloque, las 3 vidas y `EXPLOSION_DURATION` se portan con sus valores.
- **Control de ángulo en el rebote de la paleta y detección de lado en el rebote contra bloques.** El original no los tiene.
- **Controles táctiles en pantalla.** Solo teclado y mouse, con el aviso que ya existe.
- **`cursor: none` sobre el canvas.** El puntero sigue visible mientras se juega.
- **Récord personal en el HUD.**
- **Tests automatizados.** El repo no tiene test runner y este spec no instala uno.
- **Tocar `app/juegos/`, `app/jugar/`, `app/salon/`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts` ni `app/jugar/actions.ts`.** Todo eso es catalog-driven: el juego aparece solo, y la tab del Salón también.

## Modelo de datos

No hay ningún cambio de esquema: el puntaje termina en `public.scores` con `game_id = 'arkanoid'`, por el camino que abrió el SPEC 06. Lo que se introduce es la fila del catálogo, un método en el contrato del motor y una clave de `localStorage`.

### La fila del catálogo

`games` tiene RLS activa y su única política es de SELECT: sin política de INSERT, la operación queda negada para todos. La fila entra por migración y por ningún otro camino.

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values ('arkanoid', 'ARKANOID',
        'Rompe cinco muros de bloques con una paleta y una pelota.',
        'Una paleta de plasma defiende la base de un núcleo que rebota sin descanso. Cinco muros con patrones distintos —parrilla, pirámide, tablero, filas con huecos y marco con cruz— y la pelota un diez por ciento más rápida en cada uno. Tres vidas para limpiarlos todos: la que se escapa por abajo no vuelve.',
        'ARCADE', 'cover-arkanoid', 'magenta', 11);
```

`"long"` va siempre entre comillas: es palabra reservada. `sort_order` 11 es el más alto de hoy (10, `tetris`) más uno. `cat` y `color` salen de los valores de los CHECK constraints de `public.games`; no se agrega ninguno.

Agregar una fila **no** cambia el esquema: `npm run db:types` no hace falta en este spec.

### El contrato del motor

`GameSnapshot` y `EngineOptions` no cambian: el SPEC 07 los dejó listos para esto. `EngineHandle` suma un método:

```ts
// lib/games/types.ts — lo único que cambia
export type EngineHandle = {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
  /** El botón de silencio del HUD. Los motores mudos lo implementan como no-op. */
  setMuted(muted: boolean): void;
  destroy(): void;
};
```

Cada motor llena lo suyo en el snapshot:

| Motor        | `lives` | `extra`                                                                               |
| ------------ | ------- | ------------------------------------------------------------------------------------- |
| `asteroides` | `3 → 0` | `{ label: "Triple disparo", value: "3x · 4.2s" }`, solo con el power-up activo        |
| `tetris`     | ausente | `{ label: "Líneas", value: "37" }`, siempre                                           |
| `arkanoid`   | `3 → 0` | `{ label: "Velocidad", value: "×1.21" }`, siempre — el multiplicador del nivel actual |

```ts
// lib/games/arkanoid/engine.ts
export function createArkanoidEngine(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): EngineHandle;
```

```ts
// lib/games/registry.ts — la línea que se agrega
arkanoid: () => import("./arkanoid/engine").then((m) => m.createArkanoidEngine),
```

### La preferencia de silencio

Una clave nueva de `localStorage`, con el mismo prefijo y el mismo formato JSON que `av_user`:

```
av_muted → true | false | ausente (ausente ⇒ con sonido)
```

Vive en `<Reproductor>` como estado, se lee en un efecto después del primer render —leerla durante el render rompe la hidratación, igual que en `lib/session.tsx`— y baja al motor por la prop `muted` de `<GameCanvas>`, no por el handle imperativo:

```ts
// components/game-canvas.tsx — la prop que se agrega
type GameCanvasProps = {
  gameId: string;
  muted: boolean;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onGameOver: (finalScore: number) => void;
  ref?: Ref<GameCanvasHandle>;
};
```

`GameCanvasHandle` **no** cambia. El motor se crea después de un `import()` dinámico, así que un `setMuted` imperativo llamado al montar encontraría el ref en `null`; una prop se aplica dos veces —justo después de `createEngine()` y en un efecto cuando cambia— y ese hueco no existe. El valor se lee desde un ref dentro del efecto de montaje, como ya se hace con los callbacks: cambiar el silencio no puede reiniciar la partida.

### Constantes del port

Se portan con sus valores, sin excepción:

```ts
const PADDLE_SPEED = 400; // px/s con teclado
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = 80; // (800 − 10 × 64) / 2
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const PADDLE = { y: 560, w: 81, h: 14 }; // 81, no 162
const BALL = { w: 16, h: 16 };
const POINTS_PER_BLOCK = 10;
const START_LIVES = 3;
const EXPLOSION_DURATION = 150; // ms, 4 fases
```

Los cinco niveles de `levels.js` se portan con sus generadores tal cual: parrilla 10×6, pirámide con `pyStart = [4,3,2,1,0,0]` y `pyEnd = [5,6,7,8,9,9]`, tablero con `(col + row) % 2 === 0`, filas con los huecos de `gaps4`, y marco más cruz en la columna 4 y la fila 2. Los multiplicadores de velocidad son `1.00`, `1.10`, `1.21`, `1.33` y `1.46`.

Los siete nombres de color del original mapean a constantes del motor, **nunca leídas del DOM** — un motor que necesita una hoja de estilos para dibujar falla en silencio:

| Original  | Motor     | De dónde sale                                                      |
| --------- | --------- | ------------------------------------------------------------------ |
| `cyan`    | `#00f5ff` | `--cyan`                                                           |
| `magenta` | `#ff006e` | `--magenta`                                                        |
| `yellow`  | `#f5ff00` | `--yellow`                                                         |
| `green`   | `#00ff88` | `--green`                                                          |
| `hotpink` | `#ff4da6` | magenta aclarado, para que se distinga del magenta puro            |
| `red`     | `#ff3b1f` | color de juego, no acento — como el `thrust` naranja de asteroides |
| `gray`    | `#8a8fb5` | `--ink-dim`, como los asteroides                                   |

La paleta se pinta en `--magenta` con glow, la pelota en `--cyan` con glow, y el fondo en negro.

## Plan de implementación

1. **La migración del catálogo y la portada.** El `.sql` con el insert literal de arriba en `supabase/migrations/`, aplicado al proyecto remoto, más `.cover-arkanoid` en `app/globals.css`: arte CSS puro, cero archivos de imagen — el muro de bloques neón arriba con dos huecos ya abiertos, la pelota subiendo con estela por uno de ellos, y la paleta magenta con glow abajo. `.cover-bricks` (de BLOQUE BUSTER) no se toca.
   _Verificación:_ `/juegos` muestra once tarjetas, ARKANOID aparece bajo el filtro `ARCADE` y bajo `TODOS`, `/juegos/arkanoid` renderiza el detalle con su portada, `/salon` muestra la tab nueva vacía, y `/jugar/arkanoid` corre **con el puntaje simulado**, igual que los otros ocho. Nada se rompió porque nada nuevo se montó.

2. **El contrato de silencio.** Sin motor nuevo todavía y sin cambio de comportamiento en los dos que hay:
   - `EngineHandle` suma `setMuted(muted: boolean)` en `lib/games/types.ts`.
   - `lib/games/asteroides/engine.ts` y `lib/games/tetris/engine.ts` lo implementan como no-op de una línea, con un comentario que dice que son mudos.
   - `components/game-canvas.tsx` suma la prop `muted`, la guarda en un ref, la aplica justo después de `createEngine()` y la reaplica en un efecto cuando cambia.
   - `components/reproductor.tsx` suma el estado `muted`, su hidratación desde `av_muted` en un efecto y su espejo de vuelta a `localStorage`, más el botón `SONIDO` / `SILENCIO` en `hud-actions`, con `className="btn ghost"` y renderizado **solo cuando `withEngine`**. Los ocho simulados no lo ven.
   - Los dos mp3 se copian a `public/sounds/`, referenciados desde el motor como `/sounds/ball-bounce.mp3` y `/sounds/break-sound.mp3`.

   _Verificación:_ `npx tsc --noEmit` pasa, `npx eslint app lib components` no reporta errores, y `/jugar/asteroides` y `/jugar/tetris` se comportan **exactamente** igual que antes: mismo HUD, mismas vidas, mismo `3x`, mismas líneas. El botón nuevo alterna entre `SONIDO` y `SILENCIO`, sobrevive a una recarga y todavía no silencia nada porque ningún motor suena. `/jugar/caida` no muestra el botón.

3. **El motor, mudo y solo con teclado** (`lib/games/arkanoid/engine.ts`). Port de `game.js` y `levels.js` a TypeScript dentro de `createArkanoidEngine(canvas, options)`:
   - `initPaddle`, `initBall`, `loadLevel`, `collideAABB`, `update` y los cinco generadores de niveles se portan **sin cambios de lógica**, tipados, tomando `ctx` del closure.
   - **Nada corre al importar el archivo.** El `loadSpritesheet(cb)` de la última línea y el `getElementById('game')` de la primera desaparecen; todo efecto vive dentro de `start()`. Los dos `new Audio()` de nivel de módulo también: un `new Audio()` al importar corre en el servidor y revienta el build.
   - Los listeners de teclado se registran en `start()` sobre `window` y se quitan en `destroy()`. Hacen `preventDefault()` en `ArrowLeft` y `ArrowRight` para que jugar no scrollee la página. Se usa `e.code`, como en asteroides.
   - **La pausa la maneja React.** El bloque `if (e.key === 'p' || … || e.key === 'Escape') isPaused = !isPaused` se elimina: `<Reproductor>` ya ata `P` y `Escape` desde el SPEC 07, y dejar las dos capas alternaría dos veces por pulsación.
   - `pause()` cancela el `requestAnimationFrame` y marca una bandera `paused`; `resume()` lo vuelve a pedir **y resetea `lastTime` a `null`**, para que el primer `dt` después de la pausa no sea el tiempo entero que estuvo pausado. El `dt` queda topeado en 50 ms, igual que en asteroides y tetris.
   - `emitSnapshot()` guarda el último snapshot y **solo emite si algo cambió**. Con `extra.value` ya formateado como `×1.21`, la comparación es de strings.
   - Se **eliminan** el HUD dibujado en el canvas (`Score:`, `Nivel:` y las vidas como sprites de pelota), `drawOverlay()`, `drawPauseOverlay()` y el `canvas.addEventListener('click', …)` del selector de nivel, junto con sus cinco constantes `PAUSE_BTN_*`.
   - Se **elimina** `assets/spritesheet.js`: los bloques se dibujan como rectángulos de relleno sólido con una banda superior clara (`rgba(255,255,255,0.12)`, como en tetris), la paleta y la pelota con `shadowBlur` para el glow. El glow va solo en esos dos: sesenta bloques con sombra por frame cuestan caro.
   - La explosión reemplaza los 4 frames del spritesheet por ocho fragmentos que se alejan del centro del bloque y se desvanecen, en los **mismos** `EXPLOSION_DURATION = 150` ms. La cola `explosions[]`, su `elapsed` y su filtrado se portan tal cual.
   - Al limpiar el nivel 5, en vez de `gameState = 'win'` el motor entra en `gameover` y llama `onGameOver(score)` **una sola vez**, con el puntaje acumulado de los cinco niveles.
   - `end()` pone `lives = 1` y llama a la misma función de pérdida de vida que usa la pelota que se escapa, para que el botón FIN y perder terminen por un camino idéntico.
   - `restart()` vuelve al nivel 1 con 3 vidas y 0 puntos, y rearranca el loop.
   - `setMuted()` existe pero todavía no hace nada: el audio entra en el paso 5.

   _Verificación:_ `npx tsc --noEmit` pasa y `npx eslint lib` no reporta errores. El archivo todavía no lo importa nadie.

4. **El registro, el mouse y `.game-canvas`.** La línea de `arkanoid` en `ENGINES`, más:
   - `.game-canvas` pasa a `pointer-events: auto` en `app/globals.css`.
   - El listener `mousemove` se registra en `start()` **sobre el canvas** y se quita en `destroy()`. La conversión de coordenadas usa `WORLD_W / rect.width`, **no** `canvas.width / rect.width` como el original: `<GameCanvas>` fija `canvas.width = WORLD_W * dpr`, así que en una pantalla HiDPI la fórmula del original movería la paleta a la mitad de velocidad y la dejaría clavada a media pantalla.
   - El listener sale temprano mientras `paused` está en `true`, para que mover el mouse durante la pausa no arrastre la paleta por debajo del overlay.
   - `<Reproductor>` pasa `muted` a `<GameCanvas>`.

   _Verificación:_ `/jugar/arkanoid` se juega: la paleta sigue al mouse y a `←` `→`, la pelota rebota en paredes, paleta y bloques, romper un bloque suma 10 puntos y lanza la explosión, la pelota perdida descuenta una vida y se repone sobre la paleta, limpiar un nivel carga el siguiente más rápido, y el HUD muestra Jugador · Puntuación · Vidas · Nivel · Velocidad. `/jugar/asteroides` y `/jugar/tetris` se juegan igual que antes: no registran listeners de puntero, así que `pointer-events: auto` no les cambia nada.

5. **El audio del motor.** Los dos efectos, con el silencio y el desbloqueo:
   - Los elementos `Audio` se crean dentro de la fábrica, en `start()`, apuntando a `/sounds/ball-bounce.mp3` y `/sounds/break-sound.mp3`.
   - Cada sonido tiene un **pool fijo de 4 elementos con índice circular**, y reproducir es `el.currentTime = 0; void el.play().catch(() => {})`. El `cloneNode().play()` del original crea un `<audio>` nuevo por rebote y no lo suelta nunca.
   - Volumen fijo en `0.4` para los dos, declarado como constante del motor.
   - **Desbloqueo por gesto:** una bandera `unlocked` que pasa a `true` en el primer `keydown` o el primer `mousemove` de la partida. Hasta entonces no se llama a `play()`. Como la paleta no se mueve sin uno de esos dos eventos, el gesto llega en el primer segundo y el navegador nunca rechaza la reproducción.
   - `setMuted(true)` corta: no se llama a `play()` y los elementos que estén sonando se pausan. `setMuted(false)` vuelve a habilitar sin reproducir nada.
   - `destroy()` pausa los ocho elementos del pool.

   _Verificación:_ rebotar contra una pared suena, romper un bloque suena distinto, el botón `SILENCIO` los corta en el acto, el botón `SONIDO` los devuelve, la preferencia sobrevive a una recarga y a navegar a otro juego, y la consola no muestra ningún `NotAllowedError` de autoplay.

6. **Repaso final.** Las once rutas de `/juegos/<id>` y `/jugar/<id>` responden 200, las pantallas anteriores se ven idénticas, y la consola queda limpia después de jugar una partida completa y de navegar cinco veces entre `/jugar/arkanoid` y `/juegos`.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni errores de tipos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npx eslint app lib components` no reporta errores.
- [ ] `select id, sort_order from games order by sort_order` devuelve **once** filas, con `arkanoid` última en `sort_order` 11.
- [ ] `/juegos` muestra **once** tarjetas y ARKANOID aparece bajo el filtro `ARCADE` y bajo `TODOS`.
- [ ] `.cover-arkanoid` es arte CSS puro: no se agregó ningún archivo de imagen al repo, y `assets/spritesheet-breakout.png` no está en `public/`.
- [ ] `/juegos/arkanoid` y `/jugar/arkanoid` responden 200.
- [ ] `/salon` muestra una tab nueva con el ranking de ARKANOID.
- [ ] La paleta sigue el mouse sobre el canvas y se mueve con `←` y `→`, y no se sale de los bordes por ninguno de los dos caminos.
- [ ] En una pantalla con `devicePixelRatio` 2, la paleta llega al borde derecho del canvas siguiendo el mouse.
- [ ] Pulsar `←` o `→` **no** scrollea la página.
- [ ] Mover el mouse durante la pausa **no** desplaza la paleta.
- [ ] Romper un bloque suma exactamente 10 puntos, lo hace desaparecer y lanza la explosión, que dura 150 ms.
- [ ] La pelota que se escapa por abajo descuenta una vida y se repone centrada sobre la paleta; con 0 vidas termina la partida.
- [ ] La paleta mide 81 px de ancho, no 162.
- [ ] Limpiar un nivel carga el siguiente con la pelota más rápida, y el slot `Velocidad` del HUD pasa por `×1.00`, `×1.10`, `×1.21`, `×1.33` y `×1.46`.
- [ ] Los cinco niveles tienen los patrones del original: parrilla completa, pirámide, tablero de ajedrez, filas con huecos, y marco con cruz central.
- [ ] Limpiar el nivel 5 termina la partida y abre el modal **una sola vez**, con el puntaje acumulado de los cinco niveles.
- [ ] El HUD de React muestra Jugador · Puntuación · Vidas · Nivel · Velocidad, con los valores reales del motor.
- [ ] El canvas **no** dibuja ningún HUD, ni overlay de pausa, ni overlay de game over, ni overlay de victoria, ni los cinco botones de salto de nivel.
- [ ] La partida siempre arranca en el nivel 1: no hay ninguna forma de saltar a otro.
- [ ] PAUSA congela el juego por completo y REANUDAR lo sigue desde donde estaba, sin un salto proporcional al tiempo pausado.
- [ ] `Escape` y `P` pausan y reanudan igual que el botón.
- [ ] El botón FIN termina la partida en el acto y abre el modal; perder la última vida lo abre **una sola vez**.
- [ ] Guardar desde el modal inserta una fila en `scores` con `game_id = 'arkanoid'`, y recargar `/juegos/arkanoid` la muestra en el top-10 y actualiza `Mejor global` y `Partidas`.
- [ ] JUGAR DE NUEVO reinicia en 0 puntos, 3 vidas, nivel 1 y el muro del nivel 1 completo.
- [ ] Rebotar contra una pared, la paleta o un bloque reproduce el sonido correspondiente.
- [ ] La consola **no** muestra ningún `NotAllowedError` ni warning de autoplay al cargar `/jugar/arkanoid`.
- [ ] El botón de silencio corta el audio en el acto y el de sonido lo devuelve.
- [ ] La preferencia de silencio sobrevive a una recarga y a navegar a otro juego (`av_muted` en `localStorage`).
- [ ] El botón de silencio aparece en los tres juegos con motor y **no** aparece en los ocho simulados.
- [ ] Jugar tres minutos no deja más de ocho elementos `<audio>` vivos.
- [ ] `/jugar/asteroides` y `/jugar/tetris` se ven y se comportan exactamente igual que antes del spec, incluidos el slot de vidas, el `3x · N.Ns` y el contador de líneas.
- [ ] Los ocho juegos simulados siguen con el puntaje simulado y se ven exactamente igual que antes del spec.
- [ ] Navegar cinco veces entre `/jugar/arkanoid` y `/juegos` no acelera el juego, ni duplica el puntaje, ni duplica el sonido.
- [ ] El motor de arkanoid no aparece en el bundle compartido de `/jugar/[id]`, y los de asteroides y tetris tampoco.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna ruta.
- [ ] `app/juegos/`, `app/jugar/`, `app/salon/`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts` y `app/jugar/actions.ts` no fueron modificados.

## Decisiones

- **Sí:** una fila nueva `arkanoid` en vez de darle motor a `bloque-buster`. Es el mismo criterio con el que el SPEC 07 eligió una fila nueva `tetris` en vez de `caida`: las tarjetas mock son el catálogo original y fusionarlas es un debate propio. La fila nueva deja clarísimo cuál de las dos es la jugable.
- **Sí:** `ARKANOID` como título, con el nombre real del juego, siguiendo el criterio de `ASTEROIDES` y `TETRIS`. Los nombres inventados en español son de las tarjetas mock.
- **Sí:** acento `magenta`. `bloque-buster` —la otra tarjeta de paleta y bloques— es cyan, y dos entradas del mismo género con el mismo acento se leen como duplicados. `magenta` y `hotpink` son además dos de los seis colores de bloque del original.
- **Sí:** dibujo vectorial en vez del spritesheet PNG. Es la misma decisión del SPEC 05, que reemplazó los sprites de asteroides por vectores. Mantiene el repo sin un solo asset de imagen, deja `start()` síncrono —el contrato actual no modela un estado `loading`— y evita que un spritesheet de arcade clásico conviva con el repintado neón que todos los specs de juego hacen igual. El precio es el pixel art del original y los 28 frames de explosión, que se reemplazan por un estallido de ocho fragmentos con la misma duración.
- **Sí:** mouse además del teclado, aunque cueste cambiar `.game-canvas` a `pointer-events: auto`. Es el control canónico del género y el README del juego lo lista primero; con teclado solo, una paleta a 400 px/s contra una pelota que arranca a 360 px/s y llega a 526 se siente lenta. El cambio es de una propiedad y no afecta a los otros dos motores, que no registran ningún listener de puntero.
- **No:** `cursor: none` sobre el canvas. Es lo habitual en un juego de paleta, pero es una segunda propiedad del chasis compartido para un beneficio estético, y el cursor tapando la paleta molesta menos que un cursor que desaparece sin avisar.
- **Sí:** el sonido entra, con los dos mp3 del original en `public/sounds/`. Rompe el precedente del SPEC 05 y el SPEC 07, que lo dejaron fuera, y a cambio obliga a resolver acá las tres decisiones que ese precedente estaba postergando: autoplay, control de silencio y persistencia. Son 19 KB de binarios y el rebote es la mitad de la sensación de este juego.
- **Sí:** `setMuted()` en `EngineHandle` en vez de un módulo `lib/games/audio.ts` con estado global. El estado del silencio vive en React, que es donde vive todo el resto del estado del reproductor, y no queda un singleton mutable que dos motores montados a la vez podrían pisarse. El precio es un no-op de una línea en asteroides y en tetris.
- **Sí:** el silencio baja por una prop de `<GameCanvas>` y no por `GameCanvasHandle`. El motor se crea después de un `import()` dinámico: una llamada imperativa al montar encontraría el ref en `null` y el primer rebote sonaría aunque el jugador tuviera el portal silenciado.
- **Sí:** desbloqueo del audio con el primer gesto dentro de la partida. El juego no se puede jugar sin mover la paleta, así que el `keydown` o el `mousemove` que el navegador exige llega en el primer segundo, sin pedirle nada al jugador y sin cambiar el arranque del reproductor para los otros diez juegos.
- **No:** un botón EMPEZAR que garantice el gesto. Cambia el arranque de `<Reproductor>` —el chasis de los once juegos— para resolver un problema que hoy tiene uno solo.
- **Sí:** un pool de 4 elementos `Audio` por sonido, con índice circular y `currentTime = 0`. El `cloneNode().play()` del original crea un elemento nuevo por cada rebote y no lo libera: una partida larga deja cientos de nodos vivos.
- **Sí:** volumen fijo en `0.4`. No es rebalancear el juego —no toca ninguna constante de física ni de puntaje— sino una decisión del portal: un efecto a volumen completo dentro de una página web es agresivo de un modo que el mismo efecto en una pestaña dedicada no es.
- **Sí:** `av_muted` en `localStorage`, con el prefijo `av_` de `av_user`. Silenciar el portal una vez y que se quede silenciado es la expectativa; el costo es una lectura en efecto para no romper la hidratación, que es el patrón que `lib/session.tsx` ya tiene escrito.
- **Sí:** el botón de silencio aparece en los tres juegos con motor, no solo en arkanoid. Mostrarlo condicionado a que el motor tenga audio obligaría a que el motor le reporte esa capacidad a React, que es un segundo canal de comunicación para un botón. Silenciar un juego mudo es un no-op que nadie nota.
- **Sí:** limpiar el nivel 5 termina la partida por el camino normal de `onGameOver`. El portal tiene un solo final —el modal con el puntaje y el formulario de guardado— y ese es el que importa: el logro real de haber completado los cinco niveles queda registrado en el ranking, que es donde este portal mide las cosas.
- **No:** un estado de victoria en `GameStatus` ni un título alternativo en el modal. Sería meter un concepto nuevo en el contrato que comparten los tres motores para un caso que hoy tiene uno solo, y el precio es un cartel.
- **No:** el ciclo infinito de niveles después del 5. Encajaría con un portal de puntajes altos, pero obliga a inventar la curva de velocidad más allá de ×1.46 — y eso es rebalancear.
- **Sí:** `{ label: "Velocidad", value: "×1.21" }` como stat del HUD. Es lo que distingue un nivel de otro más allá del patrón y le da al jugador la lectura de por qué le está costando más.
- **No:** el selector de nivel del overlay de pausa. Depende del overlay propio del motor, que se elimina, y del `click` sobre el canvas. Saltar directo al nivel 5 antes de guardar un puntaje es además un atajo sobre un ranking público — aunque hoy el nivel 5 acumule el score de los cuatro anteriores.
- **Sí:** el HUD del canvas, los dos overlays y el botón Reiniciar se **eliminan**, no se ocultan. Misma decisión que el SPEC 05 y el SPEC 07: código muerto que dibuja encima es peor que código borrado.
- **Sí:** los colores son constantes del motor y no se leen del DOM, incluidos los siete de los bloques.
- **No:** rebalancear nada. `PADDLE_SPEED`, las velocidades base, los cinco multiplicadores, los 10 puntos por bloque, las 3 vidas y los 150 ms de explosión se portan con sus valores. Se portan también los tres defectos conocidos del original —la paleta de 81 px, el `vy = -vy` sin detección de lado y el rebote sin control de ángulo—, porque son el balance que está probado. Si el juego resulta difícil o fácil, se ajusta después, con el juego andando y midiendo.
- **No:** power-ups, control de ángulo en la paleta ni detección de lado en los bloques. El original no los tiene y agregarlos es diseñar un juego distinto del que está probado.
- **No:** controles táctiles ni récord personal en el HUD, por las mismas razones que el SPEC 05.

## Riesgos

| Riesgo                                                                                                                   | Mitigación                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La conversión de coordenadas del mouse usa `canvas.width`, que con HiDPI vale 1600: la paleta se mueve a media velocidad | El paso 4 lo dice explícitamente: la fórmula usa `WORLD_W / rect.width`. Hay un criterio de aceptación que lo verifica con `devicePixelRatio` 2.                                                                             |
| `pointer-events: auto` cambia el comportamiento de asteroides y tetris                                                   | Ninguno de los dos registra listeners de puntero, y el paso 4 los verifica jugándolos. El overlay de pausa (z-index 5) sigue tapando el canvas, así que la pausa no cambia por ningún lado.                                  |
| El audio nunca se desbloquea y el juego queda mudo en silencio                                                           | El desbloqueo se dispara con el primer `keydown` o `mousemove`, que son los dos únicos eventos con los que se juega. Hay un criterio de aceptación sobre `NotAllowedError` en consola.                                       |
| `new Audio()` a nivel de módulo revienta el build con `Audio is not defined` en el servidor                              | Nada del motor corre al importar el archivo: los elementos se crean dentro de `start()`, y el registro carga con `import()` dinámico.                                                                                        |
| El `cloneNode().play()` del original deja cientos de nodos `<audio>` vivos en una partida larga                          | Pool fijo de 4 elementos por sonido con índice circular. Hay un criterio de aceptación que lo cuenta después de tres minutos.                                                                                                |
| El silencio no llega al motor porque el `import()` dinámico todavía está viajando, y el primer rebote suena              | El silencio baja por una prop, no por el handle imperativo: `<GameCanvas>` lo aplica justo después de `createEngine()` además de en el efecto de cambio.                                                                     |
| Leer `av_muted` durante el render rompe la hidratación                                                                   | Se lee en un efecto después del primer render, con el mismo patrón y el mismo `eslint-disable` que `lib/session.tsx` ya usa para `av_user`.                                                                                  |
| El botón de silencio aparece en los ocho juegos simulados, donde no hay nada que silenciar                               | Se renderiza solo cuando `withEngine`. Hay un criterio de aceptación que lo verifica en los ocho.                                                                                                                            |
| Agregar `setMuted` a `EngineHandle` rompe asteroides o tetris en silencio                                                | El paso 2 es un paso propio del plan, sin cambio de comportamiento, y su verificación es explícitamente "los dos se comportan exactamente igual". El compilador además obliga a implementarlo en los dos.                    |
| La pausa se alterna dos veces por pulsación porque el motor y React atan `P` y `Escape` a la vez                         | El bloque de pausa del original se elimina del motor: la pausa la maneja solo `<Reproductor>`, como en tetris.                                                                                                               |
| Mover el mouse durante la pausa arrastra la paleta y al reanudar salta                                                   | El listener sale temprano mientras `paused` es `true`, además de que el overlay de React tapa el canvas. Hay un criterio de aceptación.                                                                                      |
| El motor filtra `requestAnimationFrame`, listeners o audio al navegar, y el juego corre al doble                         | `destroy()` cancela el rAF, quita los listeners de teclado y de mouse y pausa los ocho elementos del pool; el `useEffect` de `<GameCanvas>` lo devuelve como cleanup. Hay un criterio que lo verifica navegando cinco veces. |
| Con la pestaña en segundo plano, el `dt` acumulado teletransporta la pelota a través de la paleta                        | El `dt` se topea en 50 ms como en los otros dos motores, y `resume()` resetea `lastTime` a `null`.                                                                                                                           |
| `onSnapshot` dispara `setState` en cada frame y el HUD hunde el rendimiento del juego                                    | El motor compara con el último snapshot y solo emite cuando algo cambió. Puntaje, vidas, nivel y velocidad cambian por evento, no por frame.                                                                                 |
| Dibujar sesenta bloques con `shadowBlur` por frame hunde los 60 fps                                                      | El glow va solo en la paleta y la pelota; los bloques son relleno sólido con una banda superior clara, como en tetris.                                                                                                       |
| La migración se aplica dos veces y falla por clave primaria duplicada                                                    | `games.id` es la primary key: el segundo intento falla en vez de duplicar la tarjeta. `select id, sort_order from games order by sort_order` es el criterio de verificación.                                                 |
| El motor de arkanoid entra en el bundle compartido de `/jugar/[id]` y los diez juegos restantes pagan su peso            | El registro usa `import()` dinámico, igual que los otros dos. Hay un criterio de aceptación sobre el build que verifica los tres motores.                                                                                    |

## Lo que **no** entra en esta spec

- Motores para los ocho juegos simulados que quedan.
- Fusionar, renombrar o retirar la fila `bloque-buster` del catálogo.
- El spritesheet PNG del juego de referencia.
- Un estado de victoria en `GameStatus` o un modal distinto para el que completa los cinco niveles.
- Niveles más allá del quinto, en ciclo o nuevos.
- El selector de salto de nivel del overlay de pausa.
- Power-ups, control de ángulo en la paleta o detección de lado en los bloques.
- Música de fondo, volumen graduable o sonido para asteroides y tetris.
- Controles táctiles en pantalla.
- Récord personal en el HUD.
- Tests automatizados.

Cada una de esas, si aparece, va en su propia spec.
