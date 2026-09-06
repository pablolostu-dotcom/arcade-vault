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

import type { EngineHandle, EngineOptions, GameSnapshot, GameStatus } from "../types";

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
 */
const COLORS: (string | null)[] = [
  null,
  "#00f5ff", // I — --cyan
  "#f5ff00", // O — --yellow
  "#aa00ff", // T — violeta
  "#00ff88", // S — --green
  "#ff006e", // Z — --magenta
  "#00a2ff", // J — azul
  "#ff7700", // L — naranja
  "#8a8fb5", // N (tuerca) — --ink-dim, como los asteroides
];

const GRID_LINE = "rgba(0, 245, 255, 0.08)";
const HIGHLIGHT = "rgba(255, 255, 255, 0.12)";
const GHOST_ALPHA = 0.2;

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
  function drawBlock(x: number, y: number, colorIndex: number, size: number, alpha = 1) {
    if (!colorIndex) return;
    const color = COLORS[colorIndex];
    if (!color) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    // El brillo superior del original: le da volumen al bloque plano.
    ctx.fillStyle = HIGHLIGHT;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  function drawGrid() {
    ctx.strokeStyle = GRID_LINE;
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
        drawBlock(offX + c, offY + r, shape[r][c], NEXT_BLOCK);
      }
    }
  }

  function draw() {
    // El mundo entero en negro: las bandas de los costados del tablero también.
    ctx.fillStyle = "#000";
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
        drawBlock(current.x + c, gy + r, current.shape[r][c], BLOCK, GHOST_ALPHA);
      }
    }

    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        drawBlock(current.x + c, current.y + r, current.shape[r][c], BLOCK);
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
