-- SPEC 06 — El catálogo y los puntajes se mudan a Postgres.
-- Crea el catálogo (`games`), los puntajes (`scores`), las dos vistas de
-- lectura y la RLS de ambas tablas. El seed de las nueve filas va en la
-- migración siguiente.

-- ===== El catálogo =====
-- `best` y `plays` NO son columnas: se derivan de `scores` en `game_stats`.
-- `sort_order` preserva el orden del array GAMES (la biblioteca abre con
-- BLOQUE BUSTER); sin él el select devolvería lo que Postgres tenga a mano.
create table public.games (
  id          text primary key,                    -- el slug de la URL: "asteroides"
  title       text not null,
  short       text not null,
  "long"      text not null,                       -- palabra reservada: siempre entre comillas
  cat         text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover       text not null,                       -- clase CSS: "cover-asteroides"
  color       text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order  integer not null,
  created_at  timestamptz not null default now()
);

-- ===== Los puntajes =====
-- Tabla append-only: la aplicación no la actualiza ni la borra.
create table public.scores (
  id           uuid primary key default gen_random_uuid(),
  game_id      text not null references public.games(id) on delete cascade,
  player_name  text not null,
  score        integer not null,
  created_at   timestamptz not null default now(),

  constraint scores_name_shape check (
    player_name = upper(player_name)
    and player_name = btrim(player_name)
    and char_length(player_name) between 1 and 10
  ),
  constraint scores_range check (score >= 0 and score <= 9999999)
);

-- Cubre las tres consultas del spec (ranking por juego, mejor puntaje global y
-- conteo). El orden de columnas es el del ORDER BY de las vistas, incluido el
-- desempate por created_at ascendente: ante dos puntajes iguales gana el que
-- llegó primero.
create index scores_ranking_idx on public.scores (game_id, score desc, created_at asc);

-- ===== Las vistas de lectura =====
-- `security_invoker = on` en las dos: sin eso una vista corre con los permisos
-- de su dueño y saltea la RLS de la tabla que consulta.

-- Mejor puntaje de cada alias en cada juego, con la fecha de ESE puntaje.
create view public.leaderboard_entries with (security_invoker = on) as
select distinct on (game_id, player_name)
  game_id, player_name, score, created_at
from public.scores
order by game_id, player_name, score desc, created_at asc;

-- Los números que las tarjetas mostraban como mock. El left join hace que un
-- juego sin un solo puntaje devuelva best = 0 y plays = 0 en vez de desaparecer.
create view public.game_stats with (security_invoker = on) as
select g.id as game_id,
       coalesce(max(s.score), 0) as best,
       count(s.id)               as plays
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;

-- ===== RLS =====
alter table public.games  enable row level security;
alter table public.scores enable row level security;

-- `games` no tiene política de INSERT, UPDATE ni DELETE: con RLS activa y sin
-- política, esas operaciones quedan negadas para todos. El catálogo se cambia
-- por migración.
create policy games_select_public  on public.games  for select to anon, authenticated using (true);

-- `scores` acepta INSERT anónimo porque la Server Action inserta con el cliente
-- de servidor, que sin auth es `anon`. Consecuencia asumida: cualquiera puede
-- insertar contra PostgREST sin pasar por la acción. Lo único que lo acota son
-- los CHECK constraints, que sí corren siempre; el rate limit de la acción, no.
create policy scores_select_public on public.scores for select to anon, authenticated using (true);
create policy scores_insert_public on public.scores for insert to anon, authenticated with check (true);
