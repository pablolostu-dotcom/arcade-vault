# Diseño de las tres skins de ABISMO

> **Fecha:** 2026-09-18
> **Juego:** `abismo`
> **Piso de contraste:** información ≥ 4.5:1, estructural ≥ 3:1, entidades a distinguir ≥ 1.5:1 entre sí, todo contra `#000`.

## La aritmética que se usa acá

Contra el negro del canvas (`L₂ = 0`) el ratio de WCAG se reduce a **`r = 20·L + 1`**.

De ahí sale el atajo que este documento usa todo el tiempo: como `L + 0.05 = r / 20`, **el contraste entre dos colores es el cociente de sus ratios contra negro**. Decir «el buzo y el submarino enemigo están a 1.55 entre sí» es decir `16.83 / 10.88`.

Para los colores con alpha —la banda de aire, el lecho, las burbujas, la bodega vacía— el compuesto sobre negro es `canal × alpha`, que es lo que el script calcula.

Los números salen de un script descartable en el scratchpad de la sesión, no de una estimación a ojo.

## Qué cuenta como información en ABISMO

El SPEC 10 dejó escrito el código de color como **la regla de lectura del juego**: _magenta sos vos, amarillo te mata, verde se salva, gris te muerde_. Eso define exactamente qué elementos portan información y tienen que cruzar 4.5:1:

- el **submarino del jugador** (y su casco en alarma),
- los **buzos**,
- el **tiburón**,
- el **submarino enemigo**,
- los **dos torpedos**,
- la **línea de agua**, que es donde se respira y donde se cobra.

Lo demás es **decoración y no tiene piso**: el degradado del agua, la banda de aire, las cuarenta burbujas y la silueta del lecho marino. El lecho en particular **no colisiona con nada** —el submarino ya está topeado antes por `SUB_MAX_Y`, y el comentario del motor lo dice—, así que no es estructura que guíe una decisión: es fondo.

Las **luces de bodega** son un caso aparte: se dibujan **dentro del casco**, no sobre el fondo, así que su contraste se mide contra el casco y no contra negro.

## Los pares que hay que poder distinguir

Cinco entidades, y los torpedos heredan la luminancia de quien los dispara, así que son cuatro niveles los que hay que repartir. El máximo contra negro es 21:1 y el piso 4.5:1, o sea que caben exactamente cuatro escalones de 1.5 (`4.5 × 1.5³ = 15.19 ≤ 21`) y **no cinco** (`4.5 × 1.5⁴ = 22.78 > 21`). Cuatro entidades, cuatro escalones: entra justo.

| Par                              | Por qué importa                                      |
| -------------------------------- | ---------------------------------------------------- |
| submarino ↔ tiburón              | el que te muerde                                     |
| submarino ↔ submarino enemigo    | **silueta casi idéntica**: elipse + torreta + hélice |
| buzo ↔ submarino enemigo         | el premio contra el que dispara                      |
| buzo ↔ tiburón                   | el premio contra el que muerde                       |
| submarino enemigo ↔ tiburón      | uno dispara y el otro no: se esquivan distinto       |
| torpedo propio ↔ torpedo enemigo | dos rectángulos de 4 px de alto, 18 px contra 14     |

---

## `clasico` — extraída, no diseñada

Es **exactamente** lo que el motor pinta hoy. Los quince `COLOR_*` y los tres `GLOW_*` de las líneas 171–194, movidos de constantes sueltas a una entrada del record `SKINS`. Cero correcciones.

| Elemento          | Color                       | Origen              | Ratio   | `shadowBlur` |
| ----------------- | --------------------------- | ------------------- | ------- | ------------ |
| agua arriba       | `#001018`                   | fuera de tokens     | 1.09:1  | no           |
| abismo            | `#000000`                   | negro               | 1.00:1  | no           |
| banda de aire     | `rgba(0, 245, 255, 0.06)`   | `--cyan` al 6 %     | 1.07:1  | no           |
| línea de agua     | `#00f5ff`                   | `--cyan`            | 15.50:1 | **10**       |
| lecho marino      | `rgba(138, 143, 181, 0.18)` | `--ink-dim` al 18 % | 1.21:1  | no           |
| burbujas (×40)    | `rgba(0, 245, 255, 0.10)`   | `--cyan` al 10 %    | 1.15:1  | no           |
| submarino         | `#ff006e`                   | `--magenta`         | 5.48:1  | **12**       |
| casco en alarma   | `#ffa8c8`                   | magenta al blanco   | 11.69:1 | **12**       |
| bodega ocupada    | `#00ff88`                   | `--green`           | 15.66:1 | no           |
| bodega vacía      | `rgba(0, 255, 136, 0.18)`   | `--green` al 18 %   | 1.40:1  | no           |
| buzo (≤3)         | `#00ff88`                   | `--green`           | 15.66:1 | **8**        |
| torpedo propio    | `#ff006e`                   | `--magenta`         | 5.48:1  | no           |
| tiburón           | `#8a8fb5`                   | `--ink-dim`         | 6.68:1  | no           |
| submarino enemigo | `#f5ff00`                   | `--yellow`          | 19.19:1 | no           |
| torpedo enemigo   | `#f5ff00`                   | `--yellow`          | 19.19:1 | no           |

**Los siete elementos que portan información cruzan 4.5:1.** Lo que no cruza es la separación entre dos pares:

| Par                              | Separación |                   |
| -------------------------------- | ---------- | ----------------- |
| submarino ↔ tiburón              | **1.22:1** | por debajo de 1.5 |
| submarino ↔ submarino enemigo    | 3.50:1     | OK                |
| submarino ↔ buzo                 | 2.86:1     | OK                |
| buzo ↔ tiburón                   | 2.35:1     | OK                |
| buzo ↔ submarino enemigo         | **1.23:1** | por debajo de 1.5 |
| submarino enemigo ↔ tiburón      | 2.87:1     | OK                |
| torpedo propio ↔ torpedo enemigo | 3.50:1     | OK                |

**Los dos pares en negrita se dejan como están.** Magenta contra gris y verde contra amarillo se distinguen hoy **solo por matiz**, y para un jugador con deuteranopía o protanopía el par verde/amarillo es el que más cuesta. Corregirlo cambiaría lo que el jugador ya conoce, que es el criterio de fracaso de esta corrida. Va a `## Lo que no entra` del spec, y **`neon` y `retro` lo resuelven cada una por su lado** — que es, en el fondo, el mejor argumento para que existan.

---

## `neon` — los cuatro matices del código de color, sobre una rampa de luminancia

La identidad de matiz se conserva entera: **magenta sos vos, amarillo te mata, verde se salva, gris te muerde**. Cambiar un matiz obligaría al jugador a reaprender la regla de lectura al tocar un botón del HUD, y eso no es una skin: es otro juego.

Lo que `neon` sí hace es poner los cuatro matices en **cuatro escalones de luminancia separados por ≥1.5**, que es lo que `clasico` no tiene:

| Escalón | Ratio   | Entidad                            | Por qué ahí                                                   |
| ------- | ------- | ---------------------------------- | ------------------------------------------------------------- |
| L4      | 16.83:1 | submarino enemigo + su torpedo     | es el que **no lleva glow** y tiene que gritar por luminancia |
| L3      | 10.88:1 | buzo                               | lleva `shadowBlur 12`, que le suma presencia sin subir el hex |
| L2      | 7.18:1  | submarino del jugador + su torpedo | lleva `shadowBlur 16`, el más alto de la skin                 |
| L1      | 4.56:1  | tiburón                            | la silueta que **no brilla**, tal como la definió el SPEC 10  |

El reparto no es arbitrario: **quien lleva glow puede permitirse menos luminancia bruta**. El jugador y los buzos son los dos únicos elementos con `shadowBlur` en el presupuesto del SPEC 10, y son justamente los dos que ocupan los escalones intermedios. Los enemigos, que tienen prohibido el glow porque pueden ser diez, se compran su visibilidad con luminancia.

| Elemento          | Color                       | Origen                             | Ratio   | `shadowBlur` |
| ----------------- | --------------------------- | ---------------------------------- | ------- | ------------ |
| agua arriba       | `#001b2b`                   | `#001018` saturado hacia el cian   | 1.19:1  | no           |
| abismo            | `#000000`                   | negro                              | 1.00:1  | no           |
| banda de aire     | `rgba(0, 245, 255, 0.10)`   | `--cyan` al 10 %                   | 1.15:1  | no           |
| línea de agua     | `#00f5ff`                   | `--cyan`                           | 15.50:1 | **14**       |
| lecho marino      | `rgba(138, 143, 181, 0.30)` | `--ink-dim` al 30 %                | 1.49:1  | no           |
| burbujas (×40)    | `rgba(0, 245, 255, 0.16)`   | `--cyan` al 16 %                   | 1.32:1  | no           |
| submarino         | `#ff58a3`                   | `--magenta` aclarado al escalón L2 | 7.18:1  | **16**       |
| casco en alarma   | `#ffd6e8`                   | el mismo magenta casi al blanco    | 16.04:1 | **16**       |
| bodega ocupada    | `#00ff88`                   | `--green`                          | 15.66:1 | no           |
| bodega vacía      | `rgba(0, 255, 136, 0.22)`   | `--green` al 22 %                  | 1.59:1  | no           |
| buzo (≤3)         | `#00d676`                   | `--green` bajado al escalón L3     | 10.88:1 | **12**       |
| torpedo propio    | `#ff58a3`                   | el color del casco                 | 7.18:1  | no           |
| tiburón           | `#6e7396`                   | `--ink-dim` bajado al escalón L1   | 4.56:1  | no           |
| submarino enemigo | `#e6f000`                   | `--yellow` bajado al escalón L4    | 16.83:1 | no           |
| torpedo enemigo   | `#e6f000`                   | el color de quien lo dispara       | 16.83:1 | no           |

Separación entre entidades — **los siete pares por encima de 1.5**:

| Par                              | Separación |
| -------------------------------- | ---------- |
| submarino ↔ tiburón              | 1.58:1     |
| submarino ↔ submarino enemigo    | 2.34:1     |
| submarino ↔ buzo                 | 1.52:1     |
| buzo ↔ tiburón                   | 2.39:1     |
| buzo ↔ submarino enemigo         | 1.55:1     |
| submarino enemigo ↔ tiburón      | 3.69:1     |
| torpedo propio ↔ torpedo enemigo | 2.34:1     |

Y los siete elementos de información cruzan 4.5:1: 15.50 · 7.18 · 16.04 · 10.88 · 7.18 · 4.56 · 16.83.

La luz de bodega ocupada queda a **2.18:1** del casco (`15.66 / 7.18`), así que las seis plazas se siguen leyendo adentro del submarino.

### Los tres `shadowBlur` de `neon`

`12 → 16` en el casco, `10 → 14` en la línea de agua, `8 → 12` en los buzos. **El presupuesto no se mueve**: siguen siendo las mismas cinco sombras por frame como techo (1 casco + 1 línea de agua + 3 buzos). Subir el radio no cuesta más sombras; cuesta un poco más de fill rate en cinco elementos, que es exactamente lo que el SPEC 10 dejó autorizado.

---

## `retro` — fósforo verde y la lectura reconstruida en luminancia

Un solo matiz. El verde P1, el mismo que estrenó `retro` en TETRIS (`specs/skins/tetris/02-diseno.md`): `retro` tiene que leerse como **la misma skin del vault** en los cinco juegos, no como un tema distinto por juego. Que un submarino en fósforo verde sea, además, exactamente lo que un sonar dibuja en una pantalla, es un regalo del tema.

Con un solo matiz, la regla de lectura del SPEC 10 —_magenta sos vos, amarillo te mata, verde se salva, gris te muerde_— se pierde entera y hay que **reconstruirla con otra cosa**. Tres ejes:

1. **Luminancia** — los mismos cuatro escalones de fósforo que TETRIS, ya medidos: `#a0ffa0` 17.31 · `#00da00` 11.03 · `#00ae00` 7.05 · `#008a00` 4.64, con ≥1.5 entre vecinos y el más oscuro todavía por encima de 4.5.
2. **Relleno contra contorno** — el par imposible de resolver con luminancia sola.
3. **Silueta** — la que el motor ya dibuja y ninguna skin toca.

### El par que obliga al segundo eje

El submarino del jugador y el submarino enemigo tienen **la misma silueta**: una elipse, una torreta rectangular arriba y una aleta de hélice atrás (líneas 915–925 contra 1005–1010). En `clasico` y en `neon` los separa el matiz —magenta contra amarillo— y con eso alcanza. En monocromo no queda nada: dos elipses verdes de 56×26 y 58×24 a distintas luminancias, cruzándose a 200 px/s, son el mismo objeto.

La salida es el segundo eje: **el submarino enemigo se dibuja de contorno y el del jugador macizo.** Un campo `esubHollow` de la paleta, `false` en `clasico` y `neon`, `true` en `retro`; el motor cambia `fill()` por `stroke()` con `lineWidth = 2`. Es el mismo mecanismo con el que TETRIS resolvió sus ocho piezas —cuatro luminancias por dos tratamientos de relleno— y **es el único cambio de dibujo que esta corrida le hace al motor**.

Con eso el par queda separado por tres cosas a la vez: 2.45:1 de luminancia, macizo contra hueco, y el glow que solo el jugador lleva.

### El reparto

| Escalón | Ratio   | Entidad                                           | Relleno   | Lectura                     |
| ------- | ------- | ------------------------------------------------- | --------- | --------------------------- |
| L4      | 17.31:1 | submarino del jugador + su torpedo, línea de agua | macizo    | «sos vos, y ahí se respira» |
| L3      | 11.03:1 | buzo                                              | macizo    | «esto se salva»             |
| L2      | 7.05:1  | submarino enemigo + su torpedo                    | **hueco** | «esto te dispara»           |
| L1      | 4.64:1  | tiburón                                           | macizo    | «esto te muerde»            |

**Cuanto más brillante, más tuyo.** Es la regla de lectura de `retro` y se aprende igual de rápido que la del color: el jugador es lo más blanco de la pantalla, el premio viene después, y los dos enemigos son las dos siluetas apagadas — la hueca dispara, la maciza muerde.

Los torpedos **heredan la luminancia de quien los disparó**: L4 el propio, L2 el enemigo, 2.45:1 entre sí. Un rectángulo de 4 px de alto no admite contorno, así que ahí el único eje disponible es la luminancia y alcanza de sobra.

La línea de agua comparte el escalón L4 con el jugador. No hay confusión posible: es una franja de 2 px que cruza los 800 px de ancho a una `y` fija, no una entidad que se mueva.

| Elemento          | Color                       | Origen                               | Ratio   | `shadowBlur` |
| ----------------- | --------------------------- | ------------------------------------ | ------- | ------------ |
| agua arriba       | `#001400`                   | fósforo al mínimo                    | 1.10:1  | no           |
| abismo            | `#000000`                   | negro                                | 1.00:1  | no           |
| banda de aire     | `rgba(160, 255, 160, 0.06)` | L4 al 6 %                            | 1.09:1  | no           |
| línea de agua     | `#a0ffa0`                   | L4                                   | 17.31:1 | **0**        |
| lecho marino      | `rgba(0, 218, 0, 0.18)`     | L3 al 18 %                           | 1.29:1  | no           |
| burbujas (×40)    | `rgba(160, 255, 160, 0.08)` | L4 al 8 %                            | 1.13:1  | no           |
| submarino         | `#a0ffa0`                   | L4                                   | 17.31:1 | **0**        |
| casco en alarma   | `#e2ffe2`                   | L4 casi al blanco                    | 19.64:1 | **0**        |
| bodega ocupada    | `#008a00`                   | L1 — **oscuro sobre el casco claro** | 4.64:1  | no           |
| bodega vacía      | `rgba(0, 60, 0, 0.35)`      | L1 apenas insinuado                  | 1.11:1  | no           |
| buzo (≤3)         | `#00da00`                   | L3                                   | 11.03:1 | **0**        |
| torpedo propio    | `#a0ffa0`                   | L4, el del casco                     | 17.31:1 | no           |
| tiburón           | `#008a00`                   | L1, macizo                           | 4.64:1  | no           |
| submarino enemigo | `#00ae00`                   | L2, **hueco**                        | 7.05:1  | no           |
| torpedo enemigo   | `#00ae00`                   | L2, el de quien lo dispara           | 7.05:1  | no           |

Separación entre entidades — **los siete pares por encima de 1.5**:

| Par                              | Separación | Además                      |
| -------------------------------- | ---------- | --------------------------- |
| submarino ↔ tiburón              | 3.73:1     | silueta                     |
| submarino ↔ submarino enemigo    | 2.45:1     | **macizo contra hueco**     |
| submarino ↔ buzo                 | 1.57:1     | tamaño (56×26 contra 16×22) |
| buzo ↔ tiburón                   | 2.38:1     | silueta                     |
| buzo ↔ submarino enemigo         | 1.56:1     | macizo contra hueco         |
| submarino enemigo ↔ tiburón      | 1.52:1     | macizo contra hueco         |
| torpedo propio ↔ torpedo enemigo | 2.45:1     | largo (18 px contra 14 px)  |

### Las dos inversiones de `retro`

Dos elementos **invierten su dirección** respecto de `clasico`, y las dos son consecuencia de la misma decisión:

- **Las luces de bodega.** En `clasico` el casco es magenta oscuro y las luces ocupadas verdes brillantes: la plaza llena es lo que brilla. En `retro` el casco es lo más brillante de la pantalla, así que una luz clara adentro sería invisible. Se invierte: **la plaza ocupada es un punto oscuro** (L1, 3.73:1 contra el casco) y la vacía apenas se insinúa. La lectura «cuántos puntos nítidos veo» se conserva; lo que cambia es el signo.
- **La alarma de oxígeno.** En `clasico` el casco vira de magenta a `#ffa8c8`, o sea que **sube** de brillo (5.48 → 11.69). En `retro` el casco ya está en L4, así que sube lo que queda: a `#e2ffe2`, 19.64:1. La dirección es la misma —el parpadeo aclara— y eso es lo que importa: el jugador ya tiene entrenado que «se pone más blanco» significa «te queda poco aire».

### `shadowBlur 0` en las tres

`retro` no lleva glow, siguiendo el precedente del SPEC 11: **el halo del fósforo ya lo pone el marco CRT de `<Reproductor>`**, y un `shadowBlur` encima lo duplica y embarra el verde. Con 17.31:1 sobre negro, el casco y la línea de agua no necesitan ayuda para verse.

---

## El bloque de constantes, listo para pegar

```ts
type AbismoPalette = {
  /** El tope del degradado de agua, justo bajo la línea de superficie. */
  deepTop: string;
  /** El fondo del degradado: el abismo. */
  deepBottom: string;
  /** La banda de aire sobre SURFACE_Y. */
  air: string;
  /** La línea de agua: donde se respira y donde se cobra. */
  surface: string;
  /** La silueta del lecho marino. Decoración: no colisiona con nada. */
  seabed: string;
  /** Las BUBBLE_COUNT burbujas de fondo. */
  bubble: string;
  /** El casco del jugador. */
  sub: string;
  /** El casco parpadeando con el tanque por debajo de TANK_ALARM_S. */
  subAlarm: string;
  /** Una luz de bodega ocupada. Va SOBRE el casco, no sobre el fondo. */
  cargoOn: string;
  /** Una plaza de bodega vacía. */
  cargoOff: string;
  /** Los buzos. */
  diver: string;
  /** El torpedo del jugador. */
  torpedo: string;
  /** El tiburón. */
  shark: string;
  /** El submarino enemigo. */
  esub: string;
  /** El torpedo del submarino enemigo. */
  eTorpedo: string;
  /**
   * `true` ⇒ el submarino enemigo se dibuja de contorno en vez de macizo.
   *
   * Es el segundo eje que hace posible `retro`: el submarino enemigo comparte
   * silueta con el del jugador —elipse, torreta y hélice—, y en monocromo la
   * luminancia sola no alcanza para separarlos a 200 px/s.
   */
  esubHollow: boolean;
  /** shadowBlur del casco. 0 ⇒ sin glow. */
  glowSub: number;
  /** shadowBlur de la línea de agua. */
  glowSurface: number;
  /** shadowBlur de los buzos. */
  glowDiver: number;
};

/** El ancho del contorno cuando `esubHollow` está en true. */
const HOLLOW_LINE_WIDTH = 2;

const SKINS: Record<SkinId, AbismoPalette> = {
  // Extraída literal del motor previo al SPEC 12: los quince COLOR_* y los tres
  // GLOW_* de las líneas 171–194, sin tocar un matiz. Dos pares de entidades se
  // distinguen acá SOLO por matiz —el jugador del tiburón (1.22:1) y el buzo
  // del submarino enemigo (1.23:1)— y se dejan así a propósito: corregirlos
  // cambiaría lo que el jugador ya conoce. `neon` y `retro` los resuelven.
  clasico: {
    deepTop: "#001018",
    deepBottom: "#000000",
    air: "rgba(0, 245, 255, 0.06)",
    surface: "#00f5ff", // --cyan          15.50:1
    seabed: "rgba(138, 143, 181, 0.18)",
    bubble: "rgba(0, 245, 255, 0.10)",
    sub: "#ff006e", // --magenta            5.48:1
    subAlarm: "#ffa8c8", //                11.69:1
    cargoOn: "#00ff88", // --green         15.66:1
    cargoOff: "rgba(0, 255, 136, 0.18)",
    diver: "#00ff88", // --green           15.66:1
    torpedo: "#ff006e", // --magenta        5.48:1
    shark: "#8a8fb5", // --ink-dim          6.68:1
    esub: "#f5ff00", // --yellow           19.19:1
    eTorpedo: "#f5ff00", // --yellow       19.19:1
    esubHollow: false,
    glowSub: 12,
    glowSurface: 10,
    glowDiver: 8,
  },
  // Los cuatro matices del código de color del SPEC 10, repartidos en cuatro
  // escalones de luminancia separados por ≥1.5:1. Quien lleva glow —el jugador
  // y los buzos— ocupa los escalones del medio; los enemigos, que lo tienen
  // prohibido porque pueden ser diez, se compran la visibilidad con luminancia.
  neon: {
    deepTop: "#001b2b",
    deepBottom: "#000000",
    air: "rgba(0, 245, 255, 0.10)",
    surface: "#00f5ff", // --cyan          15.50:1
    seabed: "rgba(138, 143, 181, 0.30)",
    bubble: "rgba(0, 245, 255, 0.16)",
    sub: "#ff58a3", // magenta L2           7.18:1
    subAlarm: "#ffd6e8", //                16.04:1
    cargoOn: "#00ff88", // --green         15.66:1  (2.18:1 contra el casco)
    cargoOff: "rgba(0, 255, 136, 0.22)",
    diver: "#00d676", // verde L3          10.88:1
    torpedo: "#ff58a3", // el del casco     7.18:1
    shark: "#6e7396", // gris L1            4.56:1
    esub: "#e6f000", // amarillo L4        16.83:1
    eTorpedo: "#e6f000", //                16.83:1
    esubHollow: false,
    glowSub: 16,
    glowSurface: 14,
    glowDiver: 12,
  },
  // Fósforo verde P1, el mismo que el `retro` de TETRIS: la skin tiene que
  // leerse igual en los cinco juegos. Cuatro luminancias —17.31 / 11.03 / 7.05
  // / 4.64— por dos tratamientos de relleno. Cuanto más brillante, más tuyo.
  retro: {
    deepTop: "#001400",
    deepBottom: "#000000",
    air: "rgba(160, 255, 160, 0.06)",
    surface: "#a0ffa0", // L4              17.31:1
    seabed: "rgba(0, 218, 0, 0.18)",
    bubble: "rgba(160, 255, 160, 0.08)",
    sub: "#a0ffa0", // L4                  17.31:1
    subAlarm: "#e2ffe2", //                19.64:1
    // Invertido respecto de las otras dos: el casco es lo más claro de la
    // pantalla, así que la plaza OCUPADA es el punto oscuro (3.73:1 contra él).
    cargoOn: "#008a00", // L1               4.64:1
    cargoOff: "rgba(0, 60, 0, 0.35)",
    diver: "#00da00", // L3                11.03:1
    torpedo: "#a0ffa0", // L4, el del casco 17.31:1
    shark: "#008a00", // L1, macizo         4.64:1
    esub: "#00ae00", // L2, HUECO           7.05:1
    eTorpedo: "#00ae00", // L2              7.05:1
    esubHollow: true,
    // Sin glow: el halo del fósforo ya lo pone el marco CRT de <Reproductor>.
    glowSub: 0,
    glowSurface: 0,
    glowDiver: 0,
  },
};
```

## Lo que este diseño NO cambia del motor

- **El presupuesto de sombras del SPEC 10.** Cinco por frame como techo, y nunca en enemigos, torpedos ni burbujas. Lo único que varía por skin es el radio de esas cinco.
- **Las siluetas.** Ningún vértice del tiburón, del casco ni del buzo se mueve.
- **El balance.** Ni una constante de velocidad, de puntaje, de oxígeno o de aparición.
- **El parpadeo del respawn**, que es `alpha` y no color (línea 899): es deliberado que no se confunda con la alarma, y sigue igual en las tres skins.
