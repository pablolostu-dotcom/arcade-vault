# SPEC 10 — ABISMO: el quinto juego jugable, un rescate submarino con el aire contado

> **Status:** Abrobado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-09-13
> **Objective:** Diseñar y montar ABISMO —un shooter de corte submarino con oxígeno, rescate de buzos y cobro en la superficie— en `/jugar/abismo` como decimotercera fila del catálogo, sin tocar el chasis.

## Por qué existe este spec

Sale de una game jam con el tema **«el fondo del mar»**. El brief con los cinco candidatos comparados y el porqué de este está en `specs/game-jam/abismo/01-brief.md`, y el diseño completo —reglas, casos borde, constantes, paleta, portada— en `specs/game-jam/abismo/02-diseno.md`. Este documento es el implementable, y no repite el diseño entero: lo resume y remite.

El catálogo tiene hoy **doce filas y cuatro motores**: `asteroides` (shooter vectorial de pantalla envolvente), `tetris` (puzzle de caída), `arkanoid` (pantalla fija de rebote) y `snake` (grilla por tics). Los cuatro se agregaron con el mismo procedimiento y cada uno ensanchó algo, salvo el último.

**Este spec tampoco ensancha nada**, y esa es la mejor noticia que puede dar un spec de juego. `GameSnapshot` ya modela vidas opcionales desde el SPEC 07, ya tiene el slot `extra`, y `EngineHandle` ya tiene `setMuted()` desde el SPEC 08. `Escape` y `P` ya pausan desde React. `.game-canvas` ya es `aspect-ratio: 4 / 3`, y el mundo de ABISMO es 800×600 clavado. **`lib/games/types.ts`, `components/reproductor.tsx` y `components/game-canvas.tsx` no se tocan.** El único archivo compartido que cambia es `lib/games/registry.ts`, y cambia en una línea.

Las fricciones reales son cinco, y todas están resueltas acá con un número o una regla:

1. **El juego tiene dos stats propios y `extra` es uno solo.** Oxígeno y buzos a bordo son las dos mitades de la única decisión del juego, así que ninguna puede quedar fuera del HUD. Se empaquetan en un `value` con el `label` nombrando las dos mitades en el mismo orden: `{ label: "O₂ · BUZOS", value: "68% · 4" }`. No es un invento: `asteroides` publica `"3x · 4.2s"` en producción desde el SPEC 05.
2. **Una barra de oxígeno sería HUD, y el motor no dibuja HUD.** Por eso el oxígeno **no** se dibuja en el canvas. La alarma de tanque bajo es el casco del submarino parpadeando magenta por debajo de los 12 segundos, más un pulso de audio; el número exacto vive en el slot `extra` de React. Los buzos a bordo sí se refuerzan en el canvas, como seis luces dentro del casco, porque eso es dibujo de entidad y no un panel.
3. **El cobro en superficie es un evento de cruce, no un estado.** Cobrar mientras el submarino está arriba pagaría los buzos sesenta veces por segundo. Se resuelve con una bandera `wasSurfaced` y el cobro en la transición de sumergido a emergido.
4. **El balance se elige, no se porta.** Las tres carpetas de `references/started-games/` ya están consumidas por los SPEC 05, 07 y 08: no hay original del que copiar constantes. Es la misma situación del SPEC 09 y se paga igual — todas las constantes juntas en un bloque, y rebalancear anotado como esperable.
5. **No hay entrevista detrás de este spec.** Lo escribió el subagente `game-jam` a partir de un tema, sin `AskUserQuestion`. Cada hueco que `/spec-juego` habría preguntado está cerrado con una decisión argumentada en `## Decisiones`, que por eso es la sección más larga del documento.

## Alcance

**Dentro:**

- `lib/games/abismo/engine.ts` — el motor completo: el mundo de tres bandas, el submarino, el oxígeno, la superficie y su cobro, los buzos, los tiburones, los submarinos enemigos, los dos tipos de torpedo, las vidas y el dibujo, encapsulados en `createAbismoEngine(canvas, options)`.
- La quinta fila de `ENGINES` en `lib/games/registry.ts`.
- `supabase/migrations/<ts>_add_game_abismo.sql` — el `insert into public.games` de la decimotercera fila.
- `.cover-abismo` en `app/globals.css` — arte CSS puro, como las doce que ya están.
- Los seis efectos de sonido, **sintetizados con `AudioContext`**. Cero binarios.

**Fuera de alcance (para specs futuras):**

- **Inercia y flotación**, corrientes por zonas y oscuridad con cono de linterna. Las tres están descartadas con argumento en `02-diseno.md`.
- **Jefes, IA de persecución y minas fijas.** Ningún enemigo persigue: cruzan su carril en línea recta.
- **Disparo vertical o diagonal.** El torpedo es horizontal.
- **Vidas extra por puntaje, bodega de más de seis y puntaje por profundidad.**
- **Controles táctiles o de mouse.** Solo teclado, con el aviso que `.keyboard-notice` ya muestra en puntero grueso.
- **Récord personal en el HUD y modo dos jugadores.** Mismos recortes que el SPEC 05, el SPEC 08 y el SPEC 09.
- **Los ocho juegos simulados.** `bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria` y `duelo-pixel` siguen con el puntaje simulado y no se tocan.
- **Rebalancear las constantes con el juego andando.** Es esperable —no vienen de un original probado— pero se hace midiendo, en otro spec, no durante esta implementación.
- **Assets binarios de cualquier tipo.** Ni sprites ni audio: nada entra en `public/`.
- **Tests automatizados.** El repo no tiene test runner y este spec no instala uno.
- **Tocar `app/juegos/`, `app/jugar/`, `app/salon/`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts`, `app/jugar/actions.ts`, `lib/games/types.ts`, `components/reproductor.tsx` ni `components/game-canvas.tsx`.**

## Modelo de datos

No hay ningún cambio de esquema: el puntaje termina en `public.scores` con `game_id = 'abismo'`, por el camino que abrió el SPEC 06. Lo que se introduce es la fila del catálogo y las reglas del juego.

### La fila del catálogo

`games` tiene RLS activa y su única política es de SELECT: sin política de INSERT, la operación queda negada para todos. La fila entra por migración y por ningún otro camino.

```sql
insert into public.games (id, title, short, "long", cat, cover, color, sort_order)
values ('abismo', 'ABISMO',
        'Rescata buzos del abismo antes de que se acabe el aire.',
        'Un submarino de bolsillo baja a un corte del océano de seis carriles, entre tiburones y submarinos enemigos que lo cruzan sin descanso. El tanque da cincuenta segundos de aire y solo se recarga en la superficie, que es también el único lugar donde los buzos se cobran. Cada buzo que subís multiplica el rescate por sí mismo: seis valen treinta y seis veces uno, y bajar a buscar el sexto es siempre la decisión que te mata.',
        'SHOOTER', 'cover-abismo', 'magenta', 13);
```

`"long"` va siempre entre comillas: es palabra reservada. `sort_order` 13 es el más alto de hoy (12, `snake`) más uno. `cat` y `color` salen de los valores de los CHECK constraints de `public.games`; no se agrega ninguno. `abismo` no choca con ninguno de los doce `id` del catálogo, y `cover-abismo` no choca con ninguna de las doce clases en uso.

Agregar una fila **no** cambia el esquema: `npm run db:types` no hace falta en este spec.

### El contrato del motor

**No cambia nada.** `lib/games/types.ts` queda exactamente como está: el SPEC 07 volvió `lives` y `extra` opcionales y el SPEC 08 sumó `setMuted()`. ABISMO nace importando de ahí y no pide un solo campo nuevo.

```ts
// lib/games/abismo/engine.ts
export function createAbismoEngine(canvas: HTMLCanvasElement, options: EngineOptions): EngineHandle;
```

```ts
// lib/games/registry.ts — la línea que se agrega
abismo: () => import("./abismo/engine").then((m) => m.createAbismoEngine),
```

Cómo llena cada motor el snapshot, con la fila nueva al final:

| Motor        | `lives` | `extra`                                                                        |
| ------------ | ------- | ------------------------------------------------------------------------------ |
| `asteroides` | `3 → 0` | `{ label: "Triple disparo", value: "3x · 4.2s" }`, solo con el power-up activo |
| `tetris`     | ausente | `{ label: "Líneas", value: "37" }`, siempre                                    |
| `arkanoid`   | `3 → 0` | `{ label: "Velocidad", value: "×1.21" }`, siempre                              |
| `snake`      | ausente | `{ label: "Largo", value: "24" }`, siempre                                     |
| `abismo`     | `3 → 0` | `{ label: "O₂ · BUZOS", value: "68% · 4" }`, siempre                           |

El porcentaje es `Math.round((tank / TANK_S) * 100)` y el segundo número son los buzos a bordo, de 0 a 6. Los dos viajan **ya formateados en un solo string por el motor**: el HUD no sabe que el primero salió de un número de segundos. El `label` se pinta con `--mono`, que tiene el glifo `₂`; el `value` con `--pixel`, y usa el mismo `·` que `asteroides` publica hoy.

`lives = 3` ⇒ `<Reproductor>` pinta tres `♥`, exactamente como con `arkanoid`. El slot no se ensancha.

### El mundo

800×600 partido en tres bandas, y la cuenta cierra exacta:

```ts
const SURFACE_Y = 90; // la línea de agua
const SEABED_Y = 570; // el lecho marino
const LANES = 6;
const LANE_H = 80; // (570 − 90) / 6 = 80 exacto
const LANE_Y = [130, 210, 290, 370, 450, 530]; // SURFACE_Y + LANE_H * (i + 0.5)
```

`90 + 480 + 30 = 600`. Sin bandas muertas y sin reencuadre: **`.game-canvas` no cambia**, su `aspect-ratio: 4 / 3` ya calza. Como en los otros cuatro motores, **nunca se lee `canvas.width`**: `<GameCanvas>` lo fija en `800 × devicePixelRatio` y en una pantalla HiDPI valdría 1600.

Los carriles son solo para nacer. Todo aparece fuera de pantalla, en `x = −80` o `x = 880`, y cruza los 800 px completos; nada nace dentro del campo visible. Ningún enemigo entra en la banda de aire, así que la superficie es segura por construcción y no por una regla de invulnerabilidad.

El detalle completo —entidades, tamaños, colisión AABB, y los trece casos borde resueltos— está en `## Las reglas` de `02-diseno.md`.

### Las reglas del recurso

- El tanque baja `1` s por segundo mientras `sub.y > SURFACE_Y`, y sube `TANK_S / REFILL_S` mientras `sub.y <= SURFACE_Y`.
- Por debajo de `TANK_ALARM_S = 12` el casco parpadea a 4 Hz y suena la alarma.
- A cero, el submarino implota: **pierde una vida por la misma rama que una colisión**.
- El cobro ocurre en la **transición** a emergido, con `wasSurfaced`: `RESCUE_BASE × buzos²` más `O2_BONUS × Math.floor(tank)`, y la bodega se vacía.
- Emerger con cero buzos recarga el tanque y no suma nada. Nunca cuesta una vida.
- Morir con buzos a bordo los pierde sin cobrarlos.

### Las constantes

Las **cuarenta y dos constantes numéricas** del juego están todas en `## Las constantes` de `02-diseno.md`, en un solo bloque TypeScript, agrupadas en ocho secciones: el mundo, el submarino, el oxígeno, los buzos, los enemigos, los torpedos, el puntaje y el loop. Se copian tal cual al encabezado de `engine.ts`. Ninguna constante aparece en este spec que no esté allá, y viceversa.

Las que fijan el balance y conviene tener a mano: `TANK_S = 50`, `TANK_ALARM_S = 12`, `REFILL_S = 2.5`, `DIVER_CAPACITY = 6`, `RESCUE_BASE = 50`, `O2_BONUS = 2`, `SHARK_POINTS = 20`, `ESUB_POINTS = 30`, `DIVERS_PER_LEVEL = 6`, `START_LIVES = 3`, `MAX_FRAME_MS = 50`.

### El puntaje y el nivel

```ts
score += enemy.kind === "shark" ? SHARK_POINTS : ESUB_POINTS; // 20 o 30, planos
score += RESCUE_BASE * divers * divers; // al emerger: 50 × buzos²
score += O2_BONUS * Math.floor(tank); // 2 por segundo de aire sobrante
const level = Math.floor(diversRescued / DIVERS_PER_LEVEL) + 1;
```

Un viaje del nivel 1 con tres tiburones, un submarino enemigo, cuatro buzos y 18,4 s de tanque paga `90 + 800 + 36 = 926`. El mismo viaje con seis buzos y 9 s paga `1908`. Seis viajes de un buzo cada uno pagan `840` en total. Una partida que llega al nivel 6 aterriza entre **10.000 y 16.000 puntos**, el mismo rango que SNAKE.

`diversRescued` cuenta buzos **entregados**, no recogidos, así que `level` es monótono y no se puede trabar. Con el nivel se mueven tres cosas: la velocidad de los enemigos (90 → 260 px/s), el intervalo de aparición (1500 → 520 ms) y la proporción de submarinos enemigos (20 % → 60 %). El tanque, la bodega y los puntos **no cambian nunca**.

### Los controles

`ArrowUp`/`KeyW`, `ArrowDown`/`KeyS`, `ArrowLeft`/`KeyA`, `ArrowRight`/`KeyD` para moverse, y `Space` para disparar. `preventDefault()` en las cuatro flechas **y en `Space`**: la barra scrollea una pantalla entera. El disparo va por estado de tecla con `TORPEDO_COOLDOWN_MS`, ignorando el `keydown` con `repeat === true`.

**El motor no ata `Escape` ni `KeyP`.** Los ata `<Reproductor>` desde el SPEC 07; atarlas también acá alternaría la pausa dos veces por pulsación.

### La paleta

Constantes del motor, **nunca leídas del DOM**. La tabla completa está en `## La paleta` de `02-diseno.md`. El código de color es la regla de lectura del juego: **magenta sos vos, amarillo te mata, verde se salva, gris te muerde.**

El `shadowBlur` va **solo** en el submarino del jugador, los buzos y la línea de agua — cinco sombras por frame como mucho. **No va** en los enemigos (hasta diez), los torpedos (hasta seis) ni las burbujas de fondo (hasta cuarenta): cien sombras por frame hunden los 60 fps, la lección que el SPEC 09 escribió sobre el cuerpo de la serpiente.

## Plan de implementación

El orden se aparta del canónico de `/spec-juego` en un punto y a propósito: **la línea de `ENGINES` entra en el paso 2 y no en un paso propio**, porque no hay tipos que hoistear y porque con el motor registrado temprano cada paso siguiente se verifica jugando en el navegador, no leyendo el código.

1. **La migración del catálogo y la portada.** El `.sql` con el insert literal de arriba en `supabase/migrations/`, aplicado al proyecto remoto, más `.cover-abismo` en `app/globals.css`: arte CSS puro, cero archivos de imagen. Las tres capas están descritas en `## La portada` de `02-diseno.md` — columna de agua en degradado, rayos de luz en diagonal y la línea de agua en el `background`; el submarino magenta con `clip-path` y `drop-shadow` en el `::before`; el tiburón gris y los dos buzos verdes con halo en el `::after`. Ninguna de las doce portadas existentes se toca.
   _Verificación:_ `/juegos` muestra trece tarjetas, ABISMO aparece bajo el filtro `SHOOTER` y bajo `TODOS`, `/juegos/abismo` renderiza el detalle con su portada, `/salon` muestra la tab nueva vacía, y `/jugar/abismo` corre **con el puntaje simulado**, igual que los otros ocho. Nada se rompió porque nada nuevo se montó.

2. **El motor mudo, capa 1: el mundo, el submarino y el oxígeno**, en `lib/games/abismo/engine.ts`, más la línea de `abismo` en `ENGINES`. Las tres bandas, el fondo con burbujas, el submarino con sus topes y su orientación, el tanque que baja y se recarga en la superficie, la alarma por debajo de `TANK_ALARM_S`, las tres vidas, el respawn y el snapshot con `lives` y `extra`. Sin buzos, sin enemigos y sin torpedos todavía. Las reglas del chasis que este paso establece y los siguientes respetan:
   - **Nada corre al importar el archivo.** Ni listeners, ni `requestAnimationFrame`, ni `new AudioContext()`. A nivel de módulo corren en el servidor y revientan el build.
   - Los listeners de teclado se registran en `start()` sobre `window` y se quitan en `destroy()`. Usan `e.code` y hacen `preventDefault()` en las cuatro flechas y en `Space`.
   - `pause()` cancela el `requestAnimationFrame`; `resume()` lo vuelve a pedir **y resetea `lastTime` a `null`**, para que el primer `dt` después de la pausa no sea el tiempo entero que estuvo pausada y el tanque no pierda diez segundos de golpe.
   - El `dt` queda topeado en `MAX_FRAME_MS = 50`.
   - `emitSnapshot()` guarda el último snapshot y **solo emite si algo cambió**. El porcentaje de oxígeno es un entero, así que cambia como mucho una vez cada dos frames y no cincuenta veces por segundo.
   - `end()` pone `lives` en 1 y llama a la misma función de muerte, para que FIN y perder la última vida terminen por un camino idéntico. `onGameOver(score)` se emite **una sola vez**, protegido por el `status`.
   - `restart()` vuelve a tres vidas, tanque lleno, bodega vacía, 0 puntos, nivel 1 y el submarino en `RESPAWN_X`.
   - `setMuted()` existe y todavía no hace nada: el audio entra en el paso 5.
   - El motor **no** dibuja HUD, ni overlay de pausa, ni de game over, ni instrucciones: todo eso lo pinta `<Reproductor>`.

   _Verificación:_ `/jugar/abismo` se juega. El submarino se mueve con flechas y con `WASD` dentro de sus topes, el slot `O₂ · BUZOS` baja de `100% · 0` hacia abajo, el casco parpadea por debajo del 24 % del tanque, llegar a `0%` cuesta una vida y las tres agotadas abren el modal una sola vez, el HUD muestra tres `♥`, PAUSA congela el tanque, y FIN termina en el acto. `npx tsc --noEmit` pasa y `npx eslint app lib components` no reporta errores.

3. **Los buzos y el cobro en superficie.** El spawner con su `DIVER_SPAWN_MS` y su `DIVER_MAX_ON_SCREEN`, la recogida por AABB con el tope de `DIVER_CAPACITY`, las seis luces dentro del casco, la bandera `wasSurfaced`, la fórmula de cobro y `diversRescued` alimentando `level`.
   _Verificación:_ tocar un buzo enciende una luz y sube el segundo número del slot `extra`; tocar un séptimo con la bodega llena no hace nada y el buzo sigue nadando; emerger con cuatro buzos y el tanque a la mitad suma exactamente `50 × 16 + 2 × floor(tanque)` y deja la bodega en 0; quedarse tres segundos en la superficie **no** vuelve a cobrar; emerger con cero buzos recarga y no suma; el slot Nivel pasa a `02` con el sexto buzo entregado.

4. **Los enemigos, los torpedos y la muerte por colisión.** Tiburones y submarinos enemigos con su spawner por nivel, el reciclado al salir de pantalla, los torpedos del jugador con cooldown y tope, los torpedos enemigos por temporizador, las colisiones AABB de los dos bandos y el escalado de velocidad, intervalo y proporción.
   _Verificación:_ los torpedos del jugador hunden tiburones (20) y submarinos enemigos (30) y **atraviesan a los buzos sin dañarlos**; chocar con un enemigo o con un torpedo enemigo cuesta una vida; morir con buzos a bordo los pierde sin cobrarlos; el submarino reaparece en la superficie parpadeando e invulnerable; nunca aparece un enemigo dentro del campo visible; nada entra en la banda de aire; en el nivel 5 los enemigos van visiblemente más rápido y hay más amarillos que grises.

5. **El audio.** Los seis efectos de `## Audio` de `02-diseno.md`, sintetizados con `AudioContext` por encima de un `blip(from, to, ms, type)` y un `noise(ms)`. Es el camino B del paso 5 del SPEC 09, que ya corre en producción en `lib/games/snake/engine.ts`, así que no se repite su búsqueda en bancos de audio: `AudioContext` creado dentro de `start()` y cerrado en `destroy()`, `GainNode` maestro en `0.4`, desbloqueo por gesto con una bandera `unlocked` en el primer `keydown`, y `setMuted(true)` cortando en el acto lo que esté sonando. **Ningún binario entra al repo.**
   _Verificación:_ disparar, impactar, recoger, cobrar, la alarma y morir suenan distinto entre sí; el botón `SILENCIO` los corta en el acto y `SONIDO` los devuelve; la preferencia sobrevive a una recarga (`av_muted` ya existe desde el SPEC 08); la consola no muestra ningún `NotAllowedError` de autoplay.

6. **Repaso final.** Las trece rutas de `/juegos/<id>` y `/jugar/<id>` responden 200, las pantallas anteriores se ven idénticas, y la consola queda limpia después de jugar una partida completa y de navegar cinco veces entre `/jugar/abismo` y `/juegos`.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni errores de tipos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npx eslint app lib components` no reporta errores.
- [ ] `select id, sort_order from games order by sort_order` devuelve **trece** filas, con `abismo` última en `sort_order` 13.
- [ ] `/juegos` muestra **trece** tarjetas y ABISMO aparece bajo el filtro `SHOOTER` y bajo `TODOS`.
- [ ] `.cover-abismo` es arte CSS puro: **no se agregó ningún archivo al directorio `public/`** en este spec, ni de imagen ni de audio.
- [ ] `/juegos/abismo` y `/jugar/abismo` responden 200.
- [ ] `/salon` muestra una tab nueva con el ranking de ABISMO.
- [ ] El mundo mide 800×600, la línea de agua está en `y = 90`, el lecho en `y = 570`, y los seis carriles miden 80 px: no hay bandas negras ni reencuadre.
- [ ] El HUD muestra Jugador · Puntuación · Vidas · Nivel · `O₂ · BUZOS`, con los valores reales del motor y **tres `♥`** al empezar.
- [ ] El slot `extra` muestra `100% · 0` al arrancar la partida y el porcentaje baja mientras el submarino está bajo el agua.
- [ ] El tanque tarda **50 segundos** en vaciarse sin subir, y llegar a `0%` cuesta exactamente una vida.
- [ ] Estar en la superficie recarga el tanque a `100%` en unos 2,5 segundos y **no** consume oxígeno.
- [ ] Por debajo de los 12 segundos de tanque el casco parpadea; por encima, no.
- [ ] El canvas **no** dibuja ninguna barra de oxígeno, ni HUD, ni overlay de pausa, ni de game over, ni instrucciones.
- [ ] Emerger con 4 buzos y 18 segundos de tanque suma exactamente `800 + 36 = 836` puntos.
- [ ] Emerger con 6 buzos suma exactamente 1800 puntos de rescate, más el bonus de aire.
- [ ] Quedarse en la superficie tres segundos con la bodega ya cobrada **no** vuelve a sumar puntos.
- [ ] Emerger con cero buzos recarga el tanque, no suma puntos y **no** cuesta una vida.
- [ ] Tocar un buzo con la bodega en 6 no lo recoge y el buzo sigue nadando.
- [ ] Los torpedos del jugador atraviesan a los buzos sin destruirlos.
- [ ] Hundir un tiburón suma 20 y hundir un submarino enemigo suma 30, en cualquier nivel.
- [ ] Morir con buzos a bordo los pierde: la bodega vuelve a 0 y no se suma ningún rescate.
- [ ] El slot Nivel pasa a `02` exactamente con el sexto buzo **entregado en la superficie**, no con el sexto recogido.
- [ ] Ningún enemigo, torpedo enemigo ni buzo aparece dentro del campo visible: todos entran desde fuera de pantalla.
- [ ] Ningún enemigo entra en la banda de aire por encima de `y = 90`.
- [ ] Tras perder una vida el submarino reaparece en la superficie con el tanque lleno y parpadea invulnerable unos 0,9 segundos.
- [ ] Las flechas y `WASD` mueven el submarino en los dos ejes; `Space` dispara.
- [ ] Mantener `Space` dispara a cadencia fija y nunca hay más de 2 torpedos del jugador en pantalla.
- [ ] Pulsar `←` `→` `↑` `↓` y `Space` **no** scrollea la página.
- [ ] `Escape` y `P` pausan y reanudan igual que el botón, y una sola vez por pulsación.
- [ ] PAUSA congela el juego por completo —oxígeno incluido— y REANUDAR lo sigue desde donde estaba, sin un salto proporcional al tiempo pausado.
- [ ] Dejar la pestaña en segundo plano un minuto y volver **no** vacía el tanque ni mata al submarino.
- [ ] El botón FIN termina la partida en el acto y abre el modal; perder la última vida lo abre **una sola vez**.
- [ ] Guardar desde el modal inserta una fila en `scores` con `game_id = 'abismo'`, y recargar `/juegos/abismo` la muestra en el top-10 y actualiza `Mejor global` y `Partidas`.
- [ ] JUGAR DE NUEVO reinicia en 0 puntos, nivel 1, tres vidas, tanque al `100%` y bodega en 0.
- [ ] Los seis efectos de sonido se distinguen entre sí; el botón `SILENCIO` los corta y `SONIDO` los devuelve.
- [ ] La consola **no** muestra ningún `NotAllowedError` ni warning de autoplay al cargar `/jugar/abismo`.
- [ ] Navegar cinco veces entre `/jugar/abismo` y `/juegos` no acelera el juego, ni duplica el puntaje, ni duplica el sonido.
- [ ] El motor de abismo no aparece en el bundle compartido de `/jugar/[id]`, y los de asteroides, tetris, arkanoid y snake tampoco.
- [ ] `/jugar/asteroides`, `/jugar/tetris`, `/jugar/arkanoid` y `/jugar/snake` se ven y se comportan exactamente igual que antes del spec.
- [ ] Los ocho juegos simulados siguen con el puntaje simulado y se ven exactamente igual que antes del spec.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna ruta.
- [ ] `lib/games/types.ts`, `components/reproductor.tsx`, `components/game-canvas.tsx`, `app/juegos/`, `app/jugar/`, `app/salon/`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts` y `app/jugar/actions.ts` no fueron modificados.

## Decisiones

Este spec no tuvo entrevista: lo escribió el subagente `game-jam` a partir del tema «el fondo del mar». Todo lo que `/spec-juego` habría preguntado está decidido acá, con su porqué.

- **Sí:** ABISMO y no los otros cuatro candidatos del brief. CARGAS era una sola mecánica repetida —el descarte de STAR CASTLE—, CORRIENTE era RASANTE con agua, ARRECIFE era BURBUJAS con agua, y PULPO duplicaba `gloton`, que es el descarte de PAC-MAN. Las tres últimas ya tienen su entrada en `references/games-suggestions-todo.md`.
- **Sí:** un solo spec, aunque el juego se diseñe desde cero. Es el mismo argumento del SPEC 09: son cinco reglas —moverse, disparar, recoger, emerger, respirar—, no cincuenta, y no mueve el chasis. Partirlo dejaría un motor huérfano en el medio.
- **Sí:** `SHOOTER`. Es un shooter de corte lateral con objetivo de rescate, y es la categoría más flaca del catálogo: 3 filas de 12 contra 7 de `ARCADE`.
- **Sí:** acento `magenta`. Es el único acento que ningún SHOOTER del catálogo usa hoy (`invasores` verde, `rocas` amarillo, `asteroides` cyan), y hoy es el menos usado de los cuatro en total (2 de 12). Cyan era el color obvio del agua y por eso mismo el peor: ya está en cuatro filas, una de ellas `asteroides`, el otro shooter jugable. El agua se pinta cyan igual, en el fondo; el acento de la tarjeta es el color del jugador.
- **No:** cyan, aunque la propuesta MISILES de `## Pendientes` también sea SHOOTER magenta. Es una sugerencia, no una fila del catálogo, y si algún día entran los dos se decide ahí. Elegir peor hoy por un juego que no existe no es una decisión, es una superstición.
- **Sí:** `ABISMO` como título inventado en español, rompiendo la convención del SPEC 09 de usar el nombre real del género. Acá no hay nombre de género que usar: «snake», «tetris» y «arkanoid» son nombres genéricos instalados, y el equivalente de este juego —SEAQUEST— es una marca registrada de Activision que el repo no va a estampar en una tarjeta. `ABISMO` dice el tema en una palabra y no choca con ningún `id`.
- **Sí:** una fila nueva, sin tocar ninguna tarjeta mock. Es el patrón de los SPEC 07, 08 y 09, y acá encima no hay tarjeta equivalente: ninguna de las doce es acuática.
- **Sí:** `lives = 3`. El juego tiene el concepto —el submarino se destruye— y el HUD ya pintó tres `♥` con `arkanoid`, así que el slot no se ensancha ni un píxel.
- **Sí:** los dos stats propios empaquetados en un `extra`, con el `label` nombrando las dos mitades. `asteroides` ya publica `"3x · 4.2s"` en producción; el precedente existe en código, no en teoría. La alternativa —un segundo slot— movía `GameSnapshot`, `<Reproductor>` y el CSS del HUD para un solo juego.
- **No:** dejar el oxígeno fuera del HUD y confiarlo al parpadeo del casco. El porcentaje exacto es el dato con el que se toma la decisión de subir o no; sin número, la decisión se vuelve una corazonada.
- **No:** una barra de oxígeno dibujada en el canvas. Es HUD, y el motor no dibuja HUD. La regla vale más que la comodidad de un solo juego.
- **Sí:** las seis luces de bodega dentro del casco. Es dibujo de entidad, del mismo tipo que el degradado de la cola de la serpiente, y evita que el jugador tenga que mirar fuera del canvas para saber cuánto está arriesgando.
- **Sí:** el cobro por evento de cruce, con `wasSurfaced`. Sin la bandera, medio segundo en la superficie pagaría los buzos treinta veces. Tiene su criterio de aceptación.
- **Sí:** rescate cuadrático, `50 × buzos²`. Es todo el juego en una fórmula: seis viajes de un buzo pagan 840 y un viaje de seis paga 1818. La codicia tiene número y el jugador lo puede calcular.
- **Sí:** bonus de `2` puntos por segundo de aire sobrante. Es lo que impide que la estrategia óptima sea siempre apurar hasta el último segundo: volver temprano con la bodega llena también paga.
- **No:** castigar con una vida el emerger sin buzos, como hace el original del género. Es la regla más antipática de ese juego y no hace falta: el puntaje ya castiga, porque `50 × 1²` es ridículo al lado de `50 × 6²`. Una regla que castiga con la moneda del juego es mejor que una que castiga con la vida.
- **Sí:** puntos planos por enemigo (20 y 30), sin multiplicar por el nivel. Multiplicarlos haría que el ranking midiera «sobreviví un minuto más» y no «jugué mejor». El crecimiento ya lo aporta el rescate.
- **Sí:** `level` por buzos **entregados**, no recogidos, y cada 6. Es monótono y no se puede trabar: no obliga a subir con la bodega llena, solo a entregar seis en total.
- **Sí:** con el nivel se mueven tres cosas y nada más —velocidad, intervalo de aparición y proporción de submarinos enemigos—, todas con tope. El tanque, la bodega y los puntos son constantes de por vida, así que una partida de nivel 9 se juega con las mismas reglas que una de nivel 1, solo que con más tráfico.
- **Sí:** movimiento sin inercia. Es la decisión menos «marina» del diseño y es deliberada: con el tanque bajando y torpedos cruzando, la deriva convierte cada muerte en algo que el jugador no siente como suyo. El agua la pintan la paleta, las burbujas y los rayos de luz, que no cuestan reglas.
- **Sí:** los enemigos cruzan su carril en línea recta, sin ninguna IA. Es lo que mantiene el motor en 22–26 KB, y es el motivo exacto por el que PAC-MAN y BOMBERMAN quedaron afuera del barrido de candidatos.
- **Sí:** todo nace fuera de pantalla, en `x = −80` o `x = 880`. Elimina por construcción la muerte por aparición encima del jugador, que no se puede mitigar con reflejos.
- **Sí:** la superficie es segura porque ningún enemigo entra en la banda de aire, no por una regla de invulnerabilidad. Una regla habría que explicarla; una banda vacía se ve.
- **Sí:** los torpedos del jugador atraviesan a los buzos. Castigar al jugador por acertarle a lo que vino a salvar, en una pantalla llena de fuego cruzado, agrega frustración y una rama de colisión, no profundidad.
- **No:** colisión entre enemigos. Dos tiburones solapados no molestan a nadie y resolverlo pediría un empuje para cero ganancia.
- **Sí:** flechas **y** `WASD`, como en SNAKE. Ocho entradas en un mapa y las dos convenciones están igual de instaladas.
- **Sí:** `preventDefault()` también en `Space`. La barra scrollea una pantalla entera y con un canvas de 600 px de alto lo saca de la vista de un saque.
- **Sí:** disparo por estado de tecla con cooldown, ignorando el `keydown` con `repeat`. La cadencia la fija el juego y no la configuración de teclado del sistema operativo.
- **Sí:** audio sintetizado con `AudioContext` y cero binarios, sin repetir la búsqueda en bancos que el SPEC 09 ya hizo. Su conclusión sigue valiendo: Pixabay responde 403, freesound pide OAuth, y el único CC0 verificable pesa 482 KB en Ogg, que Safari no reproduce.
- **Sí:** seis efectos por encima de dos funciones, `blip()` y `noise()`. Agregar el séptimo es una línea, no otro grafo de nodos.
- **Sí:** el `shadowBlur` solo en el submarino, los buzos y la línea de agua. Los enemigos pueden ser diez y las burbujas cuarenta; se separan por color y silueta, que alcanza.
- **Sí:** la línea de `ENGINES` entra en el paso 2 y no en un paso propio. No hay tipos que hoistear, y con el motor registrado temprano los pasos 3, 4 y 5 se verifican jugando en el navegador en vez de leyendo el código.
- **No:** rebalancear durante la implementación. Las constantes no vienen de un original probado, así que ajustarlas es esperable —igual que en el SPEC 09— pero se hace con el juego andando y midiendo, en otro spec.
- **Definición sin entrevista.** Este spec se escribió a partir de un tema, sin `AskUserQuestion` y sin bloques de preguntas. Queda anotado: si al releerlo alguna de estas decisiones no es la que el humano habría tomado, se cambia acá antes de aprobarlo, que es más barato que descubrirlo a mitad del motor.

## Riesgos

| Riesgo                                                                                                       | Mitigación                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El balance sale de la nada y el juego resulta injugable o trivial: nunca fue probado                         | Las cuarenta y dos constantes están juntas y nombradas en un solo bloque de `02-diseno.md`, listo para copiar al encabezado del motor. Ajustarlas es cambiar números, no reescribir lógica.      |
| El cobro en superficie se dispara por frame y el puntaje explota                                             | El cobro es un evento de transición con `wasSurfaced`, no un estado. Hay un criterio de aceptación que se queda tres segundos arriba y verifica que no vuelve a sumar.                           |
| Dos stats propios no entran en el único slot `extra` y alguien propone ensanchar `GameSnapshot`              | Van empaquetados en un `value` con el `label` nombrando las dos mitades, con el precedente de `"3x · 4.2s"` de `asteroides`. Hay un criterio que exige el formato exacto `100% · 0` al arrancar. |
| El motor termina dibujando una barra de oxígeno y rompe la regla de que no pinta HUD                         | La alarma es el casco parpadeando, no una barra, y hay un criterio de aceptación que lo verifica explícitamente.                                                                                 |
| Un enemigo aparece encima del submarino y la muerte se siente injusta                                        | Todo nace fuera de pantalla, en `x = −80` o `x = 880`. Hay un criterio de aceptación.                                                                                                            |
| El respawn cae al lado de un tiburón y el jugador pierde dos vidas seguidas                                  | Reaparece en la superficie, donde ningún enemigo entra, con 0,9 s de invulnerabilidad parpadeando. Dos mitigaciones para el mismo caso.                                                          |
| `new AudioContext()` a nivel de módulo revienta el build en el servidor                                      | Nada del motor corre al importar el archivo: el `AudioContext` se crea dentro de `start()` y el registro carga con `import()` dinámico. Misma regla que el SPEC 08 con `new Audio()`.            |
| Con la pestaña en segundo plano el `dt` acumulado vacía el tanque y el jugador vuelve muerto                 | El `dt` se topea en `MAX_FRAME_MS = 50` y `resume()` resetea `lastTime`. Hay un criterio que deja la pestaña un minuto en segundo plano.                                                         |
| `onSnapshot` dispara `setState` por frame —el oxígeno cambia siempre— y el HUD hunde el rendimiento          | El porcentaje se redondea a entero **en el motor** y `emitSnapshot()` compara con el último snapshot: cambia como mucho dos veces por segundo, no sesenta.                                       |
| Dibujar diez enemigos, seis torpedos y cuarenta burbujas con `shadowBlur` hunde los 60 fps                   | El glow va solo en el submarino, los buzos y la línea de agua: cinco sombras por frame como techo.                                                                                               |
| El audio nunca se desbloquea y el juego queda mudo sin decirlo                                               | El desbloqueo se dispara con el primer `keydown`, y sin teclas el submarino no se mueve: el gesto llega en el primer segundo. Hay un criterio sobre `NotAllowedError` en consola.                |
| El motor filtra `requestAnimationFrame`, listeners o el `AudioContext` al navegar, y el juego corre al doble | `destroy()` cancela el rAF, quita los listeners y cierra el `AudioContext`; el `useEffect` de `<GameCanvas>` lo devuelve como cleanup. Hay un criterio que navega cinco veces.                   |
| La migración se aplica dos veces y falla por clave primaria duplicada                                        | `games.id` es la primary key: el segundo intento falla en vez de duplicar la tarjeta. `select id, sort_order from games order by sort_order` es el criterio de verificación.                     |
| El motor de abismo entra en el bundle compartido de `/jugar/[id]` y los doce juegos restantes pagan su peso  | El registro usa `import()` dinámico, igual que los otros cuatro. Hay un criterio de aceptación sobre el build que verifica los cinco motores.                                                    |
| Al no haber entrevista, alguna decisión de diseño no es la que el humano quería                              | Las decisiones están todas en `## Decisiones` con su porqué, y el spec queda en `Draft`: cambiarlas al releer cuesta editar una línea, no reescribir el motor.                                   |

## Lo que **no** entra en esta spec

- Motores para los ocho juegos simulados que quedan.
- Inercia, flotación, corrientes por zonas y oscuridad con cono de linterna.
- Jefes, IA de persecución, minas fijas y enemigos que cambien de carril.
- Disparo vertical o diagonal.
- Vidas extra por puntaje, bodega de más de seis y puntaje por profundidad.
- Perder al buzo si le pegás con un torpedo.
- Controles táctiles o de mouse.
- Récord personal en el HUD y modo dos jugadores.
- Música de fondo, volumen graduable o sonido para asteroides y tetris.
- Rebalancear las constantes con el juego andando.
- Assets binarios de cualquier tipo en `public/`.
- Tests automatizados.

Cada una de esas, si aparece, va en su propia spec.
