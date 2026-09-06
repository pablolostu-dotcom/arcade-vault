// ===== lib/games/snake/engine.ts =====
// El cuarto motor del portal, y el primero que no es un port. Los otros tres
// vinieron de references/started-games/ con el balance ya probado y el spec
// decidía cómo adaptarlos; acá no había código de referencia, solo un atlas de
// frutas. Las constantes de abajo —tamaño de grilla, velocidad del tic, curva
// de aceleración, valor de cada fruta y fórmula del puntaje— se eligieron, no
// se copiaron, y están todas juntas a propósito: ajustarlas es cambiar números,
// no reescribir lógica.
//
// Del chasis no cambia nada. GameSnapshot ya modela un juego sin vidas desde
// tetris, ya tiene el slot `extra`, y EngineHandle ya tiene setMuted(). Escape
// y P los ata <Reproductor> desde el SPEC 07: manejarlas también acá dejaría la
// pausa alternando dos veces por pulsación.
//
// NADA corre al importar el módulo. Los listeners, el requestAnimationFrame y
// el `new Image()` del atlas viven dentro de start() y se deshacen en
// destroy(). El Image importa especialmente: a nivel de módulo corre en el
// servidor y revienta el build con "Image is not defined", igual que los
// `new Audio()` que el SPEC 08 tuvo que mover.
//
// El motor no dibuja HUD, ni overlay de pausa, ni de game over, ni
// instrucciones: todo eso lo pinta <Reproductor>.

import type { EngineHandle, EngineOptions, GameSnapshot, GameStatus } from "../types";

// ── El tablero ────────────────────────────────────────────────────────────────
// 32 × 25 = 800 y 24 × 25 = 600: divide exacto el mundo de <GameCanvas>, así que
// .game-canvas no cambia y no hay bandas laterales ni reencuadre —el problema
// que el SPEC 07 tuvo con el tablero 300×600 de tetris—.
//
// Como en los otros tres motores, NO se lee canvas.width: <GameCanvas> lo fija
// en 800 × devicePixelRatio, así que en una pantalla HiDPI valdría 1600 y el
// juego se jugaría en un mundo del doble de ancho.
const CELL = 25;
const COLS = 32;
const ROWS = 24;
const W = COLS * CELL; // 800
const H = ROWS * CELL; // 600

// ── La serpiente ──────────────────────────────────────────────────────────────
const START_LENGTH = 3;
const START_HEAD = { col: 16, row: 12 }; // el centro del tablero
const QUEUE_MAX = 2;

// ── La velocidad ──────────────────────────────────────────────────────────────
// tickMs = max(TICK_FLOOR, TICK_BASE - fruitsEaten * TICK_STEP). La aceleración
// es continua y atada a la fruta, no escalonada por nivel: el jugador siente que
// lo que hace tiene consecuencia inmediata en vez de descubrir un salto de
// velocidad al cruzar un contador que no ve. El piso está para que el juego siga
// siendo jugable con reflejos humanos; se toca a las 20 frutas.
//
// Los tres números son un 30 % más lentos que los que fijó el SPEC 09 —140 / 4 /
// 60—: la serpiente arrancaba demasiado rápido al probarla. Como la velocidad es
// 1/tick, un 30 % menos es dividir el tic por 0,7. El piso quedó en 85 y no en
// 86 a propósito: con 85 el tramo de aceleración sigue terminando exactamente en
// la fruta 20, igual que antes (a las 19 el tic vale 86, a las 20 toca el piso).
const TICK_BASE = 200; // ms por tic al empezar   (140 / 0,7)
const TICK_STEP = 6; // ms que baja por cada fruta comida   (4 / 0,7)
const TICK_FLOOR = 85; // el piso   (60 / 0,7)

/** El tope del dt, igual que en los otros tres motores. Ver loop(). */
const MAX_FRAME_MS = 50;

// ── El nivel ──────────────────────────────────────────────────────────────────
// Sin techo. `level` no es opcional en GameSnapshot, así que el slot se pinta
// igual: darle el significado del tramo de aceleración es más útil que dejarlo
// clavado en 01. El tic toca el piso a las 20 frutas, o sea a mitad del nivel 05.
const FRUITS_PER_LEVEL = 5;

// ── Las frutas ────────────────────────────────────────────────────────────────
type FruitTier = "common" | "medium" | "rare";

/**
 * Los tres escalones de valor, con su probabilidad y el color de su halo.
 *
 * El halo se dibuja siempre, haya sprite o no: sin él los tres escalones serían
 * una tabla que el jugador tiene que memorizar; con él la rareza se lee de un
 * vistazo y el sprite queda como lo que es, decoración con carácter.
 *
 * Los dos ejes del puntaje multiplican (valor × largo), así que una partida
 * larga con frutas raras se despega de una partida larga a fuerza de manzanas.
 */
const TIERS: Record<FruitTier, { value: number; probability: number; halo: string }> = {
  common: { value: 10, probability: 0.7, halo: "#00ff88" }, // --green
  medium: { value: 25, probability: 0.25, halo: "#00f5ff" }, // --cyan
  rare: { value: 50, probability: 0.05, halo: "#ff006e" }, // --magenta
};

/**
 * El índice de cada fruta dentro de public/snake/fruits.png, que es todo lo que
 * hace falta para dibujarla: sx = index * SPRITE_W, sy = 0.
 *
 * El orden es el del recorte, hecho una sola vez desde
 * references/source-assets/snake-assets/fruits.png. Ojo con sprites.js de esa
 * carpeta: sus 22 pares x/w son correctos pero sus nombres están cambiados de
 * lugar, y la hoja no tiene melón —lo que ese archivo llama `melon` es un bol de
 * ensalada—, así que el escalón rare cierra con durazno.
 */
const FRUITS: { index: number; tier: FruitTier }[] = [
  { index: 0, tier: "common" }, // manzana
  { index: 1, tier: "common" }, // cerezas
  { index: 2, tier: "medium" }, // naranja
  { index: 3, tier: "medium" }, // kiwi
  { index: 4, tier: "medium" }, // limón
  { index: 5, tier: "rare" }, // sandía
  { index: 6, tier: "rare" }, // piña
  { index: 7, tier: "rare" }, // durazno
];

const ATLAS_SRC = "/snake/fruits.png";
const SPRITE_W = 170;
const SPRITE_H = 160;

/**
 * En pantalla la fruta ocupa 28×26 centrados en su celda de 25 px: desborda un
 * píxel y medio por lado, que es lo que hace que se lea dentro del marco CRT sin
 * invadir la celda vecina.
 */
const FRUIT_W = 28;
const FRUIT_H = 26;
/** El respaldo vectorial mientras el atlas no cargó, y para siempre si falla. */
const FRUIT_FALLBACK_RADIUS = 8;
const HALO_RADIUS = 10;
const HALO_ALPHA = 0.35;

// ── La paleta ─────────────────────────────────────────────────────────────────
// Constantes del motor, NUNCA leídas del DOM con getComputedStyle: un motor que
// necesita que exista una hoja de estilos para dibujar es un motor que falla en
// silencio. Es la misma regla del SPEC 05 y del SPEC 08.
const BG = "#000";
const GRID = "rgba(138, 143, 181, 0.07)"; // --ink-dim casi apagado
const SNAKE_COLOR = "#f5ff00"; // --yellow, el acento del juego
const FRAME_COLOR = "#ff006e"; // --magenta: el límite se lee como peligro

/**
 * El cuerpo se desvanece hacia la cola. El glow va solo en la cabeza, el marco y
 * el halo de la fruta: el cuerpo puede llegar a cien segmentos y dibujar cien
 * sombras por frame hunde los 60 fps, mientras que el degradado de alpha da la
 * sensación de estela sin costo.
 */
const BODY_ALPHA_HEAD = 1;
const BODY_ALPHA_TAIL = 0.45;

const GLOW_HEAD = 12;
const GLOW_FRAME = 10;
const GLOW_HALO = 14;
const FRAME_WIDTH = 2;

// ── Los controles ─────────────────────────────────────────────────────────────
type Direction = "up" | "down" | "left" | "right";

/** Se usa e.code, como en los otros tres motores. Flechas y WASD. */
const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

/** Solo las flechas: son las que scrollean la página. WASD no lo necesita. */
const PREVENT_DEFAULT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const STEP: Record<Direction, { col: number; row: number }> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

type Cell = { col: number; row: number };

export function createSnakeEngine(canvas: HTMLCanvasElement, options: EngineOptions): EngineHandle {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("El canvas de SNAKE no expone un contexto 2d.");
  const ctx: CanvasRenderingContext2D = context2d;

  // ── Estado ──────────────────────────────────────────────────────────────────
  /** La cabeza es body[0]. Crece por el frente y se recorta por atrás. */
  let body: Cell[] = [];
  let direction: Direction = "right";
  /** Giros pendientes, uno por tic. Ver enqueueTurn(). */
  let queue: Direction[] = [];
  /** Celdas que faltan agregar. Comer suma una, el tic siguiente la consume. */
  let pendingGrowth = 0;

  let fruit: { cell: Cell; index: number; tier: FruitTier } | null = null;
  let fruitsEaten = 0;
  let score = 0;
  let state: GameStatus = "playing";

  let rafId: number | null = null;
  let lastTime: number | null = null;
  /** Acumulador del tic, en ms. */
  let accumulator = 0;
  let running = false;
  let paused = false;
  let destroyed = false;
  let listenersAttached = false;
  let lastSnapshot: GameSnapshot | null = null;

  // ── El atlas ────────────────────────────────────────────────────────────────
  // Se carga en start() y el juego arranca sin esperarlo: agregar un estado
  // `loading` al contrato que comparten los cuatro motores por un caso que tiene
  // uno solo no vale la pena, y así un 404 del PNG degrada el juego en vez de
  // romperlo. Mientras atlasReady sea false la fruta se dibuja como un círculo
  // del color de su escalón, que es perfectamente jugable.
  let atlas: HTMLImageElement | null = null;
  let atlasReady = false;

  // ── Audio ───────────────────────────────────────────────────────────────────
  // Sintetizado con WebAudio: es el camino B del paso 5 del SPEC 09, y se tomó
  // porque el camino A no cierra. En los bancos alcanzables no hay un par CC0
  // usable: el único efecto de fin de partida con licencia verificable
  // (commons.wikimedia.org/wiki/File:Fim_efeito_sonoro_retrô.oga, CC0) dura
  // 2,38 s y pesa 482 KB —veinticinco veces todo el audio del SPEC 08— y viene
  // en Ogg, que Safari no reproduce; no hay ffmpeg para recortarlo ni pasarlo a
  // mp3, Pixabay responde 403 y freesound pide un token de OAuth para bajar.
  //
  // A cambio no entra ningún binario al repo y el resultado es exactamente lo
  // que el juego pide: un blip sintetizado ES el sonido del Snake de Nokia.
  //
  // Nada de esto corre al importar el módulo ni al crear el motor: el
  // AudioContext se construye en start() y se cierra en destroy().
  const SOUND_VOLUME = 0.4; // el mismo del SPEC 08
  /** Comer: dos escalones ascendentes, corto y agudo. */
  const EAT_MS = 150;
  const EAT_FROM = 880; // A5
  const EAT_TO = 1318.5; // E6, una quinta arriba
  /** Morir: un barrido descendente. */
  const DIE_MS = 400;
  const DIE_FROM = 440; // A4
  const DIE_TO = 55; // A1
  /** exponentialRampToValueAtTime no acepta 0: este es el cero práctico. */
  const SILENCE = 0.0001;

  let audioCtx: AudioContext | null = null;
  let master: GainNode | null = null;
  /** Los osciladores vivos, para que destroy() los corte sin esperar su stop(). */
  const voices = new Set<OscillatorNode>();
  let muted = false;
  /**
   * La política de autoplay exige un gesto antes de que suene nada. Se levanta
   * con el primer keydown de la partida: sin teclas la serpiente no cambia de
   * dirección, así que el gesto llega en el primer segundo. Hasta entonces no se
   * programa ni un nodo y no hay NotAllowedError que registrar.
   */
  let unlocked = false;

  /**
   * El AudioContext nace suspendido cuando todavía no hubo gesto, y programarle
   * algo así es lo que dispara el warning de autoplay. Por eso el resume() va
   * acá, en el primer keydown, y playEat()/playDie() no hacen nada antes.
   */
  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    if (audioCtx?.state === "suspended") void audioCtx.resume().catch(() => {});
  }

  /**
   * Un oscilador con su envolvente, conectado al master. Es todo lo que
   * necesitan los dos efectos: cambia el tipo de onda, las dos frecuencias y la
   * duración.
   */
  function blip(type: OscillatorType, from: number, to: number, ms: number, slide: boolean) {
    const ctx2 = audioCtx;
    const out = master;
    if (!ctx2 || !out || muted || !unlocked || ctx2.state === "closed") return;

    const t0 = ctx2.currentTime;
    const dur = ms / 1000;
    const osc = ctx2.createOscillator();
    const env = ctx2.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (slide) {
      // El barrido de la muerte: exponencial, que es como lo oye el oído.
      osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    } else {
      // El bocado: un escalón seco a mitad de camino, no un glissando.
      osc.frequency.setValueAtTime(to, t0 + dur / 2);
    }

    // Ataque de 5 ms para que no chasquee, y caída al silencio.
    env.gain.setValueAtTime(SILENCE, t0);
    env.gain.exponentialRampToValueAtTime(1, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(SILENCE, t0 + dur);

    osc.connect(env).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur);
    voices.add(osc);
    osc.onended = () => {
      voices.delete(osc);
      osc.disconnect();
      env.disconnect();
    };
  }

  /** Corta en el acto lo que esté sonando. Lo usan setMuted(true) y destroy(). */
  function stopVoices() {
    for (const osc of voices) {
      try {
        osc.onended = null;
        osc.stop();
        osc.disconnect();
      } catch {
        // Un oscilador que ya terminó tira InvalidStateError: no es un problema.
      }
    }
    voices.clear();
  }

  const playEat = () => blip("square", EAT_FROM, EAT_TO, EAT_MS, false);
  const playDie = () => blip("sawtooth", DIE_FROM, DIE_TO, DIE_MS, true);

  // ── El tic ──────────────────────────────────────────────────────────────────
  function tickMs(): number {
    return Math.max(TICK_FLOOR, TICK_BASE - fruitsEaten * TICK_STEP);
  }

  function level(): number {
    return Math.floor(fruitsEaten / FRUITS_PER_LEVEL) + 1;
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  /**
   * La cola de giros es lo que evita las muertes injustas. La validación de 180°
   * va contra el ÚLTIMO elemento de la cola, o contra `direction` si la cola está
   * vacía — nunca contra `direction` a secas.
   *
   * Sin eso, dos pulsaciones dentro de un mismo tic se pisan y la segunda se
   * valida contra una dirección que nunca llegó a aplicarse: con direction
   * "right", pulsar ↑ y después ← daría un giro de 180° y una muerte que el
   * jugador no cometió. Una cola de un solo elemento que se pisa a sí misma
   * reintroduce exactamente ese bug; con dos y un shift() por tic, los dos
   * agujeros se cierran.
   */
  function enqueueTurn(next: Direction) {
    if (queue.length >= QUEUE_MAX) return;
    const reference = queue.length > 0 ? queue[queue.length - 1] : direction;
    if (next === reference || next === OPPOSITE[reference]) return;
    queue.push(next);
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // Antes de cualquier filtro: al navegador le sirve como gesto cualquier
    // keydown, no solo los ocho del juego.
    unlockAudio();
    const next = KEY_TO_DIRECTION[e.code];
    if (!next) return;
    // El preventDefault va aunque el juego esté pausado o terminado: las flechas
    // no tienen por qué scrollear la página mientras el canvas está montado.
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    if (paused || state !== "playing") return;
    enqueueTurn(next);
  };

  // ── La fruta ────────────────────────────────────────────────────────────────
  /**
   * La celda sale de la lista de celdas libres, no de reintentos al azar:
   * reintentar es más corto de escribir y tiene tiempo de ejecución no acotado
   * justo cuando el tablero está casi lleno, que es el peor momento posible para
   * un freeze. Recorrer las 768 celdas una vez por fruta es gratis.
   */
  function freeCells(): Cell[] {
    const occupied = new Uint8Array(COLS * ROWS);
    for (const cell of body) occupied[cell.row * COLS + cell.col] = 1;
    const free: Cell[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!occupied[row * COLS + col]) free.push({ col, row });
      }
    }
    return free;
  }

  /** Primero el escalón por probabilidad, después la fruta dentro del escalón. */
  function rollFruitKind(): { index: number; tier: FruitTier } {
    const roll = Math.random();
    let cumulative = 0;
    let tier: FruitTier = "common";
    for (const candidate of ["common", "medium", "rare"] as FruitTier[]) {
      cumulative += TIERS[candidate].probability;
      if (roll < cumulative) {
        tier = candidate;
        break;
      }
    }
    const pool = FRUITS.filter((f) => f.tier === tier);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Hay una sola fruta en el tablero a la vez y no caduca: se queda hasta que la
   * serpiente la come. Con el tablero lleno queda en null y no se dibuja nada;
   * es una rama defensiva, porque llegar ahí son 768 frutas.
   */
  function spawnFruit() {
    const free = freeCells();
    if (free.length === 0) {
      fruit = null;
      return;
    }
    const kind = rollFruitKind();
    fruit = { cell: free[Math.floor(Math.random() * free.length)], ...kind };
  }

  // ── Fin de partida ──────────────────────────────────────────────────────────
  /**
   * El único camino por el que se termina: lo usan el borde, el mordisco propio
   * y el botón FIN. El status protege de que onGameOver() se llame dos veces —no
   * hay vidas que descontar, el juego muere de una—.
   */
  function die() {
    if (state === "gameover") return;
    state = "gameover";
    stopLoop();
    playDie();
    emitSnapshot();
    options.onGameOver(score);
  }

  // ── El tic de la serpiente ──────────────────────────────────────────────────
  function step() {
    // Un giro por tic. La cola ya validó que ninguno sea de 180°.
    const turn = queue.shift();
    if (turn) direction = turn;

    const head = body[0];
    const delta = STEP[direction];
    const next: Cell = { col: head.col + delta.col, row: head.row + delta.row };

    // El borde mata: es la regla canónica del género y la que le da sentido a un
    // tablero grande. El wrap de asteroides no se replica.
    if (next.col < 0 || next.col >= COLS || next.row < 0 || next.row >= ROWS) {
      die();
      return;
    }

    // El mordisco propio excluye el último segmento cuando se va a liberar en
    // este mismo tic: entrar en la celda que la cola deja no es morderse. Si hay
    // crecimiento pendiente no se libera nada, así que ahí cuenta todo el cuerpo.
    const bitable = pendingGrowth > 0 ? body.length : body.length - 1;
    for (let i = 0; i < bitable; i++) {
      if (body[i].col === next.col && body[i].row === next.row) {
        die();
        return;
      }
    }

    const eating = fruit !== null && fruit.cell.col === next.col && fruit.cell.row === next.row;
    if (eating && fruit) {
      // Una celda de crecimiento por fruta, sea cual sea el escalón: acoplar
      // riesgo y recompensa con 1/2/3 celdas era elegante pero suma una regla más
      // a un juego que ya tiene tres tablas, y el halo ya comunica la rareza.
      pendingGrowth += 1;
      fruitsEaten += 1;
    }

    body.unshift(next);
    if (pendingGrowth > 0) {
      pendingGrowth -= 1;
    } else {
      body.pop();
    }

    if (eating && fruit) {
      // El largo que multiplica es el POSTERIOR a crecer, para que sea el mismo
      // número que el HUD muestra en el slot Largo cuando el puntaje sube.
      // Cualquiera de las dos convenciones servía; dejarla sin decidir no.
      score += TIERS[fruit.tier].value * body.length;
      playEat();
      spawnFruit();
    }
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function drawGrid() {
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let col = 1; col < COLS; col++) {
      ctx.moveTo(col * CELL + 0.5, 0);
      ctx.lineTo(col * CELL + 0.5, H);
    }
    for (let row = 1; row < ROWS; row++) {
      ctx.moveTo(0, row * CELL + 0.5);
      ctx.lineTo(W, row * CELL + 0.5);
    }
    ctx.stroke();
  }

  function drawFruit() {
    if (!fruit) return;
    const cx = fruit.cell.col * CELL + CELL / 2;
    const cy = fruit.cell.row * CELL + CELL / 2;
    const halo = TIERS[fruit.tier].halo;

    // El halo va siempre, con sprite o sin él: es lo que le dice al jugador de un
    // vistazo cuánto vale la fruta que tiene delante.
    ctx.save();
    ctx.shadowColor = halo;
    ctx.shadowBlur = GLOW_HALO;
    ctx.globalAlpha = HALO_ALPHA;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, HALO_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (atlas && atlasReady) {
      ctx.drawImage(
        atlas,
        fruit.index * SPRITE_W,
        0,
        SPRITE_W,
        SPRITE_H,
        cx - FRUIT_W / 2,
        cy - FRUIT_H / 2,
        FRUIT_W,
        FRUIT_H
      );
      return;
    }

    // El respaldo vectorial: el juego es jugable en los dos casos.
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, FRUIT_FALLBACK_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake() {
    // El cuerpo primero, de atrás hacia adelante, sin sombra.
    const last = body.length - 1;
    ctx.fillStyle = SNAKE_COLOR;
    for (let i = last; i >= 1; i--) {
      const t = last === 0 ? 0 : i / last;
      ctx.globalAlpha = BODY_ALPHA_HEAD - t * (BODY_ALPHA_HEAD - BODY_ALPHA_TAIL);
      ctx.fillRect(body[i].col * CELL + 1, body[i].row * CELL + 1, CELL - 2, CELL - 2);
    }
    ctx.globalAlpha = 1;

    // Y la cabeza, la única del cuerpo que lleva glow.
    const head = body[0];
    ctx.save();
    ctx.shadowColor = SNAKE_COLOR;
    ctx.shadowBlur = GLOW_HEAD;
    ctx.fillStyle = SNAKE_COLOR;
    ctx.fillRect(head.col * CELL + 1, head.row * CELL + 1, CELL - 2, CELL - 2);
    ctx.restore();
  }

  /** El marco es el que mata: se dibuja último, por encima de todo. */
  function drawFrame() {
    ctx.save();
    ctx.shadowColor = FRAME_COLOR;
    ctx.shadowBlur = GLOW_FRAME;
    ctx.strokeStyle = FRAME_COLOR;
    ctx.lineWidth = FRAME_WIDTH;
    ctx.strokeRect(FRAME_WIDTH / 2, FRAME_WIDTH / 2, W - FRAME_WIDTH, H - FRAME_WIDTH);
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    drawGrid();
    drawFruit();
    drawSnake();
    drawFrame();
  }

  // ── Snapshot ────────────────────────────────────────────────────────────────
  /**
   * Emite solo si cambió algo: si no, React re-renderiza 60 veces por segundo.
   * Puntaje, nivel y largo cambian al comer, no por frame.
   *
   * Sin `lives`: snake no tiene el concepto y <Reproductor> ya sabe ocultar el
   * slot ♥ desde que tetris lo estrenó.
   */
  function emitSnapshot() {
    const snapshot: GameSnapshot = {
      score,
      level: level(),
      status: state,
      // Las celdas que ocupa la serpiente. Es el único de los candidatos que no
      // es una función del conteo de frutas, y el dato que explica por qué el
      // tablero se está cerrando.
      extra: { label: "Largo", value: String(body.length) },
    };
    const prev = lastSnapshot;
    if (
      prev &&
      prev.score === snapshot.score &&
      prev.level === snapshot.level &&
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
    // varios segundos y el acumulador ejecutaría decenas de tics de golpe, con
    // la serpiente apareciendo estrellada contra una pared sin que nadie la haya
    // visto moverse. Con el tope y un piso de tic de 60 ms nunca entra más de un
    // tic por frame.
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_FRAME_MS);
    lastTime = ts;

    accumulator += dt;
    while (state === "playing" && accumulator >= tickMs()) {
      accumulator -= tickMs();
      step();
    }
    // step() puede haber terminado la partida: die() ya paró el loop.
    if (state === "gameover") return;

    draw();
    emitSnapshot();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId !== null) return;
    // lastTime en null hace que el primer dt sea 0, y el acumulador arranca
    // limpio: al reanudar, la serpiente no da diez tics de golpe por el tiempo
    // que estuvo pausada.
    lastTime = null;
    accumulator = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  /** Tres celdas en fila en el centro, mirando a la derecha, y una fruta nueva. */
  function initGame() {
    body = [];
    for (let i = 0; i < START_LENGTH; i++) {
      body.push({ col: START_HEAD.col - i, row: START_HEAD.row });
    }
    direction = "right";
    queue = [];
    pendingGrowth = 0;
    fruitsEaten = 0;
    score = 0;
    state = "playing";
    paused = false;
    spawnFruit();
  }

  // ── Handle ──────────────────────────────────────────────────────────────────
  return {
    start() {
      if (destroyed || running) return;
      running = true;
      window.addEventListener("keydown", onKeyDown);
      listenersAttached = true;

      // El Image se crea acá y no a nivel de módulo: en el servidor no existe.
      atlas = new Image();
      atlas.onload = () => {
        atlasReady = true;
      };
      atlas.onerror = () => {
        // El respaldo vectorial queda para siempre. El juego sigue jugable.
        atlasReady = false;
      };
      atlas.src = ATLAS_SRC;

      // El AudioContext también se crea acá y no a nivel de módulo: en el
      // servidor no existe. Nace suspendido mientras no haya gesto y el resume()
      // llega con el primer keydown, en unlockAudio(); hasta entonces no se le
      // programa ningún nodo, que es lo que evita el warning de autoplay.
      // El master arranca ya en su volumen o en cero, según cómo haya venido
      // setMuted() desde <GameCanvas>, que lo llama antes que a start().
      audioCtx = new AudioContext();
      master = audioCtx.createGain();
      master.gain.value = muted ? 0 : SOUND_VOLUME;
      master.connect(audioCtx.destination);

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
      // El botón FIN entra por el mismo camino que chocar: no hay vidas que
      // forzar antes.
      die();
    },

    /**
     * El botón de silencio del HUD. <GameCanvas> lo llama justo después de crear
     * el motor —antes de start(), cuando el AudioContext todavía no existe— y de
     * nuevo en cada cambio, así que tiene que aguantar los dos momentos.
     *
     * Silenciar corta en el acto lo que esté sonando; volver al sonido rehabilita
     * sin reproducir nada por su cuenta.
     */
    setMuted(next: boolean) {
      muted = next;
      if (master) master.gain.value = muted ? 0 : SOUND_VOLUME;
      if (muted) stopVoices();
    },

    destroy() {
      destroyed = true;
      running = false;
      stopLoop();
      if (atlas) {
        // Sin esto, un onload que llega después del desmontaje escribe sobre un
        // motor que ya no dibuja.
        atlas.onload = null;
        atlas.onerror = null;
        atlas = null;
      }
      atlasReady = false;
      // Sin esto, el barrido de la muerte disparado en el último frame sigue
      // sonando después de que la pantalla ya cambió de juego, y cada visita
      // deja un AudioContext vivo: el navegador solo permite unos pocos.
      stopVoices();
      unlocked = false;
      master?.disconnect();
      master = null;
      if (audioCtx && audioCtx.state !== "closed") void audioCtx.close().catch(() => {});
      audioCtx = null;
      if (listenersAttached) {
        window.removeEventListener("keydown", onKeyDown);
        listenersAttached = false;
      }
    },
  };
}
