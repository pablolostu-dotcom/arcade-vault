# Sugerencias de juegos — TODO

Registro de lo que el agente `game-planner` propuso, descartó, y de lo que terminó
implementándose. Lo escribe y actualiza el agente; el estado `Implementado` lo pone
un humano cuando el spec se mergea.

Qué juegos existen hoy: `references/implemented-games.md`.
Cómo se agrega uno: la tabla de cinco archivos en `CLAUDE.md`, y `/spec-juego`.

## Pendientes

- [ ] **MISILES** — `misiles` · SHOOTER · magenta — propuesto 2026-09-13
  - **Por qué encaja:** defensa de ciudades con mira de mouse — puntaje acumulable por ola, game over duro (las 6 ciudades caídas), un jugador, control de mouse ya habilitado desde el SPEC 08, y arte 100% procedural (líneas, estelas y explosiones circulares) sin un solo asset binario. Es el primer SHOOTER del catálogo que no es ni vectorial-espacial (`asteroides`) ni de filas alienígenas (`invasores`), así que suma género en vez de repetirlo.
  - **Fricciones:** mundo 800×600 sin grilla ni reencuadre (suelo en `y = 560`; baterías en `x = 60 / 400 / 740`; 6 ciudades centradas en `x = 145 / 230 / 315` y `485 / 570 / 655`, 60 px de ancho y 25 px de aire entre sí, cierran los 800 exactos). `lives` **sí** = ciudades en pie, pero arranca en **6** y el HUD hoy nunca pintó más de 3 ♥ (arkanoid): es el slot más ancho que va a tener. `extra` = `{ label: "MISILES", value: "8·10·8" }` — munición por batería, ya formateada como un solo string por el motor; el multiplicador de ola queda afuera porque `extra` es uno solo. Sin assets: el sonido se sintetiza con WebAudio (el plan B del paso 5 del SPEC 09). El bonus de fin de ola pide un momento "entre olas" que `GameStatus` no modela: se resuelve adentro de `"playing"` con una pausa interna del motor, sin tocar el contrato.
  - **Costo:** `lib/games/misiles/engine.ts` (escala esperada ~20-25 KB, del orden de `asteroides`), una línea en `lib/games/registry.ts`, `supabase/migrations/<ts>_add_game_misiles.sql`, `.cover-misiles` en `app/globals.css`. Cero archivos en `public/`. **No mueve el chasis:** no toca `lib/games/types.ts`, `components/reproductor.tsx`, `components/game-canvas.tsx` ni ninguno de los catalog-driven.

> Barrido del 2026-09-13: 20 candidatos evaluados por cinco `game-planner` en paralelo, uno por
> carril de género (A shooters y defensa, B puzzle de grilla, C plataformas de una pantalla,
> D scroll infinito, E laberinto y evasión). Cada carril comparó 11-15 candidatos y presentó 4,
> ordenados de mejor a peor encaje. Ninguno de los 20 mueve el chasis ni pide archivos en `public/`.

### Carril A — shooters y defensa

- [ ] **ANDROIDES** — `androides` · SHOOTER · magenta — propuesto 2026-09-13
  - **Por qué encaja:** twin-stick de arena (WASD + flechas, los dos esquemas que `<Reproductor>` no usa). Puntaje acumulable por ola, game over duro por vidas, `restart()` sin estado residual. Género ausente: ninguno de los 4 motores ni de las 12 tarjetas es un twin-stick, así que cero riesgo SNAKE/SERPENTINA.
  - **Fricciones:** mundo 800×600 sin grilla — marco de 20 px y arena interna de 760×560 desde (20,20) hasta (780,580), divide exacto. `lives` sí = 3 (el HUD ya pintó 3 ♥ con arkanoid). `extra` = `{ label: "RESCATES", value: "4/5" }`. Tres tipos de enemigo y no los cinco del original, o el motor se va de escala. Sin assets (WebAudio). Ojo con `preventDefault` en las flechas.
  - **Costo:** `lib/games/androides/engine.ts` (~22-26 KB), una línea en `registry.ts`, la migración, `.cover-androides`. No mueve el chasis.

- [ ] **ÓRBITA** — `orbita` · SHOOTER · green — propuesto 2026-09-13
  - **Por qué encaja:** shooter radial de posición fija tipo Gyruss. El motor más barato del carril: sin scroll, sin física, la proyección entera es un `atan2` más una escala lineal. Único juego del catálogo con geometría polar.
  - **Fricciones:** centro en (400,300), anillo de radio 250 — el alto cierra exacto (50 px de aire arriba y abajo) y los 150 px que sobran por lado los llena el campo de estrellas, sin tocar `.game-canvas`. Profundidad del enemigo = `20 + z·230`. `lives` sí = 3. `extra` = `{ label: "ARMA", value: "DOBLE" }`. Roce declarado con el mock `invasores` (SHOOTER green espacial): se despega por ser radial y por la portada de anillo; yellow es la alternativa.
  - **Costo:** `lib/games/orbita/engine.ts` (~18-22 KB), una línea en `registry.ts`, la migración, `.cover-orbita`. No mueve el chasis.

- [ ] **VÓRTICE** — `vortice` · SHOOTER · magenta — propuesto 2026-09-13
  - **Por qué encaja:** tube shooter tipo Tempest. Es la pantalla más distinta de todo el vault: nada del catálogo, mock o jugable, se le parece — riesgo de duplicar tarjeta cero. Vector puro sobre negro, el lenguaje del tema.
  - **Fricciones:** centro en (400,290), 16 sectores, radio exterior 270 (290+270=560 < 600; 400±270 = 130…670, con el degradé de fuga en los márgenes) e interior 26. Colisión = comparar `sector` y `t ∈ [0,1]`, sin geometría. `lives` sí = 3. `extra` = `{ label: "ZAPPER", value: "LISTO" }`. **La forma del tubo se genera proceduralmente** en vez de portar las 16 formas dibujadas a mano del original: es lo que lo mantiene en escala, y hay que fijarlo en el spec. El más caro del carril.
  - **Costo:** `lib/games/vortice/engine.ts` (~24-28 KB), una línea en `registry.ts`, la migración, `.cover-vortice`. No mueve el chasis.

- [ ] **INCURSIÓN** — `incursion` · SHOOTER · yellow — propuesto 2026-09-13
  - **Por qué encaja:** shmup de scroll lateral sobre terreno generado tipo Scramble. El único del carril con scroll, y por eso el que más género agrega frente a `asteroides` y MISILES. Doble condición de derrota (vidas o combustible), las dos por el mismo camino.
  - **Fricciones:** 800×600 con scroll horizontal; terreno como heightmap de columnas de 10 px — 80 en pantalla más 16 de buffer, colisión O(1) contra la altura de la columna. `lives` sí = 3. `extra` = `{ label: "FUEL", value: "68%" }` — el combustible es un **segundo recurso** además de las vidas y ocupa el único slot: la distancia recorrida tiene que ir al `score` o no ir. Dos botones de disparo, ninguno choca con `Escape`/`P`.
  - **Costo:** `lib/games/incursion/engine.ts` (~22-26 KB), una línea en `registry.ts`, la migración, `.cover-incursion`. No mueve el chasis.

### Carril B — puzzle de grilla y de caída

- [ ] **BURBUJAS** — `burbujas` · PUZZLE · magenta — propuesto 2026-09-13
  - **Por qué encaja:** Puzzle Bobble. Es el primer PUZZLE del catálogo cuyo verbo no es "encajar una pieza que cae", así que no se lee como otro Tetris al lado de `caida` y `tetris`. Puntaje acumulable (racimo + burbujas sueltas que caen), game over duro por la línea de muerte. Mouse, ya habilitado desde el SPEC 08.
  - **Fricciones:** burbuja Ø50 px ⇒ filas pares 16×50 = 800 exacto; impares con offset de 25 px llevan 15. Paso vertical 50·√3/2 ≈ 43,3 px (no exacto, y no importa: el racimo cuelga del techo). Línea de muerte en `y = 500`, cañón en (400,555). `lives` **no** — la presión es el techo que baja, el HUD oculta el slot ♥. `extra` = `{ label: "TECHO", value: "4 tiros" }`. La burbuja siguiente se dibuja dentro del cañón (mundo, no HUD). Sin assets.
  - **Costo:** `lib/games/burbujas/engine.ts` (~20-25 KB: grilla hexagonal, BFS del racimo por color, BFS desde el techo para flotantes, rebote y snap), una línea en `registry.ts`, la migración, `.cover-burbujas`. No mueve el chasis.

- [ ] **TUBERÍAS** — `tuberias` · PUZZLE · yellow — propuesto 2026-09-13
  - **Por qué encaja:** Pipe Dream — el "puzzle de acción con reloj" que falta. El reloj es presión, no puntaje: se puntúa por tramo inundado y bonus de nivel, acumulativo. Game over clásico: el flujo llega a un extremo sin tubo. El motor más barato del carril y el que menos compite visualmente con lo existente.
  - **Fricciones:** 800×600 partido en 700+100 — grilla de 7×6 celdas de 100 px, más la banda izquierda de 100 px con la cola vertical de las 5 piezas próximas (5×100 = 500, centrada). Cierra exacto y la cola es mundo, no HUD. `lives` **no**. `extra` **cambia de significado entre fases**: `{ "SALIDA", "7s" }` durante la cuenta regresiva y `{ "FLUJO", "23" }` cuando arranca el flujo — legal porque el `label` viaja en el snapshot, pero **es la primera vez que un motor reusa el slot con dos sentidos y hay que escribirlo en el spec**.
  - **Costo:** `lib/games/tuberias/engine.ts` (~15 KB: 6 piezas como máscara de 4 bits, recorrido del flujo con progreso fraccional), una línea en `registry.ts`, la migración, `.cover-tuberias`. No mueve el chasis.

- [ ] **COLAPSO** — `colapso` · PUZZLE · green — propuesto 2026-09-13
  - **Por qué encaja:** click sobre grupos ortogonales de ≥3, con una fila nueva empujando desde abajo cada T segundos (variante Collapse!, no SameGame estático). El empuje es lo que convierte un puzzle de pensar —que se mediría en movimientos y no encajaría— en un arcade con reloj. Puntaje cuadrático por grupo con cascadas.
  - **Fricciones:** 16 columnas × 12 filas de 50 px = 800×600 exacto, con el scroll de la fila entrante animado sub-celda. `lives` **no**. `extra` = `{ label: "MAYOR", value: "11" }` (el grupo más grande de la partida). **Riesgo real: balance** — sin empuje no hay tensión, con empuje rápido es injugable, y no hay original portado del que copiar constantes (se eligen, como en Snake).
  - **Costo:** `lib/games/colapso/engine.ts` (~12-15 KB), una línea en `registry.ts`, la migración, `.cover-colapso`. No mueve el chasis.

- [ ] **PANEL NEÓN** — `panel-neon` · PUZZLE · magenta (verde si entra junto con BURBUJAS) — propuesto 2026-09-13
  - **Por qué encaja:** Panel de Pon / Tetris Attack — el tablero sube y vos intercambiás pares adyacentes. El gancho es el multiplicador por **cadena**, la cascada que se resuelve sola después de un swap. Cubre "manipulación de tablero", el sub-área que ningún motor toca.
  - **Fricciones:** 16×12 de 50 px = 800×600 exacto, pero **16 columnas es más del doble del ancho canónico (6)**: el balance del original no sirve y hay que reelegir velocidad, colores y ventana de cadena desde cero. Segundo costo declarado: es el candidato que **más se parece a lo que ya hay** (un stack que topa arriba, como `caida` y `tetris`) — se despega por el verbo y la dirección, y eso hay que sostenerlo en la portada. `lives` no. `extra` = `{ label: "CADENA", value: "x4" }`. El scroll sub-celda es la parte delicada: conviven grilla y offset continuo.
  - **Costo:** `lib/games/panel-neon/engine.ts` (~18-22 KB), una línea en `registry.ts`, la migración, `.cover-panel-neon`. No mueve el chasis.

### Carril C — plataformas y acción de una pantalla

- [ ] **PIRÁMIDE** — `piramide` · ARCADE · magenta — propuesto 2026-09-13
  - **Por qué encaja:** Q\*bert reducido. La geometría es **una sola** (28 cubos en 7 filas) y la ronda solo cambia cuántos enemigos entran: cero niveles autorales, cero tilemap. **No tiene física** — el salto es discreto de cubo a cubo con un tween de ~140 ms, sin gravedad ni AABB. Sería el motor más chico del repo en su género. El género plataformas está **vacante** en las 12 tarjetas.
  - **Fricciones:** cara superior del cubo 100×56 + lateral 44 ⇒ cubo de 100×100. Fila base 7×100 = 700 px (`x = 50…750`). Paso vertical 72 con desplazamiento de ±50: fila 0 en `y = 40`, fila 6 en `y = 472` + 100 = 572, con 28 px de aire abajo. `lives` sí = 3. `extra` = `{ label: "CUBOS", value: "12/28" }`. Fricción de control: los cuatro movimientos son **diagonales** sobre flechas ortogonales — se mapea ↑↓←→ a las diagonales y se explica en el panel de instrucciones. Los discos de escape se dejan afuera. **Roza el carril E** por el esquivar; se reclama como C porque el verbo es saltar, no recolectar.
  - **Costo:** `lib/games/piramide/engine.ts` (~14-18 KB, por debajo de `tetris`), una línea en `registry.ts`, la migración, `.cover-piramide`. No mueve el chasis.

- [ ] **JUSTA** — `justa` · ARCADE · yellow — propuesto 2026-09-13
  - **Por qué encaja:** Joust — vuelo con aleteo sobre plataformas fijas, una sola pantalla que se repite por olas. El layout es **uno solo, hardcodeado como cinco rectángulos**: no es tilemap ni nivel autoral. El combate, que en otro juego sería lo caro, acá es **una comparación de `y`**, y la IA enemiga un steering de dos líneas.
  - **Fricciones:** lava en `y = 570`; plataforma base en `y = 540` con hueco central de 200 px (`x = 300…500`); dos medias de 200×16 en `y = 380` (`x = 60` y `540`); dos altas de 160×16 en `y = 220` (`x = 180` y `460`). Wrap horizontal, techo sólido. `lives` sí = 3 (el original da 5; se baja para no ensanchar el slot ♥). `extra` = `{ label: "HUEVOS", value: "2" }`. El aleteo es impulso por pulsación ⇒ `keydown` con `repeat` filtrado. La inercia horizontal hace obligatorio el `dt` topeado.
  - **Costo:** `lib/games/justa/engine.ts` (~22-26 KB), una línea en `registry.ts`, la migración, `.cover-justa`. No mueve el chasis.

- [ ] **GLACIAR** — `glaciar` · ARCADE · cyan (green si se prefiere balancear) — propuesto 2026-09-13
  - **Por qué encaja:** Ice Climber reducido — escalada vertical rompiendo el hielo de arriba. Los pisos son **procedurales por altura**: la "pantalla" es una función de la altura, no un nivel dibujado. Puntaje monótono por altura, game over duro por caída o vidas.
  - **Fricciones:** 20 columnas × 40 px = 800 clavados; bloque de 40×24; pisos cada 120 px ⇒ 5 visibles, cámara que corre cuando el jugador pasa `y = 240`. `lives` sí = 3. `extra` = `{ label: "ALTURA", value: "128 m" }` (1 piso = 8 m). **Es el más caro del carril y el único que necesita física de salto de verdad** — gravedad, altura variable por tecla sostenida, detección de suelo, golpe de cabeza desde abajo — más destrucción por bloque y enemigos que empujan: entra en presupuesto sin margen. `cyan` ya está en 4 y subiría a 5.
  - **Costo:** `lib/games/glaciar/engine.ts` (~24-28 KB), una línea en `registry.ts`, la migración, `.cover-glaciar`. No mueve el chasis.

- [ ] **RASCACIELOS** — `rascacielos` · ARCADE · green — propuesto 2026-09-13
  - **Por qué encaja:** Crazy Climber — trepar una fachada moviendo las manos de a una. Como PIRÁMIDE, **sin física de salto**: agarre discreto sobre grilla de ventanas. La fachada se genera por filas al scrollear, así que el edificio es infinito sin un solo piso autoral.
  - **Fricciones:** 8 columnas × 80 px = 640 px de fachada centrada (`x = 80…720`), con 80 px de muro por lado; ventana de 80×60 con paso vertical de 100 ⇒ 6 filas visibles; la cámara sube de a 100 px. `lives` sí = 3. `extra` = `{ label: "PISO", value: "23" }`. **La fricción grande y por la que va cuarto: el control.** El original usa dos joysticks y acá se mapea a dos grupos de teclas (WASD mano izquierda, flechas derecha) — riesgo real de que no se entienda en los primeros diez segundos. El gorila y los objetos del original se recortan a un solo peligro (macetas por una columna).
  - **Costo:** `lib/games/rascacielos/engine.ts` (~18-22 KB), una línea en `registry.ts`, la migración, `.cover-rascacielos`. No mueve el chasis.

### Carril D — carreras, conducción y scroll infinito

- [ ] **DESCENSO** — `descenso` · ARCADE · magenta — propuesto 2026-09-13
  - **Por qué encaja:** slalom de nieve con scroll vertical automático; el esquiador queda fijo en `y = 180` y el mundo sube. Score = metros + puertas, game over sin ambigüedad (chocar un árbol). **Estrena el género que más falta: no hay un solo juego de scroll continuo entre los 12** (`asteroides` es pantalla envolvente, `tetris`/`snake` son grilla, `arkanoid` pantalla fija). Cero adyacencia con las portadas existentes.
  - **Fricciones:** pista de 640 px centrada (`x = 80…720`) sembrada en 8 columnas lógicas de 80 px (640/80 = 8 exacto), más 80 px de borde nevado por lado. Obstáculos 40×48, esquiador 28×36. Scroll 180 → 420 px/s en 6 tramos. `lives` sí = 3. `extra` = `{ label: "PUERTAS", value: "12" }` — la velocidad en km/h queda afuera, se pinta dentro del canvas si hace falta. Sin assets.
  - **Costo:** `lib/games/descenso/engine.ts` (~14-18 KB), una línea en `registry.ts`, la migración, `.cover-descenso`. No mueve el chasis.

- [ ] **NITRO** — `nitro` · ARCADE · yellow — propuesto 2026-09-13
  - **Por qué encaja:** el arquetipo del carril — carrera cenital de scroll vertical tipo Road Fighter. Puntaje por distancia y adelantamientos, doble derrota (choque o nafta en cero) por el mismo camino, teclado puro.
  - **Fricciones:** calzada de 600 px centrada (`x = 100…700`) en 5 carriles de 120 px exactos, más 100 px de berma por lado. Autos de 48×80, jugador fijo en `y = 420`. Scroll 240 → 560 px/s. `lives` sí = 3. `extra` = `{ label: "NAFTA", value: "68%" }`; los adelantamientos se pliegan dentro de `score`. **Adyacencia declarada con el mock `ranaria`** ("Cruza la autopista de pixeles"): por eso el nombre es NITRO y no AUTOPISTA, el acento yellow y no green, y la portada va con la ruta en fuga vertical, no con carriles de tráfico. El precedente SNAKE/SERPENTINA dice que se resuelve así, pero se paga.
  - **Costo:** `lib/games/nitro/engine.ts` (~16-20 KB), una línea en `registry.ts`, la migración, `.cover-nitro`. No mueve el chasis.

- [ ] **RASANTE** — `rasante` · ARCADE · green — propuesto 2026-09-13
  - **Por qué encaja:** vuelo rasante por caverna procedural (SFCave). Las reglas más limpias del carril: score = distancia, game over = rozar la pared, `restart()` = nueva semilla. Teclado y mouse, los dos ya soportados.
  - **Fricciones:** techo y piso muestreados cada 10 px → 80 columnas exactas en un buffer circular, que es todo el "nivel" que hay que guardar. Nave de 24×12 fija en `x = 180`. Hueco de 320 px que se cierra hasta 120; scroll 200 → 480 px/s. `lives` **ausente** ⇒ el HUD oculta el slot ♥ (ya pasa con `tetris` y `snake`). `extra` = `{ label: "VELOCIDAD", value: "3.2x" }`. **El riesgo es profundidad, no costo:** una sola mecánica puede quedar fina al lado de `arkanoid` o `snake`; se compensa con pickups en el hueco más angosto.
  - **Costo:** `lib/games/rasante/engine.ts` (~12-15 KB, sería el motor más chico del repo), una línea en `registry.ts`, la migración, `.cover-rasante`. No mueve el chasis.

- [ ] **AZOTEAS** — `azoteas` · ARCADE · cyan — propuesto 2026-09-13
  - **Por qué encaja:** runner sin fin tipo Canabalt. Score = distancia por definición, partida de 30-60 s — la más repetible del carril. Arte procedural con parallax de skyline.
  - **Fricciones:** edificios de 120-280 px de ancho, huecos de 60-180, alturas cuantizadas en 6 escalones de 40 px entre `y = 300` y `y = 540` (6×40 = 240 exacto), lo que hace los saltos legibles y el generador trivial. Corredor 28×36 fijo en `x = 200`. Scroll 260 → 600 px/s **con techo duro**: pasados los ~600 px/s el salto deja de ser reactivo y hay que congelar la rampa (se decide en el spec). `lives` ausente. `extra` = `{ label: "SALTOS", value: "24" }`. Dos deméritos declarados: el acento natural es cyan (el más cargado, 4) y su salto **roza el carril C**.
  - **Costo:** `lib/games/azoteas/engine.ts` (~13-16 KB), una línea en `registry.ts`, la migración, `.cover-azoteas`. No mueve el chasis.

### Carril E — laberinto, recolección y evasión

- [ ] **CERCO** — `cerco` · ARCADE · magenta — propuesto 2026-09-13
  - **Por qué encaja:** recortar territorio trazando líneas desde el borde (Qix). Score proporcional al área, acumulable por diseño. **No tiene IA de persecución:** el Qix es una polilínea que rebota pseudoaleatoriamente y las chispas patrullan el perímetro a velocidad fija — cero pathfinding, exactamente lo contrario del motivo por el que se descartó PAC-MAN. Género ausente: no hay nada de territorio/trazado en las 12 filas.
  - **Fricciones:** campo modelado como celdas de 5 px → 160×120 = 19.200 celdas exactas en un `Uint8Array`; el flood fill corre sobre ese buffer (no sobre píxeles) una vez por línea cerrada, no por frame. El jugador avanza de a 5 px y nunca queda a medio camino. `lives` sí = 3. `extra` = `{ label: "ÁREA", value: "62%" }`. Superar el 75% avanza `level` **dentro de `"playing"`**, sin pedirle un estado nuevo a `GameStatus` (el mismo truco que el bonus entre olas de MISILES). Distinción de `gloton`: total.
  - **Costo:** `lib/games/cerco/engine.ts` (~18-22 KB), una línea en `registry.ts`, la migración, `.cover-cerco`. No mueve el chasis.

- [ ] **PINGÜINO** — `pinguino` · ARCADE · green — propuesto 2026-09-13
  - **Por qué encaja:** Pengo — empujar bloques de hielo para aplastar abejas. La persecución es **deliberadamente simple**: un paso por tic hacia el jugador por el eje de mayor diferencia, con ~25% de paso aleatorio; sin personalidades, sin grafo, sin datos de laberinto (el campo se genera por densidad y cambia con cada empujón). Es el único candidato del carril donde el jugador ataca sin disparar.
  - **Fricciones:** 20×15 celdas de 40 px = 800×600 exacto (300 celdas); pingüino, abeja y bloque ocupan una celda, y el empujón desliza el bloque celda a celda hasta chocar. `lives` sí = 3. `extra` = `{ label: "ABEJAS", value: "3" }`. El bonus de "tres diamantes alineados" del original queda afuera: inflaría el motor y querría un segundo slot. Sin assets. Distinción de `gloton`: sin puntos que recolectar ni laberinto fijo, y el tablero es destructible.
  - **Costo:** `lib/games/pinguino/engine.ts` (~16-20 KB), una línea en `registry.ts`, la migración, `.cover-pinguino`. No mueve el chasis.

- [ ] **EXCAVADOR** — `excavador` · ARCADE · yellow — propuesto 2026-09-13
  - **Por qué encaja:** Dig Dug — cavar túneles, inflar enemigos, descalzar rocas para aplastarlos en cadena. El que más suma de golpe (cavar + evadir + atacar sin proyectil). La IA es **una sola regla compartida** por los dos tipos: avanzar por túnel hacia el jugador por el eje mayor y, tras N segundos, cruzar la tierra en línea recta. Nada de cuatro personalidades.
  - **Fricciones:** tierra como máscara de 32×24 celdas de 25 px = 800×600 exacto — el mismo reticulado que ya probó `snake`, o sea una cuenta verificada en producción. `lives` sí = 3. `extra` = `{ label: "ESTRATO", value: "2" }`; el contador de enemigos queda afuera. **Es el candidato del carril que hay que defender contra `gloton`:** al empezar no hay laberinto, la pantalla es tierra llena y el trazado lo hacés vos (la mitad del descarte de PAC-MAN desaparece), la paleta son estratos ocres y el jugador ataca. Aun así es el más cercano, y `.cover-excavador` tiene que ser un corte de tierra con túnel y roca, nunca una grilla de corredores.
  - **Costo:** `lib/games/excavador/engine.ts` (~22-26 KB), una línea en `registry.ts`, la migración, `.cover-excavador`. No mueve el chasis.

- [ ] **CUBETAS** — `cubetas` · ARCADE · magenta — propuesto 2026-09-13
  - **Por qué encaja:** Avalanche / Kaboom — un bombardero suelta bombas y las atrapás con una pila de tres cubetas movidas con mouse. El motor más barato del repo y el que menos supuestos rompe: sin grilla, sin laberinto, sin IA (el bombardero patrulla con una senoidal más jitter, no persigue). Género ausente: no hay nada de "atrapar lo que cae".
  - **Fricciones:** bombardero en la franja `y = 60…100`; pila de cubetas de 90×16 con 8 px de aire apoyada en `y = 520` (72 px de alto); bombas de 12 px de radio y ~430 px de caída útil. Velocidad 260 px/s en la ola 1, +40 por ola, tope 700 → 0,61 s de caída en la ola tope, todavía reaccionable con mouse. `lives` sí = 3 (las cubetas). `extra` = `{ label: "OLA", value: "5 · x8" }`, siguiendo el precedente `"8·10·8"` de MISILES. Riesgo visual anotado: una paleta en la base recuerda a `bloque-buster` y `arkanoid` — se despega porque no hay pelota ni muro.
  - **Costo:** `lib/games/cubetas/engine.ts` (~10-14 KB, el motor más chico que tendría el repo), una línea en `registry.ts`, la migración, `.cover-cubetas`. No mueve el chasis.

## Descartados

- **CENTIPEDE** — descartado 2026-09-13 — el motor (segmentación de la oruga al recibir impacto, campo de hongos persistente, araña y pulga como enemigos aparte) se va bastante por encima de la escala de 16-32 KB de los motores actuales.
- **LUNAR LANDER** — descartado 2026-09-13 — el puntaje es por aterrizaje y apenas acumulable, la partida es lenta y poco repetible, y querría dos stats propios (combustible y velocidad de descenso) contra el único slot `extra`.
- **FROGGER** — descartado 2026-09-13 — duplica una a una la tarjeta mock `ranaria` (ARCADE, verde, "Cruza la autopista de pixeles"), y el precedente SNAKE/SERPENTINA muestra lo que cuesta esa colisión.
- **PAC-MAN / laberinto** — descartado 2026-09-13 — duplica la tarjeta mock `gloton` y además pide datos de laberinto más cuatro IAs de fantasma con personalidad distinta, muy por encima del presupuesto de un solo `engine.ts`.
- **PONG** — descartado 2026-09-13 — es `VERSUS` y necesita un rival: el chasis no sostiene multijugador ni IA rival, y encima duplica la tarjeta mock `duelo-pixel`.


Del barrido de cinco carriles del 2026-09-13 (los candidatos que cada planner evaluó y dejó afuera):

- **DEFENDER** — descartado 2026-09-13 — scroll bidireccional de un mundo mayor que la pantalla, radar de minimapa y abducción de humanoides son tres subsistemas de más, y el radar pediría pintar un panel adentro del canvas, que es justo lo que el motor no hace.
- **GALAGA / GALAXIAN** — descartado 2026-09-13 — duplica una a una la tarjeta mock `invasores` y paga el costo SNAKE/SERPENTINA sin traer un género que el catálogo no tenga.
- **TOWER DEFENSE** — descartado 2026-09-13 — partida larga y poco repetible, economía entre olas, y una UI de colocación de torres que el motor tendría que pintar adentro del canvas; el `restart()` instantáneo pierde sentido.
- **GALERÍA DE TIRO / DUCK HUNT** — descartado 2026-09-13 — mecánica demasiado fina para un motor propio, y pisa el control de mira con mouse de MISILES.
- **BATTLEZONE** — descartado 2026-09-13 — wireframe 3D con proyección en perspectiva y recorte de líneas, muy por encima de la escala de 16-32 KB.
- **STAR CASTLE** — descartado 2026-09-13 — buen vector y barato, pero es una sola pantalla que se repite sin progresión real: `level` sería solo un multiplicador de velocidad.
- **RAMPART** — descartado 2026-09-13 — fases alternadas (construir / disparar / reparar) que `GameStatus` no modela, y además es mitad puzzle de colocación.
- **ZAXXON** — descartado 2026-09-13 — la proyección isométrica con eje de altura necesitaría un segundo stat propio (altitud) contra el único slot `extra`.
- **BEAMRIDER** — descartado 2026-09-13 — rail shooter de 5 carriles: encaja, pero es una versión más pobre de ÓRBITA y compartiría portada con ella.
- **COLUMNS / COLUMNAS** — descartado 2026-09-13 — paga doble: se lee como otro Tetris al lado de `caida` y `tetris`, y su tablero canónico de 6×13 no divide 800×600 (el reencuadre caro del SPEC 07).
- **DR. MARIO / PUYO PUYO** — descartado 2026-09-13 — mismo problema de forma que Columns con un tablero todavía más angosto (8×16, relación 1:2 contra el 4:3 del canvas).
- **BEJEWELED (match-3 clásico)** — descartado 2026-09-13 — sin reloj ni empuje el único game over posible es el bloqueo por falta de jugadas, que casi nunca llega: un juego que en la práctica no termina rompe `end()` y el ciclo de `restart()`.
- **2048** — descartado 2026-09-13 — el puntaje sale de la aritmética de las fusiones y no de la destreza, y el tablero 4×4 obliga a un cuadrado con 100 px de banda muerta a cada lado.
- **BUSCAMINAS** — descartado 2026-09-13 — no tiene puntaje acumulable: se mide en tiempo, el criterio que descalifica de entrada.
- **SOKOBAN** — descartado 2026-09-13 — puzzle por nivel, sin puntaje creciente y sin condición de derrota propia; habría que inventarle las dos cosas.
- **LIGHTS OUT / FLOOD-IT** — descartado 2026-09-13 — se miden en cantidad de movimientos, no acumulan puntaje y no tienen game over propio.
- **KLAX** — descartado 2026-09-13 — la cinta en falso 3D es la mitad del motor y no aporta al puntaje, las metas por ola no mapean limpio contra `level`, y la paleta que atrapa fichas pisa el verbo de `arkanoid`.
- **MR. DRILLER** — descartado 2026-09-13 — pide dos stats propios (aire y profundidad) contra el único slot `extra`.
- **ZUMA / cadena en espiral** — descartado 2026-09-13 — buen encaje técnico, pero repite el verbo de BURBUJAS (apuntar y emparejar colores): queda como reemplazo de ese, no como candidato aparte.
- **HEXIC / rotación de tríos** — descartado 2026-09-13 — la rotación sobre grilla hexagonal encarece el motor sin agregar un verbo distinto al match de colores.
- **DONKEY KONG** — descartado 2026-09-13 — son cuatro pantallas autorales distintas con mecánicas propias cada una, más barriles, martillos y escaleras: un tilemap dibujado a mano y tres motores en uno.
- **DONKEY KONG JR. / SKY SKIPPER** — descartado 2026-09-13 — misma familia autoral que DK, y además se leerían como variantes del mismo juego en la grilla del catálogo.
- **BURGERTIME** — descartado 2026-09-13 — tableros autorales y tres enemigos con pathfinding sobre el grafo de plataformas y escaleras; el estado de cada ingrediente a medio caer duplica la lógica de colisión.
- **LODE RUNNER** — descartado 2026-09-13 — 150 niveles diseñados a mano (sin ellos no es Lode Runner) más IA de guardias: pide un editor de tiles, justo lo que el presupuesto excluye.
- **BUBBLE BOBBLE** — descartado 2026-09-13 — cien pantallas autorales, herencia de dos jugadores, y una máquina de estados por burbuja sobre sprites que el repo no tiene.
- **KANGAROO / POPEYE** — descartado 2026-09-13 — pantallas autorales y dependencia total de sprites: el mismo costo que Donkey Kong sin su reconocimiento.
- **PITFALL** — descartado 2026-09-13 — el mundo son 255 pantallas encadenadas y precalculadas, y el scroll lateral lo empuja fuera del género de pantalla única.
- **FLAPPY / vuelo de aleteo infinito** — descartado 2026-09-13 — mecánica única sin plataformas; su nicho de scroll infinito ya lo cubre mejor RASANTE.
- **ELEVATOR ACTION** — descartado 2026-09-13 — plataformas + ascensores + puertas + disparo + IA de agentes: no entra en el presupuesto de un solo `engine.ts`.
- **ICE CLIMBER "fiel"** — descartado 2026-09-13 — con nubes móviles, cóndor y fase de bonus suma tres subsistemas sin cambiar el puntaje; se propone la versión reducida (GLACIAR).
- **Q\*BERT "fiel"** — descartado 2026-09-13 — con discos voladores, Ugg, Wrong-Way, Slick y Sam; se propone la versión reducida de dos enemigos (PIRÁMIDE).
- **OUT RUN / pseudo-3D con curvas** — descartado 2026-09-13 — el segmentado de ruta con escalado de sprites y curvas es el motor más caro del carril, y sin assets los autos escalados quedan pobres.
- **ENDURO** — descartado 2026-09-13 — mismo pseudo-3D, y la meta es una cuota de autos por día: un reloj disfrazado de puntaje.
- **NIGHT DRIVER** — descartado 2026-09-13 — pseudo-3D otra vez, y su encanto original (la noche con solo los postes visibles) se pierde en un canvas de neón donde todo ya brilla.
- **MOON PATROL** — descartado 2026-09-13 — su identidad real es disparar hacia arriba y adelante, y el motor con terreno, cráteres, dos armas y enemigos aéreos se va a ~30 KB.
- **SPY HUNTER** — descartado 2026-09-13 — armas, vehículos especiales y transformación a lancha: muy por encima del presupuesto de un solo `engine.ts`.
- **RIVER RAID** — descartado 2026-09-13 — scroll vertical con terreno procedural, pero es un shooter puro y su nicho lo cubre INCURSIÓN.
- **EXCITEBIKE** — descartado 2026-09-13 — se mide en tiempo de vuelta contra reloj, no en puntaje creciente.
- **TRON / LIGHT CYCLES** — descartado 2026-09-13 — es `VERSUS` y necesita una IA rival que el chasis no sostiene; además la estela en grilla es visualmente un SNAKE de a dos.
- **PAPERBOY** — descartado 2026-09-13 — la proyección isométrica encarece el motor y el recorrido es finito, así que el puntaje deja de ser acumulable sin inventarle un bucle.
- **SUBWAY SURFERS / esquive de 3 carriles** — descartado 2026-09-13 — es NITRO con menos ideas; si entra uno de los dos, que entre el que tiene tráfico y nafta.
- **BOULDER DASH** — descartado 2026-09-13 — el que más cerca estuvo de entrar (su cueva de 40×30 celdas de 20 px divide 800×600 exacto), pero solapa el cavar de EXCAVADOR y su física de rocas que caen roza el puzzle de caída.
- **BOMBERMAN** — descartado 2026-09-13 — laberinto destructible, cadenas de explosión, power-ups y varios enemigos se van de escala, y sin versus (que el chasis no sostiene) pierde la mitad de su gracia.
- **AMIDAR / MAKE TRAX / LADY BUG** — descartado 2026-09-13 — variantes de laberinto fijo con puntos y perseguidores: duplican `gloton` sin una mecánica que las despegue, el mismo motivo que PAC-MAN.
- **HEAD ON** — descartado 2026-09-13 — recolección en pistas concéntricas esquivando un auto rival: es conducción, y el rival es una IA que persigue.
- **SURROUND / ciclos de luz** — descartado 2026-09-13 — cercar con estela necesita rival: es `VERSUS` de hecho, y encima se lee como `serpentina` / `snake`.
- **MR. DO!** — descartado 2026-09-13 — cavar y empujar manzanas es casi exactamente EXCAVADOR; no aporta nada sobre él.
- **LOCO-MOTION / MOUSE TRAP** — descartado 2026-09-13 — laberintos reconfigurables o con puertas conmutables: el estado del tablero infla el motor y el puntaje queda flojo.

## Implementados

_(vacío — los cuatro motores actuales son anteriores al agente)_
