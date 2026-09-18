// ===== lib/games/registry.ts =====
// El mapa "id del catálogo → motor". Existía con una sola fila para que el
// segundo juego fuera una línea acá y no otra pasada por <Reproductor>; el
// SPEC 07 cobró esa promesa y tetris entró como una línea.
//
// El import es dinámico a propósito: los diez juegos comparten la ruta
// /jugar/[id] y los ocho simulados no tienen por qué arrastrar ningún motor en
// su bundle. Los import type de arriba se borran al compilar, así que el único
// vínculo real con cada motor es el import() de adentro.

import type { EngineHandle, EngineOptions } from "./types";

export type EngineFactory = (canvas: HTMLCanvasElement, options: EngineOptions) => EngineHandle;

/** id de GAMES → carga perezosa del motor. */
export const ENGINES: Record<string, () => Promise<EngineFactory>> = {
  asteroides: () => import("./asteroides/engine").then((m) => m.createAsteroidesEngine),
  tetris: () => import("./tetris/engine").then((m) => m.createTetrisEngine),
  arkanoid: () => import("./arkanoid/engine").then((m) => m.createArkanoidEngine),
  snake: () => import("./snake/engine").then((m) => m.createSnakeEngine),
  abismo: () => import("./abismo/engine").then((m) => m.createAbismoEngine),
};

export function hasEngine(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENGINES, id);
}
