# ABISMO — el diseño del juego

> **Juego:** ABISMO
> **`id`:** `abismo`
> **Date:** 2026-09-13
> **Status:** Draft
> **Objetivo:** Bajar a un corte del océano de seis carriles, rescatar buzos entre tiburones y submarinos enemigos, y volver a la superficie antes de que se acabe el aire — cuantos más traigas de una vez, más vale el viaje.

## El juego en una pantalla

Manejás un submarino de bolsillo en un corte lateral del océano. Te movés libre en los dos ejes y disparás torpedos horizontales hacia donde mirás. Cruzándote de lado a lado, por seis carriles fijos, pasan tiburones, submarinos enemigos que te disparan, y **buzos**, que no matan a nadie: se recogen tocándolos, hasta seis en la bodega. El tanque da cincuenta segundos de aire y **solo se recarga en la superficie**, que es también el único lugar donde los buzos se cobran. Perdés cuando el tanque llega a cero o cuando te quedás sin las tres vidas, y el rescate paga al cuadrado: subir con seis buzos vale seis veces más que subir seis veces con uno. Bajar a buscar el sexto es siempre la decisión que te mata.

## El mundo

El mundo es 800×600 fijo, el de `components/game-canvas.tsx`. Se parte en tres bandas horizontales y la cuenta cierra exacta:

```
y   0 ─────────────────────────  banda de aire          90 px
y  90 ═══════════════════════════ SURFACE_Y (línea de agua)
      carril 0   centro y = 130   80 px
      carril 1   centro y = 210   80 px
      carril 2   centro y = 290   80 px      agua: 480 px
      carril 3   centro y = 370   80 px
      carril 4   centro y = 450   80 px
      carril 5   centro y = 530   80 px
y 570 ─────────────────────────── SEABED_Y
      lecho marino                           30 px
y 600 ───────────────────────────
```

```
90 + 480 + 30 = 600         (570 − 90) / 6 = 80 carriles de 80 px exactos
centro del carril i = SURFACE_Y + LANE_H * (i + 0.5) → 130, 210, 290, 370, 450, 530
```

**No sobran bandas y `.game-canvas` no cambia.** Su `aspect-ratio: 4 / 3` ya calza con 800×600, así que no hay reencuadre ni el segundo sistema de coordenadas que el SPEC 07 tuvo que inventar para el tablero 300×600 de Tetris.

El eje horizontal se usa entero: los enemigos y los buzos nacen fuera de pantalla, en `x = −80` o `x = 880`, y cruzan los 800 px completos. Nunca aparece nada dentro del campo visible, así que no existe la muerte por spawn encima del jugador.

El **lecho marino** de los 30 px de abajo es decorativo: una silueta de rocas dibujada una vez y una franja de `--ink-dim` al 18 %. No colisiona con nada; el submarino ya está topeado antes por `SUB_MAX_Y`.

La **banda de aire** de arriba lleva la línea de agua brillante, unas pocas crestas, y es donde el submarino asoma para respirar. **Ningún enemigo entra ahí**: la superficie es segura por construcción, no por una regla de invulnerabilidad. Lo que la hace cara es el tiempo que perdés arriba mientras la pantalla se sigue llenando.

Los carriles son solo para **nacer**. El submarino del jugador se mueve libre y continuo; una vez en el agua, un tiburón conserva su `y` hasta que sale por el otro lado.

## Las reglas

### Entidades

| Entidad             | Tamaño | Se mueve                                | Colisiona con                      |
| ------------------- | ------ | --------------------------------------- | ---------------------------------- |
| Submarino (jugador) | 56×26  | libre, `WASD` / flechas                 | enemigos, torpedos enemigos, buzos |
| Tiburón             | 62×28  | recto por su carril, velocidad de nivel | submarino, torpedos del jugador    |
| Submarino enemigo   | 58×24  | recto por su carril, y dispara          | submarino, torpedos del jugador    |
| Buzo                | 16×22  | recto por su carril, 35 px/s            | solo el submarino                  |
| Torpedo del jugador | 18×4   | horizontal, 520 px/s                    | tiburones, submarinos enemigos     |
| Torpedo enemigo     | 14×4   | horizontal, 300 px/s                    | solo el submarino                  |

Todas las colisiones son **AABB**, rectángulo contra rectángulo. No hay círculos, no hay separación de ejes, no hay rotación.

### Movimiento del jugador

Aceleración instantánea, sin inercia: mantener una tecla mueve a velocidad constante y soltarla frena en el acto. El agua no arrastra. Es lo contrario de `asteroides` a propósito — con oxígeno bajando y torpedos cruzando, la deriva convierte cada muerte en algo que el jugador no siente como suyo.

El submarino queda topeado en `x ∈ [SUB_W/2, 800 − SUB_W/2]` y en `y ∈ [SUB_MIN_Y, SUB_MAX_Y]`, con `SUB_MIN_Y = 58`: el casco asoma 32 px por encima de la línea de agua, lo suficiente para que se vea que está respirando.

La **orientación** es la última dirección horizontal pulsada, y arranca mirando a la derecha. El torpedo sale por la proa.

### El oxígeno

- Mientras `sub.y > SURFACE_Y`, el tanque baja `1` segundo por segundo de juego real.
- Mientras `sub.y <= SURFACE_Y`, el tanque **sube** a razón de `TANK_S / REFILL_S` por segundo, o sea 20 segundos de aire por segundo de recarga, y se topea en `TANK_S`.
- Por debajo de `TANK_ALARM_S = 12` el casco del submarino parpadea magenta a 4 Hz y suena un pulso de alarma por segundo.
- Si llega a `0`, el submarino implota: **se pierde una vida** por la misma rama que una colisión.

El submarino puede volver a bajar antes de terminar la recarga, con lo que haya juntado. Nadie te obliga a llenar.

### El cobro en superficie

Es el corazón del juego y es un **evento de cruce**, no un estado. Se guarda `wasSurfaced` y el cobro ocurre en el frame en que `wasSurfaced` es `false` y `sub.y <= SURFACE_Y` pasa a ser `true`:

- Si hay **al menos un buzo** a bordo: se suman `RESCUE_BASE × buzos²` puntos, más `O2_BONUS × Math.floor(tanque)` por el aire que sobró, la bodega se vacía y `diversRescued` sube en esa cantidad.
- Si hay **cero buzos**: no se suma nada. El tanque se recarga igual. Subir a respirar siempre es gratis en vidas y siempre es carísimo en puntaje, que es exactamente la presión que el juego quiere.

Sin la bandera, quedarse arriba medio segundo pagaría los buzos treinta veces.

### Casos borde, resueltos

1. **Tocar un buzo con la bodega llena (6):** no se recoge y el buzo sigue nadando. No se pierde, no se penaliza, no rebota. Una séptima plaza sería una constante más para un caso que dura dos segundos.
2. **Los torpedos del jugador atraviesan a los buzos.** No los matan, no los empujan, no los recogen. Castigar al jugador por acertarle a lo que vino a salvar, en una pantalla llena de fuego cruzado, agrega frustración y una rama de colisión, no profundidad.
3. **Morir con buzos a bordo:** los buzos se pierden y no se cobran. Esa es la penalización real de la codicia, y es la que le da peso a la decisión de subir.
4. **Perder la última vida con buzos a bordo:** igual, se pierden. El puntaje final es el que ya estaba.
5. **Emerger con el tanque ya lleno y buzos a bordo:** se cobra igual. El cobro depende de los buzos, no del tanque; el bonus de aire simplemente es el máximo.
6. **Emerger con `TANK_S` exacto:** `Math.floor(tanque)` da 50 y el bonus es `2 × 50 = 100`. No hay caso especial.
7. **Un enemigo que sale por el borde opuesto** se recicla al pool. No da ni quita puntos.
8. **Un buzo que cruza sin ser recogido** también se va, y tampoco penaliza. Los buzos son oportunidades, no cuotas.
9. **Los enemigos se atraviesan entre sí.** Dos tiburones en el mismo carril se solapan y nadie se entera; colisionarlos pediría una resolución de empuje para cero ganancia.
10. **El torpedo enemigo solo apunta hacia adelante**, en la dirección en que el submarino enemigo ya se está moviendo. No corrige hacia el jugador: no hay puntería, hay tráfico.
11. **Respawn tras perder una vida:** el submarino reaparece en `x = 120`, `y = SURFACE_Y` con el tanque lleno y `RESPAWN_MS = 900` de invulnerabilidad parpadeando. Los enemigos en pantalla **no se limpian**; nacer en la superficie, que es donde no entra ninguno, ya garantiza que el respawn nunca sea injusto.
12. **La pausa:** `pause()` cancela el `requestAnimationFrame`, así que se congela todo —oxígeno, recarga, alarma, temporizadores de spawn—. `resume()` resetea `lastTime` a `null` para que el primer `dt` no sea el tiempo entero de la pausa.
13. **Pestaña en segundo plano:** el `dt` está topeado en `MAX_FRAME_MS = 50`. Un minuto minimizado consume, como mucho, los 50 ms del último frame.

### Muerte y fin de partida

Hay dos formas de perder una vida y las dos pasan por la **misma función**: el tanque a cero, y el contacto con un tiburón, con un submarino enemigo o con un torpedo enemigo. Con `lives > 0` se respawnea; con `lives === 0` se emite `onGameOver(score)` **una sola vez**, protegido por el `status`.

`end()` —el botón FIN— pone `lives` en 1 y llama a esa misma función de muerte, igual que en `asteroides`. FIN y perder la última vida terminan por un camino idéntico.

### Nivel y escalado

`level = Math.floor(diversRescued / DIVERS_PER_LEVEL) + 1`, con `diversRescued` contando **buzos entregados en la superficie**, no recogidos. Es monótono y no se puede trabar: no depende de subir con la bodega llena, solo de entregar seis en total, en los viajes que sean.

Con el nivel se mueven tres cosas y nada más:

- la velocidad de los enemigos, de `90` a `260` px/s;
- el intervalo de aparición, de `1500` a `520` ms;
- la proporción de submarinos enemigos —los que disparan— frente a tiburones, de `20 %` a `60 %`.

El tanque, la capacidad de bodega y el valor de los puntos **no cambian nunca**. Todo lo que sube es la presión del tráfico.

## Las constantes

Todas juntas y nombradas, que es lo que permite rebalancear sin tocar una línea de lógica.

```ts
// ── El mundo ──────────────────────────────────────────────────────────────────
const W = 800; // el mundo de <GameCanvas>; nunca se lee canvas.width
const H = 600;
const SURFACE_Y = 90; // la línea de agua
const SEABED_Y = 570; // el lecho marino
const LANES = 6;
const LANE_H = 80; // (570 − 90) / 6 = 80 exacto
const LANE_Y = [130, 210, 290, 370, 450, 530]; // SURFACE_Y + LANE_H * (i + 0.5)
const SPAWN_X_LEFT = -80; // fuera de pantalla: nada nace dentro del campo
const SPAWN_X_RIGHT = 880;

// ── El submarino del jugador ──────────────────────────────────────────────────
const SUB_W = 56;
const SUB_H = 26;
const SUB_SPEED_X = 260; // px/s, sin inercia
const SUB_SPEED_Y = 200; // px/s
const SUB_MIN_Y = 58; // asoma 32 px por encima de SURFACE_Y
const SUB_MAX_Y = 557; // SEABED_Y − SUB_H / 2
const START_LIVES = 3;
const RESPAWN_X = 120;
const RESPAWN_MS = 900; // invulnerable y parpadeando

// ── El oxígeno ────────────────────────────────────────────────────────────────
const TANK_S = 50; // segundos de tanque lleno
const TANK_ALARM_S = 12; // por debajo: casco parpadeando + pulso de alarma
const REFILL_S = 2.5; // segundos que tarda la recarga completa en superficie
const ALARM_BLINK_HZ = 4;

// ── Los buzos ─────────────────────────────────────────────────────────────────
const DIVER_CAPACITY = 6;
const DIVER_W = 16;
const DIVER_H = 22;
const DIVER_SPEED = 35; // px/s, siempre; no escala con el nivel
const DIVER_SPAWN_MS = 4200;
const DIVER_MAX_ON_SCREEN = 3;

// ── Los enemigos ──────────────────────────────────────────────────────────────
const SHARK_W = 62;
const SHARK_H = 28;
const ESUB_W = 58;
const ESUB_H = 24;
const ENEMY_SPEED_BASE = 90; // px/s en el nivel 1
const ENEMY_SPEED_STEP = 22; // px/s por nivel
const ENEMY_SPEED_MAX = 260; // techo: se toca en el nivel 9
const SPAWN_BASE_MS = 1500;
const SPAWN_STEP_MS = 110;
const SPAWN_MIN_MS = 520; // piso: se toca en el nivel 10
const ESUB_SHARE_BASE = 0.2; // proporción de submarinos enemigos en el nivel 1
const ESUB_SHARE_STEP = 0.08;
const ESUB_SHARE_MAX = 0.6;
const ENEMY_MAX = 10; // tope de enemigos simultáneos

// ── Los torpedos ──────────────────────────────────────────────────────────────
const TORPEDO_W = 18;
const TORPEDO_H = 4;
const TORPEDO_SPEED = 520; // px/s
const TORPEDO_COOLDOWN_MS = 220;
const TORPEDO_MAX = 2; // simultáneos en pantalla
const ETORPEDO_W = 14;
const ETORPEDO_H = 4;
const ETORPEDO_SPEED = 300; // px/s
const ETORPEDO_COOLDOWN_MS = 1800; // por submarino enemigo

// ── El puntaje ────────────────────────────────────────────────────────────────
const SHARK_POINTS = 20;
const ESUB_POINTS = 30;
const RESCUE_BASE = 50; // bonus de rescate = RESCUE_BASE × buzos²
const O2_BONUS = 2; // por segundo entero de tanque restante al emerger
const DIVERS_PER_LEVEL = 6;

// ── El loop ───────────────────────────────────────────────────────────────────
const MAX_FRAME_MS = 50; // el tope del dt, igual que en los otros cuatro motores
```

## El puntaje y el nivel

Tres fuentes, y una sola de ellas crece:

```ts
// al destruir
score += enemy.kind === "shark" ? SHARK_POINTS : ESUB_POINTS; // 20 o 30, planos

// al emerger con buzos a bordo
score += RESCUE_BASE * divers * divers; // 50 × buzos²
score += O2_BONUS * Math.floor(tank); // 2 por segundo de aire sobrante
```

**Ejemplo numérico resuelto.** Nivel 1. Bajás, hundís tres tiburones y un submarino enemigo (`3 × 20 + 30 = 90`), recogés cuatro buzos y emergés con 18,4 segundos de tanque:

```
rescate  = 50 × 4 × 4 = 800
aire     = 2 × floor(18.4) = 2 × 18 = 36
enemigos = 90
viaje    = 926 puntos
```

El mismo viaje con los seis buzos y 9 segundos de tanque paga `50 × 36 = 1800` más `18` más los enemigos: **1908**, más del doble por dos buzos más. Y seis viajes de un buzo cada uno, con el tanque casi lleno cada vez, pagan `6 × (50 + 2 × 45) = 840` — menos de la mitad que un solo viaje completo, con seis veces más trayecto recorrido. **Ahí vive el juego.**

**Rango de una partida.** Cada nivel cuesta seis buzos entregados. Un jugador que llega al nivel 6 entregó 30 buzos: si los trajo de a seis, son cinco cobros de ~1818, más unos quince enemigos por viaje a 25 de promedio. Aterriza entre **10.000 y 16.000 puntos**, el mismo rango que SNAKE, que es lo que hace que el Salón de la Fama se lea bien con las dos tabs al lado.

**Los enemigos pagan plano a propósito.** Multiplicarlos por el nivel haría que el puntaje explotara y que el ranking midiera «sobreviví un minuto más» en vez de «jugué mejor». El crecimiento ya lo aporta el rescate cuadrático, que es la decisión que el jugador toma.

## Los controles

| `e.code`              | Acción                        |
| --------------------- | ----------------------------- |
| `ArrowUp` / `KeyW`    | subir                         |
| `ArrowDown` / `KeyS`  | bajar                         |
| `ArrowLeft` / `KeyA`  | izquierda (y orienta la proa) |
| `ArrowRight` / `KeyD` | derecha (y orienta la proa)   |
| `Space`               | disparar torpedo              |

Las dos convenciones —flechas y `WASD`— van atadas, igual que en SNAKE: son ocho entradas en un mapa y las dos están igual de instaladas.

`preventDefault()` en **`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` y `Space`**. Las flechas scrollean la página y la barra la scrollea una pantalla entera, que con un juego de 600 px de alto lo saca de la vista de un saque.

El disparo se maneja por estado de tecla, no por evento: mantener `Space` dispara cada `TORPEDO_COOLDOWN_MS` mientras haya menos de `TORPEDO_MAX` torpedos vivos. El `keydown` con `repeat === true` se ignora, así que la cadencia la fija el cooldown y no la repetición del sistema operativo.

**El motor no ata `Escape` ni `KeyP`.** Los ata `<Reproductor>` desde el SPEC 07; manejarlas también acá dejaría la pausa alternando dos veces por pulsación.

## El HUD

`lives` **sí**: arranca en `START_LIVES = 3` y baja a 0. El HUD ya pintó tres `♥` con `arkanoid`, así que el slot no se ensancha.

`extra` es **uno solo** y lleva los dos recursos propios del juego, con el `label` nombrando las dos mitades en el mismo orden que el `value`:

```ts
extra: { label: "O₂ · BUZOS", value: "68% · 4" }
```

- El porcentaje es `Math.round((tank / TANK_S) * 100)`, formateado **por el motor**; el HUD no sabe que salió de un número de segundos.
- El segundo número son los buzos a bordo, de 0 a 6.
- El `label` va por `--mono`, que tiene el glifo `₂`. El `value` va por `--pixel` (Press Start 2P) y usa `·`, el mismo separador que `asteroides` publica hoy en `"3x · 4.2s"`.

Es el stat que explica por qué la partida se está poniendo difícil: el porcentaje dice cuánto te queda para volver y el conteo dice cuánto perdés si no volvés. Los dos juntos **son** la decisión del juego.

El refuerzo visual de la bodega va **en el mundo, no en un segundo slot**: seis luces dentro del casco, encendidas en verde según cuántos buzos lleves. Eso es dibujo de entidad, del mismo tipo que el degradado de la cola de la serpiente, y no un HUD dibujado en el canvas.

**El oxígeno no se dibuja como barra en el canvas.** Una barra es HUD y el motor no pinta HUD. La alarma de tanque bajo es el casco parpadeando y el pulso de audio; el número exacto vive en el slot `extra` de React.

## La paleta

Constantes del motor, **nunca leídas del DOM** — un motor que necesita una hoja de estilos para dibujar falla en silencio. Misma regla que el SPEC 05, el SPEC 08 y el SPEC 09.

| Elemento                      | Color                        | De dónde sale                                       |
| ----------------------------- | ---------------------------- | --------------------------------------------------- |
| Fondo abisal                  | degradado `#001018` → `#000` | negro como los otros cuatro motores, con tinte frío |
| Banda de aire                 | `rgba(0, 245, 255, 0.06)`    | `--cyan` casi apagado                               |
| Línea de agua                 | `#00f5ff`                    | `--cyan`                                            |
| Lecho marino                  | `rgba(138, 143, 181, 0.18)`  | `--ink-dim`                                         |
| Burbujas de fondo             | `rgba(0, 245, 255, 0.10)`    | `--cyan`, casi apagado                              |
| Submarino del jugador         | `#ff006e`                    | `--magenta`, el acento del juego                    |
| Torpedo del jugador           | `#ff006e`                    | el mismo acento: lo que sale de vos es magenta      |
| Luces de bodega (en el casco) | `#00ff88`                    | `--green`, el color de lo que salvás                |
| Tiburón                       | `#8a8fb5`                    | `--ink-dim`: la silueta que no brilla               |
| Submarino enemigo             | `#f5ff00`                    | `--yellow`                                          |
| Torpedo enemigo               | `#f5ff00`                    | el mismo: lo que viene del enemigo es amarillo      |
| Buzo                          | `#00ff88`                    | `--green`                                           |
| Casco en alarma               | `#ff006e` parpadeando        | `--magenta` a `ALARM_BLINK_HZ`                      |

**Dónde va el `shadowBlur`:** en el submarino del jugador, en los buzos y en la línea de agua. Son, como mucho, cinco sombras por frame.

**Dónde no va:** en los enemigos (pueden ser diez), en los torpedos (pueden ser seis entre los dos bandos), en las burbujas de fondo (hasta cuarenta) ni en el lecho. Cien sombras por frame hunden los 60 fps — la lección que el SPEC 09 escribió sobre el cuerpo de la serpiente. Los enemigos se separan del fondo por color y por silueta, que alcanza y sobra.

El **código de color es la regla de lectura del juego**: magenta sos vos, amarillo te mata, verde se salva, gris te muerde. Se aprende en dos segundos y no necesita leyenda.

## La portada

`.cover-abismo` — arte CSS puro, cero archivos de imagen, como las doce que ya están.

- **`.cover-abismo`**: capas de `background`. Un `linear-gradient` vertical de `#0a1a26` a `#05050d` para la columna de agua; un `repeating-linear-gradient` en diagonal, cyan al 4 %, para los rayos de luz que bajan desde la superficie; y una franja cyan brillante arriba, a la altura del 15 %, que es la línea de agua.
- **`.cover-abismo::before`**: el submarino, en magenta, con `clip-path: polygon(...)` — un casco alargado con torreta y una hélice atrás — más `drop-shadow(0 0 8px rgba(255, 0, 110, 0.55))`. Va en el tercio superior izquierdo, mirando a la derecha.
- **`.cover-abismo::after`**: la amenaza y el premio. La silueta de un tiburón en `--ink-dim`, con `clip-path`, cruzando abajo a la derecha, y dos puntos verdes con halo —los buzos— hechos con `radial-gradient`, uno en cada tercio inferior. Es la misma técnica con la que `.cover-serpiente` dibuja sus tres frutas.

**Cómo se distingue de las doce que ya están.** No hay ninguna portada acuática en el catálogo, así que el riesgo de duplicado es cero — no hay un SNAKE/SERPENTINA acá. Las dos más cercanas son espaciales y se despegan solas: `.cover-invaders` es una grilla de filas alienígenas sobre negro plano, y `.cover-rocas` son polígonos irregulares amarillos. Esta tiene **una línea de agua horizontal con rayos en diagonal debajo**, que es un gesto que ninguna otra portada del repo hace, y su acento dominante es magenta contra el verde y el amarillo de aquellas.

## Audio

**Sintetizado con `AudioContext`, cero binarios.** Es el camino B del paso 5 del SPEC 09, que ya corre en producción en `lib/games/snake/engine.ts`: `AudioContext` creado **dentro de `start()`**, cerrado en `destroy()`, `GainNode` maestro con volumen `0.4`, y desbloqueo por gesto con una bandera `unlocked` que pasa a `true` en el primer `keydown` de la partida. Sin teclas el submarino no se mueve, así que el gesto llega en el primer segundo y no hay `NotAllowedError` que registrar.

Cinco efectos, todos por encima de dos funciones —un `blip(from, to, ms, type)` y un `noise(ms)`— para que agregar uno no sea escribir otro grafo de nodos:

| Efecto              | Cómo suena                                                       |
| ------------------- | ---------------------------------------------------------------- |
| Torpedo             | cuadrada, 660 → 330 Hz en 90 ms                                  |
| Impacto             | ruido blanco con envolvente de 250 ms y `lowpass` que cae        |
| Rescate             | tres notas ascendentes, 523 · 659 · 784 Hz, 220 ms en total      |
| Cobro en superficie | arpegio de cinco notas, 320 ms — el único sonido largo y alegre  |
| Alarma de oxígeno   | dos pulsos de 1200 Hz por segundo mientras `tank < TANK_ALARM_S` |
| Muerte              | sierra descendente, 440 → 55 Hz en 400 ms                        |

`setMuted(true)` corta en el acto lo que esté sonando y no programa nada nuevo; `setMuted(false)` rehabilita sin reproducir. El botón del HUD y `av_muted` en `localStorage` ya existen desde el SPEC 08 — el motor no toca nada de eso.

**No se prescribe descargar ningún asset de audio.** El SPEC 09 ya recorrió los bancos y documentó por qué no cierran: Pixabay responde 403, freesound pide OAuth, y el único CC0 verificable de Wikimedia pesa 482 KB en Ogg, que Safari no reproduce. Repetir esa búsqueda sería repetir su resultado.

## Lo que el diseño deja afuera

- **Inercia y flotación.** La idea más «de agua» de todas y la primera que se cortó: con el tanque bajando y torpedos cruzando, la deriva hace que las muertes no se sientan del jugador. La sensación acuática la dan la paleta, las burbujas de fondo y los rayos de luz, que no cuestan reglas.
- **Oscuridad con cono de linterna.** Preciosa y cara: es una segunda pasada de render con composición, y adentro del marco CRT —que ya tiene scanlines y viñeta— pelea con la legibilidad en vez de sumarle. Va en su propio spec si alguna vez se quiere.
- **Corrientes que arrastran por zonas.** Misma familia que la inercia, y además obliga a dibujar dónde están, o el jugador no entiende por qué se movió.
- **Un jefe cada N niveles** (el pulpo, la ballena). Es una máquina de estados entera, con patrones y barra de vida, para un juego que hoy no tiene ninguna IA. Duplicaría el motor.
- **Que el tiburón persiga.** Los enemigos cruzan su carril y nada más. Es lo que mantiene el motor en 22–26 KB y es el motivo exacto por el que PAC-MAN y BOMBERMAN quedaron afuera del barrido del 2026-09-13.
- **Disparar en vertical o en diagonal.** El torpedo es horizontal. Un segundo eje de disparo pide una mira, y una mira pide mouse o un segundo grupo de teclas: es el problema de control por el que RASCACIELOS quedó cuarto en su carril.
- **Perder al buzo si le pegás.** Descartado en la regla 2 de los casos borde: frustración sin profundidad, más una rama de colisión.
- **Minas fijas y erizos.** Peligro estático en un juego cuyo verbo es moverse libre; empujaría hacia un layout de nivel, que es lo que ningún motor del repo tiene.
- **Puntaje por profundidad.** Sonaba temático y rompía la economía: haría rentable quedarse abajo sin rescatar a nadie, que es justo lo contrario de lo que el juego quiere premiar.
- **Un séptimo hueco de bodega, o bodega infinita.** Seis es lo que hace que la decisión tenga techo. Sin techo, la estrategia óptima es una sola y no hay juego.
- **Vidas extra por puntaje.** Alargaría la partida sin cambiar ninguna decisión, y `restart()` instantáneo es lo que hace que valga la pena volver a intentar.
- **Controles táctiles o de mouse.** Solo teclado, con el aviso que `.keyboard-notice` ya muestra en puntero grueso.
