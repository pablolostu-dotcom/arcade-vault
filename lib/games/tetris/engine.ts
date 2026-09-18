// ===== lib/games/tetris/engine.ts =====
// Port de references/started-games/03-tetris/game.js a TypeScript.
//
// La lógica del juego no cambia: mismo tablero, mismas ocho piezas, mismos wall
// kicks, mismo balance. Lo que cambia es cómo se monta. El original toma los dos
// canvas de document en la línea 33 y llama init() en la última línea del
// archivo; acá NADA corre al importar el módulo. Todos los efectos secundarios
// (listeners, requestAnimationFrame) viven dentro de start() y se deshacen en
// destroy(), que es lo que permite montarlo y desmontarlo desde React.
//
// Lo que el portal ya provee se elimina, no se oculta:
//   - el HUD del sidebar (#score, #lines, #level) → lo pinta <Reproductor>
//   - el overlay compartido de PAUSA y GAME OVER, y el botón Reiniciar
//   - el toggle claro/oscuro y su clave `tetris-theme` en localStorage
//   - el segundo <canvas> de la vista previa → se dibuja en la banda derecha
// La tecla P tampoco se maneja acá: la pausa es del reproductor, y que el motor
// la manejara además dejaría la pausa alternando dos veces por pulsación.

import type { EngineHandle, EngineOptions, GameSnapshot, GameStatus, SkinId } from "../types";

// ── Constantes ────────────────────────────────────────────────────────────────
// Portadas con sus valores originales. Este motor no rebalancea nada.
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const LINE_SCORES = [0, 100, 300, 500, 800];

/**
 * El encuadre dentro del mundo 800×600 del chasis. El tablero mide 300×600
 * (1:2) y el marco es 4:3, así que el conjunto tablero + vista previa va
 * centrado y las bandas de los costados quedan en negro. El motor sigue
 * razonando en coordenadas del mundo: cero cambios de física.
 */
const WORLD_W = 800;
const WORLD_H = 600;
const BOARD_X = 170; // tablero: x 170..470 (COLS × BLOCK = 300)
const BOARD_Y = 0; //           y 0..600   (ROWS × BLOCK = 600)
const NEXT_X = 510; // vista previa: 120×120, a 40px del tablero
const NEXT_Y = 60;
const NEXT_BLOCK = 30;
const NEXT_CELLS = 4; // la caja de 4×4 en la que se centra la pieza siguiente

/**
 * La paleta del portal, escrita a mano. A propósito NO se leen de :root con
 * getComputedStyle: un motor que necesita que exista una hoja de estilos para
 * dibujar es un motor que falla en silencio. El original lee `--grid-line` así
 * y esa variable en app/globals.css no existe: importado tal cual, la grilla se
 * dibujaría con un strokeStyle vacío y sin decir nada.
 *
 * Desde el SPEC 11 hay tres paletas en vez de una. `clasico` NO es un rediseño:
 * son exactamente los literales que este archivo ya tenía sueltos, movidos acá
 * sin tocar ni uno. Los números de contraste de cada skin están calculados en
 * specs/skins/tetris/02-diseno.md.
 */
type SkinPiece = {
  color: string;
  /**
   * `true` ⇒ el bloque se pinta como un anillo con el centro vacío.
   *
   * Es el segundo eje que hace posible `retro`: ocho piezas en un solo matiz no
   * caben en una rampa de luminancia (ocho escalones de 1.5:1 sobre un piso de
   * 4.5:1 necesitan 76.89:1, y contra negro el máximo es 21:1). Cuatro
   * luminancias por dos tratamientos de relleno sí dan ocho.
   */
  hollow: boolean;
};

type TetrisPalette = {
  bg: string;
  grid: string;
  /** El brillo superior del bloque. Va SOBRE la pieza, no sobre el fondo. */
  highlight: string;
  ghostAlpha: number;
  /**
   * Contorno del fantasma. `null` ⇒ el fantasma es la pieza a `ghostAlpha`,
   * como en el original. Un color ⇒ es un contorno de ese color, y entonces su
   * contraste no depende de qué pieza esté cayendo.
   */
  ghostStroke: string | null;
  /** shadowBlur de la pieza activa y de la siguiente. 0 ⇒ sin glow. */
  glow: number;
  /** Índice 0 sin usar; 1..8 = I O T S Z J L N, como PIECES. */
  pieces: readonly (SkinPiece | null)[];
};

const solid = (color: string): SkinPiece => ({ color, hollow: false });
const hollow = (color: string): SkinPiece => ({ color, hollow: true });

const SKINS: Record<SkinId, TetrisPalette> = {
  // Extraída literal del motor previo al SPEC 11. Dos de estos valores están
  // por debajo del piso de contraste —el violeta de la T a 4.15:1 y la grilla a
  // 1.11:1— y se dejan igual a propósito: corregirlos cambiaría lo que el
  // jugador ya conoce. `neon` los resuelve en su propia paleta.
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
      solid("#8a8fb5"), // N (tuerca) — --ink-dim, como los asteroides
    ],
  },
  // Los ocho matices de `clasico`, saturados y con glow. La identidad de cada
  // pieza se conserva: cambiar de matiz le haría perder al jugador la lectura
  // que trae. T, J y L suben de brillo; T es el que cruza el piso de 4.5:1.
  // No hay token violeta, azul ni naranja en :root — esas tres piezas ya usaban
  // hex fuera de la paleta del portal desde el SPEC 07.
  neon: {
    bg: "#000",
    grid: "rgba(0, 245, 255, 0.16)",
    highlight: "rgba(255, 255, 255, 0.22)",
    ghostAlpha: 0.2,
    ghostStroke: "#00686d", // 3.20:1
    glow: 14, // el mismo número que la pala y la pelota de arkanoid
    pieces: [
      null,
      solid("#00f5ff"), // I — --cyan      15.50:1
      solid("#f5ff00"), // O — --yellow    19.19:1
      solid("#c04dff"), // T — violeta      5.75:1
      solid("#00ff88"), // S — --green     15.66:1
      solid("#ff006e"), // Z — --magenta    5.48:1
      solid("#00b4ff"), // J — azul         8.97:1
      solid("#ff9100"), // L — naranja      9.30:1
      solid("#c7d0e0"), // N — --silver    13.53:1
    ],
  },
  // Fósforo verde: un solo matiz y la información en luminancia. Cuatro niveles
  // —17.31 / 11.03 / 7.05 / 4.64 contra negro, con ≥1.5:1 entre vecinos— por
  // dos tratamientos de relleno. Los dos pares que un jugador confunde de
  // verdad, S/Z y J/L, quedan repartidos en luminancia Y en tratamiento.
  retro: {
    bg: "#000",
    grid: "rgba(0, 255, 0, 0.14)",
    highlight: "rgba(160, 255, 160, 0.16)",
    ghostAlpha: 0.2,
    ghostStroke: "#006900", // 3.02:1, y a 1.53:1 de la pieza más oscura
    glow: 0, // el halo del fósforo ya lo pone el marco CRT de <Reproductor>
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

/**
 * Ocho piezas, no siete: la octava es la tuerca, un anillo 3×3 que el README
 * del juego de referencia no menciona pero randomPiece() sortea igual que a
 * todas las demás. Manda el código.
 */
const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

/** Las teclas del juego: se les corta el scroll de la página mientras se juega. */
const HANDLED_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

type Piece = { type: number; shape: number[][]; x: number; y: number };

export function createTetrisEngine(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): EngineHandle {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("El canvas de TETRIS no expone un contexto 2d.");
  const ctx: CanvasRenderingContext2D = context2d;

  // La paleta activa. Es una constante del motor, nunca leída del DOM.
  let skin: TetrisPalette = SKINS[options.skin ?? "clasico"];

  // ── Estado ──────────────────────────────────────────────────────────────────
  let board: number[][] = [];
  let current: Piece = randomPiece();
  let next: Piece = randomPiece();
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = 1000;
  let dropAccum = 0;
  let state: GameStatus = "playing";

  let rafId: number | null = null;
  let lastTime: number | null = null;
  let running = false;
  let destroyed = false;
  let listenersAttached = false;
  let lastSnapshot: GameSnapshot | null = null;

  // ── Tablero y piezas ────────────────────────────────────────────────────────
  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result[c][rows - 1 - r] = shape[r][c];
      }
    }
    return result;
  }

  /** Rotación con wall kicks: prueba en el sitio, ±1 y ±2 columnas, o descarta. */
  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (current.shape[r][c]) {
          board[current.y + r][current.x + c] = current.shape[r][c];
        }
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  /** La fila en la que aterrizaría la pieza actual si cayera ya mismo. */
  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
  }

  /** Fin de partida. Avisa una sola vez: el guard de state es lo que lo asegura. */
  function endGame() {
    if (state === "gameover") return;
    state = "gameover";
    stopLoop();
    emitSnapshot();
    options.onGameOver(score);
  }

  // ── Snapshot ────────────────────────────────────────────────────────────────
  /** Emite solo si cambió algo: si no, React re-renderiza 60 veces por segundo. */
  function emitSnapshot() {
    const snapshot: GameSnapshot = {
      score,
      level,
      status: state,
      // Sin `lives`: Tetris no tiene el concepto, y el HUD oculta el slot ♥.
      // El contador de líneas es el stat propio, y es además el que gobierna
      // el nivel y la velocidad de caída.
      extra: { label: "Líneas", value: String(lines) },
    };
    const prev = lastSnapshot;
    if (
      prev &&
      prev.score === snapshot.score &&
      prev.level === snapshot.level &&
      prev.extra?.value === snapshot.extra?.value &&
      prev.status === snapshot.status
    ) {
      return;
    }
    lastSnapshot = snapshot;
    options.onSnapshot(snapshot);
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  const onKeyDown = (e: KeyboardEvent) => {
    if (HANDLED_KEYS.has(e.code)) e.preventDefault();
    // Con el loop detenido (pausa o fin de partida) las teclas no mueven nada.
    if (rafId === null || state === "gameover") return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
      default:
        return;
    }
    emitSnapshot();
  };

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  /**
   * `glow` solo lo piden la pieza activa y la siguiente: como mucho 16 celdas
   * por frame. Un tablero lleno son 200, y 200 shadowBlur por frame se comen
   * los 60 fps — el motor de arkanoid ya dejó escrita esa cuenta.
   */
  function drawBlock(
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha = 1,
    glow = false
  ) {
    if (!colorIndex) return;
    const piece = skin.pieces[colorIndex];
    if (!piece) return;
    ctx.globalAlpha = alpha;
    if (glow && skin.glow > 0) {
      ctx.shadowColor = piece.color;
      ctx.shadowBlur = skin.glow;
    }
    ctx.fillStyle = piece.color;
    if (piece.hollow) {
      // Un anillo: el marco del bloque con el centro vacío. Con size 30 son 5 px
      // de espesor sobre 28 px de bloque, y el hueco central mide 18 px.
      const t = Math.max(2, Math.round(size / 6));
      const x0 = x * size + 1;
      const y0 = y * size + 1;
      const s = size - 2;
      ctx.fillRect(x0, y0, s, t);
      ctx.fillRect(x0, y0 + s - t, s, t);
      ctx.fillRect(x0, y0 + t, t, s - 2 * t);
      ctx.fillRect(x0 + s - t, y0 + t, t, s - 2 * t);
    } else {
      ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    }
    ctx.shadowBlur = 0;
    // El brillo superior del original: le da volumen al bloque plano.
    ctx.fillStyle = skin.highlight;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  /**
   * El fantasma. Con `ghostStroke` en null se dibuja como siempre —la pieza a
   * `ghostAlpha`—, y con un color se dibuja como contorno de ese color. La
   * diferencia importa porque el relleno hereda la luminancia de la pieza: con
   * la más oscura de una paleta no llega ni a 1.7:1 contra el fondo.
   */
  function drawGhostBlock(x: number, y: number, colorIndex: number, size: number) {
    if (!colorIndex) return;
    if (!skin.ghostStroke) {
      drawBlock(x, y, colorIndex, size, skin.ghostAlpha);
      return;
    }
    if (!skin.pieces[colorIndex]) return;
    ctx.strokeStyle = skin.ghostStroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  }

  function drawGrid() {
    ctx.strokeStyle = skin.grid;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  /** La pieza siguiente, centrada en su caja de 4×4 en la banda derecha. */
  function drawNext() {
    const shape = next.shape;
    const offX = Math.floor((NEXT_CELLS - shape[0].length) / 2);
    const offY = Math.floor((NEXT_CELLS - shape.length) / 2);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        drawBlock(offX + c, offY + r, shape[r][c], NEXT_BLOCK, 1, true);
      }
    }
  }

  function draw() {
    // El mundo entero en negro: las bandas de los costados del tablero también.
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    ctx.save();
    ctx.translate(BOARD_X, BOARD_Y);
    drawGrid();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drawBlock(c, r, board[r][c], BLOCK);
      }
    }

    // El fantasma va debajo de la pieza: marca dónde va a aterrizar.
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        drawGhostBlock(current.x + c, gy + r, current.shape[r][c], BLOCK);
      }
    }

    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        drawBlock(current.x + c, current.y + r, current.shape[r][c], BLOCK, 1, true);
      }
    }
    ctx.restore();

    ctx.save();
    ctx.translate(NEXT_X, NEXT_Y);
    drawNext();
    ctx.restore();
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    // dt topeado en 50 ms: sin el tope, una pestaña en segundo plano acumula
    // minutos en dropAccum y al volver la pieza se hunde de golpe.
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;

    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
    // lockPiece() puede haber terminado la partida: endGame() ya paró el loop.
    if (state === "gameover") return;

    draw();
    emitSnapshot();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId !== null) return;
    // lastTime en null hace que el primer dt sea 0: una pausa larga no hunde
    // la pieza al reanudar.
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  /** El init() del original, sin el arranque del loop ni el toque del overlay. */
  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropAccum = 0;
    state = "playing";
    next = randomPiece();
    spawn();
  }

  // ── Handle ──────────────────────────────────────────────────────────────────
  return {
    start() {
      if (destroyed || running) return;
      running = true;
      window.addEventListener("keydown", onKeyDown);
      listenersAttached = true;
      initGame();
      lastSnapshot = null;
      emitSnapshot();
      startLoop();
    },

    pause() {
      if (destroyed || !running) return;
      stopLoop();
    },

    resume() {
      if (destroyed || !running) return;
      startLoop();
    },

    restart() {
      if (destroyed || !running) return;
      stopLoop();
      initGame();
      lastSnapshot = null;
      emitSnapshot();
      startLoop();
    },

    end() {
      if (destroyed || !running || state === "gameover") return;
      // El botón FIN entra por el mismo camino que un spawn() que no encuentra
      // sitio, así el fin de partida es idéntico se llegue como se llegue.
      endGame();
    },

    // Tetris es mudo: no hay nada que silenciar.
    setMuted() {},

    /**
     * Cambia la paleta en caliente. No toca el tablero ni el loop: el próximo
     * frame ya dibuja con la skin nueva, así que cambiar de skin en mitad de
     * una partida no le cuesta al jugador ni un punto.
     */
    setSkin(next: SkinId) {
      skin = SKINS[next] ?? SKINS.clasico;
    },

    destroy() {
      destroyed = true;
      running = false;
      stopLoop();
      if (listenersAttached) {
        window.removeEventListener("keydown", onKeyDown);
        listenersAttached = false;
      }
    },
  };
}
