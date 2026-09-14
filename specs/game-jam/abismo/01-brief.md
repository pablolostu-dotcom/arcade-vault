# Game jam — «el fondo del mar»

> **Tema:** el fondo del mar
> **Juego elegido:** ABISMO — `abismo` · SHOOTER · magenta
> **Date:** 2026-09-13
> **Status:** Draft

## El tema, leído

«El fondo del mar» no es un género, es un conjunto de presiones. Lo que el tema trae de verdad no son peces: es **un recurso que se agota mientras jugás** (el aire), **una superficie a la que hay que volver** (el único lugar donde el recurso se repone), **un medio que frena y flota** (la inercia acuática) y **una oscuridad que esconde lo que viene**. Cualquiera de esas cuatro puede ser el motor de un arcade; las dos primeras son las que generan una decisión repetida cada pocos segundos, que es lo que hace un juego de puntaje.

La imagen fácil —un submarino disparando torpedos— es la más pobre: sin un reloj propio queda como un `asteroides` horizontal. La imagen que aprovecha el tema es la **tensión entre bajar y volver**: abajo está todo lo que vale, arriba está el aire, y el trayecto se paga dos veces. Eso convierte el oxígeno en un reloj que el jugador administra en vez de sufrir, y convierte cada segundo extra de descenso en una apuesta con número.

De ahí salen las mecánicas concretas que el tema abre: un **recurso-reloj** que solo se recarga en un lugar fijo; una **bodega con capacidad** que hace que la codicia tenga techo; **carriles horizontales** que leen como cortes de profundidad y dan un campo de juego sin scroll; **flotación** como esquema de movimiento; y **rescate** como objetivo distinto de matar. Los géneros arcade que las encarnan son tres: el shooter de corte lateral con economía de rescate, el puzzle de burbujas que suben, y la evasión en laberinto de arrecife.

## Los candidatos

| Juego     | `id`        | `cat`   | `color` | Veredicto en cuatro palabras     |
| --------- | ----------- | ------- | ------- | -------------------------------- |
| ABISMO    | `abismo`    | SHOOTER | magenta | Gana: tema, género y economía    |
| CARGAS    | `cargas`    | SHOOTER | cyan    | Barato pero mecánicamente fino   |
| CORRIENTE | `corriente` | ARCADE  | cyan    | Es RASANTE con agua              |
| ARRECIFE  | `arrecife`  | PUZZLE  | green   | Es BURBUJAS con agua             |
| PULPO     | `pulpo`     | ARCADE  | magenta | Duplica `gloton`, mismo descarte |

## Por qué gana ABISMO

**La cuenta de 800×600 cierra exacta y sin reencuadre.** La banda de aire ocupa de `y = 0` a `y = 90`, el lecho marino de `y = 570` a `y = 600`, y el agua los 480 px del medio: `(570 − 90) / 6 = 80`, seis carriles de 80 px clavados. Los centros de carril caen en `130, 210, 290, 370, 450, 530` — seis números redondos, no seis fracciones. El ancho se usa entero: los enemigos nacen en `x = −80` o `x = 880` y cruzan los 800 px completos. **`.game-canvas` no cambia**: su `aspect-ratio: 4 / 3` ya calza, no hay bandas negras y no hay un segundo sistema de coordenadas, que fue lo caro del tablero 300×600 del SPEC 07.

**Entra en `GameSnapshot` sin tocarlo.** `score` y `level` obligatorios, `lives = 3 → 0`, y el slot `extra` con `{ label: "O₂ · BUZOS", value: "68% · 4" }`. Dos datos en un `value` no es un invento de este spec: `asteroides` ya publica `"3x · 4.2s"` hoy, en producción. El resto del estado —cuántos buzos van a bordo— se dibuja **como entidad del mundo**, seis luces verdes dentro del casco, que es dibujo de personaje y no HUD.

**Es el género que más suma.** Los cuatro motores actuales son: shooter vectorial de pantalla envolvente (`asteroides`), puzzle de caída (`tetris`), pantalla fija de rebote (`arkanoid`) y grilla por tics (`snake`). ABISMO no es ninguno de los cuatro: es corte lateral con carriles, movimiento libre en dos ejes, un recurso que se agota y una **economía de entrega** —recolectar abajo, cobrar arriba— que ningún motor del repo tiene. Y `SHOOTER` es la categoría más flaca del catálogo con 3 de 12 filas, contra 7 de `ARCADE`.

**Riesgo de confusión con una tarjeta mock: cero.** Ninguna de las doce filas es acuática. `invasores` y `rocas` son espaciales, `bloque-buster` es de rebote, `ranaria` es de cruzar carriles en tierra. No hay un SNAKE/SERPENTINA acá, y eso es lo que hizo caro el SPEC 09.

**Tamaño esperado del motor: 22–26 KB**, en la banda de `asteroides` (21,6 KB) y `arkanoid` (25,3 KB), por debajo de `snake` (32,2 KB). El presupuesto se sostiene porque **no hay ninguna IA**: tiburones y submarinos enemigos cruzan su carril en línea recta a velocidad constante, los buzos también, y el único disparo enemigo sale por temporizador hacia adelante. Cero pathfinding, cero steering, cero grafo — exactamente el motivo por el que PAC-MAN y BOMBERMAN quedaron afuera del barrido del 2026-09-13.

**El puntaje es acumulable, no lineal y comparable con el Salón de la Fama.** El rescate paga `50 × buzos²`: subir con seis vale 1800 y subir seis veces con uno vale 300. Una partida que llega al nivel 6 aterriza entre 10.000 y 16.000 puntos, el mismo rango que SNAKE.

## Los que cayeron

- **CARGAS** (Depthcharge, 1977): un destructor patrulla la franja de superficie y suelta cargas sobre submarinos que cruzan a distintas profundidades. Encaja en todo y cuesta poquísimo —sería el motor más chico del repo—, pero el jugador solo se mueve en un eje y la partida entera es la misma acción repetida con el reloj como único escalado. Es la crítica exacta con la que el barrido descartó **STAR CASTLE**: una sola pantalla que se repite sin progresión real, con `level` como multiplicador de velocidad y nada más. ABISMO lo contiene: sus submarinos enemigos que cruzan y disparan son CARGAS visto desde abajo, con un juego alrededor.
- **CORRIENTE**: vuelo rasante por un cañón submarino procedural, esquivando paredes que se estrechan. Técnicamente impecable y baratísimo, pero es **exactamente RASANTE** —ya propuesto en `## Pendientes` el 2026-09-13, cañón procedural, `lives` ausente, `extra` de velocidad— con la piel cambiada. Proponerlo sería duplicar una entrada del registro, que es lo que la regla de memoria existe para impedir.
- **ARRECIFE**: burbujas que suben desde abajo y hay que emparejar por color antes de que toquen la superficie. Mismo problema: es **BURBUJAS** (Puzzle Bobble, ya en `## Pendientes`) invertido, y el barrido ya descartó **ZUMA** por repetir ese verbo. Además el tema queda de decoración: el agua no cambia ninguna regla.
- **PULPO**: recolectar perlas en un laberinto de arrecife mientras morenas te persiguen. Es el caso que el barrido descartó tres veces —**PAC-MAN**, **AMIDAR / MAKE TRAX / LADY BUG**— porque duplica la tarjeta mock `gloton` y pide cuatro IAs de persecución. El coral no arregla ninguna de las dos cosas.

## Fricciones declaradas

1. **Dos stats propios contra un solo slot `extra`.** El juego tiene oxígeno y buzos a bordo, y `GameSnapshot.extra` es uno. Se resuelve empaquetando los dos en un `value`: `{ label: "O₂ · BUZOS", value: "68% · 4" }`, con el `label` nombrando las dos mitades en orden. Precedente en código, no en teoría: `asteroides` ya emite `"3x · 4.2s"`. El refuerzo visual de los buzos va en el mundo —seis luces en el casco—, no en un segundo slot.
2. **El motor no dibuja HUD, y una barra de oxígeno es HUD.** Por eso el oxígeno **no** se dibuja como barra en el canvas. La alarma de tanque bajo es **el casco del submarino parpadeando** por debajo de los 12 segundos, que es dibujo de entidad, más un pulso de audio. El número exacto vive en el slot `extra` del HUD de React, que es su lugar.
3. **`lives` sí, y arranca en 3.** El HUD ya pintó tres `♥` con `arkanoid`: el slot no se ensancha ni un píxel.
4. **El cobro en superficie es un evento de cruce, no un estado.** Cobrar mientras `sub.y <= SURFACE_Y` pagaría los buzos sesenta veces por segundo. Se resuelve con una bandera `wasSurfaced` y el cobro en la transición de sumergido a emergido. Está escrito como caso borde en el diseño y tiene su criterio de aceptación.
5. **Nada de assets binarios.** Submarino, tiburón, buzo y torpedos son polígonos y rectángulos con `fill`. El audio va sintetizado con `AudioContext` — el camino B del paso 5 del SPEC 09, ya probado en producción en `lib/games/snake/engine.ts`. **Cero archivos en `public/`.**
6. **El acento magenta lo comparte con MISILES**, la propuesta que `game-planner` dejó en `## Pendientes` el mismo día. No es un choque real —hoy magenta es el acento **menos** usado del catálogo, 2 filas de 12— pero si los dos entran, el catálogo tendría dos SHOOTER magenta. Se anota y se deja decidido acá: ABISMO se queda con magenta porque es el único acento que ningún SHOOTER del catálogo usa hoy (`invasores` verde, `rocas` amarillo, `asteroides` cyan) y porque cyan, el color obvio del agua, ya está en cuatro filas y encima es el de `asteroides`, el otro shooter jugable.
7. **El balance se elige, no se porta.** No hay original en `references/started-games/` — las tres carpetas que hay ya están consumidas por los SPEC 05, 07 y 08. Es la misma situación del SPEC 09 y se paga igual: todas las constantes van juntas y nombradas en un bloque, ajustarlas es cambiar números y no reescribir lógica, y queda anotado que rebalancear es esperable.

## Costo

| Archivo                                        | Qué cambia                                     |
| ---------------------------------------------- | ---------------------------------------------- |
| `lib/games/abismo/engine.ts`                   | nuevo — `createAbismoEngine(canvas, options)`  |
| `lib/games/registry.ts`                        | una línea en `ENGINES`                         |
| `supabase/migrations/<ts>_add_game_abismo.sql` | el `insert into public.games`, `sort_order` 13 |
| `app/globals.css`                              | `.cover-abismo` + `::before` + `::after`       |
| `components/reproductor.tsx`                   | **no se toca**                                 |
| `public/`                                      | **nada**                                       |

**No mueve el chasis.** No se tocan `lib/games/types.ts`, `components/reproductor.tsx` ni `components/game-canvas.tsx`, que es el mejor resultado posible y el que estrenó el SPEC 09. Tampoco ninguno de los catalog-driven: `app/juegos/**`, `app/jugar/**`, `app/salon/**`, `lib/catalog.ts`, `lib/scores.ts`, `lib/data.ts` y `app/jugar/actions.ts` quedan intactos, y la tab del Salón de la Fama aparece sola.

## Memoria

Cruzado contra **`references/implemented-games.md`** (12 filas leídas): ningún juego acuático, y `abismo` no choca con ninguno de los doce `id`. La clase `.cover-abismo` tampoco choca: las doce en uso son `cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`, `cover-asteroides`, `cover-tetris`, `cover-arkanoid` y `cover-serpiente`.

Cruzado contra **`references/games-suggestions-todo.md`** (barrido de 21 candidatos en `## Pendientes` y 47 entradas en `## Descartados`, todos del 2026-09-13):

- **ABISMO no está propuesto.** Ninguno de los 21 pendientes es submarino ni tiene economía de rescate. Este brief no baja una propuesta existente a spec: la crea.
- **Roce con `rasante` y con `burbujas`**, las dos en `## Pendientes`. Por eso CORRIENTE y ARRECIFE cayeron: eran esas dos con otra piel, y proponerlas habría ensuciado el registro con duplicados.
- **Roce con `misiles`**, también pendiente, únicamente en el acento (SHOOTER magenta). Resuelto arriba, en la fricción 6.
- **DEFENDER está en `## Descartados`** y es el pariente más cercano de ABISMO, porque también se rescata. El descarte fue por tres cosas concretas: scroll bidireccional de un mundo mayor que la pantalla, radar de minimapa dibujado dentro del canvas, y abducción de humanoides como cuarto subsistema. **ABISMO no tiene ninguna de las tres**: una sola pantalla sin scroll, sin radar, y el buzo se recoge tocándolo. No estoy reviviendo un descarte: son dos juegos distintos que comparten un verbo.
- **INCURSIÓN (pendiente) y RIVER RAID (descartado)** son los otros dos con vehículo y terreno. Los dos tienen scroll y son shooters puros sin economía de entrega. No se solapan.
- **GALERÍA DE TIRO (descartado)** no aplica: acá el jugador se mueve en dos ejes y el disparo es una de cuatro mecánicas, no la única.

`references/games-suggestions-todo.md` **no fue modificado**: es territorio de `game-planner`.
