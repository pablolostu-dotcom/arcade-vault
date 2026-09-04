// ===== lib/scores.ts — los rankings, leídos de Postgres =====
// Solo servidor: usa lib/supabase/server.ts.
//
// Reemplaza al generador determinístico de lib/data.ts, un LCG que fabricaba
// las mismas doce filas para todos los visitantes. Lee `leaderboard_entries`,
// la vista que ya trae el MEJOR puntaje de cada alias en cada juego —un jugador
// insistente ocupa un renglón, no diez— con la fecha de ese puntaje.
//
// El orden es el del índice `scores_ranking_idx`: puntaje descendente y, ante
// un empate, el más antiguo arriba. Es la convención de arcade y además hace el
// orden determinístico: sin el desempate, dos filas iguales cambiarían de lugar
// entre recargas.

import { formatScoreDate, type ScoreRow } from "@/lib/data";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type EntryRow = Database["public"]["Views"]["leaderboard_entries"]["Row"];

// Las columnas de la vista son nullable en los tipos generados —PostgREST no
// puede probar lo contrario para una vista— pero ninguna lo es en la tabla que
// la alimenta. El mapper descarta la fila imposible en vez de pintar un "null",
// y por eso el `rank` se numera DESPUÉS de filtrar: si no, el ranking tendría
// un hueco donde estaba la fila descartada.
function toScoreRows(rows: EntryRow[]): ScoreRow[] {
  return rows
    .filter((row) => row.player_name && row.score !== null && row.created_at)
    .map((row, i) => ({
      rank: i + 1, // el puesto lo asigna la posición, no la base
      name: row.player_name!,
      score: row.score!,
      date: formatScoreDate(row.created_at!),
    }));
}

/** El top de un juego: lo que muestra el Detalle (limit 10). */
export async function getLeaderboard(gameId: string, limit: number): Promise<ScoreRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leaderboard_entries")
    .select("*")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[puntajes] no se pudo leer el ranking:", error);
    return [];
  }

  return toScoreRows(data ?? []);
}

/**
 * Los rankings de TODOS los juegos, en UNA sola consulta.
 *
 * El Salón pinta nueve tabs y las resuelve como estado local del cliente: si
 * cada tab consultara lo suyo serían nueve viajes al servidor para pintar una
 * página. Se traen todas las entradas ordenadas y se agrupan en memoria.
 *
 * El corte por `limit` es por juego, así que no se puede hacer en SQL con un
 * `.limit()` global. Con nueve juegos y doce filas cada uno son 108 filas —
 * menos de lo que pesa una portada. Si el número de alias distintos creciera
 * hasta acercarse al `max_rows` de la API (1000), esto pasaría a necesitar una
 * consulta por juego o una función con `row_number()`.
 */
export async function getAllLeaderboards(limit: number): Promise<Record<string, ScoreRow[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leaderboard_entries")
    .select("*")
    .order("game_id", { ascending: true })
    .order("score", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[puntajes] no se pudieron leer los rankings:", error);
    return {};
  }

  const byGame = new Map<string, EntryRow[]>();
  for (const row of data ?? []) {
    if (!row.game_id) continue;
    const rows = byGame.get(row.game_id);
    if (rows) rows.push(row);
    else byGame.set(row.game_id, [row]);
  }

  const leaderboards: Record<string, ScoreRow[]> = {};
  for (const [gameId, rows] of byGame) {
    leaderboards[gameId] = toScoreRows(rows.slice(0, limit));
  }
  return leaderboards;
}
