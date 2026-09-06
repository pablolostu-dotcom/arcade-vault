// ===== lib/games/arkanoid/engine.ts =====
// Port de references/started-games/04-arkanoid/game.js y levels.js a TypeScript.
//
// La lógica del juego no cambia: mismas constantes, mismos cinco niveles, mismo
// balance. Lo que cambia es cómo se monta. El original toma el canvas de
// document en la línea 1 y arranca el loop dentro de loadSpritesheet() en la
// última línea del archivo; acá NADA corre al importar el módulo. Todos los
// efectos secundarios (listeners, requestAnimationFrame y los elementos Audio)
// viven dentro de start() y se deshacen en destroy(). Los dos `new Audio()` de
// nivel de módulo del original importan especialmente: corren en el servidor y
// revientan el build con "Audio is not defined".
//
// Lo que el portal ya provee se elimina, no se oculta:
//   - el HUD dibujado en el canvas (Score:, Nivel: y las vidas como pelotas)
//   - drawOverlay() de GAME OVER y el cartel de victoria
//   - drawPauseOverlay(), sus cinco constantes PAUSE_BTN_* y el click sobre el
//     canvas que saltaba de nivel
// La tecla P y Escape tampoco se manejan acá: la pausa es del reproductor desde
// el SPEC 07, y que el motor las manejara además dejaría la pausa alternando
// dos veces por pulsación.
//
// Tres defectos conocidos del original se portan tal cual, porque son el
// balance que está probado:
//   - la paleta mide 81 px, no los 162 que documenta su CLAUDE.md (el sprite es
//     de 162 y drawSprite lo dibuja a media escala; manda el código)
//   - el rebote contra un bloque es un `vy = -vy` seco, sin detectar el lado
//   - el rebote en la paleta no depende de dónde pegue: no hay control de ángulo

import type { EngineHandle, EngineOptions, GameSnapshot, GameStatus } from "../types";

// ── Constantes ────────────────────────────────────────────────────────────────
// Portadas con sus valores originales. Este motor no rebalancea nada.
//
// El mundo del chasis es 800×600 y el canvas del original también, así que no
// hay nada que reencuadrar. Sí importa NO leer canvas.width: <GameCanvas> lo
// fija en WORLD_W × devicePixelRatio, así que en una pantalla HiDPI valdría
// 1600 y el juego se jugaría en un mundo del doble de ancho.
const W = 800;
const H = 600;

const PADDLE_SPEED = 400; // px/s con teclado
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const PADDLE = { y: 560, w: 81, h: 14 }; // 81, no 162
const BALL = { w: 16, h: 16 };
const POINTS_PER_BLOCK = 10;
const START_LIVES = 3;
const EXPLOSION_DURATION = 150; // ms

/** El estallido que reemplaza a los 28 frames del spritesheet, en los mismos 150 ms. */
const EXPLOSION_FRAGMENTS = 8;
const EXPLOSION_REACH = 26; // px que recorre cada fragmento
const EXPLOSION_FRAGMENT_SIZE = 8; // lado del fragmento al empezar

type BlockColor = "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

/**
 * La paleta del portal, escrita a mano. A propósito NO se leen de :root con
 * getComputedStyle: un motor que necesita que exista una hoja de estilos para
 * dibujar es un motor que falla en silencio.
 *
 * Los siete nombres son los del original. `hotpink` es el magenta aclarado,
 * para que se distinga del magenta puro; `red` es color de juego y no acento,
 * como el naranja del propulsor de asteroides; `gray` es --ink-dim.
 */
const BLOCK_COLORS: Record<BlockColor, string> = {
  cyan: "#00f5ff", // --cyan
  magenta: "#ff006e", // --magenta
  yellow: "#f5ff00", // --yellow
  green: "#00ff88", // --green
  hotpink: "#ff4da6",
  red: "#ff3b1f",
  gray: "#8a8fb5", // --ink-dim
};

const PADDLE_COLOR = "#ff006e"; // --magenta
const BALL_COLOR = "#00f5ff"; // --cyan
/** El brillo superior del bloque plano, igual que en tetris. */
const HIGHLIGHT = "rgba(255, 255, 255, 0.12)";

/** Las teclas del juego: se les corta el scroll de la página mientras se juega. */
const HANDLED_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

// ── Audio ─────────────────────────────────────────────────────────────────────
// Los dos efectos del original, servidos desde public/. Son los primeros —y por
// ahora los únicos— sonidos del portal.
const BOUNCE_SRC = "/sounds/ball-bounce.mp3";
const BREAK_SRC = "/sounds/break-sound.mp3";

/**
 * Volumen fijo. No es rebalancear el juego —no toca ninguna constante de física
 * ni de puntaje— sino una decisión del portal: un efecto a volumen completo
 * dentro de una página web es agresivo de un modo que el mismo efecto en una
 * pestaña dedicada no es.
 */
const SOUND_VOLUME = 0.4;

/**
 * Cuatro elementos por sonido, con índice circular. El original hace
 * `bounceSound.cloneNode().play()` en cada rebote: crea un <audio> nuevo cada
 * vez y no lo suelta nunca, así que una partida larga deja cientos de nodos
 * vivos. Cuatro alcanzan para que dos rebotes seguidos no se corten.
 */
const SOUND_POOL_SIZE = 4;

type SoundPool = { els: HTMLAudioElement[]; next: number };

type LevelBlock = { col: number; row: number; color: BlockColor };
type Level = { speed: number; blocks: LevelBlock[] };
type Block = { x: number; y: number; w: number; h: number; color: BlockColor; alive: boolean };
type Explosion = { x: number; y: number; w: number; h: number; color: BlockColor; elapsed: number };

/**
 * Port de levels.js: los cinco generadores, con sus patrones y sus
 * multiplicadores de velocidad tal cual. Es una función pura y se llama desde
 * dentro de la fábrica: nada corre al importar el módulo.
 */
function buildLevels(): Level[] {
  const rowColors1: BlockColor[] = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2: BlockColor[] = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4: BlockColor[] = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  // 1 — parrilla completa
  const l1: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) l1.push({ col, row, color: rowColors1[row] });
  }

  // 2 — pirámide
  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = pyStart[row]; col <= pyEnd[row]; col++) {
      l2.push({ col, row, color: rowColors2[row] });
    }
  }

  // 3 — tablero de ajedrez
  const l3: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      if ((col + row) % 2 === 0) l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });
    }
  }

  // 4 — filas con huecos
  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] });
    }
  }

  // 5 — marco con cruz central
  const l5: LevelBlock[] = [];
  for (let row = 0; row < BLOCK_ROWS; row++) {
    for (let col = 0; col < BLOCK_COLS; col++) {
      const isFrame = col === 0 || col === BLOCK_COLS - 1 || row === 0 || row === BLOCK_ROWS - 1;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross) {
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
      }
    }
  }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
}

export function createArkanoidEngine(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): EngineHandle {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("El canvas de ARKANOID no expone un contexto 2d.");
  const ctx: CanvasRenderingContext2D = context2d;

  const LEVELS = buildLevels();

  // ── Estado ──────────────────────────────────────────────────────────────────
  let paddleX = 0;
  const ball = { x: 0, y: 0, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = START_LIVES;
  let score = 0;
  let currentLevel = 1;
  let state: GameStatus = "playing";

  let rafId: number | null = null;
  let lastTime: number | null = null;
  let running = false;
  let paused = false;
  let destroyed = false;
  let listenersAttached = false;
  let lastSnapshot: GameSnapshot | null = null;

  // ── Audio ───────────────────────────────────────────────────────────────────
  // Los elementos se crean en start(), no acá y menos a nivel de módulo: `new
  // Audio()` no existe en el servidor.
  let bouncePool: SoundPool | null = null;
  let breakPool: SoundPool | null = null;
  let muted = false;
  /**
   * La política de autoplay del navegador exige un gesto del usuario antes del
   * primer play(). Se levanta con el primer keydown o el primer mousemove de la
   * partida: como la paleta no se mueve sin uno de los dos, el gesto llega en
   * el primer segundo y el navegador nunca rechaza la reproducción. Hasta
   * entonces no se llama a play() y no hay NotAllowedError que registrar.
   */
  let unlocked = false;

  function createPool(src: string): SoundPool {
    return {
      els: Array.from({ length: SOUND_POOL_SIZE }, () => {
        const el = new Audio(src);
        el.volume = SOUND_VOLUME;
        el.preload = "auto";
        return el;
      }),
      next: 0,
    };
  }

  /** Los ocho elementos, o ninguno si todavía no se llamó a start(). */
  function eachSound(fn: (el: HTMLAudioElement) => void) {
    for (const pool of [bouncePool, breakPool]) {
      if (!pool) continue;
      for (const el of pool.els) fn(el);
    }
  }

  function play(pool: SoundPool | null) {
    if (!pool || muted || !unlocked) return;
    const el = pool.els[pool.next];
    pool.next = (pool.next + 1) % pool.els.length;
    el.currentTime = 0;
    // El catch se come el rechazo de la política de autoplay: un sonido que no
    // suena no puede tumbar el frame.
    void el.play().catch(() => {});
  }

  const playBounce = () => play(bouncePool);
  const playBreak = () => play(breakPool);

  // ── Input ───────────────────────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    // Antes del filtro de teclas: cualquier keydown le sirve al navegador como
    // gesto, no solo las dos flechas del juego.
    unlocked = true;
    if (!HANDLED_KEYS.has(e.code)) return;
    e.preventDefault();
    keys[e.code] = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (!HANDLED_KEYS.has(e.code)) return;
    e.preventDefault();
    keys[e.code] = false;
  };

  /**
   * El control canónico del género. Dos diferencias con el original:
   *
   *  - la escala es `W / rect.width`, NO `canvas.width / rect.width`.
   *    <GameCanvas> fija canvas.width = W × devicePixelRatio, así que en una
   *    pantalla HiDPI la fórmula del original daría el doble y la paleta se
   *    movería a la mitad de velocidad, sin llegar nunca al borde derecho.
   *  - sale temprano en pausa: el overlay de React tapa el canvas, pero si el
   *    puntero entrara igual, mover el mouse arrastraría la paleta por debajo
   *    y al reanudar saltaría.
   */
  const onMouseMove = (e: MouseEvent) => {
    // También cuenta como gesto, y antes de las guardas: mover el mouse en
    // pausa desbloquea el audio igual.
    unlocked = true;
    if (paused || state !== "playing") return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const mouseX = (e.clientX - rect.left) * (W / rect.width);
    paddleX = Math.max(0, Math.min(W - PADDLE.w, mouseX - PADDLE.w / 2));
  };

  // ── Paleta, pelota y niveles ────────────────────────────────────────────────
  function initPaddle() {
    paddleX = (W - PADDLE.w) / 2;
  }

  function initBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddleX + (PADDLE.w - BALL.w) / 2;
    ball.y = PADDLE.y - BALL.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    // El original limpia la cola al cambiar de nivel: la explosión del último
    // bloque no sobrevive al muro siguiente.
    explosions = [];
    initBall();
  }

  function collideAABB(block: Block): boolean {
    return (
      ball.x < block.x + block.w &&
      ball.x + BALL.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + BALL.h > block.y
    );
  }

  // ── Fin de partida ──────────────────────────────────────────────────────────
  function endGame() {
    if (state === "gameover") return;
    state = "gameover";
    stopLoop();
    emitSnapshot();
    options.onGameOver(score);
  }

  /**
   * El único camino por el que se pierde: lo usa la pelota que se escapa por
   * abajo y también el botón FIN, que antes se deja con una vida sola. Así el
   * fin de partida es idéntico se llegue como se llegue.
   */
  function loseLife() {
    lives--;
    if (lives <= 0) {
      lives = 0;
      endGame();
    } else {
      initBall();
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state !== "playing") return;

    // Paleta
    if (keys.ArrowLeft) paddleX = Math.max(0, paddleX - PADDLE_SPEED * dt);
    if (keys.ArrowRight) paddleX = Math.min(W - PADDLE.w, paddleX + PADDLE_SPEED * dt);

    // Pelota
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Rebote contra las paredes (izquierda, derecha, techo)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playBounce();
    }
    if (ball.x + BALL.w >= W) {
      ball.x = W - BALL.w;
      ball.vx = -Math.abs(ball.vx);
      playBounce();
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playBounce();
    }

    // Rebote en la paleta. Sin control de ángulo: invierte vy y deja vx intacto,
    // como el original.
    if (
      ball.vy > 0 &&
      ball.x + BALL.w > paddleX &&
      ball.x < paddleX + PADDLE.w &&
      ball.y + BALL.h >= PADDLE.y &&
      ball.y + BALL.h <= PADDLE.y + PADDLE.h + 8
    ) {
      ball.y = PADDLE.y - BALL.h;
      ball.vy = -Math.abs(ball.vy);
      playBounce();
    }

    // Bloques. Un bloque por frame, como el original.
    for (const block of blocks) {
      if (!block.alive) continue;
      if (!collideAABB(block)) continue;

      block.alive = false;
      explosions.push({
        x: block.x,
        y: block.y,
        w: block.w,
        h: block.h,
        color: block.color,
        elapsed: 0,
      });
      score += POINTS_PER_BLOCK;
      // Sin detección de lado: la pelota que entra por el costado sale hacia
      // arriba igual. Es el original.
      ball.vy = -ball.vy;
      playBreak();

      if (blocks.every((b) => !b.alive)) {
        if (currentLevel < LEVELS.length) {
          loadLevel(currentLevel + 1);
        } else {
          // El original dibuja "¡Completaste el juego!" y se queda ahí. El
          // portal tiene un solo final —el modal con el puntaje y el formulario
          // de guardado— y limpiar el nivel 5 entra por ese mismo camino, con
          // el puntaje acumulado de los cinco niveles.
          endGame();
        }
      }
      break;
    }

    // endGame() ya paró el loop: no tiene sentido seguir moviendo nada, y sin
    // esta guarda la pelota podría además descontar una vida ya terminada.
    if (state !== "playing") return;

    // Explosiones
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Pelota perdida
    if (ball.y > H) loseLife();
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function drawBlocks() {
    for (const block of blocks) {
      if (!block.alive) continue;
      ctx.fillStyle = BLOCK_COLORS[block.color];
      ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
      // El glow va solo en la paleta y la pelota: sesenta bloques con
      // shadowBlur por frame se comen los 60 fps.
      ctx.fillStyle = HIGHLIGHT;
      ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, 4);
    }
  }

  /**
   * Los 4 frames de spritesheet del original, como ocho fragmentos que se
   * alejan del centro del bloque y se desvanecen en los mismos 150 ms.
   */
  function drawExplosions() {
    for (const exp of explosions) {
      const t = Math.min(exp.elapsed / EXPLOSION_DURATION, 1);
      const cx = exp.x + exp.w / 2;
      const cy = exp.y + exp.h / 2;
      const size = EXPLOSION_FRAGMENT_SIZE * (1 - t * 0.7);
      const reach = t * EXPLOSION_REACH;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = BLOCK_COLORS[exp.color];
      for (let i = 0; i < EXPLOSION_FRAGMENTS; i++) {
        const a = (i / EXPLOSION_FRAGMENTS) * Math.PI * 2;
        ctx.fillRect(
          cx + Math.cos(a) * reach - size / 2,
          cy + Math.sin(a) * reach - size / 2,
          size,
          size
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPaddle() {
    ctx.save();
    ctx.shadowColor = PADDLE_COLOR;
    ctx.shadowBlur = 14;
    ctx.fillStyle = PADDLE_COLOR;
    ctx.fillRect(paddleX, PADDLE.y, PADDLE.w, PADDLE.h);
    ctx.restore();
  }

  function drawBall() {
    // La física sigue siendo la caja de 16×16 del original; el círculo es solo
    // cómo se pinta, igual que los vectores reemplazaron a los sprites en
    // asteroides.
    const r = BALL.w / 2;
    ctx.save();
    ctx.shadowColor = BALL_COLOR;
    ctx.shadowBlur = 14;
    ctx.fillStyle = BALL_COLOR;
    ctx.beginPath();
    ctx.arc(ball.x + r, ball.y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    drawBlocks();
    drawExplosions();
    drawPaddle();
    drawBall();
  }

  // ── Snapshot ────────────────────────────────────────────────────────────────
  /** Emite solo si cambió algo: si no, React re-renderiza 60 veces por segundo. */
  function emitSnapshot() {
    const snapshot: GameSnapshot = {
      score,
      level: currentLevel,
      status: state,
      lives,
      // El multiplicador del nivel actual, ya formateado: es lo que distingue
      // un nivel de otro más allá del patrón. Con el string armado acá, la
      // comparación de abajo es de strings y no hay redondeos que discutir.
      extra: { label: "Velocidad", value: `×${LEVELS[currentLevel - 1].speed.toFixed(2)}` },
    };
    const prev = lastSnapshot;
    if (
      prev &&
      prev.score === snapshot.score &&
      prev.level === snapshot.level &&
      prev.lives === snapshot.lives &&
      prev.status === snapshot.status &&
      prev.extra?.value === snapshot.extra?.value
    ) {
      return;
    }
    lastSnapshot = snapshot;
    options.onSnapshot(snapshot);
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    // dt topeado en 50 ms: sin el tope, una pestaña en segundo plano acumula
    // segundos y la pelota se teletransporta a través de la paleta.
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;

    update(dt / 1000);
    // update() puede haber terminado la partida: endGame() ya paró el loop.
    if (state === "gameover") return;

    draw();
    emitSnapshot();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId !== null) return;
    // lastTime en null hace que el primer dt sea 0: al reanudar, la pelota no
    // salta el tiempo entero que estuvo pausada.
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  /** El arranque del original, sin el spritesheet ni el pedido de rAF. */
  function initGame() {
    lives = START_LIVES;
    score = 0;
    state = "playing";
    paused = false;
    initPaddle();
    loadLevel(1);
  }

  // ── Handle ──────────────────────────────────────────────────────────────────
  return {
    start() {
      if (destroyed || running) return;
      running = true;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      // El mousemove va sobre el canvas y no sobre window: la paleta sigue al
      // puntero solo mientras está encima de la pantalla del juego.
      canvas.addEventListener("mousemove", onMouseMove);
      listenersAttached = true;
      bouncePool = createPool(BOUNCE_SRC);
      breakPool = createPool(BREAK_SRC);
      initGame();
      lastSnapshot = null;
      emitSnapshot();
      startLoop();
    },

    pause() {
      if (destroyed || !running || paused) return;
      paused = true;
      stopLoop();
    },

    resume() {
      if (destroyed || !running || !paused) return;
      paused = false;
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
      // Una vida, y perderla: el botón FIN entra por el mismo camino que la
      // pelota que se escapa con la última.
      lives = 1;
      loseLife();
      emitSnapshot();
    },

    /**
     * El botón de silencio del HUD. <GameCanvas> lo llama justo después de
     * crear el motor —antes de start(), cuando los pools todavía no existen— y
     * de nuevo en cada cambio, así que tiene que aguantar los dos momentos.
     */
    setMuted(next: boolean) {
      muted = next;
      if (!muted) return;
      // Silenciar corta en el acto lo que esté sonando; volver al sonido no
      // reproduce nada por su cuenta.
      eachSound((el) => {
        el.pause();
        el.currentTime = 0;
      });
    },

    destroy() {
      destroyed = true;
      running = false;
      stopLoop();
      // Los ocho elementos del pool: sin esto, un rebote disparado en el último
      // frame sigue sonando después de que la pantalla ya cambió de juego.
      eachSound((el) => {
        el.pause();
        el.src = "";
      });
      bouncePool = null;
      breakPool = null;
      if (listenersAttached) {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        canvas.removeEventListener("mousemove", onMouseMove);
        listenersAttached = false;
      }
    },
  };
}
