"use server";

// ===== app/jugar/actions.ts — guardado de puntajes =====
// El único camino de la aplicación hacia `scores`. Mismo patrón que
// sendContactMessage del SPEC 03: resultado discriminado, sin detalles del
// proveedor hacia la UI.
//
// La validación de acá NO es la única defensa. Los CHECK constraints y la clave
// foránea de la tabla corren siempre, incluso si alguien insertara directo
// contra PostgREST sin pasar por esta acción —que con INSERT anónimo habilitado
// es posible, y está aceptado en las decisiones del SPEC 06—. Lo que solo vive
// acá es el límite por IP.

import { headers } from "next/headers";

import { checkRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/** Payload que el modal de fin de partida manda a la Server Action. */
export type SubmitScoreInput = {
  gameId: string;
  score: number;
  name: string;
};

/** Discriminante del mensaje inline. La UI no muestra detalles del proveedor. */
export type SubmitScoreError =
  | "INVALID" // alias vacío o puntaje fuera de rango / no entero
  | "RATE_LIMIT" // demasiados guardados desde la misma IP
  | "DB"; // Postgres rechazó el insert, o no contestó

export type SubmitScoreResult = { ok: true } | { ok: false; error: SubmitScoreError };

// Diez guardados cada diez minutos. Los tres del formulario de contacto son
// correctos para un formulario y muy pocos para alguien que juega varias
// partidas seguidas.
const SCORE_LIMIT = { max: 10, windowMs: 10 * 60 * 1000 };

// El mismo rango que el constraint scores_range. Un tope global y no uno por
// juego: ocho de los nueve juegos no tienen motor y su puntaje lo inventa un
// setInterval, así que calibrar máximos creíbles por juego sería afinar un
// instrumento que todavía no suena.
const MAX_SCORE = 9_999_999;
const MAX_NAME = 10;

export async function submitScore(input: SubmitScoreInput): Promise<SubmitScoreResult> {
  // La misma normalización que aplica el modal y que exige el constraint
  // scores_name_shape: mayúsculas, sin espacios en los extremos, ≤10.
  const name = input.name.trim().toUpperCase().slice(0, MAX_NAME).trim();
  const { gameId, score } = input;

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Clave namespaceada: el cupo de puntajes es independiente del de contacto.
  if (!checkRateLimit(`score:${ip}`, SCORE_LIMIT)) {
    return { ok: false, error: "RATE_LIMIT" };
  }

  // El cliente ya normaliza, pero la Server Action es invocable directamente:
  // lo del cliente es una conveniencia, no una defensa.
  if (!name || !gameId || !Number.isInteger(score) || score < 0 || score > MAX_SCORE) {
    return { ok: false, error: "INVALID" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, player_name: name, score });

  if (error) {
    // Un game_id inexistente llega acá como violación de clave foránea. Al
    // jugador no le sirve el código de Postgres y filtrarlo expone la base.
    console.error("[puntajes] no se pudo guardar el puntaje:", error);
    return { ok: false, error: "DB" };
  }

  return { ok: true };
}
