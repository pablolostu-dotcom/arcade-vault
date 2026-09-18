# SPEC 12 — Skins de ABISMO: las tres paletas del vault en el motor del fondo del mar

> **Status:** Aceptado
> **Depends on:** SPEC 10, SPEC 11
> **Date:** 2026-09-18
> **Objective:** Darle a `abismo` las tres skins del vault —`clasico`, `neon` y `retro`— sin cambiar un píxel de lo que el juego se ve hoy, y de paso cerrar el `setSkin` que le falta al motor y hoy rompe el chequeo de tipos.

## Por qué existe este spec

Dos cosas, y conviene no confundirlas.

**La primera es un arreglo.** `abismo` (SPEC 10) y el chasís de skins (SPEC 11) se escribieron en paralelo, y el motor del quinto juego quedó sin implementar el método que el SPEC 11 agregó a `EngineHandle`. `main` no compila:

```
lib/games/abismo/engine.ts(1132,3): error TS2741: Property 'setSkin' is missing in type
'{ start(): void; pause(): void; resume(): void; restart(): void; end(): void;
setMuted(next: boolean): void; destroy(): void; }' but required in type 'EngineHandle'.
```

El SPEC 11 dejó autorizado el no-op para los motores que todavía no tienen skins, y tres de los cinco lo usan. `abismo` **no va a usarlo**: un `setSkin() {}` vacío taparía el error de tipos sin darle al jugador nada, y este juego es justamente el que mejor aprovecha una paleta alternativa.

**La segunda es el trabajo real.** `abismo` es el motor más pintado del portal —un degradado de agua, una banda de aire, cuarenta burbujas, un lecho marino, un submarino con seis luces de bodega, buzos, dos clases de enemigo y dos clases de torpedo— y su paleta está hoy en **quince constantes de módulo sueltas** (líneas 171–185) más tres `GLOW_*` (192–194).

La fricción real es una sola y es lo que hace difícil a este juego: **el código de color es la regla de lectura**. El SPEC 10 lo escribió así, textualmente: _magenta sos vos, amarillo te mata, verde se salva, gris te muerde_. Se aprende en dos segundos y no necesita leyenda. En `retro`, que es monocromo por definición, **esa regla desaparece entera** y hay que reconstruirla con otra cosa. La salida está medida en `02-diseno.md`: cuatro escalones de luminancia de fósforo verde, más un segundo eje de **relleno macizo contra contorno** para el único par que la luminancia sola no separa —el submarino enemigo comparte silueta con el del jugador—.

La tercera decisión que vale la pena adelantar: **`clasico` se extrae literal.** Los quince hex y los tres radios de glow se mueven al record sin tocar uno. Dos pares de entidades están hoy por debajo de la separación de 1.5:1 —el jugador contra el tiburón a 1.22:1, el buzo contra el submarino enemigo a 1.23:1— y **se dejan como están**: corregirlos cambiaría lo que el jugador ya conoce, y el criterio de fracaso de este trabajo es exactamente ése. `neon` y `retro` los resuelven cada una por su lado.

## Alcance

**Dentro:**

- `lib/games/abismo/engine.ts`: el tipo `AbismoPalette`, el record `SKINS: Record<SkinId, AbismoPalette>` con las tres entradas, la variable `skin` de la fábrica y el `setSkin()` real que cierra el error de tipos.
- La extracción literal de las quince constantes `COLOR_*` y las tres `GLOW_*` a la entrada `clasico`, y el borrado de las constantes huérfanas.
- El único cambio de dibujo: el campo `esubHollow`, que en `retro` hace que el submarino enemigo se dibuje de contorno (`stroke`) en vez de macizo (`fill`).
- Los tres documentos de `specs/skins/abismo/`.

**Fuera de alcance (para futuras specs):**

- Las skins de `asteroides`, `arkanoid` y `snake`. Siguen con su `setSkin()` no-op, que es legal desde el SPEC 11. Son tres corridas más del mismo agente.
- Cualquier cambio al chasís: `lib/games/types.ts`, `components/game-canvas.tsx` y el selector de `components/reproductor.tsx` ya están completos desde el SPEC 11 y esta spec **no los toca**.
- Corregir los dos pares de `clasico` que están por debajo del piso de separación.
- Una cuarta skin, y una skin propia por juego. Las tres del vault son las tres, en los cinco motores.
- Persistir la skin en Postgres. Es una preferencia de cliente y vive en `localStorage`, igual que `av_muted` y `av_user`.

## El contrato del motor

**No cambia.** Esta spec no toca `lib/games/types.ts`: `SkinId`, `SKIN_IDS`, `EngineOptions.skin` y `EngineHandle.setSkin` existen tal cual desde el SPEC 11, y `<GameCanvas>` ya baja la prop y ya llama al método. Lo único que pasa acá es que **un quinto motor deja de ignorarlos**.

Del lado de `abismo`, el contrato con el resto del sistema sigue idéntico:

- `GameSnapshot` no cambia: `score`, `level`, `status`, `lives` y el `extra` con `O₂ · BODEGA`. La skin no es estado del juego y **no viaja en el snapshot**.
- `setSkin(next)` cambia la paleta **en caliente**: no reinicia la partida, no toca el reloj, no toca el oxígeno y no emite un snapshot. El próximo frame ya dibuja con la paleta nueva.
- La skin inicial entra por `EngineOptions.skin`, con `clasico` cuando viene ausente. Va ahí y no en un `setSkin()` posterior porque el motor se crea después de un `import()` dinámico y el primer frame escaparía con la paleta equivocada.
- Un valor que no esté en `SKIN_IDS` cae a `clasico`, igual que en `tetris`.

Las reglas de motor de `CLAUDE.md` que esta spec no puede romper:

- **Nada corre al importar el módulo.** El record `SKINS` son literales de string y número: no crea un `Audio`, ni una `Image`, ni lee el DOM.
- **La paleta vive en el motor, nunca en el DOM.** Ni un `getComputedStyle`, ni una custom property leída en runtime. Los hex están en el archivo.
- **`Escape` y `P` las ata `<Reproductor>`.** Esta spec no agrega una sola tecla; el cambio de skin es un botón del HUD.
- **El presupuesto de sombras del SPEC 10.** `shadowBlur` solo en el casco, la línea de agua y los buzos: cinco por frame como techo. Nunca en los diez enemigos, los seis torpedos ni las cuarenta burbujas. Lo único que varía por skin es el **radio** de esas cinco.

### La forma de la paleta

```ts
type AbismoPalette = {
  deepTop: string; // el tope del degradado de agua
  deepBottom: string; // el abismo
  air: string; // la banda sobre SURFACE_Y
  surface: string; // la línea de agua
  seabed: string; // el lecho, decoración: no colisiona
  bubble: string; // las BUBBLE_COUNT burbujas
  sub: string; // el casco del jugador
  subAlarm: string; // el casco con el tanque bajo
  cargoOn: string; // una plaza de bodega ocupada (va SOBRE el casco)
  cargoOff: string; // una plaza vacía
  diver: string;
  torpedo: string;
  shark: string;
  esub: string;
  eTorpedo: string;
  /** true ⇒ el submarino enemigo va de contorno. El segundo eje de `retro`. */
  esubHollow: boolean;
  glowSub: number;
  glowSurface: number;
  glowDiver: number;
};
```

Los tres valores completos, con sus ratios, están en `02-diseno.md` y el bloque está listo para pegar.

## Plan de implementación

Cinco pasos. Cada uno deja el sistema funcionando y cada uno tiene su verificación.

**Paso 1 — El tipo y el record.** Reemplazar las líneas 171–194 por `AbismoPalette`, `HOLLOW_LINE_WIDTH` y `SKINS`, con las tres entradas de `02-diseno.md`. Todavía nada lo usa, así que `tsc` va a marcar las constantes viejas como faltantes en el paso siguiente: los dos pasos se cierran juntos.

_Verificación:_ `npx tsc --noEmit` (se espera rojo hasta el paso 2).

**Paso 2 — La paleta activa y los catorce puntos de uso.** Declarar `let skin: AbismoPalette = SKINS[options.skin ?? "clasico"];` al principio de la fábrica, junto al `ctx`, y reemplazar cada `COLOR_*` y cada `GLOW_*` por su campo: `848–849`, `856`, `860`, `870–872`, `879`, `903`, `912–913`, `936`, `952–954`, `984`, `1005`, `1019`, `1023`. Las constantes sueltas quedan borradas.

_Verificación:_ `npx tsc --noEmit` en verde y `npx eslint app components lib` sin `no-unused-vars` en el archivo. Hasta acá **el juego se ve exactamente igual que antes**: lo único que cambió es de dónde sale cada hex.

**Paso 3 — El contorno del submarino enemigo.** En `drawEnemies()`, la rama `else`: cuando `skin.esubHollow` es `true`, la elipse y los dos rectángulos van con `stroke` / `strokeRect` y `lineWidth = HOLLOW_LINE_WIDTH` en vez de `fill` / `fillRect`. Con `esubHollow: false` el camino es byte por byte el de hoy.

_Verificación:_ `npx tsc --noEmit`, y en el browser el enemigo amarillo sigue macizo en `clasico`.

**Paso 4 — `setSkin`.** Reemplazar la ausencia del método en el objeto devuelto (después de `setMuted`, línea 1197) por:

```ts
setSkin(next: SkinId) {
  skin = SKINS[next] ?? SKINS.clasico;
},
```

Con eso `EngineHandle` queda satisfecho y el error TS2741 desaparece.

_Verificación:_ `npx tsc --noEmit` en verde — **este es el paso que arregla `main`**.

**Paso 5 — Verificar de verdad.** `npx tsc --noEmit`, `npx eslint app components lib`, `npm run build`, y las tres capturas del juego en `/jugar/abismo`, una por skin.

## Criterios de aceptación

1. **`clasico` no cambia un píxel.** Puesta al lado de una captura previa al SPEC 12, la pantalla es idéntica: el mismo degradado, el mismo cian de la línea de agua, el mismo magenta del casco, los mismos radios de glow 12 / 10 / 8, y el submarino enemigo macizo.
2. **`npx tsc --noEmit` pasa.** Hoy no pasa: el criterio incluye arreglar lo que estaba roto.
3. **`npx eslint app components lib` sin errores ni warnings nuevos.** Ninguna de las quince constantes viejas queda huérfana.
4. **`npm run build` termina.**
5. **Las tres skins se ven en el browser** y el botón del HUD cicla `CLÁSICO → NEÓN → RETRO → CLÁSICO` sin reiniciar la partida ni perder el puntaje.
6. **La skin sobrevive al recargar** y es **por juego**: elegir `retro` en `abismo` no toca la de `tetris`.
7. **En `neon` y en `retro`, los siete pares de entidades están a ≥1.5:1 y los siete elementos de información a ≥4.5:1**, con los números de `02-diseno.md`.
8. **En `retro` el submarino enemigo se distingue del jugador** por tres cosas a la vez: 2.45:1 de luminancia, contorno contra macizo, y el glow que solo el jugador lleva.
9. **Sesenta fps con diez enemigos y seis torpedos en pantalla.** Ninguna skin agrega una sombra: siguen siendo cinco por frame como techo.
10. Nada fuera de `lib/games/abismo/engine.ts` y `specs/skins/abismo/` cambia.

## Decisiones

**`retro` usa el mismo fósforo verde que TETRIS, no ámbar.** Un `retro` ámbar para el juego del mar y un `retro` verde para Tetris serían dos skins distintas con el mismo nombre, y el botón del HUD dejaría de significar algo estable. Los cuatro escalones (`#a0ffa0` · `#00da00` · `#00ae00` · `#008a00`) se reusan tal cual de `specs/skins/tetris/02-diseno.md`, ya medidos. Que el verde de sonar sea además lo que un submarino ve por su pantalla es una coincidencia que no se desaprovecha.

**El segundo eje de `retro` es relleno macizo contra contorno, y va solo en el submarino enemigo.** Se evaluó y se descartó darle contorno también al tiburón: su silueta —morro, dentado de aletas, dorsal— no se parece a nada más en pantalla, y hueco perdería justamente el peso visual que lo hace leerse como amenaza. El eje se gasta donde hace falta: dos elipses con torreta y hélice, de 56×26 y 58×24, cruzándose a 200 px/s.

**Los torpedos heredan la luminancia de quien los disparó, en las tres skins.** Es una regla y no una coincidencia: el jugador no tiene que aprender un cuarto color, y con eso el par torpedo-propio ↔ torpedo-enemigo queda resuelto por el mismo reparto que resuelve el par submarino ↔ submarino-enemigo.

**En `neon` el enemigo es el más brillante y el jugador el anteúltimo.** Es contraintuitivo y es deliberado: el presupuesto del SPEC 10 le da glow al jugador y a los buzos, y se lo prohíbe a los enemigos, que pueden ser diez. Quien tiene glow puede permitirse menos luminancia bruta; quien no lo tiene se la compra. El resultado es que los cuatro escalones caen casi solos.

**En `neon` los cuatro matices se corren de su token, pero ninguno cambia de familia.** El magenta pasa de `#ff006e` a `#ff58a3`, el verde de `#00ff88` a `#00d676`, el amarillo de `#f5ff00` a `#e6f000` y el gris de `#8a8fb5` a `#6e7396`. Es el precio de meter cuatro entidades en cuatro escalones de 1.5:1 dentro de un rango que va de 4.5 a 21. Se eligió correr los hex antes que reasignar matices: la regla de lectura del SPEC 10 sobrevive intacta.

**Las luces de bodega se invierten en `retro`.** El casco pasa a ser lo más claro de la pantalla, así que una luz clara adentro sería invisible. La plaza **ocupada** pasa a ser el punto oscuro (L1, 3.73:1 contra el casco) y la vacía apenas se insinúa. Se conserva lo que el jugador lee —cuántos puntos nítidos hay— y se invierte el signo, que es lo único que el fondo permite.

**El lecho marino, el degradado, la banda de aire y las burbujas se tratan como decoración, sin piso de contraste.** El lecho es el caso discutible: parece estructura. No lo es — el comentario del motor lo dice: «No colisiona con nada; el submarino ya está topeado antes por `SUB_MAX_Y`». Ninguna decisión del jugador depende de verlo. Forzarlo a 3:1 lo pondría a competir con las entidades por la atención, que es lo contrario de lo que un fondo hace.

**Una sola skin sube de radio de glow y ninguna agrega una sombra.** `neon` va a 16 / 14 / 12 y `retro` a 0 / 0 / 0. El presupuesto de cinco sombras por frame es el mismo en las tres: lo que varía es el radio, no la cuenta.

**`clasico` conserva sus dos pares por debajo del piso.** Ya está argumentado arriba y vuelve a aparecer en `## Lo que no entra`. Es la regla más fuerte de este trabajo: si introducir skins cambia lo que ya se veía, el trabajo está mal, aunque se vea mejor.

**El error de tipos se cierra con la implementación real y no con un no-op.** El no-op está autorizado por el SPEC 11 y habría dejado `main` compilando en un commit de una línea. Se descarta: el motivo por el que este spec existe es que `abismo` tenga skins, y un no-op sería deuda disfrazada de arreglo.

## Riesgos

**Que `clasico` cambie sin que nadie lo note.** Es el riesgo principal y la mitigación es mecánica: los quince hex y los tres radios se mueven por copia, y el paso 2 se cierra con el juego viéndose igual antes de que exista una segunda paleta. La captura de `clasico` contra el estado previo es el criterio 1.

**Que un `COLOR_*` quede huérfano y siga usándose.** Lo agarra `eslint` con `no-unused-vars` si sobra, y `tsc` si falta. Los catorce puntos de uso están enumerados en el paso 2 y en `01-auditoria.md`.

**Que el contorno del submarino enemigo se lea peor que el macizo en movimiento.** Un `lineWidth` de 2 px sobre un óvalo de 58×24 a 260 px/s en el nivel 9 es poca tinta. Mitigación: la luminancia lo cubre igual (7.05:1, a 1.52:1 del tiburón y a 2.45:1 del jugador), así que el contorno es el segundo eje y no el único. Si en la verificación visual se lee flaco, el ajuste es subir `HOLLOW_LINE_WIDTH` a 3 — un número, no un rediseño.

**Que `retro` se vuelva ilegible con el marco CRT de `<Reproductor>` encima.** El scanline y el viñeteado del reproductor bajan el contraste efectivo sobre el negro. Por eso el escalón más oscuro está en 4.64:1 y no pegado a 4.50, y por eso `retro` no lleva glow: el halo lo pone el marco.

**Que el archivo se vuelva más difícil de leer.** El motor pasa de quince constantes con nombre a un record de tres entradas de diecinueve campos. Es el mismo movimiento que hizo `tetris` en el SPEC 11 y el resultado ahí fue más legible, no menos: el diff de una skin queda contenido en su bloque.

## Lo que **no** entra en esta spec

- **Los dos pares de `clasico` por debajo de 1.5:1** —el jugador contra el tiburón (1.22:1) y el buzo contra el submarino enemigo (1.23:1)—. El segundo es el que de verdad molesta: verde contra amarillo es justo el par que la deuteranopía borra. Se deja igual porque `clasico` se extrae y no se diseña; el jugador que lo necesite tiene `neon` y `retro` a un botón de distancia. Si en algún momento se decide que la accesibilidad gana sobre la fidelidad, es su propio spec y su propia discusión.
- **Las skins de `asteroides`, `arkanoid` y `snake`.** Tres corridas más del agente `skin-designer`, una por juego. Su paleta actual ya está ubicada con archivo y línea en `01-auditoria.md`.
- **Un preview de la skin en la biblioteca o en la ficha del juego.** Hoy la skin solo se ve jugando. Las portadas son arte en CSS puro y no saben nada de la paleta del motor.
- **Que la skin del portal (el marco CRT, el HUD, los colores de `<Reproductor>`) acompañe a la del juego.** Hoy el marco es siempre el mismo y el `retro` verde convive con un HUD cian. Es defendible que se vea raro y es un spec aparte, porque toca `app/globals.css` y el reproductor entero.
- **Una migración, una columna o un `npm run db:types`.** Las skins no tocan Postgres.
