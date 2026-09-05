// ===== lib/games/registry.ts =====
// El mapa "id de GAMES → motor". Hoy tiene una sola fila; existe igual para que
// el segundo juego sea una línea acá y no otra pasada por <Reproductor>.
//
// El import es dinámico a propósito: los nueve juegos comparten la ruta
// /jugar/[id] y los ocho simulados no tienen por qué arrastrar el motor de
// asteroides en su bundle. Los import type de arriba se borran al compilar, así
// que el único vínculo real con el motor es el import() de adentro.

import type { EngineHandle, EngineOptions } from "./types";

export type EngineFactory = (canvas: HTMLCanvasElement, options: EngineOptions) => EngineHandle;

/** id de GAMES → carga perezosa del motor. */
export const ENGINES: Record<string, () => Promise<EngineFactory>> = {
  asteroides: () => import("./asteroides/engine").then((m) => m.createAsteroidesEngine),
};

export function hasEngine(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENGINES, id);
}
