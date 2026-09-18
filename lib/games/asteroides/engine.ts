// ===== lib/games/asteroides/engine.ts =====
// Port de references/started-games/02-asteroids/game.js a TypeScript.
//
// La lógica del juego no cambia: mismas clases, mismas constantes, mismo
// balance. Lo que cambia es cómo se monta. El original toma el canvas de
// document en la línea 3 y arranca el loop en la última línea del archivo;
// acá NADA corre al importar el módulo. Todos los efectos secundarios
// (listeners, requestAnimationFrame) viven dentro de start() y se deshacen en
// destroy(), que es lo que permite montarlo y desmontarlo desde React.
//
// El HUD y el fin de partida los pinta el reproductor, no el canvas: por eso
// acá no existen drawHUD() ni el overlay de GAME OVER, ni el reinicio con
// Espacio del original.

import type { EngineHandle, EngineOptions, GameSnapshot, GameStatus } from "../types";

// ── Constantes ────────────────────────────────────────────────────────────────
// Portadas con sus valores originales. Este motor no rebalancea nada.
const W = 800;
const H = 600;

const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

/**
 * La paleta del portal, escrita a mano. A propósito NO se leen de :root con
 * getComputedStyle: un motor que necesita que exista una hoja de estilos para
 * dibujar es un motor que falla en silencio.
 */
const COLORS = {
  space: "#000",
  ship: "#00f5ff", // --cyan
  asteroid: "#8a8fb5", // --ink-dim
  bullet: "#f5ff00", // --yellow
  powerUp: "#ff006e", // --magenta
  /** La llama queda naranja, como en el original: es fuego, no un acento. */
  thrust: "rgba(255, 130, 0, 0.85)",
  particle: (alpha: number) => `rgba(255, 0, 110, ${alpha})`, // --magenta
};

/** Las teclas del juego: se les corta el scroll de la página mientras se juega. */
const HANDLED_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);

type Point = { x: number; y: number };

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

export function createAsteroidesEngine(
  canvas: HTMLCanvasElement,
  options: EngineOptions
): EngineHandle {
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new Error("El canvas de ASTEROIDES no expone un contexto 2d.");
  // Con tipo declarado: el estrechamiento del null no sobrevive dentro de los
  // métodos de las clases, y todos los draw() lo usan desde el closure.
  const ctx: CanvasRenderingContext2D = context2d;

  // ── Input ───────────────────────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};

  const onKeyDown = (e: KeyboardEvent) => {
    if (HANDLED_KEYS.has(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (HANDLED_KEYS.has(e.code)) e.preventDefault();
    keys[e.code] = false;
  };

  function pressed(code: string): boolean {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  // ── Bullet ──────────────────────────────────────────────────────────────────
  class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl = 1.1;
    radius = 2;
    dead = false;

    constructor(x: number, y: number, angle: number) {
      this.x = x;
      this.y = y;
      const SPEED = 520;
      this.vx = Math.cos(angle) * SPEED;
      this.vy = Math.sin(angle) * SPEED;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      ctx.fillStyle = COLORS.bullet;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Asteroid ────────────────────────────────────────────────────────────────
  class Asteroid {
    x: number;
    y: number;
    size: number;
    radius: number;
    vx: number;
    vy: number;
    rot: number;
    rotSpeed: number;
    verts: [number, number][] = [];
    dead = false;

    constructor(x: number, y: number, size = 3) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.radius = RADII[size];

      const angle = rand(0, Math.PI * 2);
      const speed = SPEEDS[size] + rand(-15, 15);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.rotSpeed = rand(-1.2, 1.2);
      this.rot = rand(0, Math.PI * 2);

      // Polígono irregular
      const n = randInt(8, 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += this.rotSpeed * dt;
    }

    split(): Asteroid[] {
      if (this.size <= 1) return [];
      return [
        new Asteroid(this.x, this.y, this.size - 1),
        new Asteroid(this.x, this.y, this.size - 1),
      ];
    }

    draw() {
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.strokeStyle = COLORS.asteroid;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++) {
        ctx.lineTo(this.verts[i][0], this.verts[i][1]);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── PowerUp ─────────────────────────────────────────────────────────────────
  class PowerUp {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius = 12;
    ttl = POWERUP_TTL;
    dead = false;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(20, 40);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
      const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = COLORS.powerUp;
      ctx.lineWidth = 2;
      const r = this.radius * pulse;
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.restore();
      ctx.fillStyle = COLORS.powerUp;
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("3x", this.x, this.y);
    }
  }

  // ── Ship ────────────────────────────────────────────────────────────────────
  class Ship {
    x = W / 2;
    y = H / 2;
    angle = -Math.PI / 2;
    vx = 0;
    vy = 0;
    radius = 12;
    thrusting = false;
    invincible = 3;
    shootCooldown = 0;
    dead = false;
    tripleShot = 0;

    reset() {
      this.x = W / 2;
      this.y = H / 2;
      this.angle = -Math.PI / 2;
      this.vx = 0;
      this.vy = 0;
      this.radius = 12;
      this.thrusting = false;
      this.invincible = 3;
      this.shootCooldown = 0;
      this.dead = false;
    }

    update(dt: number) {
      if (this.dead) return;
      if (this.invincible > 0) this.invincible -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.tripleShot > 0) this.tripleShot -= dt;

      const ROT = 3.5; // rad/s
      const THRUST = 260; // px/s²
      const DRAG = 0.987;

      if (keys["ArrowLeft"]) this.angle -= ROT * dt;
      if (keys["ArrowRight"]) this.angle += ROT * dt;

      this.thrusting = !!keys["ArrowUp"];
      if (this.thrusting) {
        this.vx += Math.cos(this.angle) * THRUST * dt;
        this.vy += Math.sin(this.angle) * THRUST * dt;
      }

      this.vx *= DRAG;
      this.vy *= DRAG;
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }

    tryShoot(): Bullet[] {
      if (this.shootCooldown > 0 || this.dead) return [];
      this.shootCooldown = 0.2;
      const NOSE = 21;
      const ox = this.x + Math.cos(this.angle) * NOSE;
      const oy = this.y + Math.sin(this.angle) * NOSE;
      if (this.tripleShot > 0) {
        return [
          new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
          new Bullet(ox, oy, this.angle),
          new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
        ];
      }
      return [new Bullet(ox, oy, this.angle)];
    }

    draw() {
      if (this.dead) return;
      // Parpadeo durante la invencibilidad de reaparición
      if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.strokeStyle = COLORS.ship;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";

      // Silueta clásica: triángulo con muesca trasera
      ctx.beginPath();
      ctx.moveTo(20, 0); // nariz
      ctx.lineTo(-12, -9); // ala izquierda
      ctx.lineTo(-7, 0); // muesca trasera
      ctx.lineTo(-12, 9); // ala derecha
      ctx.closePath();
      ctx.stroke();

      // Llama del propulsor
      if (this.thrusting && Math.random() > 0.35) {
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.lineTo(-8 - rand(6, 14), 0);
        ctx.lineTo(-8, 4);
        ctx.strokeStyle = COLORS.thrust;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ── Partículas (explosión) ──────────────────────────────────────────────────
  class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    dead = false;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 130);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = rand(0.4, 1.1);
      this.ttl = this.life;
    }

    update(dt: number) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      const alpha = this.ttl / this.life;
      ctx.strokeStyle = COLORS.particle(Number(alpha.toFixed(2)));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
      ctx.stroke();
    }
  }

  // ── Estado del juego ────────────────────────────────────────────────────────
  let ship = new Ship();
  let bullets: Bullet[] = [];
  let asteroids: Asteroid[] = [];
  let particles: Particle[] = [];
  let powerUps: PowerUp[] = [];
  let score = 0;
  let lives = 3;
  let level = 1;
  let state: GameStatus = "playing";
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

  // Ciclo de vida del motor: nada de esto existe en el original, que arranca
  // una sola vez y no se apaga nunca.
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let running = false;
  let destroyed = false;
  let listenersAttached = false;
  let gameOverEmitted = false;
  let lastSnapshot: GameSnapshot | null = null;

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    gameOverEmitted = false;
    spawnAsteroids(4);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      lives = 0;
      state = "gameover";
      emitGameOver();
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  /** El fin de partida sale una sola vez, en la transición a gameover. */
  function emitGameOver() {
    if (gameOverEmitted) return;
    gameOverEmitted = true;
    emitSnapshot();
    options.onGameOver(score);
  }

  /** Emite solo si cambió algo: si no, React re-renderiza 60 veces por segundo. */
  function emitSnapshot() {
    // El formateo del contador vive acá y no en el HUD: el reproductor no tiene
    // por qué saber que `3x · 4.2s` sale de un número de segundos. Redondeado a
    // un decimal antes de volverse string, así la comparación de abajo es exacta.
    const remaining = Math.max(0, Math.round(ship.tripleShot * 10) / 10);
    const snapshot: GameSnapshot = {
      score,
      lives,
      level,
      status: state,
      extra:
        remaining > 0
          ? { label: "Triple disparo", value: `3x · ${remaining.toFixed(1)}s` }
          : undefined,
    };
    const prev = lastSnapshot;
    if (
      prev &&
      prev.score === snapshot.score &&
      prev.lives === snapshot.lives &&
      prev.level === snapshot.level &&
      prev.extra?.value === snapshot.extra?.value &&
      prev.status === snapshot.status
    ) {
      return;
    }
    lastSnapshot = snapshot;
    options.onSnapshot(snapshot);
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      // Sin reinicio con Espacio: de eso se encarga JUGAR DE NUEVO en React.
      // Las partículas siguen para que la explosión termine de dibujarse.
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw ────────────────────────────────────────────────────────────────────
  // Sin drawHUD() ni drawOverlay(): el HUD y el fin de partida son de React.
  function draw() {
    ctx.fillStyle = COLORS.space;
    ctx.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    powerUps.forEach((p) => p.draw());
    bullets.forEach((b) => b.draw());
    ship.draw();
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    draw();
    emitSnapshot();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId !== null) return;
    // lastTime en null hace que el primer dt sea 0: una pausa larga no
    // teletransporta a nadie al reanudar.
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  // ── Handle ──────────────────────────────────────────────────────────────────
  return {
    start() {
      if (destroyed || running) return;
      running = true;
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
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
      // Una vida, y matarla: el botón FIN entra por el mismo camino que perder
      // la última, así el fin de partida es idéntico se llegue como se llegue.
      lives = 1;
      killShip();
      emitSnapshot();
    },

    // Asteroides es mudo: no hay nada que silenciar.
    setMuted() {},

    // Asteroides todavía no tiene skins: su paleta sigue siendo COLORS. No-op
    // por el mismo criterio con el que los motores mudos no-opean setMuted().
    setSkin() {},

    destroy() {
      destroyed = true;
      running = false;
      stopLoop();
      if (listenersAttached) {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        listenersAttached = false;
      }
    },
  };
}
