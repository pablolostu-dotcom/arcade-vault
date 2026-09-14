// ===== lib/games/abismo/engine.ts =====
// El quinto motor del portal y el primero que sale de una game jam: el tema fue
// «el fondo del mar» y el juego se diseñó entero antes de escribir una línea.
// El brief, el diseño y el spec están en specs/game-jam/abismo/.
//
// Del chasis no cambia nada, y esa es la mejor noticia que puede dar un motor.
// GameSnapshot ya modela `lives` opcional desde el SPEC 07 y ya tiene el slot
// `extra`; EngineHandle ya tiene setMuted() desde el SPEC 08. Escape y P los ata
// <Reproductor> desde el SPEC 07: manejarlas también acá dejaría la pausa
// alternando dos veces por pulsación.
//
// NADA corre al importar el módulo. Los listeners y el requestAnimationFrame
// viven dentro de start() y se deshacen en destroy(). A nivel de módulo correrían
// en el servidor y reventarían el build, que es la misma razón por la que el
// SPEC 08 tuvo que mover sus `new Audio()` y el SPEC 09 su `new Image()`.
//
// El motor no dibuja HUD, ni overlay de pausa, ni de game over, ni
// instrucciones: todo eso lo pinta <Reproductor>. En particular NO dibuja una
// barra de oxígeno — una barra es HUD; la alarma de tanque bajo es el casco
// parpadeando y el número exacto vive en el slot `extra` de React.
//
// El archivo está completo según el plan del SPEC 10: el mundo, el submarino, el
// oxígeno, los buzos, el cobro en superficie, los enemigos, los torpedos y los
// seis efectos de audio, sintetizados y sin un solo binario en el repo.

import type { EngineHandle, EngineOptions, GameSnapshot, GameStatus } from "../types";

// ── El mundo ──────────────────────────────────────────────────────────────────
// 800×600 partido en tres bandas, y la cuenta cierra exacta: 90 + 480 + 30 = 600,
// con (570 − 90) / 6 = 80 px de carril. No sobran bandas, así que .game-canvas no
// cambia: su aspect-ratio 4/3 ya calza.
//
// Como en los otros cuatro motores, NUNCA se lee canvas.width: <GameCanvas> lo
// fija en 800 × devicePixelRatio, así que en una pantalla HiDPI valdría 1600 y el
// juego se jugaría en un mundo del doble de ancho.
const W = 800;
const H = 600;
const SURFACE_Y = 90; // la línea de agua
const SEABED_Y = 570; // el lecho marino

// Los carriles son solo para NACER: una vez en el agua, cada cosa conserva su y
// hasta que sale por el otro lado. El submarino del jugador no usa carriles.
const LANE_Y = [130, 210, 290, 370, 450, 530]; // SURFACE_Y + 80 * (i + 0.5)
// Fuera de pantalla, los dos: nada aparece nunca dentro del campo visible, así
// que la muerte por spawn encima del jugador no existe por construcción.
const SPAWN_X_LEFT = -80;
const SPAWN_X_RIGHT = 880;

// ── El submarino del jugador ──────────────────────────────────────────────────
const SUB_W = 56;
const SUB_H = 26;
const SUB_SPEED_X = 260; // px/s, sin inercia: soltar la tecla frena en el acto
const SUB_SPEED_Y = 200; // px/s
const SUB_MIN_Y = 58; // el casco asoma 32 px por encima de SURFACE_Y
const SUB_MAX_Y = 557; // SEABED_Y − SUB_H / 2
const START_LIVES = 3;
const RESPAWN_X = 120;
const RESPAWN_MS = 900; // invulnerable y parpadeando

// ── El oxígeno ────────────────────────────────────────────────────────────────
// El tanque solo se recarga en la superficie, que es también el único lugar
// donde los buzos se cobran (paso 3). Esa doble función de la superficie es el
// centro del juego: subir siempre es gratis en vidas y carísimo en tiempo.
const TANK_S = 50; // segundos de tanque lleno
const TANK_ALARM_S = 12; // por debajo: casco parpadeando y pulso de alarma
const REFILL_S = 2.5; // segundos que tarda la recarga completa
const REFILL_RATE = TANK_S / REFILL_S; // 20 segundos de aire por segundo de recarga
const ALARM_BLINK_HZ = 4;

// ── Los buzos ─────────────────────────────────────────────────────────────────
// Seis plazas de bodega es lo que le pone techo a la decisión del juego. Sin
// techo, la estrategia óptima sería una sola —juntar todo— y no habría juego.
const DIVER_CAPACITY = 6;
const DIVER_W = 16;
const DIVER_H = 22;
const DIVER_SPEED = 35; // px/s, siempre: los buzos NO escalan con el nivel
const DIVER_SPAWN_MS = 4200;
const DIVER_MAX_ON_SCREEN = 3;

// ── Los enemigos ──────────────────────────────────────────────────────────────
// Ninguno persigue: cruzan su carril en línea recta y nada más. Es lo que
// mantiene el motor en el orden de los 25 KB, y es el motivo exacto por el que
// PAC-MAN y BOMBERMAN quedaron afuera del barrido de candidatos.
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
// El rescate es cuadrático y ahí vive el juego: seis viajes de un buzo pagan
// 6 × 50 = 300 de rescate, y un solo viaje con seis paga 50 × 36 = 1800. La
// codicia tiene número y el jugador lo puede calcular antes de decidir.
//
// Los enemigos, en cambio, pagan PLANO y no se multiplican por el nivel:
// multiplicarlos haría que el ranking midiera «sobreviví un minuto más» en vez
// de «jugué mejor». El crecimiento ya lo aporta el rescate.
const SHARK_POINTS = 20;
const ESUB_POINTS = 30;
const RESCUE_BASE = 50; // rescate = RESCUE_BASE × buzos²
const O2_BONUS = 2; // por segundo entero de tanque al emerger
const DIVERS_PER_LEVEL = 6;

// ── El audio ──────────────────────────────────────────────────────────────────
// Sintetizado con AudioContext y CERO binarios. Es el camino B del paso 5 del
// SPEC 09, que ya corre en producción en lib/games/snake/engine.ts, así que no
// se repite su búsqueda en bancos de audio: su conclusión sigue valiendo
// —Pixabay responde 403, freesound pide OAuth, y el único CC0 verificable de
// Wikimedia pesa 482 KB en Ogg, que Safari no reproduce—.
//
// Los seis efectos se construyen sobre dos primitivas, tone() y noise(), para
// que agregar el séptimo sea una línea y no otro grafo de nodos.
const SOUND_VOLUME = 0.4; // el mismo del SPEC 08 y del SPEC 09
/** exponentialRampToValueAtTime no acepta 0: este es el cero práctico. */
const SILENCE = 0.0001;

/** Torpedo: una cuadrada que cae, corta y seca. */
const SND_TORPEDO_FROM = 660;
const SND_TORPEDO_TO = 330;
const SND_TORPEDO_MS = 90;
/** Impacto: ruido blanco con un lowpass que se cierra. */
const SND_HIT_MS = 250;
const SND_HIT_CUTOFF_FROM = 2400;
const SND_HIT_CUTOFF_TO = 200;
/** Recoger un buzo: tres notas ascendentes, 220 ms en total. */
const SND_PICKUP_NOTES = [523.25, 659.25, 783.99]; // do · mi · sol
const SND_PICKUP_NOTE_MS = 73;
/** Cobrar en superficie: el único sonido largo y alegre del juego. */
const SND_CASH_NOTES = [523.25, 659.25, 783.99, 1046.5, 1318.51];
const SND_CASH_NOTE_MS = 64;
/** Alarma de oxígeno: dos pulsos por segundo mientras el tanque esté bajo. */
const SND_ALARM_HZ = 1200;
const SND_ALARM_MS = 70;
const SND_ALARM_PULSE_MS = 500;
/** Muerte: una sierra que se desploma. */
const SND_DEATH_FROM = 440;
const SND_DEATH_TO = 55;
const SND_DEATH_MS = 400;

// ── El loop ───────────────────────────────────────────────────────────────────
const MAX_FRAME_MS = 50; // el tope del dt, igual que en los otros cuatro motores

// ── La paleta ─────────────────────────────────────────────────────────────────
// Constantes del motor, NUNCA leídas del DOM: un motor que necesita una hoja de
// estilos para dibujar falla en silencio. Misma regla que el SPEC 05, el 08 y el
// 09.
//
// El código de color es la regla de lectura del juego: magenta sos vos, amarillo
// te mata, verde se salva, gris te muerde. Se aprende en dos segundos y no
// necesita leyenda.
const COLOR_DEEP_TOP = "#001018"; // el agua cerca de la superficie
const COLOR_DEEP_BOTTOM = "#000000"; // el abismo
const COLOR_AIR = "rgba(0, 245, 255, 0.06)";
const COLOR_SURFACE = "#00f5ff";
const COLOR_SEABED = "rgba(138, 143, 181, 0.18)";
const COLOR_BUBBLE = "rgba(0, 245, 255, 0.10)";
const COLOR_SUB = "#ff006e";
const COLOR_SUB_ALARM = "#ffa8c8"; // el casco en alarma, magenta al blanco
const COLOR_CARGO_ON = "#00ff88"; // una luz de bodega ocupada
const COLOR_CARGO_OFF = "rgba(0, 255, 136, 0.18)"; // una plaza vacía
const COLOR_DIVER = "#00ff88"; // --green: el color de lo que salvás
const COLOR_TORPEDO = "#ff006e"; // lo que sale de vos es magenta
const COLOR_SHARK = "#8a8fb5"; // --ink-dim: la silueta que no brilla
const COLOR_ESUB = "#f5ff00"; // --yellow
const COLOR_ETORPEDO = "#f5ff00"; // lo que viene del enemigo es amarillo

// El shadowBlur va SOLO en el submarino, en la línea de agua y (desde el paso 3)
// en los buzos: cinco sombras por frame como techo. No va en los enemigos, que
// pueden ser diez, ni en las burbujas, que son cuarenta — cien sombras por frame
// hunden los 60 fps, la lección que el SPEC 09 escribió sobre el cuerpo de la
// serpiente.
const GLOW_SUB = 12;
const GLOW_SURFACE = 10;
const GLOW_DIVER = 8;

// ── Las burbujas de fondo ─────────────────────────────────────────────────────
// Decoración pura: no colisionan con nada y no entran en ninguna regla. Son lo
// que hace que el agua se lea como agua sin costar una sola mecánica, que es
// exactamente el argumento con el que el diseño descartó la inercia.
const BUBBLE_COUNT = 40;
const BUBBLE_MIN_R = 1;
const BUBBLE_MAX_R = 3.5;
const BUBBLE_MIN_SPEED = 12; // px/s hacia arriba
const BUBBLE_MAX_SPEED = 34;

/** La orientación del submarino: la última dirección horizontal pulsada. */
type Facing = "left" | "right";

type Bubble = { x: number; y: number; r: number; speed: number };

/** Un buzo cruzando su carril. `vx` lleva el signo de la dirección. */
type Diver = { x: number; y: number; vx: number };

/** Gris te muerde, amarillo te dispara. */
type EnemyKind = "shark" | "esub";

type Enemy = {
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  /** ms para el próximo disparo. Solo lo usan los `esub`. */
  fireMs: number;
};

/** Un torpedo, del jugador o de un enemigo. Siempre horizontal. */
type Torpedo = { x: number; y: number; vx: number };

/** Las teclas que el juego usa, por e.code. El disparo entra en el paso 4. */
const KEY_UP = new Set(["ArrowUp", "KeyW"]);
const KEY_DOWN = new Set(["ArrowDown", "KeyS"]);
const KEY_LEFT = new Set(["ArrowLeft", "KeyA"]);
const KEY_RIGHT = new Set(["ArrowRight", "KeyD"]);
/** Las flechas scrollean la página y la barra la scrollea una pantalla entera. */
const PREVENT_DEFAULT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

export function createAbismoEngine(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): EngineHandle {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("El canvas de ABISMO no expone un contexto 2d.");
  const ctx: CanvasRenderingContext2D = context2d;

  // ── Estado ──────────────────────────────────────────────────────────────────
  /** El centro del submarino. `y <= SURFACE_Y` es la condición de emergido. */
  let subX = RESPAWN_X;
  let subY = SURFACE_Y;
  let facing: Facing = "right";
  /** Segundos de aire restantes, de TANK_S a 0. */
  let tank = TANK_S;
  let lives = START_LIVES;
  /** Buzos a bordo, de 0 a DIVER_CAPACITY. Morir los pierde sin cobrarlos. */
  let divers = 0;
  /** Buzos ENTREGADOS en la superficie, no recogidos: es lo que gobierna el nivel. */
  let diversRescued = 0;
  let score = 0;
  let state: GameStatus = "playing";

  /** ms restantes de invulnerabilidad tras un respawn. 0 = vulnerable. */
  let invulnMs = 0;
  /** Reloj propio del motor, en ms de juego. Mueve el parpadeo de la alarma. */
  let clockMs = 0;

  /**
   * El cobro es un EVENTO DE CRUCE, no un estado. Sin esta bandera, quedarse
   * medio segundo en la superficie pagaría los buzos treinta veces: el cobro
   * ocurre en el frame en que esto pasa de false a true, y en ningún otro.
   */
  let wasSurfaced = true;

  const bubbles: Bubble[] = [];
  /** Los buzos que están nadando en el agua. `divers` es cuántos llevás a bordo. */
  const swimmers: Diver[] = [];
  /** ms que faltan para soltar el próximo buzo. */
  let diverSpawnMs = DIVER_SPAWN_MS;

  const enemies: Enemy[] = [];
  /** ms que faltan para el próximo enemigo. Se acorta con el nivel. */
  let enemySpawnMs = SPAWN_BASE_MS;
  /** ms para el próximo pulso de alarma. Solo corre con el tanque bajo. */
  let alarmPulseMs = 0;
  /** Los torpedos del jugador y los de los enemigos, en listas separadas. */
  const torpedoes: Torpedo[] = [];
  const eTorpedoes: Torpedo[] = [];
  /** ms que faltan para poder volver a disparar. */
  let torpedoCooldownMs = 0;

  const held = { up: false, down: false, left: false, right: false, fire: false };

  let rafId: number | null = null;
  let lastTime: number | null = null;
  let running = false;
  let paused = false;
  let destroyed = false;
  let listenersAttached = false;
  let lastSnapshot: GameSnapshot | null = null;

  // ── Audio ───────────────────────────────────────────────────────────────────
  // Nada de esto corre al importar el módulo ni al crear el motor: el
  // AudioContext se construye en start() y se cierra en destroy(). A nivel de
  // módulo correría en el servidor y reventaría el build, que es exactamente lo
  // que el SPEC 08 tuvo que arreglar con sus `new Audio()`.
  let audioCtx: AudioContext | null = null;
  let master: GainNode | null = null;
  /** Las fuentes vivas, para que destroy() las corte sin esperar su stop(). */
  const voices = new Set<AudioScheduledSourceNode>();
  let muted = false;
  /**
   * La política de autoplay exige un gesto antes de que suene nada. Se levanta
   * con el primer keydown de la partida: sin teclas el submarino no se mueve ni
   * dispara, así que el gesto llega en el primer segundo. Hasta entonces no se
   * programa ni un nodo, y no hay NotAllowedError que registrar.
   */
  let unlocked = false;

  function unlockAudio() {
    if (unlocked) return;
    unlocked = true;
    if (audioCtx?.state === "suspended") void audioCtx.resume().catch(() => {});
  }

  /** ¿Se puede programar algo ahora mismo? */
  function audioReady(): boolean {
    return Boolean(audioCtx && master && !muted && unlocked && audioCtx.state !== "closed");
  }

  function trackVoice(node: AudioScheduledSourceNode) {
    voices.add(node);
    node.onended = () => voices.delete(node);
  }

  /**
   * La primera primitiva: un oscilador con su envolvente. `delay` deja encadenar
   * notas sin un temporizador de JavaScript por nota.
   */
  function tone(type: OscillatorType, from: number, to: number, ms: number, delay = 0, gain = 1) {
    if (!audioReady()) return;
    const actx = audioCtx as AudioContext;
    const out = master as GainNode;

    const t0 = actx.currentTime + delay / 1000;
    const dur = ms / 1000;
    const osc = actx.createOscillator();
    const env = actx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);

    // Ataque de 5 ms para que no chasquee, y caída al silencio.
    env.gain.setValueAtTime(SILENCE, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    env.gain.exponentialRampToValueAtTime(SILENCE, t0 + dur);

    osc.connect(env).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur);
    trackVoice(osc);
  }

  /**
   * La segunda primitiva: ruido blanco por un lowpass que se cierra. Es lo que
   * hace que un impacto suene a impacto y no a nota.
   */
  function noise(ms: number, cutoffFrom: number, cutoffTo: number) {
    if (!audioReady()) return;
    const actx = audioCtx as AudioContext;
    const out = master as GainNode;

    const t0 = actx.currentTime;
    const dur = ms / 1000;
    const frames = Math.max(1, Math.floor(actx.sampleRate * dur));
    const buffer = actx.createBuffer(1, frames, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;

    const source = actx.createBufferSource();
    source.buffer = buffer;

    const filter = actx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoffFrom, t0);
    filter.frequency.exponentialRampToValueAtTime(cutoffTo, t0 + dur);

    const env = actx.createGain();
    env.gain.setValueAtTime(1, t0);
    env.gain.exponentialRampToValueAtTime(SILENCE, t0 + dur);

    source.connect(filter).connect(env).connect(out);
    source.start(t0);
    trackVoice(source);
  }

  // Los seis efectos, todos por encima de las dos primitivas de arriba.
  function playTorpedo() {
    tone("square", SND_TORPEDO_FROM, SND_TORPEDO_TO, SND_TORPEDO_MS, 0, 0.6);
  }

  function playHit() {
    noise(SND_HIT_MS, SND_HIT_CUTOFF_FROM, SND_HIT_CUTOFF_TO);
  }

  function playPickup() {
    SND_PICKUP_NOTES.forEach((hz, i) => {
      tone("triangle", hz, hz, SND_PICKUP_NOTE_MS, i * SND_PICKUP_NOTE_MS, 0.7);
    });
  }

  function playCash() {
    SND_CASH_NOTES.forEach((hz, i) => {
      tone("square", hz, hz, SND_CASH_NOTE_MS, i * SND_CASH_NOTE_MS, 0.55);
    });
  }

  function playAlarm() {
    tone("sine", SND_ALARM_HZ, SND_ALARM_HZ, SND_ALARM_MS, 0, 0.5);
  }

  function playDeath() {
    tone("sawtooth", SND_DEATH_FROM, SND_DEATH_TO, SND_DEATH_MS, 0, 0.8);
  }

  /** Corta en el acto lo que esté sonando. La usan setMuted(true) y destroy(). */
  function stopVoices() {
    for (const voice of voices) {
      try {
        voice.stop();
      } catch {
        // Una fuente que todavía no arrancó tira al pararla; no importa.
      }
    }
    voices.clear();
  }

  // ── Utilidades ──────────────────────────────────────────────────────────────
  function clamp(value: number, min: number, max: number): number {
    return value < min ? min : value > max ? max : value;
  }

  function rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  /** ¿El submarino está emergido? Es la condición de recarga y la del cobro. */
  function isSurfaced(): boolean {
    return subY <= SURFACE_Y;
  }

  /**
   * Colisión AABB, rectángulo contra rectángulo, con las coordenadas centradas.
   * Es la única forma de colisión del juego: no hay círculos, ni separación de
   * ejes, ni rotación. Desde el paso 4 la comparten los enemigos y los torpedos.
   */
  function overlaps(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ): boolean {
    return (
      Math.abs(ax - bx) * 2 < aw + bw && //
      Math.abs(ay - by) * 2 < ah + bh
    );
  }

  function level(): number {
    return Math.floor(diversRescued / DIVERS_PER_LEVEL) + 1;
  }

  // Con el nivel se mueven TRES cosas y nada más: la velocidad de los enemigos,
  // cada cuánto aparecen, y cuántos de ellos disparan. El tanque, la bodega y el
  // valor de los puntos no cambian nunca, así que una partida de nivel 9 se
  // juega con las mismas reglas que una de nivel 1 — con más tráfico.
  function enemySpeed(): number {
    return Math.min(ENEMY_SPEED_MAX, ENEMY_SPEED_BASE + (level() - 1) * ENEMY_SPEED_STEP);
  }

  function enemySpawnInterval(): number {
    return Math.max(SPAWN_MIN_MS, SPAWN_BASE_MS - (level() - 1) * SPAWN_STEP_MS);
  }

  function esubShare(): number {
    return Math.min(ESUB_SHARE_MAX, ESUB_SHARE_BASE + (level() - 1) * ESUB_SHARE_STEP);
  }

  // ── Arranque y reinicio ─────────────────────────────────────────────────────
  function initBubbles() {
    bubbles.length = 0;
    for (let i = 0; i < BUBBLE_COUNT; i += 1) {
      bubbles.push({
        x: rand(0, W),
        y: rand(SURFACE_Y, SEABED_Y),
        r: rand(BUBBLE_MIN_R, BUBBLE_MAX_R),
        speed: rand(BUBBLE_MIN_SPEED, BUBBLE_MAX_SPEED),
      });
    }
  }

  /** Deja al submarino en la superficie, con el tanque lleno e invulnerable. */
  function placeSub() {
    subX = RESPAWN_X;
    subY = SURFACE_Y;
    facing = "right";
    tank = TANK_S;
    invulnMs = RESPAWN_MS;
    // Nace emergido, así que el cruce ya está "consumido": sin esto el primer
    // frame contaría como una emersión y dispararía un cobro que nadie hizo.
    wasSurfaced = true;
  }

  function initGame() {
    lives = START_LIVES;
    divers = 0;
    diversRescued = 0;
    score = 0;
    state = "playing";
    clockMs = 0;
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.fire = false;
    placeSub();
    initBubbles();
    swimmers.length = 0;
    diverSpawnMs = DIVER_SPAWN_MS;
    enemies.length = 0;
    enemySpawnMs = SPAWN_BASE_MS;
    torpedoes.length = 0;
    eTorpedoes.length = 0;
    torpedoCooldownMs = 0;
  }

  /**
   * Suelta un enemigo en un carril al azar y siempre fuera de pantalla. Que
   * todo nazca en x = −80 o x = 880 elimina POR CONSTRUCCIÓN la muerte por
   * aparición encima del jugador, que es la única que no se puede mitigar con
   * reflejos. Y como los carriles empiezan en y = 130, ningún enemigo entra en
   * la banda de aire: la superficie es segura sin una regla que la declare.
   */
  function spawnEnemy() {
    const fromLeft = Math.random() < 0.5;
    const kind: EnemyKind = Math.random() < esubShare() ? "esub" : "shark";
    enemies.push({
      kind,
      x: fromLeft ? SPAWN_X_LEFT : SPAWN_X_RIGHT,
      y: LANE_Y[Math.floor(Math.random() * LANE_Y.length)],
      vx: fromLeft ? enemySpeed() : -enemySpeed(),
      fireMs: ETORPEDO_COOLDOWN_MS,
    });
  }

  /**
   * Suelta un buzo en un carril al azar, desde uno de los dos costados y SIEMPRE
   * fuera de pantalla. Los buzos no escalan con el nivel: son la constante del
   * juego, y lo que cambia alrededor es el tráfico que hay que atravesar.
   */
  function spawnDiver() {
    const fromLeft = Math.random() < 0.5;
    swimmers.push({
      x: fromLeft ? SPAWN_X_LEFT : SPAWN_X_RIGHT,
      y: LANE_Y[Math.floor(Math.random() * LANE_Y.length)],
      vx: fromLeft ? DIVER_SPEED : -DIVER_SPEED,
    });
  }

  // ── Muerte ──────────────────────────────────────────────────────────────────
  /**
   * La única rama de muerte del juego. Llegan acá el tanque a cero, el botón FIN
   * y —desde el paso 4— el contacto con un enemigo o un torpedo enemigo. Que
   * todas pasen por la misma función es lo que garantiza que FIN y perder la
   * última vida terminen idénticos.
   */
  function die() {
    if (state === "gameover") return;

    playDeath();

    // Los buzos a bordo se pierden sin cobrarse: esa es la penalización real de
    // la codicia, y es la que le da peso a la decisión de subir.
    divers = 0;
    lives -= 1;

    if (lives <= 0) {
      lives = 0;
      state = "gameover";
      stopLoop();
      draw();
      emitSnapshot();
      // Una sola vez, protegido por el status de arriba.
      options.onGameOver(score);
      return;
    }

    // Reaparece en la superficie, que es donde no entra ningún enemigo: el
    // respawn nunca puede ser injusto, ni siquiera con la pantalla llena.
    placeSub();
  }

  // ── Los buzos ───────────────────────────────────────────────────────────────
  /**
   * Mueve a los buzos por su carril, los recoge al tocarlos y suelta uno nuevo
   * cada DIVER_SPAWN_MS mientras haya menos de DIVER_MAX_ON_SCREEN nadando.
   */
  function updateDivers(seconds: number, dt: number) {
    diverSpawnMs -= dt;
    if (diverSpawnMs <= 0) {
      diverSpawnMs = DIVER_SPAWN_MS;
      if (swimmers.length < DIVER_MAX_ON_SCREEN) spawnDiver();
    }

    for (let i = swimmers.length - 1; i >= 0; i -= 1) {
      const diver = swimmers[i];
      diver.x += diver.vx * seconds;

      // El que cruza sin ser recogido se va, y no penaliza: los buzos son
      // oportunidades, no cuotas.
      if (diver.x < SPAWN_X_LEFT - DIVER_W || diver.x > SPAWN_X_RIGHT + DIVER_W) {
        swimmers.splice(i, 1);
        continue;
      }

      // Con la bodega llena el buzo NO se recoge y sigue nadando. No se pierde,
      // no se penaliza y no rebota: una séptima plaza sería una constante más
      // para un caso que dura dos segundos.
      if (divers >= DIVER_CAPACITY) continue;

      if (overlaps(subX, subY, SUB_W, SUB_H, diver.x, diver.y, DIVER_W, DIVER_H)) {
        swimmers.splice(i, 1);
        divers += 1;
        playPickup();
      }
    }
  }

  /**
   * El corazón del juego. Cobra en el frame en que el submarino cruza hacia
   * arriba la línea de agua, y en ningún otro: quedarse arriba no vuelve a
   * pagar. Emerger sin buzos recarga el tanque y no suma nada — subir a
   * respirar siempre es gratis en vidas y siempre es carísimo en puntaje, que
   * es exactamente la presión que el juego quiere.
   */
  function collectOnSurface() {
    const surfaced = isSurfaced();
    if (surfaced && !wasSurfaced && divers > 0) {
      score += RESCUE_BASE * divers * divers;
      score += O2_BONUS * Math.floor(tank);
      diversRescued += divers;
      divers = 0;
      playCash();
    }
    wasSurfaced = surfaced;
  }

  // ── Los enemigos y los torpedos ─────────────────────────────────────────────
  function enemySize(kind: EnemyKind): { w: number; h: number } {
    return kind === "shark" ? { w: SHARK_W, h: SHARK_H } : { w: ESUB_W, h: ESUB_H };
  }

  /** El torpedo del jugador sale por la proa, en la dirección en que mira. */
  function fireTorpedo() {
    if (torpedoes.length >= TORPEDO_MAX) return;
    const dir = facing === "right" ? 1 : -1;
    torpedoes.push({
      x: subX + dir * (SUB_W / 2 + TORPEDO_W / 2),
      y: subY,
      vx: dir * TORPEDO_SPEED,
    });
    torpedoCooldownMs = TORPEDO_COOLDOWN_MS;
    playTorpedo();
  }

  function updateEnemies(seconds: number, dt: number) {
    enemySpawnMs -= dt;
    if (enemySpawnMs <= 0) {
      enemySpawnMs = enemySpawnInterval();
      if (enemies.length < ENEMY_MAX) spawnEnemy();
    }

    for (let i = enemies.length - 1; i >= 0; i -= 1) {
      const enemy = enemies[i];
      const { w } = enemySize(enemy.kind);
      enemy.x += enemy.vx * seconds;

      // El que sale por el borde opuesto se recicla: no da ni quita puntos.
      if (enemy.x < SPAWN_X_LEFT - w || enemy.x > SPAWN_X_RIGHT + w) {
        enemies.splice(i, 1);
        continue;
      }

      // Los submarinos enemigos disparan HACIA ADELANTE, en la dirección en que
      // ya se están moviendo. No corrigen hacia el jugador: no hay puntería,
      // hay tráfico. Solo disparan dentro de la pantalla, para que no lleguen
      // torpedos desde fuera del campo visible.
      if (enemy.kind !== "esub") continue;
      enemy.fireMs -= dt;
      if (enemy.fireMs <= 0 && enemy.x > 0 && enemy.x < W) {
        enemy.fireMs = ETORPEDO_COOLDOWN_MS;
        const dir = enemy.vx > 0 ? 1 : -1;
        eTorpedoes.push({
          x: enemy.x + dir * (ESUB_W / 2 + ETORPEDO_W / 2),
          y: enemy.y,
          vx: dir * ETORPEDO_SPEED,
        });
      }
    }
  }

  function updateTorpedoes(seconds: number, dt: number) {
    if (torpedoCooldownMs > 0) torpedoCooldownMs = Math.max(0, torpedoCooldownMs - dt);
    if (held.fire && torpedoCooldownMs === 0) fireTorpedo();

    // Los del jugador. Atraviesan a los buzos sin tocarlos: castigar al jugador
    // por acertarle a lo que vino a salvar, en una pantalla llena de fuego
    // cruzado, agrega frustración y una rama de colisión, no profundidad.
    for (let i = torpedoes.length - 1; i >= 0; i -= 1) {
      const shot = torpedoes[i];
      shot.x += shot.vx * seconds;
      if (shot.x < -TORPEDO_W || shot.x > W + TORPEDO_W) {
        torpedoes.splice(i, 1);
        continue;
      }

      for (let j = enemies.length - 1; j >= 0; j -= 1) {
        const enemy = enemies[j];
        const { w, h } = enemySize(enemy.kind);
        if (!overlaps(shot.x, shot.y, TORPEDO_W, TORPEDO_H, enemy.x, enemy.y, w, h)) continue;
        score += enemy.kind === "shark" ? SHARK_POINTS : ESUB_POINTS;
        playHit();
        enemies.splice(j, 1);
        torpedoes.splice(i, 1);
        break;
      }
    }

    // Los de los enemigos: solo colisionan con el submarino, y eso se resuelve
    // en checkPlayerCollisions().
    for (let i = eTorpedoes.length - 1; i >= 0; i -= 1) {
      const shot = eTorpedoes[i];
      shot.x += shot.vx * seconds;
      if (shot.x < -ETORPEDO_W || shot.x > W + ETORPEDO_W) eTorpedoes.splice(i, 1);
    }
  }

  /**
   * Lo que mata al jugador por contacto. Devuelve true si murió, para que
   * update() corte el frame: die() ya paró el loop si era la última vida.
   */
  function checkPlayerCollisions(): boolean {
    if (invulnMs > 0) return false;

    for (const enemy of enemies) {
      const { w, h } = enemySize(enemy.kind);
      if (overlaps(subX, subY, SUB_W, SUB_H, enemy.x, enemy.y, w, h)) {
        die();
        return true;
      }
    }

    for (let i = eTorpedoes.length - 1; i >= 0; i -= 1) {
      const shot = eTorpedoes[i];
      if (overlaps(subX, subY, SUB_W, SUB_H, shot.x, shot.y, ETORPEDO_W, ETORPEDO_H)) {
        eTorpedoes.splice(i, 1);
        die();
        return true;
      }
    }

    return false;
  }

  // ── Actualización ───────────────────────────────────────────────────────────
  function update(dt: number) {
    const seconds = dt / 1000;
    clockMs += dt;

    if (invulnMs > 0) invulnMs = Math.max(0, invulnMs - dt);

    // Movimiento sin inercia: la velocidad es el estado de las teclas, no una
    // aceleración que se integra. El agua no arrastra, a propósito.
    let vx = 0;
    let vy = 0;
    if (held.left) vx -= SUB_SPEED_X;
    if (held.right) vx += SUB_SPEED_X;
    if (held.up) vy -= SUB_SPEED_Y;
    if (held.down) vy += SUB_SPEED_Y;

    subX = clamp(subX + vx * seconds, SUB_W / 2, W - SUB_W / 2);
    subY = clamp(subY + vy * seconds, SUB_MIN_Y, SUB_MAX_Y);

    updateDivers(seconds, dt);
    updateEnemies(seconds, dt);
    updateTorpedoes(seconds, dt);
    // Morir corta el frame acá: si era la última vida, die() ya paró el loop.
    if (checkPlayerCollisions()) return;

    // El cobro en superficie. Va ANTES del bloque de oxígeno a propósito: el
    // bonus paga el aire que SOBRÓ al llegar arriba, así que se mide antes de
    // que la recarga de este mismo frame lo infle.
    collectOnSurface();

    // El oxígeno. Bajo el agua baja 1 segundo por segundo; en la superficie sube
    // TANK_S / REFILL_S y se topea. Se puede volver a bajar con lo que se haya
    // juntado: nadie obliga a llenar.
    if (isSurfaced()) {
      tank = Math.min(TANK_S, tank + REFILL_RATE * seconds);
    } else {
      tank -= seconds;
      if (tank <= 0) {
        tank = 0;
        die();
        return;
      }
    }

    // El pulso de alarma, dos por segundo mientras el tanque esté bajo. Se
    // acompaña con el casco parpadeando, que es la mitad visual de lo mismo.
    if (tank < TANK_ALARM_S) {
      alarmPulseMs -= dt;
      if (alarmPulseMs <= 0) {
        alarmPulseMs = SND_ALARM_PULSE_MS;
        playAlarm();
      }
    } else {
      // Que el primer pulso al entrar en la zona roja salga en el acto.
      alarmPulseMs = 0;
    }

    // Las burbujas suben y reaparecen abajo. Decoración: no tocan ninguna regla.
    for (const bubble of bubbles) {
      bubble.y -= bubble.speed * seconds;
      if (bubble.y + bubble.r < SURFACE_Y) {
        bubble.y = SEABED_Y + bubble.r;
        bubble.x = rand(0, W);
      }
    }
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function drawWorld() {
    // El agua, de un azul frío casi negro al negro del abismo.
    const water = ctx.createLinearGradient(0, SURFACE_Y, 0, H);
    water.addColorStop(0, COLOR_DEEP_TOP);
    water.addColorStop(1, COLOR_DEEP_BOTTOM);
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, W, H);

    // La banda de aire: cyan casi apagado. Ningún enemigo entra acá, así que la
    // superficie es segura por construcción y no por una regla que haya que
    // explicar.
    ctx.fillStyle = COLOR_AIR;
    ctx.fillRect(0, 0, W, SURFACE_Y);

    // Las burbujas, sin sombra: son cuarenta.
    ctx.fillStyle = COLOR_BUBBLE;
    for (const bubble of bubbles) {
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // La línea de agua, con glow: es la referencia visual más importante del
    // juego, porque marca dónde se respira y dónde se cobra.
    ctx.save();
    ctx.shadowColor = COLOR_SURFACE;
    ctx.shadowBlur = GLOW_SURFACE;
    ctx.fillStyle = COLOR_SURFACE;
    ctx.fillRect(0, SURFACE_Y - 1, W, 2);
    ctx.restore();

    // El lecho marino: una franja y una silueta de rocas, dibujadas con una
    // onda determinista para que no titilen entre frames. No colisiona con nada;
    // el submarino ya está topeado antes por SUB_MAX_Y.
    ctx.fillStyle = COLOR_SEABED;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, SEABED_Y);
    for (let x = 0; x <= W; x += 40) {
      const peak = SEABED_Y - 6 - 5 * Math.sin(x * 0.031) - 4 * Math.cos(x * 0.017);
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(W, SEABED_Y);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawSub() {
    // El parpadeo del respawn: el casco se ve a intervalos mientras dura la
    // invulnerabilidad. Es alpha, no color, para que no se confunda con la
    // alarma de oxígeno, que sí cambia de color.
    if (invulnMs > 0 && Math.floor(clockMs / 90) % 2 === 0) return;

    // La alarma de tanque bajo: el casco vira de magenta a casi blanco a 4 Hz.
    // Esto es dibujo de entidad, no una barra de HUD.
    const alarming = tank < TANK_ALARM_S;
    const blinkOn = Math.floor((clockMs / 1000) * ALARM_BLINK_HZ) % 2 === 0;
    const hull = alarming && blinkOn ? COLOR_SUB_ALARM : COLOR_SUB;

    const dir = facing === "right" ? 1 : -1;
    const halfW = SUB_W / 2;
    const halfH = SUB_H / 2;

    ctx.save();
    ctx.translate(subX, subY);
    ctx.scale(dir, 1);
    ctx.shadowColor = COLOR_SUB;
    ctx.shadowBlur = GLOW_SUB;
    ctx.fillStyle = hull;

    // El casco: un óvalo alargado.
    ctx.beginPath();
    ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
    ctx.fill();

    // La torreta, arriba y un poco adelantada.
    ctx.fillRect(-4, -halfH - 7, 16, 8);

    // La hélice, atrás: una aleta vertical.
    ctx.fillRect(-halfW - 6, -9, 5, 18);

    // El periscopio.
    ctx.fillRect(8, -halfH - 12, 2, 6);

    // Las seis luces de bodega, dentro del casco. Es el refuerzo visual de
    // cuántos buzos llevás encima, y va en el mundo y no en un segundo slot del
    // HUD: es dibujo de entidad, del mismo tipo que el degradado de la cola de
    // la serpiente. Sin sombra propia: heredan el glow del casco.
    ctx.shadowBlur = 0;
    for (let i = 0; i < DIVER_CAPACITY; i += 1) {
      ctx.fillStyle = i < divers ? COLOR_CARGO_ON : COLOR_CARGO_OFF;
      ctx.beginPath();
      ctx.arc(-18 + i * 7, 2, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Los buzos, en verde y con glow: son el premio, y tienen que verse desde el
   * otro lado de la pantalla para que la decisión de ir a buscarlos exista. Son
   * como mucho tres, así que las tres sombras entran en el presupuesto.
   */
  function drawDivers() {
    ctx.save();
    ctx.shadowColor = COLOR_DIVER;
    ctx.shadowBlur = GLOW_DIVER;
    ctx.fillStyle = COLOR_DIVER;
    for (const diver of swimmers) {
      // El casco de buceo.
      ctx.beginPath();
      ctx.arc(diver.x, diver.y - DIVER_H / 2 + 5, 5, 0, Math.PI * 2);
      ctx.fill();
      // El cuerpo.
      ctx.fillRect(diver.x - 3.5, diver.y - DIVER_H / 2 + 9, 7, 9);
      // Las aletas, del lado contrario al que avanza.
      const back = diver.vx > 0 ? -1 : 1;
      ctx.fillRect(diver.x + back * 5, diver.y + DIVER_H / 2 - 4, 6, 3);
    }
    ctx.restore();
  }

  /**
   * Los enemigos y los torpedos, SIN shadowBlur: pueden ser diez y seis
   * respectivamente, y cien sombras por frame hunden los 60 fps —la lección que
   * el SPEC 09 escribió sobre el cuerpo de la serpiente—. Se separan del fondo
   * por color y por silueta, que alcanza y sobra: gris te muerde, amarillo te
   * dispara.
   */
  function drawEnemies() {
    for (const enemy of enemies) {
      const dir = enemy.vx > 0 ? 1 : -1;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.scale(dir, 1);

      if (enemy.kind === "shark") {
        ctx.fillStyle = COLOR_SHARK;
        // El cuerpo, con el morro adelante.
        ctx.beginPath();
        ctx.moveTo(SHARK_W / 2, 0);
        ctx.lineTo(6, -SHARK_H / 2 + 4);
        ctx.lineTo(-SHARK_W / 2 + 10, -SHARK_H / 2 + 6);
        ctx.lineTo(-SHARK_W / 2, -SHARK_H / 2);
        ctx.lineTo(-SHARK_W / 2 + 8, 0);
        ctx.lineTo(-SHARK_W / 2, SHARK_H / 2);
        ctx.lineTo(-SHARK_W / 2 + 10, SHARK_H / 2 - 6);
        ctx.lineTo(6, SHARK_H / 2 - 4);
        ctx.closePath();
        ctx.fill();
        // La aleta dorsal.
        ctx.beginPath();
        ctx.moveTo(2, -SHARK_H / 2 + 3);
        ctx.lineTo(-6, -SHARK_H / 2 - 7);
        ctx.lineTo(-12, -SHARK_H / 2 + 4);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = COLOR_ESUB;
        ctx.beginPath();
        ctx.ellipse(0, 0, ESUB_W / 2, ESUB_H / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // La torreta y la hélice, espejadas respecto del submarino del jugador.
        ctx.fillRect(-10, -ESUB_H / 2 - 6, 14, 7);
        ctx.fillRect(-ESUB_W / 2 - 5, -8, 4, 16);
      }

      ctx.restore();
    }
  }

  function drawTorpedoes() {
    ctx.fillStyle = COLOR_TORPEDO;
    for (const shot of torpedoes) {
      ctx.fillRect(shot.x - TORPEDO_W / 2, shot.y - TORPEDO_H / 2, TORPEDO_W, TORPEDO_H);
    }
    ctx.fillStyle = COLOR_ETORPEDO;
    for (const shot of eTorpedoes) {
      ctx.fillRect(shot.x - ETORPEDO_W / 2, shot.y - ETORPEDO_H / 2, ETORPEDO_W, ETORPEDO_H);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawWorld();
    drawDivers();
    drawEnemies();
    drawTorpedoes();
    drawSub();
  }

  // ── El snapshot ─────────────────────────────────────────────────────────────
  function emitSnapshot() {
    const snapshot: GameSnapshot = {
      score,
      level: level(),
      status: state,
      lives,
      // Los dos recursos propios del juego en el único slot `extra`, con el
      // label nombrando las dos mitades en el mismo orden que el value. El
      // precedente es `3x · 4.2s` de asteroides, que corre en producción desde
      // el SPEC 05: el HUD no sabe que el porcentaje salió de un número de
      // segundos, y la comparación de igualdad se vuelve una de strings.
      extra: {
        label: "O₂ · BUZOS",
        value: `${Math.round((tank / TANK_S) * 100)}% · ${divers}`,
      },
    };

    const prev = lastSnapshot;
    if (
      prev &&
      prev.score === snapshot.score &&
      prev.level === snapshot.level &&
      prev.status === snapshot.status &&
      prev.lives === snapshot.lives &&
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
    // varios segundos y el jugador volvería a un submarino ya implotado, con el
    // tanque vaciado por un frame que nadie vio.
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, MAX_FRAME_MS);
    lastTime = ts;

    if (state === "playing") update(dt);
    // update() puede haber terminado la partida: die() ya paró el loop.
    if (state === "gameover") return;

    draw();
    emitSnapshot();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId !== null) return;
    // lastTime en null hace que el primer dt sea 0. Es lo que evita que, al
    // reanudar, el primer frame cobre todo el tiempo que estuvo pausado: sin
    // esto una pausa de diez segundos vaciaría un quinto del tanque de golpe.
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
    lastTime = null;
  }

  // ── Entradas ────────────────────────────────────────────────────────────────
  function onKeyDown(event: KeyboardEvent) {
    if (PREVENT_DEFAULT.has(event.code)) event.preventDefault();
    // El gesto que la política de autoplay exige llega con la primera tecla.
    unlockAudio();
    // El disparo (paso 4) se maneja por estado de tecla y la repetición del
    // sistema operativo no tiene por qué fijar la cadencia.
    if (event.repeat) return;

    if (KEY_UP.has(event.code)) held.up = true;
    else if (KEY_DOWN.has(event.code)) held.down = true;
    else if (KEY_LEFT.has(event.code)) {
      held.left = true;
      facing = "left";
    } else if (KEY_RIGHT.has(event.code)) {
      held.right = true;
      facing = "right";
    } else if (event.code === "Space") held.fire = true;
  }

  function onKeyUp(event: KeyboardEvent) {
    if (KEY_UP.has(event.code)) held.up = false;
    else if (KEY_DOWN.has(event.code)) held.down = false;
    else if (KEY_LEFT.has(event.code)) held.left = false;
    else if (KEY_RIGHT.has(event.code)) held.right = false;
    else if (event.code === "Space") held.fire = false;
  }

  return {
    start() {
      if (destroyed || running) return;
      running = true;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      listenersAttached = true;

      // El AudioContext se crea acá y no a nivel de módulo: en el servidor no
      // existe. Nace suspendido mientras no haya gesto, y el resume() llega con
      // el primer keydown en unlockAudio(); hasta entonces no se le programa un
      // solo nodo, que es lo que evita el warning de autoplay.
      //
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
      // Cancelar el rAF congela todo de una: el oxígeno, la recarga, la alarma y
      // —desde el paso 4— los temporizadores de aparición.
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
      // El botón FIN: deja una sola vida y entra por la misma rama que implotar,
      // igual que en asteroides. FIN y perder la última vida terminan idénticos.
      lives = 1;
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
      // Sin esto, la sierra de la muerte disparada en el último frame sigue
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
        window.removeEventListener("keyup", onKeyUp);
        listenersAttached = false;
      }
    },
  };
}
