// ===== lib/catalog.ts — el catálogo, leído de Postgres =====
// Solo servidor: usa lib/supabase/server.ts, que llama a cookies(). Importarlo
// desde un Client Component no compila.
//
// Reemplaza al array de catálogo que vivía en lib/data.ts. Los números que las
// tarjetas mostraban inventados —`best` y `plays`— ya no son columnas: salen de
// la vista `game_stats`, que los deriva de la tabla `scores`.
//
// Cuando la base no responde, las funciones devuelven vacío en vez de lanzar:
// el portal muestra su estado vacío y /supabase-check sigue siendo la
// herramienta para diagnosticar por qué.

import type { Accent, Category, GameWithStats } from "@/lib/data";
import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type StatsRow = Database["public"]["Views"]["game_stats"]["Row"];

// Los tipos generados traen `cat` y `color` como `string` pelado: el CHECK
// constraint vive en Postgres y TypeScript no lo ve. El estrechamiento a las
// uniones que la UI ya tiene se hace UNA VEZ, acá, y nadie más vuelve a tocar
// el tipo. El default nunca debería dispararse —la base rechaza cualquier otro
// valor—; está para que una fila imposible pinte raro en vez de romper la
// página.
const CATEGORIES: readonly string[] = ["ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
const ACCENTS: readonly string[] = ["cyan", "magenta", "yellow", "green"];

function toCategory(value: string): Category {
  return CATEGORIES.includes(value) ? (value as Category) : "ARCADE";
}

function toAccent(value: string): Accent {
  return ACCENTS.includes(value) ? (value as Accent) : "cyan";
}

/** Un juego sin puntajes existe igual: la vista lo devuelve en 0, y si el
 *  select de stats falló, 0 es también lo honesto que se puede decir. */
function toGame(row: GameRow, stats: StatsRow | undefined): GameWithStats {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: toCategory(row.cat),
    cover: row.cover,
    color: toAccent(row.color),
    best: stats?.best ?? 0,
    plays: stats?.plays ?? 0,
  };
}

/**
 * El catálogo completo, en el orden de `sort_order` — el mismo que tenía el
 * array y que la biblioteca da por sentado (abre con BLOQUE BUSTER).
 *
 * Son dos consultas y no un embed de PostgREST porque `game_stats` es una vista
 * agregada y PostgREST no le encuentra relación con `games` (PGRST200). Van en
 * paralelo y son nueve filas cada una.
 */
export async function getGames(): Promise<GameWithStats[]> {
  const supabase = await createClient();

  const [games, stats] = await Promise.all([
    supabase.from("games").select("*").order("sort_order", { ascending: true }),
    supabase.from("game_stats").select("*"),
  ]);

  if (games.error) {
    console.error("[catálogo] no se pudo leer games:", games.error);
    return [];
  }
  if (stats.error) {
    // Los juegos sí llegaron: se muestran con los contadores en 0 antes que
    // dejar la biblioteca vacía por un problema de la vista.
    console.error("[catálogo] no se pudo leer game_stats:", stats.error);
  }

  const byGame = statsByGame(stats.data);
  return games.data.map((row) => toGame(row, byGame.get(row.id)));
}

/** Un juego por su slug. `null` cuando no existe: la página llama a notFound(). */
export async function getGame(id: string): Promise<GameWithStats | null> {
  const supabase = await createClient();

  const [game, stats] = await Promise.all([
    supabase.from("games").select("*").eq("id", id).maybeSingle(),
    supabase.from("game_stats").select("*").eq("game_id", id).maybeSingle(),
  ]);

  if (game.error) {
    console.error("[catálogo] no se pudo leer el juego:", game.error);
    return null;
  }
  if (!game.data) return null;
  if (stats.error) {
    console.error("[catálogo] no se pudo leer game_stats:", stats.error);
  }

  return toGame(game.data, stats.data ?? undefined);
}

function statsByGame(rows: StatsRow[] | null): Map<string, StatsRow> {
  const byGame = new Map<string, StatsRow>();
  for (const row of rows ?? []) {
    // `game_id` es nullable en los tipos generados solo porque viene de una
    // vista; en la práctica es la PK de `games` y nunca es null.
    if (row.game_id) byGame.set(row.game_id, row);
  }
  return byGame;
}
