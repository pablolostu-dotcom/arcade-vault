// ===== lib/data.ts — tipos compartidos y lo que sigue siendo mock =====
// Portado de references/templates/data.jsx. El catálogo y los rankings ya NO
// viven acá: se leen de Postgres con lib/catalog.ts y lib/scores.ts. Lo que
// queda es de tres clases:
//
//   - los tipos que las pantallas comparten (Game, ScoreRow, …),
//   - CATS, que es la lista de chips del filtro y se valida con un CHECK,
//   - LIVE_SCORES y TOP_TODAY, el bloque de actividad del home, que sigue
//     siendo mock a propósito (fuera del alcance del SPEC 06).

export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type Accent = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string; // slug de la URL
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string; // clase CSS: "cover-bricks", "cover-tetro", …
  color: Accent;
};

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string;
};

/**
 * Lo que las pantallas consumen: el juego con sus números reales, derivados de
 * la tabla `scores` a través de la vista `game_stats`. `plays` cuenta puntajes
 * guardados, no partidas empezadas: es lo único que la tabla sabe.
 */
export type GameWithStats = Game & { best: number; plays: number };

// Las filas del ranking las formatea el SERVIDOR (el top-10 del detalle, las
// tablas del salón) y la fila "TU MEJOR MARCA" la formatea el BROWSER. Sin una
// zona horaria fija, la misma fecha se vería distinta en la misma tabla según
// dónde se haya renderizado, así que UTC va explícito y no se negocia.
const SCORE_DATE_FORMAT = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

/** El `created_at` de Postgres tal como se ve en un ranking: "04/09/2026". */
export function formatScoreDate(iso: string): string {
  return SCORE_DATE_FORMAT.format(new Date(iso));
}

// Los chips del filtro de la biblioteca. "TODOS" no es una categoría: es el
// estado sin filtrar. Las otras cuatro son las que el CHECK de games.cat
// admite, así que una tabla `categories` sería un join para decir lo mismo.
export const CATS: readonly string[] = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];

/** Fila del ticker "ÚLTIMAS PUNTUACIONES" del home. */
export type LiveScore = {
  player: string;   // "NEONFOX"
  game: string;     // "Caída" — texto libre, no un id del catálogo
  score: number;
  when: string;     // "hace 2 min" — literal, no se calcula
  color: Accent;    // clase neon-* de la columna del jugador
};

/** Fila de "TOP JUGADORES · HOY" del home. */
export type TopPlayer = {
  rank: number;
  player: string;
  score: number;
};

// Las dos tablas del bloque de actividad del home, copiadas literal de los
// arrays inline de references/templates/home-about/home.jsx. Siguen siendo
// mock: no se cruzan con el catálogo (los títulos van en capitalización de
// título, no en mayúsculas) ni salen de la tabla `scores`. Un ticker de
// actividad real tiene que decidir ventana temporal, orden y refresco — es una
// pantalla, no una consulta, y va en otra spec.
export const LIVE_SCORES: readonly LiveScore[] = [
  { player: "NEONFOX",  game: "Caída",         score: 184220, when: "hace 2 min",  color: "magenta" },
  { player: "PX_KAI",   game: "Glotón",        score: 96400,  when: "hace 5 min",  color: "yellow" },
  { player: "Z3R0COOL", game: "Invasores",     score: 54190,  when: "hace 8 min",  color: "green" },
  { player: "VAULT_07", game: "Rocas",         score: 41200,  when: "hace 12 min", color: "cyan" },
  { player: "GLITCHA",  game: "Bloque Buster", score: 28450,  when: "hace 18 min", color: "cyan" },
  { player: "ARKADYA",  game: "Serpentina",    score: 7820,   when: "hace 24 min", color: "green" },
  { player: "CYBER_LU", game: "Ranaria",       score: 18900,  when: "hace 31 min", color: "yellow" },
];

export const TOP_TODAY: readonly TopPlayer[] = [
  { rank: 1, player: "NEONFOX",  score: 312840 },
  { rank: 2, player: "PX_KAI",   score: 248110 },
  { rank: 3, player: "M00NRYU",  score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA",  score: 138900 },
];
