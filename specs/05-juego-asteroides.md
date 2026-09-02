# SPEC 05 — ASTEROIDES: el primer juego jugable del vault

> **Status:** Aprobado
> **Depends on:** SPEC 04
> **Date:** 2026-09-02
> **Objective:** Portar el clon de Asteroids de `references/started-games/02-asteroids/` a un motor de canvas en TypeScript y montarlo en `/jugar/asteroides` como noveno juego del catálogo, dejando `<Reproductor>` como chasis único que sigue simulando los otros ocho.

## Por qué existe este spec

Arcade Vault lleva cuatro specs siendo un portal de arcade **sin un solo juego**. `components/reproductor.tsx` lo dice sin disimulo en su propio comentario: "No hay ningún juego: el puntaje es un `setInterval` que suma un delta aleatorio". El marco CRT, el HUD, la pausa, el modal de fin de partida y el guardado en `av_scores` ya están construidos y funcionan — lo único que falta adentro de la pantalla es algo que se pueda jugar.

En `references/started-games/02-asteroids/` hay un clon de Asteroids completo y terminado: 510 líneas de canvas 2D sin dependencias, con nave inercial, envolvimiento toroidal, asteroides que se parten en tres tamaños, partículas de explosión, tres vidas con invencibilidad al reaparecer, niveles crecientes y un power-up de triple disparo. Está probado y balanceado. **Este spec no diseña un juego: lo adapta.**

La adaptación tiene tres fricciones reales, y son las que justifican que esto sea un spec y no un copiar-pegar:

1. **El juego es un script global y Next es un bundler con SSR.** `game.js` toma `document.getElementById('canvas')` en la línea 3 y arranca el loop en la última línea del archivo. Importado tal cual en un componente de React, revienta en el servidor y filtra listeners en cada navegación del App Router.
2. **Hay dos HUD y dos ciclos de fin de partida.** El juego pinta `SCORE / NIVEL / vidas` dentro del canvas y reinicia con Espacio; el reproductor pinta lo mismo arriba en React y abre un modal para guardar el puntaje. Si ambos sobreviven, el jugador ve dos veces la misma información y dos mensajes distintos de "se terminó".
3. **El canvas es fijo 800×600 y el marco CRT es fluido.** Sin escalado explícito, el juego se desborda o deja bandas negras según el ancho de la ventana.

Resolver esas tres cosas una vez, acá, es lo que hace que el **segundo** juego sea una línea en un registro.

## Alcance

**Dentro:**

- `lib/games/asteroides/engine.ts` — el port completo de `game.js` a TypeScript: `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, el loop y el estado, encapsulados en una fábrica que recibe el canvas y devuelve un handle con `start / pause / resume / restart / end / destroy`.
- `lib/games/registry.ts` — el mapa `id del juego → motor`, con import dinámico.
- `components/game-canvas.tsx` — la isla cliente que monta el motor sobre un `<canvas>`, resuelve el escalado por `devicePixelRatio` y limpia todo al desmontar.
- Cambios en `components/reproductor.tsx`: cuando el juego tiene motor, el HUD (puntuación, vidas, nivel, `3x`) se alimenta de los callbacks del motor en lugar del `setInterval`; PAUSA / FIN / JUGAR DE NUEVO controlan el motor.
- La novena entrada en `GAMES` (`lib/data.ts`): `id: "asteroides"`, `title: "ASTEROIDES"`, `cat: "SHOOTER"`, `color: "cyan"`, `cover: "cover-asteroides"`.
- `.cover-asteroides` en `app/globals.css` — arte CSS puro, como las otras ocho portadas.
- Los estilos mínimos del canvas dentro del CRT y el aviso de "requiere teclado" en punteros gruesos.
- El repintado del juego con la paleta neón del portal.

**Fuera de alcance (para specs futuras):**

- **Los otros ocho juegos.** `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria` y `duelo-pixel` siguen exactamente con el puntaje simulado. Este spec no toca su comportamiento.
- **Persistir puntajes en Supabase.** El puntaje se guarda con `saveScore()` en `av_scores` (localStorage), igual que hoy. La tabla `scores`, sus políticas RLS y el guardado en servidor son otro spec — el SPEC 04 los dejó explícitamente afuera.
- **Leer `av_scores`.** El Salón de la Fama y el top-10 del Detalle siguen mostrando `seededScores()`. Hoy nadie lee esa clave en todo el repo y este spec tampoco lo cambia.
- **Auth real.** El nombre del jugador sigue saliendo de `lib/session.tsx` (`av_user`) o de `INVITADO`.
- **Sonido.** El juego de referencia no tiene audio y este spec no lo inventa.
- **Récord personal en el HUD.**
- **Dificultad extra**: OVNIs, asteroides acelerados, más power-ups. El juego trae `3 + level` asteroides por nivel y con eso se queda.
- **Controles táctiles en pantalla.** Solo teclado, con un aviso en dispositivos sin teclado.
- **Guardar la partida a medias** o reanudar entre sesiones.
- **Tests automatizados.** El repo no tiene test runner y este spec no instala uno.
- **Tocar `lib/session.tsx`, `proxy.ts` o los clientes de Supabase.**

## Modelo de datos

No hay ninguna estructura **persistida** nueva: el puntaje final termina en `av_scores` con la forma que ya define `SavedScore` (`{ game, score, name, at }`), donde `game` pasa a valer `"asteroides"`.

Lo que sí se introduce son la entrada del catálogo y el contrato del motor.

### La novena entrada de `GAMES`

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Parte las rocas antes de que te partan a vos.",
  long: "…",              // en el tono de las otras ocho descripciones
  cat: "SHOOTER",         // ya existe en CATS, no hay filtro nuevo
  cover: "cover-asteroides",
  color: "cyan",          // el acento de la nave; ROCAS ya usa yellow
  best: <número mock>,
  plays: "<string mock>",
}
```

`best` y `plays` siguen siendo mock como en las otras ocho tarjetas. El día que los puntajes sean reales, cambian las nueve a la vez; tener una tarjeta con datos reales y ocho con datos inventados es peor que tener nueve consistentes.

### El contrato del motor

```ts
// lib/games/asteroides/engine.ts
export type GameStatus = "playing" | "dead" | "gameover";

/** Lo único que el motor le cuenta a React. */
export type GameSnapshot = {
  score: number;
  lives: number;
  level: number;
  tripleShot: number; // segundos restantes, 0 si no hay power-up activo
  status: GameStatus;
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

export function createAsteroidesEngine(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): EngineHandle;
```

```ts
// lib/games/registry.ts
export type EngineFactory = (canvas: HTMLCanvasElement, options: EngineOptions) => EngineHandle;

/** id de GAMES → carga perezosa del motor. */
export const ENGINES: Record<string, () => Promise<EngineFactory>> = {
  asteroides: () => import("./asteroides/engine").then((m) => m.createAsteroidesEngine),
};

export function hasEngine(id: string): boolean;
```

El import es **dinámico a propósito**: los otros ocho juegos comparten la misma ruta `/jugar/[id]` y no tienen por qué arrastrar el motor de asteroides en su bundle.

Las constantes del juego (`RADII`, `SPEEDS`, `POINTS`, `POWERUP_DROP_CHANCE`, `POWERUP_DURATION`, `POWERUP_TTL`, `TRIPLE_SPREAD`, `W`, `H`) se portan con sus mismos valores. **Este spec no rebalancea nada.**

## Plan de implementación

1. **La entrada del catálogo y su portada.** Agregar el noveno objeto a `GAMES` en `lib/data.ts` y la clase `.cover-asteroides` en `app/globals.css`, siguiendo el patrón de las otras ocho portadas: arte CSS puro, cero assets de imagen — campo de estrellas con `radial-gradient`, dos siluetas de asteroide y la nave triangular en `--cyan`.
   _Verificación:_ `/juegos` muestra nueve tarjetas, el filtro `SHOOTER` incluye la nueva, `/juegos/asteroides` renderiza el detalle y `/jugar/asteroides` funciona **con la simulación**, igual que los otros ocho. Nada se rompió todavía porque nada nuevo se montó.

2. **El motor** (`lib/games/asteroides/engine.ts`). Port de `game.js` a TypeScript dentro de `createAsteroidesEngine(canvas, options)`:
   - Las cinco clases (`Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`) y los helpers (`wrap`, `dist`, `rand`, `randInt`) se portan **sin cambios de lógica**, tipados, tomando `ctx` del closure en vez de un global de módulo.
   - **Nada corre al importar el archivo.** No hay `document`, no hay `window` ni `requestAnimationFrame` a nivel de módulo: eso es lo que hoy hace que `game.js` sea imposible de importar en un componente de React. Todos los efectos secundarios viven dentro de `start()`.
   - Los listeners de teclado se registran en `start()` sobre `window` y se quitan en `destroy()`. Hacen `preventDefault()` en `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` y `Space` para que jugar no scrollee la página.
   - `pause()` cancela el `requestAnimationFrame`; `resume()` lo vuelve a pedir **y resetea `lastTime` a `null`**, para que el primer `dt` después de la pausa no sea el tiempo entero que estuvo pausado. El tope de `dt` en 50 ms se conserva igual.
   - `onSnapshot` se emite **solo cuando cambia algo**: se guarda el último snapshot y se compara antes de llamar. `tripleShot` se redondea a un decimal antes de comparar. Sin esto, React re-renderiza 60 veces por segundo para mostrar el mismo número.
   - Se **elimina** `drawHUD()` y el `drawOverlay('GAME OVER', …)`: el HUD y el fin de partida los pinta React (paso 5).
   - Se **elimina** el reinicio con Espacio dentro de `update()`. Al llegar a `gameover` el motor deja de actualizar y llama `onGameOver(score)` **una sola vez**.
   - `end()` fuerza `lives = 0` y dispara el mismo camino de game over que perder la última vida, para que el botón FIN y morir terminen idénticos.
   - `restart()` es `initGame()` más volver a arrancar el loop.

   _Verificación:_ `npx tsc --noEmit` pasa y `npx eslint lib` no reporta errores. El archivo todavía no lo importa nadie.

3. **La isla del canvas** (`components/game-canvas.tsx`, `"use client"`). Recibe `{ gameId, onSnapshot, onGameOver }` más un handle hacia afuera para que el reproductor pueda pausar y reiniciar.
   - Un `useRef` al `<canvas>` y un `useEffect` que carga la fábrica del registro, crea el motor, lo arranca y devuelve `() => engine.destroy()`. El efecto depende de `gameId`, así que navegar entre juegos destruye y recrea limpiamente.
   - **Escalado:** `canvas.width = 800 * dpr` y `canvas.height = 600 * dpr` con `ctx.scale(dpr, dpr)`, mientras el CSS lo estira con `width: 100%` y `aspect-ratio: 4 / 3`. El motor sigue razonando en coordenadas 800×600 — **cero cambios de física** — y el dibujo no se ve borroso en pantallas HiDPI.
   - Los callbacks se leen desde un ref para que cambiar la función no reinicie el juego.
   - Fondo negro y sin `outline` al enfocar; el canvas no es interactivo por mouse.

   _Verificación:_ montado a mano en `/jugar/asteroides`, el juego se ve, se controla con las flechas y el Espacio, las flechas no scrollean la página, y navegar a otra ruta y volver no deja dos loops corriendo (el puntaje no avanza al doble).

4. **El registro** (`lib/games/registry.ts`) con `ENGINES` y `hasEngine(id)`, tal como está en el modelo de datos.
   _Verificación:_ `hasEngine("asteroides")` es `true`, `hasEngine("caida")` es `false`, y el análisis del build muestra que el motor no entra en el bundle compartido de `/jugar/[id]`.

5. **El reproductor** (`components/reproductor.tsx`). El componente sigue siendo **uno solo** para los nueve juegos; adentro se bifurca:
   - `const withEngine = hasEngine(game.id)`.
   - Si `withEngine`, el `setInterval` del puntaje simulado y el efecto de nivel cada 2500 puntos **no corren**; el estado de `score`, `lives`, `level` y `tripleShot` viene del `onSnapshot`. Si no, todo queda exactamente como hoy.
   - `lives` deja de ser la constante `3` y pasa a ser estado; en los juegos sin motor sigue valiendo `3` y el HUD se ve igual que ahora.
   - Dentro del `.crt-screen`: si `withEngine` se monta `<GameCanvas>`; si no, la animación decorativa `.game-arena` de siempre.
   - **PAUSA / REANUDAR** llama `pause()` / `resume()`; el overlay `EN PAUSA` que ya existe se muestra igual. La tecla `Escape` hace lo mismo que el botón.
   - **FIN** llama `end()`.
   - **`onGameOver`** abre el modal que ya existe, con el puntaje real. `saveScore({ game: "asteroides", score, name })` se guarda en `av_scores` sin cambios.
   - **JUGAR DE NUEVO** llama `restart()` además de resetear el estado de React.
   - El contador `3x  4.2s` se muestra como un `.hud-stat` más, solo cuando `tripleShot > 0`.

   _Verificación:_ en `/jugar/asteroides` el HUD sigue al juego en vivo; pausar congela nave y asteroides; perder tres vidas abre el modal con el puntaje real; guardar agrega la fila a `av_scores` con `game: "asteroides"`; JUGAR DE NUEVO empieza de cero. En `/jugar/caida` todo sigue simulado y sin cambios visibles.

6. **Paleta y aviso de teclado.** Repintar el motor con los acentos del portal: nave en `--cyan`, asteroides en `--ink-dim`, balas en `--yellow`, power-up y explosiones en `--magenta`, llama del propulsor en naranja como el original. Los colores se declaran como constantes del motor (no se leen del DOM: el motor no debe depender de que exista una hoja de estilos). Agregar en `app/globals.css` el bloque `@media (pointer: coarse)` que muestra el aviso "ASTEROIDES REQUIERE TECLADO" dentro del CRT — **por CSS, no por detección en JavaScript**, para no arriesgar un desajuste de hidratación.
   _Verificación:_ el juego se lee como parte del portal dentro del marco CRT; en un viewport táctil simulado aparece el aviso y en uno de escritorio no.

7. **Repaso final.** Confirmar que las nueve rutas responden 200 y que las ocho pantallas anteriores se ven idénticas. Confirmar que `lib/session.tsx`, `proxy.ts` y `lib/supabase/` no fueron modificados. Jugar una partida completa mirando la consola: sin errores, sin warnings de hidratación, sin listeners huérfanos después de navegar cinco veces entre `/jugar/asteroides` y `/juegos`.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni errores de tipos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npx eslint app lib components` no reporta errores.
- [ ] `/juegos` muestra **nueve** tarjetas y la nueva aparece bajo el filtro `SHOOTER` y bajo `TODOS`.
- [ ] `.cover-asteroides` es arte CSS puro: no se agregó ningún archivo de imagen al repo.
- [ ] `/juegos/asteroides` y `/jugar/asteroides` responden 200.
- [ ] En `/jugar/asteroides` la nave rota con `←` `→`, propulsa con `↑` y dispara con `Espacio`.
- [ ] Pulsar `↑` o `Espacio` **no** scrollea la página.
- [ ] Disparar a un asteroide grande lo parte en dos medianos; el mediano en dos pequeños; el pequeño no se parte.
- [ ] Los puntos son 20 / 50 / 100 por tamaño grande / mediano / pequeño, igual que el juego de referencia.
- [ ] Los objetos que salen por un borde reaparecen por el opuesto.
- [ ] El power-up `3x` aparece, se puede recoger, dispara tres balas y dura 5 segundos; el HUD muestra su cuenta regresiva mientras está activo.
- [ ] Al destruir el último asteroide sube el nivel y aparecen `3 + nivel` asteroides.
- [ ] El HUD de React muestra puntuación, vidas y nivel **reales** del motor, y el canvas **no** dibuja ningún HUD.
- [ ] El canvas **no** dibuja el overlay `GAME OVER` ni reinicia con Espacio.
- [ ] PAUSA congela el juego por completo (nave, asteroides, partículas) y REANUDAR lo sigue desde donde estaba, sin un salto proporcional al tiempo pausado.
- [ ] La tecla `Escape` pausa y reanuda igual que el botón.
- [ ] El botón FIN termina la partida en el acto y abre el modal.
- [ ] Perder las tres vidas abre el modal **una sola vez** con el puntaje real.
- [ ] Guardar desde el modal agrega a `av_scores` una fila con `game: "asteroides"` y el puntaje real.
- [ ] JUGAR DE NUEVO reinicia el juego en 0 puntos, 3 vidas y nivel 1.
- [ ] `/jugar/caida` (y los otros siete) siguen con el puntaje simulado y se ven exactamente igual que antes del spec.
- [ ] Navegar cinco veces entre `/jugar/asteroides` y `/juegos` no acelera el juego ni duplica el puntaje: `destroy()` limpia el `requestAnimationFrame` y los listeners.
- [ ] El canvas ocupa el ancho del marco CRT manteniendo 4:3 y se ve nítido en una pantalla con `devicePixelRatio` 2.
- [ ] En un viewport con `pointer: coarse` aparece el aviso de teclado; en escritorio no.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna ruta.
- [ ] `lib/session.tsx`, `proxy.ts` y `lib/supabase/**` no fueron modificados.
- [ ] No hay ninguna tabla nueva en Supabase ni ninguna migración nueva.
- [ ] El motor de asteroides no aparece en el bundle de `/juegos` ni en el JavaScript compartido de `/jugar/[id]`.

## Decisiones

- **Sí:** una entrada nueva `asteroides` en vez de reusar `rocas`. `rocas` describe OVNIs que el código no implementa y ya tiene su propio acento y portada; darle un motor sería prometer algo distinto de lo que hace. La novena entrada dice exactamente lo que es.
- **Sí:** motor en TypeScript desacoplado, con el canvas y los callbacks inyectados. Es lo que convierte un script global en algo montable, desmontable y tipado. Un `iframe` habría evitado el port pero deja el puntaje viajando por `postMessage` y el juego fuera del sistema visual; reescribirlo con estado de React habría tirado a la basura código que funciona para conseguir 60 renders por segundo de arrays de objetos.
- **Sí:** un registro `id → motor` con import dinámico, aunque hoy tenga una sola fila. Es la diferencia entre "el segundo juego es una línea" y "el segundo juego vuelve a tocar `<Reproductor>`". El import dinámico además evita que los otros ocho paguen el peso del motor.
- **Sí:** `<Reproductor>` sigue siendo un solo componente para los nueve juegos. Duplicar el chasís por juego duplicaría el HUD, la pausa, el modal y el guardado — cuatro cosas que ya funcionan y que deben seguir siendo idénticas en todo el portal.
- **Sí:** manda el HUD de React y el ciclo de fin de partida del reproductor. Es lo único que hace que el puntaje llegue a `av_scores` y que el jugador vea su nombre. El overlay del canvas y el reinicio con Espacio se eliminan del motor, no se ocultan: código muerto que dibuja encima es peor que código borrado.
- **Sí:** el snapshot se emite solo cuando cambia. Llamar a `setState` en cada frame es el error clásico de meter un juego de canvas adentro de React, y produce exactamente el problema de rendimiento que el canvas venía a evitar.
- **Sí:** el motor mantiene sus coordenadas 800×600 y escala por CSS más `devicePixelRatio`. Hacer el mundo responsive de verdad significaría rebalancear velocidades, radios y distancias de spawn — un juego distinto del que está probado.
- **Sí:** el power-up de triple disparo se porta tal cual. Está en el código que funciona y ya está balanceado, aunque el README del juego no lo documente.
- **Sí:** los colores son constantes del motor, no valores leídos del DOM. Un motor que necesita que exista una hoja de estilos para dibujar es un motor que falla en silencio.
- **Sí:** el aviso de "requiere teclado" es una media query de CSS. Detectar el dispositivo en JavaScript significa que el servidor y el cliente rendericen distinto en el primer paso — el mismo problema de hidratación que `lib/session.tsx` documenta.
- **No:** controles táctiles. Diseñarlos, posicionarlos sobre el canvas y probarlos es un spec propio, y sin ellos el juego funciona perfecto en el escritorio, que es donde se juega un arcade con teclado.
- **No:** persistir el puntaje en Supabase. El SPEC 04 dejó el cableado listo y las tablas explícitamente afuera. Mezclar "el juego no anda" con "la base no anda" en la misma entrega hace que el primer bug cueste el doble de diagnosticar.
- **No:** leer `av_scores` para mostrar un récord personal. Hoy nadie lee esa clave; el primero que lo haga define cómo se agrega, se ordena y se muestra — y eso pertenece al spec de puntajes reales.
- **No:** sonido. El juego de referencia no tiene audio; agregarlo es diseñar algo nuevo, con su política de autoplay y su control de silencio.
- **No:** rebalancear nada. Las constantes se portan con sus valores. Si el juego resulta difícil o fácil, se ajusta después, con el juego andando y midiendo.
- **Sí:** `best` y `plays` de la entrada nueva siguen siendo mock. Nueve tarjetas consistentes se leen mejor que una real entre ocho inventadas; cambian todas juntas el día que los puntajes sean reales.

## Riesgos

| Riesgo                                                                                                                      | Mitigación                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El motor filtra `requestAnimationFrame` o listeners de teclado al navegar, y el juego corre al doble de velocidad al volver | `destroy()` cancela el rAF y quita los listeners; el `useEffect` de `<GameCanvas>` lo devuelve como cleanup. Hay un criterio de aceptación que lo verifica navegando cinco veces. |
| Se importa el motor en un Server Component y el build revienta con `document is not defined`                                | Nada del motor corre al importar el archivo: todo efecto vive dentro de `start()`. `<GameCanvas>` es `"use client"` y el registro carga con import dinámico.                      |
| `onSnapshot` dispara `setState` en cada frame y el HUD hunde el rendimiento del juego                                       | El motor compara con el último snapshot y solo emite cuando algo cambió, con `tripleShot` redondeado a un decimal.                                                                |
| Al reanudar de una pausa larga el juego da un salto: el `dt` acumulado teletransporta los asteroides                        | `resume()` resetea `lastTime` a `null`, y el tope de `dt` en 50 ms del original se conserva.                                                                                      |
| Las flechas y el Espacio scrollean la página mientras se juega                                                              | `preventDefault()` en las cinco teclas del juego, registrado y quitado junto con el motor.                                                                                        |
| El canvas se ve borroso en pantallas HiDPI                                                                                  | Backing store escalado por `devicePixelRatio` y `ctx.scale(dpr, dpr)`; el CSS solo estira la caja.                                                                                |
| Los cambios en `<Reproductor>` rompen los otros ocho juegos, que comparten el componente                                    | La bifurcación es una sola condición (`hasEngine(game.id)`) y la rama sin motor queda idéntica a hoy. Hay un criterio de aceptación explícito sobre `/jugar/caida`.               |
| El aviso de teclado aparece en escritorio o desaparece en móvil por una detección hecha en JavaScript                       | Es una media query `(pointer: coarse)`, evaluada por el navegador y sin participación del render.                                                                                 |
| `onGameOver` se dispara más de una vez y el modal se reabre encima del guardado                                             | El motor entra a `gameover` una sola vez y deja de actualizar; el callback se emite en esa transición, no en cada frame.                                                          |
| El motor entra en el bundle de todas las rutas y engorda la carga inicial de la biblioteca                                  | El registro usa `import()` dinámico. Hay un criterio de aceptación que lo verifica sobre el build.                                                                                |

## Lo que **no** entra en esta spec

- Motores para los otros ocho juegos del catálogo.
- Persistir puntajes en Supabase: tabla, RLS, Server Action.
- Leer `av_scores` en el Salón, en el Detalle o en el HUD.
- Auth real o cualquier cambio a `lib/session.tsx`.
- Sonido, música o control de volumen.
- Controles táctiles en pantalla.
- OVNIs, más power-ups o cualquier cambio de balance respecto del juego de referencia.
- Guardar o reanudar una partida entre sesiones.
- Tests automatizados.

Cada una de esas, si aparece, va en su propia spec.
