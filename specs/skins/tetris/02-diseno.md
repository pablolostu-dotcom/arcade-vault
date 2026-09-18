# Diseño de las tres skins de TETRIS

> **Fecha:** 2026-09-18
> **Juego:** `tetris`
> **Piso de contraste:** información ≥ 4.5:1, estructural ≥ 3:1, entidades a distinguir ≥ 1.5:1 entre sí, todo contra `#000`.

## La aritmética que se usa acá

Contra el negro del canvas (`L₂ = 0`) el ratio de WCAG se reduce a **`r = 20·L + 1`**.

De ahí sale un atajo que este documento usa todo el tiempo: como `L + 0.05 = r / 20`, **el contraste entre dos colores es el cociente de sus ratios contra negro**. Decir «S y N están a 1.16 entre sí» es decir `15.66 / 13.53`.

Los números salen de un script descartable en el scratchpad de la sesión, no de una estimación a ojo.

---

## `clasico` — extraída, no diseñada

Es **exactamente** lo que el motor pinta hoy. Los ocho hex de `COLORS` (líneas 51–61), el `GRID_LINE`, el `HIGHLIGHT`, el `GHOST_ALPHA` y el `#000` de la línea 369, movidos de constantes sueltas a una entrada del record `SKINS`. Cero correcciones.

| Elemento   | Color                       | Origen             | Ratio                   | `shadowBlur` |
| ---------- | --------------------------- | ------------------ | ----------------------- | ------------ |
| fondo      | `#000`                      | literal, línea 369 | 1.00:1                  | no           |
| I          | `#00f5ff`                   | `--cyan`           | 15.50:1                 | no           |
| O          | `#f5ff00`                   | `--yellow`         | 19.19:1                 | no           |
| T          | `#aa00ff`                   | fuera de tokens    | **4.15:1**              | no           |
| S          | `#00ff88`                   | `--green`          | 15.66:1                 | no           |
| Z          | `#ff006e`                   | `--magenta`        | 5.48:1                  | no           |
| J          | `#00a2ff`                   | fuera de tokens    | 7.61:1                  | no           |
| L          | `#ff7700`                   | fuera de tokens    | 7.89:1                  | no           |
| N (tuerca) | `#8a8fb5`                   | `--ink-dim`        | 6.68:1                  | no           |
| grilla     | `rgba(0, 245, 255, 0.08)`   | `--cyan` al 8 %    | **1.11:1**              | no           |
| brillo     | `rgba(255, 255, 255, 0.12)` | blanco al 12 %     | n/a (va sobre la pieza) | no           |
| fantasma   | la pieza a `alpha = 0.2`    | —                  | n/a                     | no           |

**Los dos números en negrita están por debajo del piso y se dejan así.** Corregirlos sería cambiar lo que el jugador ya vio, que es el criterio de fracaso de esta corrida. Van a `## Lo que no entra`.

---

## `neon` — los ocho matices, saturados y con glow

La identidad de cada pieza se conserva (I cian, O amarillo, T violeta, S verde, Z magenta, J azul, L naranja, N metal): cambiar de matiz reasignaría las piezas y el jugador perdería la lectura que trae de `clasico`. Lo que cambia es la **saturación**, el **brillo** de los tres que estaban apagados, y el **glow**.

| Elemento   | Color                       | Origen                                | Ratio   | `shadowBlur`                              |
| ---------- | --------------------------- | ------------------------------------- | ------- | ----------------------------------------- |
| fondo      | `#000`                      | igual que `clasico`                   | 1.00:1  | no                                        |
| I          | `#00f5ff`                   | `--cyan`                              | 15.50:1 | solo si es la pieza activa o la siguiente |
| O          | `#f5ff00`                   | `--yellow`                            | 19.19:1 | ídem                                      |
| T          | `#c04dff`                   | `#aa00ff` aclarado hasta cruzar 4.5:1 | 5.75:1  | ídem                                      |
| S          | `#00ff88`                   | `--green`                             | 15.66:1 | ídem                                      |
| Z          | `#ff006e`                   | `--magenta`                           | 5.48:1  | ídem                                      |
| J          | `#00b4ff`                   | `#00a2ff` subido de brillo            | 8.97:1  | ídem                                      |
| L          | `#ff9100`                   | `#ff7700` subido de brillo            | 9.30:1  | ídem                                      |
| N (tuerca) | `#c7d0e0`                   | `--silver`                            | 13.53:1 | ídem                                      |
| fantasma   | contorno `#00686d`          | `--cyan` bajado a ~3:1                | 3.20:1  | no                                        |
| grilla     | `rgba(0, 245, 255, 0.16)`   | `--cyan` al 16 %                      | 1.32:1  | no                                        |
| brillo     | `rgba(255, 255, 255, 0.22)` | blanco al 22 %                        | n/a     | no                                        |

**Las ocho piezas cruzan el piso de 4.5:1.** El único que estaba abajo en `clasico` —el violeta de la T— se aclara a `#c04dff` sin salirse de su matiz.

### Dónde va el glow y dónde no

`shadowBlur = 14`, el mismo número que `arkanoid` usa para la pala y la pelota, y **solo en la pieza activa y en la pieza siguiente**. Nunca en los bloques asentados, ni en el fantasma, ni en la grilla.

El motivo es de presupuesto por frame: un tablero lleno son 200 celdas. El propio `arkanoid` deja escrito en su línea 465 que «`shadowBlur` por frame se comen los 60 fps». Con esta regla el máximo son 16 sombras por frame (la tuerca ocupa 8 celdas, y hay una activa y una siguiente), y ésas son justamente las dos cosas que el jugador está mirando.

### Los pares que comparten banda de luminancia

Nueve pares de piezas quedan por debajo de 1.5:1 entre sí:

| Par   | Cociente | Par   | Cociente |
| ----- | -------- | ----- | -------- |
| S / I | 1.01     | N / L | 1.45     |
| L / J | 1.04     | O / S | 1.23     |
| T / Z | 1.05     | O / I | 1.24     |
| I / N | 1.15     | O / N | 1.42     |
| S / N | 1.16     |       |          |

**No es un defecto del diseño: es imposible que no ocurra.** Ocho entidades con saltos de 1.5:1 sobre un piso de 4.5:1 exigen `4.5 × 1.5⁷ = 76.89:1`, y el máximo alcanzable contra `#000` es `21:1`. Con ocho piezas no hay paleta que cumpla.

Lo que resuelve la distinción en `neon` es lo mismo que la resuelve en cualquier Tetris: **la forma**. Una I es cuatro celdas en línea, una S es un zigzag, la tuerca es un anillo 3×3 — y el jugador manipula una pieza por vez. El color es identidad, no el canal por el que se juega. La regla de 1.5:1 existe para el caso en que el matiz **no** distingue, y ese caso es `retro`, donde sí se cumple entero.

---

## `retro` — fósforo verde, la información en luminancia

Un solo matiz. Ocho piezas que en color se distinguían por matiz colapsarían a una mancha verde, así que la distinción se reconstruye con **dos ejes**:

1. **Cuatro luminancias**, escalonadas con ≥ 1.5:1 entre vecinas.
2. **Dos tratamientos de relleno**: bloque sólido y **anillo hueco** (el bloque con el centro vacío, un marco de `size/6` de espesor).

4 × 2 = 8 combinaciones, y cada pieza ocupa una. Esto es lo que el brief llama «relleno contra contorno», y es la única salida: la rampa de luminancia sola no llega a ocho escalones.

### La rampa

| Nivel | Color     | Ratio contra `#000` |
| ----- | --------- | ------------------- |
| L4    | `#a0ffa0` | 17.31:1             |
| L3    | `#00da00` | 11.03:1             |
| L2    | `#00ae00` | 7.05:1              |
| L1    | `#008a00` | 4.64:1              |

Los seis pares de la rampa, todos por encima de 1.5:1:

| Par     | Cociente | Par     | Cociente |
| ------- | -------- | ------- | -------- |
| L4 / L3 | 1.57     | L3 / L2 | 1.56     |
| L4 / L2 | 2.45     | L3 / L1 | 2.38     |
| L4 / L1 | 3.73     | L2 / L1 | 1.52     |

L4 (`#a0ffa0`) es verde lavado con blanco y no verde puro: verde puro tope (`#00ff00`) da 15.30:1, y con ese techo los cuatro escalones no entran. Lavarlo sube el techo a 17.31:1 y hace que la rampa cierre. Sigue siendo un solo matiz — lo que varía es la saturación, que es exactamente lo que hace un fósforo al saturarse.

### La asignación de las ocho piezas

| Pieza      | Nivel | Tratamiento | Color     | Ratio   |
| ---------- | ----- | ----------- | --------- | ------- |
| I          | L4    | sólido      | `#a0ffa0` | 17.31:1 |
| Z          | L4    | hueco       | `#a0ffa0` | 17.31:1 |
| T          | L3    | sólido      | `#00da00` | 11.03:1 |
| L          | L3    | hueco       | `#00da00` | 11.03:1 |
| S          | L2    | sólido      | `#00ae00` | 7.05:1  |
| N (tuerca) | L2    | hueco       | `#00ae00` | 7.05:1  |
| J          | L1    | sólido      | `#008a00` | 4.64:1  |
| O          | L1    | hueco       | `#008a00` | 4.64:1  |

La asignación no es arbitraria. Los dos pares que un jugador de Tetris confunde de verdad —**S/Z** y **J/L**— quedan repartidos en luminancias distintas **y** en tratamientos distintos:

- **S** (L2 sólido) vs **Z** (L4 hueco): 2.45:1 de luminancia **y** relleno contra anillo.
- **J** (L1 sólido) vs **L** (L3 hueco): 2.38:1 de luminancia **y** relleno contra anillo.

Los cuatro sólidos forman la rampa entera (≥ 1.52:1 entre vecinos) y los cuatro huecos también. Los cuatro pares que comparten luminancia (I/Z, T/L, S/N, J/O) se separan por el tratamiento, que es una diferencia de forma y no de color: sobrevive al monocromo y al daltonismo por igual.

### El resto de la skin

| Elemento | Color                       | Ratio  | Piso | `shadowBlur` |
| -------- | --------------------------- | ------ | ---- | ------------ |
| fondo    | `#000`                      | 1.00:1 | —    | no           |
| fantasma | contorno `#006900`          | 3.02:1 | 3:1  | no           |
| grilla   | `rgba(0, 255, 0, 0.14)`     | 1.25:1 | —    | no           |
| brillo   | `rgba(160, 255, 160, 0.16)` | n/a    | —    | no           |

El fantasma está a **1.53:1** de la pieza más oscura (L1, 4.64:1) y a **2.42:1** de la grilla: se lee como guía sin confundirse ni con una pieza ni con el fondo del tablero.

`retro` **no lleva `shadowBlur` en ningún elemento**. El halo del fósforo ya lo pone el marco CRT de `<Reproductor>` (scanlines, viñeta y curvatura), y duplicarlo en el canvas emborronaría justo el eje que carga toda la información: la luminancia.

---

## El fantasma: por qué deja de ser solo `alpha`

En `clasico` el fantasma es la pieza a `alpha = 0.2`. Ese mecanismo hereda la luminancia de la pieza, y con la pieza más oscura de cualquiera de las tres paletas el resultado queda por debajo de 1.7:1 — muy lejos del piso estructural de 3:1.

Se resuelve con un campo nuevo, `ghostStroke`:

- `clasico`: `null` ⇒ el fantasma se dibuja **exactamente como hoy** (relleno a `ghostAlpha`). Cero regresión.
- `neon` y `retro`: un color fijo ⇒ el fantasma es un **contorno de 2 px** de ese color, independiente de la pieza, y por eso su ratio es el mismo siempre.

---

## La grilla queda exenta del piso estructural

La grilla de Tetris está en 1.11:1 en `clasico`, 1.32:1 en `neon` y 1.25:1 en `retro`. Ninguna llega a 3:1, y es deliberado.

La grilla **no delimita nada**: el tablero lo delimitan las bandas negras de los costados del mundo 800×600 y el marco CRT del reproductor, los dos fuera del alcance de la paleta del motor. La grilla es textura de fondo, no una guía. Subirla a 3:1 la convertiría en un tablero de ajedrez que compite con los bloques por atención — y en `clasico` está directamente prohibido, porque se extrae literal.

Lo que sí cumple el piso estructural es lo que de verdad guía: el fantasma, a 3.20:1 en `neon` y 3.02:1 en `retro`.

---

## Las constantes, listas para pegar

```ts
type SkinPiece = { color: string; hollow: boolean };

type TetrisPalette = {
  bg: string;
  grid: string;
  highlight: string;
  ghostAlpha: number;
  ghostStroke: string | null;
  glow: number;
  pieces: readonly (SkinPiece | null)[]; // índice 0 sin usar; 1..8 = I O T S Z J L N
};

const solid = (color: string): SkinPiece => ({ color, hollow: false });
const hollow = (color: string): SkinPiece => ({ color, hollow: true });

const SKINS: Record<SkinId, TetrisPalette> = {
  clasico: {
    bg: "#000",
    grid: "rgba(0, 245, 255, 0.08)",
    highlight: "rgba(255, 255, 255, 0.12)",
    ghostAlpha: 0.2,
    ghostStroke: null,
    glow: 0,
    pieces: [
      null,
      solid("#00f5ff"), // I — --cyan
      solid("#f5ff00"), // O — --yellow
      solid("#aa00ff"), // T — violeta
      solid("#00ff88"), // S — --green
      solid("#ff006e"), // Z — --magenta
      solid("#00a2ff"), // J — azul
      solid("#ff7700"), // L — naranja
      solid("#8a8fb5"), // N — --ink-dim
    ],
  },
  neon: {
    bg: "#000",
    grid: "rgba(0, 245, 255, 0.16)",
    highlight: "rgba(255, 255, 255, 0.22)",
    ghostAlpha: 0.2,
    ghostStroke: "#00686d",
    glow: 14,
    pieces: [
      null,
      solid("#00f5ff"), // I — 15.50:1
      solid("#f5ff00"), // O — 19.19:1
      solid("#c04dff"), // T —  5.75:1
      solid("#00ff88"), // S — 15.66:1
      solid("#ff006e"), // Z —  5.48:1
      solid("#00b4ff"), // J —  8.97:1
      solid("#ff9100"), // L —  9.30:1
      solid("#c7d0e0"), // N — 13.53:1
    ],
  },
  retro: {
    bg: "#000",
    grid: "rgba(0, 255, 0, 0.14)",
    highlight: "rgba(160, 255, 160, 0.16)",
    ghostAlpha: 0.2,
    ghostStroke: "#006900",
    glow: 0,
    pieces: [
      null,
      solid("#a0ffa0"), // I — L4 sólido
      hollow("#008a00"), // O — L1 hueco
      solid("#00da00"), // T — L3 sólido
      solid("#00ae00"), // S — L2 sólido
      hollow("#a0ffa0"), // Z — L4 hueco
      solid("#008a00"), // J — L1 sólido
      hollow("#00da00"), // L — L3 hueco
      hollow("#00ae00"), // N — L2 hueco
    ],
  },
};
```
