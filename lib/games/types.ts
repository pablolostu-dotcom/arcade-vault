// ===== lib/games/types.ts =====
// El contrato entre un motor de canvas y React, compartido por todos los juegos
// del vault.
//
// Nació dentro de lib/games/asteroides/engine.ts, cuando había un solo motor y
// GameSnapshot podía darse el lujo de tener `tripleShot` adentro — un power-up
// que solo existe en ese juego. Con el segundo motor eso deja de funcionar: no
// puede nacer importando del primero, ni el HUD puede ser la unión de todos los
// power-ups del catálogo.
//
// La salida son dos campos opcionales. `lives` para los juegos que tienen el
// concepto, `extra` para el stat propio de cada uno, ya formateado por el motor.

export type GameStatus = "playing" | "dead" | "gameover";

/**
 * Las tres skins del vault. Son siempre las mismas para todos los juegos:
 * `clasico` es la paleta que el motor ya tenía, `neon` la satura y le pone
 * glow, y `retro` es fósforo monocromo de CRT con la información en luminancia.
 */
export type SkinId = "clasico" | "neon" | "retro";

/** El orden en el que el botón del HUD las cicla. El primero es el default. */
export const SKIN_IDS: readonly SkinId[] = ["clasico", "neon", "retro"];

/** Lo único que un motor le cuenta a React. */
export type GameSnapshot = {
  score: number;
  level: number;
  status: GameStatus;
  /** Solo los juegos que tienen el concepto. Ausente ⇒ el HUD oculta el slot ♥. */
  lives?: number;
  /**
   * El stat propio del juego. Ausente ⇒ el HUD no lo pinta.
   *
   * `value` viaja ya formateado: que el HUD sepa que `3x · 4.2s` sale de un
   * número de segundos es exactamente el acoplamiento que estos tipos vinieron
   * a cortar. De paso, la comparación de igualdad del snapshot se vuelve una
   * comparación de strings, sin redondeos especiales.
   */
  extra?: { label: string; value: string };
};

export type EngineHandle = {
  start(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void; // el botón FIN: fuerza el game over
  /**
   * El botón de silencio del HUD. Los motores mudos lo implementan como no-op.
   *
   * Es un método del handle y no un módulo con estado global a propósito: el
   * silencio vive en React, que es donde vive el resto del estado del
   * reproductor, y así no queda un singleton mutable que dos motores montados
   * a la vez podrían pisarse.
   */
  setMuted(muted: boolean): void;
  /**
   * El botón de skin del HUD. Cambia la paleta EN CALIENTE: la partida no se
   * reinicia y el próximo frame ya sale con la paleta nueva.
   *
   * Los motores que todavía no tienen skins lo implementan como no-op, por el
   * mismo criterio con el que los motores mudos implementan `setMuted`: el
   * contrato es uno solo para los cuatro juegos y un método vacío es más barato
   * que un método opcional que cada llamador tendría que chequear.
   */
  setSkin(skin: SkinId): void;
  destroy(): void; // cancela el rAF y quita los listeners
};

export type EngineOptions = {
  /** Se llama SOLO cuando algún valor del snapshot cambió, no en cada frame. */
  onSnapshot(snapshot: GameSnapshot): void;
  onGameOver(finalScore: number): void;
  /**
   * La skin inicial. Ausente ⇒ `clasico`.
   *
   * Viaja en las opciones y no por un `setSkin()` posterior por la misma razón
   * que `muted` viaja como prop de <GameCanvas>: el motor se crea después de un
   * import() dinámico, así que un `setSkin()` imperativo llamado al montar
   * encontraría el handle en null y el primer frame escaparía con la paleta
   * equivocada.
   */
  skin?: SkinId;
};
