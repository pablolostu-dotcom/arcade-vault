# SPEC 06 — El catálogo y los puntajes se mudan a Postgres

> **Status:** Implementado
> **Depends on:** SPEC 04, SPEC 05
> **Date:** 2026-09-04
> **Objective:** Crear las tablas `games` y `scores` en Supabase, mover a Postgres el catálogo de los nueve juegos, y hacer que el Salón de la Fama y el top-10 del Detalle muestren un ranking real por juego —el mejor puntaje de cada alias— escrito por una Server Action desde el reproductor.

## Por qué existe este spec

El SPEC 04 dejó Supabase cableado y `supabase/migrations/` deliberadamente vacío: "la primera migración la escribe el spec que la necesite". Este es ese spec.

Hoy Arcade Vault miente en dos lugares a la vez, y son el mismo problema con dos caras:

1. **El catálogo vive en un array de TypeScript.** `GAMES` en `lib/data.ts` tiene nueve objetos con `best: 28450` y `plays: "12.4K"` — números inventados que nadie puede cambiar sin un deploy.
2. **Los rankings los fabrica un generador determinístico.** `seededScores()` es un LCG que produce las mismas doce filas para todos los visitantes. Mientras tanto, `saveScore()` escribe los puntajes reales en `av_scores` (localStorage) y **nadie los lee jamás** — el comentario está escrito en el propio `lib/session.tsx`. Desde el SPEC 05 hay un juego de verdad, ASTEROIDES, cuyo puntaje real termina en esa clave muerta.

El resultado es un portal donde el único puntaje auténtico del sistema es el que no se muestra. Este spec cierra el circuito: el juego escribe en Postgres y el Salón lee de Postgres.

Las dos tablas van juntas y no en dos specs porque `scores.game_id` es una clave foránea a `games.id`. Separarlas significaría crear `scores` con un `game_id` de texto libre y volver a migrarlo después, o crear `games` sin nadie que la use. La FK bien puesta desde el primer `.sql` es más barata que la migración que la agrega.

Hay una consecuencia asumida que conviene decir de frente: **no hay auth**. `av_user` sigue siendo un alias en localStorage y cualquiera entra. Un puntaje, por lo tanto, es una afirmación de un anónimo sobre sí mismo. El spec de auth real convertirá `player_name` en una referencia a `profiles`; hasta entonces, el ranking vale lo que vale y las defensas son de forma, no de identidad.

## Alcance

**Dentro:**

- La migración de esquema: tablas `public.games` y `public.scores`, sus CHECK constraints, el índice del ranking, RLS con sus políticas, y las dos vistas de lectura (`leaderboard_entries` y `game_stats`).
- La migración de seed: las nueve filas de `games`, con exactamente los valores que hoy tiene el array `GAMES`.
- `lib/catalog.ts` — lecturas del catálogo desde el servidor, con el estrechamiento de `cat` y `color` a sus uniones de TypeScript.
- `lib/scores.ts` — lecturas de rankings desde el servidor.
- `app/jugar/actions.ts` — la Server Action `submitScore`, con validación y límite por IP.
- La parametrización de `checkRateLimit()` en `lib/rate-limit.ts` para que sirva a dos llamadores con topes distintos.
- Los consumidores que pasan a leer de Postgres: `app/page.tsx` (las seis tarjetas de vista previa), `app/juegos/page.tsx` + `components/biblioteca.tsx`, `app/juegos/[id]/page.tsx`, `app/jugar/[id]/page.tsx`, `app/salon/page.tsx` + `components/salon.tsx`.
- Los estados vacíos de ranking, en el Detalle y en el Salón: podio incompleto y tabla sin filas.
- La fila "TU MEJOR MARCA" del Salón, real: consultada desde el browser con el alias de la sesión.
- La poda: se borran `seededScores()`, `PLAYERS`, el array `GAMES`, los campos `best` y `plays` del tipo `Game`, y `saveScore()` de `lib/session.tsx`.

**Fuera de alcance (para specs futuras):**

- **Auth real.** No hay registro, login ni `profiles`. `lib/session.tsx` conserva `av_user` y el alias en mayúsculas de ≤10 caracteres; lo único que pierde es `saveScore()`.
- **`scores.user_id`.** La columna no existe. El día que haya auth, la migración que la agregue decide qué hacer con las filas anónimas viejas.
- **El bloque de actividad del home.** `LIVE_SCORES` y `TOP_TODAY` en `app/page.tsx` siguen siendo mock. Un ticker de "últimas puntuaciones" real necesita decidir ventana temporal, orden y refresco — no entra acá.
- **El stat "12+ juegos" del home.** Es un número de marketing del prototipo y se queda como está.
- **Una tabla `categories`.** `CATS` sigue siendo una constante de `lib/data.ts` y la categoría se valida con un CHECK.
- **Escribir el catálogo desde la app.** `games` es solo lectura para todo el mundo. Agregar un juego es una migración.
- **Panel de administración.**
- **Realtime.** El ranking no se actualiza solo: hay que recargar.
- **Contar partidas jugadas.** `plays` es la cantidad de puntajes guardados, no de partidas empezadas. Registrar partidas es otra tabla y otro spec.
- **Migrar lo que ya haya en `av_scores`** de un navegador a Postgres.
- **Rate limit distribuido.** `lib/rate-limit.ts` sigue siendo un `Map` en la memoria del proceso, con la limitación que el SPEC 03 ya documentó.
- **La `service_role` key.** Se mantiene la decisión del SPEC 04: no entra al repo.
- **Motores para los otros ocho juegos.** Siguen con el puntaje simulado del SPEC 05; ahora ese puntaje simulado se guarda en Postgres igual que el real.
- **Tests automatizados.** El repo no tiene test runner y este spec no instala uno.

## Modelo de datos

### `public.games` — el catálogo

```sql
create table public.games (
  id          text primary key,                    -- el slug de la URL: "asteroides"
  title       text not null,
  short       text not null,
  "long"      text not null,                       -- palabra reservada: siempre entre comillas
  cat         text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover       text not null,                       -- clase CSS: "cover-asteroides"
  color       text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order  integer not null,                    -- preserva el orden del array GAMES
  created_at  timestamptz not null default now()
);
```

`best` y `plays` **no son columnas**: se derivan de `scores`. `sort_order` existe porque el orden del array de hoy es una decisión de diseño (la biblioteca abre con BLOQUE BUSTER) y sin él el `select` devolvería lo que Postgres quiera.

### `public.scores` — los puntajes

```sql
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

create index scores_ranking_idx on public.scores (game_id, score desc, created_at asc);
```

Es una tabla append-only: nada la actualiza ni la borra desde la aplicación.

El índice cubre las tres consultas del spec — ranking por juego, mejor puntaje global y conteo — y su orden de columnas es el del `ORDER BY` de las vistas, incluido el desempate por `created_at` ascendente: **ante dos puntajes iguales gana el que llegó primero**.

### Las dos vistas

```sql
-- Mejor puntaje de cada alias en cada juego, con la fecha de ESE puntaje.
create view public.leaderboard_entries with (security_invoker = on) as
select distinct on (game_id, player_name)
  game_id, player_name, score, created_at
from public.scores
order by game_id, player_name, score desc, created_at asc;

-- Los números que las tarjetas mostraban como mock.
create view public.game_stats with (security_invoker = on) as
select g.id as game_id,
       coalesce(max(s.score), 0) as best,
       count(s.id)               as plays
from public.games g
left join public.scores s on s.game_id = g.id
group by g.id;
```

`security_invoker = on` en las dos: sin eso una vista corre con los permisos de su dueño y saltea la RLS de la tabla que consulta, que es exactamente lo que el advisor de seguridad de Supabase marca como hallazgo.

`game_stats` usa `left join` para que un juego sin un solo puntaje devuelva `best = 0` y `plays = 0`, y no desaparezca de la lista.

### RLS

```sql
alter table public.games  enable row level security;
alter table public.scores enable row level security;

create policy games_select_public  on public.games  for select to anon, authenticated using (true);
create policy scores_select_public on public.scores for select to anon, authenticated using (true);
create policy scores_insert_public on public.scores for insert to anon, authenticated with check (true);
```

`games` no tiene política de INSERT, UPDATE ni DELETE: con RLS activa y sin política, esas operaciones quedan negadas para todos. El catálogo se cambia por migración.

`scores` acepta INSERT anónimo porque la Server Action inserta con el cliente de servidor, que sin auth es `anon`. **Consecuencia asumida y explícita:** cualquiera puede insertar contra PostgREST sin pasar por la Server Action. Lo único que lo acota son los CHECK constraints, que sí corren siempre. El rate limit de la acción, no.

### Los tipos de la aplicación

`lib/database.types.ts` se regenera con `npm run db:types` y trae las columnas como `string` pelado. La aplicación necesita las uniones que ya existen (`Category`, `Accent`), así que el estrechamiento se hace una vez, en el mapper de `lib/catalog.ts`, y nadie más vuelve a tocar el tipo:

```ts
// lib/data.ts — el tipo Game pierde `best` y `plays`; suma `sortOrder`.
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;
  color: Accent;
};

/** Lo que las pantallas consumen: el juego con sus números reales. */
export type GameWithStats = Game & { best: number; plays: number };
```

```ts
// lib/catalog.ts — solo servidor: usa lib/supabase/server.ts
export async function getGames(): Promise<GameWithStats[]>;
export async function getGame(id: string): Promise<GameWithStats | null>;
```

```ts
// lib/scores.ts — solo servidor
export async function getLeaderboard(gameId: string, limit: number): Promise<ScoreRow[]>;
export async function getAllLeaderboards(limit: number): Promise<Record<string, ScoreRow[]>>;
```

`ScoreRow` (`{ rank, name, score, date }`) se conserva tal cual: es lo que `<Leaderboard>` y el Salón ya saben renderizar. El `rank` lo asigna el mapper por posición, no la base.

`plays` **cambia de tipo**: era el string `"12.4K"` y pasa a ser un `number`. Los dos lugares que lo pintan lo formatean con `toLocaleString("es-ES")`, igual que `best`.

Las fechas se formatean con un único helper, para que el servidor y el browser no produzcan `dd/mm/yyyy` distintos según la zona horaria de quien renderice:

```ts
// lib/data.ts
export function formatScoreDate(iso: string): string; // "04/09/2026", timeZone: "UTC"
```

### El contrato de la Server Action

```ts
// app/jugar/actions.ts
export type SubmitScoreInput = { gameId: string; score: number; name: string };
export type SubmitScoreError = "INVALID" | "RATE_LIMIT" | "DB";
export type SubmitScoreResult = { ok: true } | { ok: false; error: SubmitScoreError };

export async function submitScore(input: SubmitScoreInput): Promise<SubmitScoreResult>;
```

Mismo patrón que `sendContactMessage` del SPEC 03: resultado discriminado, sin detalles del proveedor hacia la UI.

## Plan de implementación

1. **La migración de esquema.** `supabase migration new catalogo_y_puntajes` y escribir en el `.sql` resultante todo el bloque anterior: las dos tablas, los constraints, el índice, las dos vistas con `security_invoker` y las cuatro políticas. Aplicarla contra el proyecto remoto y correr `npm run db:types`.
   _Verificación:_ `npm run db:types` regenera `lib/database.types.ts` con `games`, `scores` y las dos vistas; el advisor de seguridad de Supabase no reporta hallazgos nuevos; `select * from scores` devuelve cero filas y ningún archivo de la aplicación cambió todavía.

2. **La migración de seed.** `supabase migration new seed_games`, con los nueve `insert` del catálogo actual — `id`, `title`, `short`, `long`, `cat`, `cover`, `color` copiados **literalmente** del array `GAMES`, y `sort_order` de 1 a 9 en el orden en que están hoy. `best` y `plays` no se siembran: no existen.
   _Verificación:_ `select id, sort_order from games order by sort_order` devuelve las nueve en el mismo orden que el array. La aplicación sigue leyendo del array y se ve idéntica.

3. **La capa de lectura.** `lib/catalog.ts` y `lib/scores.ts`, más `formatScoreDate()` en `lib/data.ts`. El mapper de `catalog.ts` hace el join con `game_stats`, estrecha `cat` y `color` a sus uniones y ordena por `sort_order`. El de `scores.ts` lee `leaderboard_entries`, ordena por `score desc, created_at asc`, corta en `limit` y numera el `rank` por posición. `getAllLeaderboards()` trae los nueve rankings en **una sola consulta** y los agrupa en memoria: nueve consultas para pintar una página es el error que después nadie encuentra.
   _Verificación:_ `npx tsc --noEmit` pasa. Todavía no las importa nadie.

4. **La biblioteca y el home leen el catálogo.** `app/juegos/page.tsx` pasa a ser `async`, llama a `getGames()` y le pasa el resultado a `<Biblioteca games={…} />`, que deja de importar `GAMES` pero conserva su estado de búsqueda y filtro. Lo mismo en `app/page.tsx` para las seis tarjetas de vista previa. `<GameCard>` recibe un `GameWithStats` y formatea `plays` con `toLocaleString("es-ES")`. Las dos páginas llevan `export const dynamic = "force-dynamic"`.
   _Verificación:_ `/juegos` muestra las nueve tarjetas en el mismo orden que antes, el buscador y los chips siguen funcionando, y el badge de mejor puntuación dice `0` en todas — porque todavía no hay ni un puntaje guardado. `/` muestra las mismas seis tarjetas de siempre.

5. **El detalle y el reproductor.** `app/juegos/[id]/page.tsx` reemplaza `GAMES.find()` por `await getGame(id)` (con `notFound()` cuando devuelve `null`) y `seededScores()` por `await getLeaderboard(id, 10)`. `<Leaderboard>` gana su estado vacío: con `rows` vacío muestra "AÚN NADIE MARCÓ UN PUNTAJE" en lugar de una lista de cero filas. `app/jugar/[id]/page.tsx` hace el mismo cambio de `GAMES.find()`. Las dos con `dynamic = "force-dynamic"`.
   _Verificación:_ `/juegos/asteroides` responde 200, muestra la descripción desde Postgres, el estado vacío en el ranking, y `Partidas 0` / `Mejor global 0`. `/juegos/no-existe` sigue dando 404. `/jugar/asteroides` arranca el motor igual que antes.

6. **El Salón, con una tabla por juego.** `app/salon/page.tsx` pasa a `async`, llama a `getGames()` y a `getAllLeaderboards(12)`, y le pasa los dos a `<Salon>`. La isla conserva las tabs como estado local: cambiar de juego no vuelve a pegarle al servidor porque los nueve rankings ya viajaron. El podio deja de asumir que existen tres filas — con 0 muestra el estado vacío de la sección entera, con 1 o 2 los slots faltantes muestran un placeholder.
   _Verificación:_ `/salon` responde 200, muestra las nueve tabs, y cada una un estado vacío. Con tres filas insertadas a mano en un juego, esa tab muestra podio y tabla y las otras ocho siguen vacías.

7. **La escritura.** `app/jugar/actions.ts` con `submitScore`: normaliza el alias (mayúsculas, `trim`, ≤10), valida que el puntaje sea un entero entre 0 y 9 999 999, verifica el límite por IP y hace el `insert`. `lib/rate-limit.ts` gana un segundo parámetro opcional (`{ max, windowMs }`) con los valores de hoy como default, de modo que la llamada del SPEC 03 no cambia; la de puntajes usa 10 envíos cada 10 minutos y la clave `score:<ip>`. En `components/reproductor.tsx`, el botón GUARDAR PUNTUACIÓN llama a la acción en vez de a `saveScore()`: muestra el estado de envío, deja el mensaje "▸ PUNTUACIÓN GUARDADA_" que ya existe cuando responde `ok`, y un mensaje inline de error cuando no —sin cerrar el modal ni perder el puntaje, para que se pueda reintentar.
   _Verificación:_ jugar una partida en `/jugar/asteroides`, guardar, y ver la fila en `select * from scores`. Recargar `/juegos/asteroides` y ver el puntaje en el top-10 y en `Mejor global`. Guardar once veces seguidas y ver que la número once responde el error de límite. Guardar también desde `/jugar/caida`, donde el puntaje es simulado, y ver que la fila entra igual.

8. **La poda.** Borrar de `lib/data.ts` el array `GAMES`, la constante `PLAYERS` y la función `seededScores()`; sacar `best` y `plays` del tipo `Game`. Borrar `saveScore` y `SCORES_KEY` de `lib/session.tsx` y del tipo `SessionValue`; `av_user`, `signIn` y `signOut` quedan intactos. Actualizar los comentarios de cabecera que describen lo que se fue.
   _Verificación:_ `grep -rn "seededScores\|av_scores\|GAMES" app components lib` no devuelve nada fuera del comentario de `lib/games/registry.ts`. `npm run build` pasa.

9. **La fila "TU MEJOR MARCA".** En `<Salon>`, cuando hay sesión, un efecto consulta desde el browser (`lib/supabase/client.ts`) la marca del alias en el juego de la tab activa contra `leaderboard_entries`, y su puesto con un `count` de las entradas que la superan. Tres estados: sin sesión no se muestra nada; con sesión y sin marca, "TODAVÍA NO TENÉS MARCA EN {JUEGO}"; con marca, la fila real con su puesto y su fecha.
   _Verificación:_ con alias guardado y un puntaje propio, `/salon` muestra la fila con el puesto correcto; cambiando de tab a un juego sin jugar, muestra el mensaje de sin marca; cerrando sesión, la fila desaparece.

10. **Repaso final.** Confirmar que las nueve rutas responden 200 y que ninguna pantalla perdió su aspecto. Jugar una partida completa de ASTEROIDES mirando la consola: sin errores, sin warnings de hidratación. Confirmar que `proxy.ts`, `lib/supabase/**` y `lib/games/**` no fueron modificados.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni errores de tipos.
- [ ] `npx tsc --noEmit` pasa.
- [ ] `npx eslint app lib components` no reporta errores.
- [ ] `supabase/migrations/` contiene dos archivos `.sql` versionados: el esquema y el seed.
- [ ] La tabla `games` tiene exactamente nueve filas y `select id from games order by sort_order` devuelve el mismo orden que tenía el array `GAMES`.
- [ ] `games` tiene RLS activa, permite SELECT público y **rechaza** un INSERT hecho con la clave publicable.
- [ ] `scores` tiene RLS activa y permite SELECT e INSERT públicos.
- [ ] Un INSERT en `scores` con `player_name` en minúsculas es rechazado por el constraint.
- [ ] Un INSERT en `scores` con `player_name` de 11 caracteres es rechazado por el constraint.
- [ ] Un INSERT en `scores` con `score` negativo o mayor a 9 999 999 es rechazado por el constraint.
- [ ] Un INSERT en `scores` con un `game_id` que no existe es rechazado por la clave foránea.
- [ ] Las vistas `leaderboard_entries` y `game_stats` están declaradas con `security_invoker = on`.
- [ ] El advisor de seguridad de Supabase no reporta hallazgos sobre las tablas ni las vistas nuevas.
- [ ] `lib/database.types.ts` está regenerado y versionado, con `games`, `scores` y las dos vistas.
- [ ] `lib/data.ts` ya no contiene `GAMES`, `PLAYERS` ni `seededScores`.
- [ ] El tipo `Game` ya no tiene `best` ni `plays`.
- [ ] `lib/session.tsx` ya no expone `saveScore` y ya no escribe `av_scores`; `av_user`, `signIn` y `signOut` siguen funcionando igual.
- [ ] `grep -rn "av_scores" app components lib` no devuelve resultados.
- [ ] `/`, `/juegos`, `/juegos/asteroides`, `/jugar/asteroides`, `/salon`, `/acceso`, `/acerca-de`, `/estilos` y `/supabase-check` responden 200.
- [ ] `/juegos/no-existe` devuelve 404.
- [ ] `/juegos` muestra las nueve tarjetas leídas de Postgres, en el orden de `sort_order`, y el buscador y los chips de categoría siguen filtrando.
- [ ] Con la tabla `scores` vacía, cada tarjeta muestra mejor puntuación `0` y el Detalle muestra `Partidas 0`.
- [ ] Con la tabla `scores` vacía, el top-10 del Detalle muestra el estado vacío y no una lista de cero filas.
- [ ] Con la tabla `scores` vacía, `/salon` renderiza sin lanzar: el podio no accede a `rows[0]`, `rows[1]` ni `rows[2]` inexistentes.
- [ ] `/salon` muestra una tab por cada uno de los nueve juegos y cada tab su propio ranking.
- [ ] Guardar un puntaje desde el modal de `/jugar/asteroides` inserta una fila en `scores` con ese `game_id`, ese alias y ese puntaje.
- [ ] Guardar un puntaje desde `/jugar/caida` (puntaje simulado) también inserta su fila.
- [ ] Después de guardar, recargar `/juegos/asteroides` muestra el puntaje en el top-10 y actualiza `Mejor global` y `Partidas`.
- [ ] Un alias que guarda tres puntajes distintos en el mismo juego aparece **una sola vez** en el ranking, con el mayor de los tres y la fecha de ese puntaje.
- [ ] Dos puntajes iguales en el mismo juego se ordenan con el más antiguo arriba.
- [ ] El puesto número 11 de envíos desde la misma IP en 10 minutos devuelve el error de límite y no inserta.
- [ ] Un error al guardar deja el modal abierto con el puntaje visible y permite reintentar.
- [ ] La llamada existente a `checkRateLimit()` en la acción de contacto no cambió de comportamiento: sigue en 3 envíos cada 10 minutos.
- [ ] Con sesión iniciada y un puntaje propio, `/salon` muestra la fila "TU MEJOR MARCA" con el puesto y la fecha reales.
- [ ] Con sesión iniciada y sin puntaje en el juego de la tab activa, `/salon` muestra el mensaje de sin marca en vez de una fila inventada.
- [ ] Sin sesión, `/salon` no muestra ninguna fila de usuario.
- [ ] Las fechas de los rankings se ven igual renderizadas en el servidor que consultadas desde el browser.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna ruta.
- [ ] `proxy.ts`, `lib/supabase/**` y `lib/games/**` no fueron modificados.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no aparece en ningún archivo del repo.
- [ ] `app/page.tsx` sigue mostrando `LIVE_SCORES` y `TOP_TODAY` como mock, sin cambios.

## Decisiones

- **Sí:** las dos tablas en una sola migración. `scores.game_id` referencia `games.id`; partirlas obligaría a crear la segunda con la FK ausente y a agregarla después. Es la única razón por la que este spec toca dos áreas a la vez.
- **Sí:** una sola tabla `scores` con `game_id`, y "una tabla por juego" resuelto en la pantalla. Nueve tablas físicas serían nueve migraciones, nueve juegos de políticas de RLS y una consulta distinta por juego, y el juego número diez volvería a pedir todo eso. Con una tabla, agregar un juego es una fila en `games`.
- **Sí:** `games.id` es el slug (`"asteroides"`) y no un `uuid`. Es el mismo string que ya viaja en `/juegos/[id]`, en `/jugar/[id]` y en el registro de motores del SPEC 05. Un `uuid` obligaría a una columna `slug` y a un lookup extra en cada ruta, a cambio de nada.
- **Sí:** el catálogo se borra de `lib/data.ts`. Dejarlo como fallback sonaba prudente, pero dos listas del mismo catálogo se desincronizan el día que alguien agregue un juego en una sola — y el fallback se activa justo cuando nadie lo está mirando.
- **No:** un script `db:seed` con `GAMES` como dato canónico en TypeScript. Es la misma duplicación con un paso más: el array sobreviviría y volvería a ser la tentación de "leer de acá que es más rápido".
- **Sí:** `best` y `plays` derivados, aunque las nueve tarjetas arranquen en `0`. El punto entero del spec es que los números dejen de ser inventados; sembrarlos con el mock viejo sería conservar la mentira en una tabla en vez de en un array, que es peor porque ya no se ve.
- **No:** sembrar puntajes de demo para que el Salón arranque poblado. Un ranking ficticio indistinguible del real es exactamente el problema que `seededScores()` ya tenía. El estado vacío hay que diseñarlo igual, y dice la verdad.
- **No:** conservar `seededScores()` como relleno cuando faltan filas. Mismo motivo, agravado: el usuario no podría distinguir su puntaje real del inventado en la misma tabla.
- **Sí:** el ranking muestra el mejor puntaje de cada alias, no todas las partidas. Un jugador insistente ocupando los diez primeros puestos hace ilegible un Salón de la Fama. `distinct on` lo resuelve en la vista y las pantallas no se enteran.
- **Sí:** el desempate es por `created_at` ascendente. Ante puntajes iguales gana quien lo consiguió primero, que es la convención de arcade y además hace el orden determinístico — sin él, dos filas empatadas cambiarían de lugar entre recargas.
- **Sí:** dos vistas SQL en vez de agregaciones en TypeScript. `distinct on` y el `left join` con `max`/`count` son de Postgres; hacerlos en Node significa traerse la tabla entera de puntajes para descartar casi todo.
- **Sí:** `security_invoker = on` en las dos vistas. Una vista sin eso corre con los permisos de su dueño y esquiva la RLS de la tabla que consulta. Hoy no cambia nada porque el SELECT es público; el día que haya auth, cambiaría todo en silencio.
- **Sí:** Server Action para escribir, con RLS y CHECK constraints igual de estrictos. La acción es el único camino de la aplicación y el único lugar donde vive el rate limit; los constraints son la red que sigue puesta si alguien va directo a PostgREST. Poner la validación solo en la acción, con INSERT público habilitado, sería una puerta abierta con un cartel.
- **Sí:** se mantiene la decisión del SPEC 04 de no usar la `service_role` key, aceptando que un INSERT directo contra PostgREST es posible. Cerrar esa puerta cuesta una clave de administrador en el entorno, y hoy lo que protegería es un ranking sin auth donde el alias ya es una afirmación no verificada. Cuando haya identidad real, la decisión se reabre.
- **Sí:** un tope global de 9 999 999 en el CHECK, no un máximo calibrado por juego en una columna de `games`. Ocho de los nueve juegos no tienen motor y su puntaje lo inventa un `setInterval`: calibrar topes creíbles para puntajes simulados es afinar un instrumento que todavía no suena. El tope global corta lo absurdo y no requiere mantenimiento.
- **Sí:** `checkRateLimit()` gana parámetros con los valores de hoy como default. Tres envíos cada diez minutos es correcto para un formulario de contacto y demasiado poco para alguien que juega varias partidas seguidas. Duplicar el módulo por un tope distinto sería duplicar también el barrido del `Map`.
- **Sí:** todas las páginas que leen del catálogo o de los rankings son `force-dynamic`. Un leaderboard cacheado sesenta segundos produce el reporte de bug "no se guardó mi puntaje", que cuesta más que las lecturas que ahorra. Si algún día el tráfico lo justifica, `revalidatePath()` desde la acción es el paso siguiente y no requiere rediseñar nada.
- **Sí:** el Salón trae los nueve rankings en una consulta y las tabs siguen siendo estado local del cliente. Son 108 filas: menos de lo que pesa una portada. Convertir la tab en un parámetro de URL habría hecho un round-trip por click a cambio de nada visible.
- **Sí:** la fila "TU MEJOR MARCA" se consulta desde el browser. El alias vive en `localStorage` y el servidor no lo ve; moverlo a una cookie para que sí lo vea es rediseñar la sesión, y eso pertenece al spec de auth. Mientras tanto, dos consultas ligeras desde el cliente dicen la verdad, incluido el caso de estar fuera del top 12.
- **Sí:** el helper `formatScoreDate()` con `timeZone: "UTC"` explícito. Las filas del ranking las formatea el servidor y la fila del usuario la formatea el browser: sin una zona fija, la misma fecha se vería distinta en la misma tabla.
- **Sí:** `plays` cuenta puntajes guardados, no partidas empezadas. Es lo único que la tabla sabe. Contar partidas de verdad requiere escribir una fila al empezar a jugar, con su propio abuso y su propia limpieza — otro spec.
- **Sí:** los ocho juegos sin motor también guardan su puntaje simulado en Postgres. La alternativa —guardar solo ASTEROIDES— dejaría ocho tabs del Salón vacías para siempre y metería una condición por juego en el reproductor, que el SPEC 05 se esforzó en mantener como un solo chasís.
- **Sí:** `sort_order` como columna. El orden del array de hoy es una decisión de diseño de la biblioteca; sin la columna, el `select` devuelve el orden que Postgres tenga a mano y la portada del vault cambia sola.
- **No:** una tabla `categories`. Son cuatro valores que no cambian y que la UI ya tiene tipados como una unión. Un CHECK dice lo mismo sin un join.
- **No:** tocar `LIVE_SCORES` y `TOP_TODAY` del home. Un ticker de actividad real necesita decidir ventana temporal, orden, refresco y qué hacer cuando no hay actividad. Es una pantalla, no una consulta.
- **No:** `scores.user_id`. Sin `auth.users` la columna sería `null` en todas las filas y su política de RLS, decorativa. La agrega el spec que traiga auth, que además es el único que puede decidir qué hacer con las filas anónimas que este spec va a dejar.

## Riesgos

| Riesgo                                                                                                            | Mitigación                                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El portal queda vacío el día del deploy: nueve tarjetas en `0` y nueve rankings sin filas                         | Es el costo asumido de no sembrar puntajes falsos, y se compensa diseñando el estado vacío. Hay criterios de aceptación explícitos para que ninguna pantalla se rompa con la tabla vacía.                    |
| El podio del Salón accede a `rows[0]`, `rows[1]` y `rows[2]` sin comprobar y lanza con menos de tres puntajes     | El paso 6 lo trata como parte del trabajo, no como un detalle. Hay dos criterios de aceptación: cero filas y el caso intermedio de una o dos.                                                                |
| Alguien inserta directamente contra PostgREST y ensucia el ranking                                                | Los CHECK constraints y la FK corren siempre, así que la basura tiene forma válida. Es una consecuencia aceptada de no usar `service_role` sin auth, y está escrita en las decisiones para que no sorprenda. |
| Un jugador martilla el guardado y llena su propia tabla                                                           | Rate limit de 10 envíos cada 10 minutos por IP, y el ranking muestra un solo puntaje por alias: repetir no ocupa más renglones.                                                                              |
| El rate limit no frena nada porque el `Map` vive en la memoria del proceso y serverless levanta instancias nuevas | Limitación heredada y ya documentada por el SPEC 03. Frena el caso real (alguien insistiendo desde una pestaña) y no pretende ser un límite distribuido.                                                     |
| El Salón dispara nueve consultas, una por tab, y la página tarda                                                  | `getAllLeaderboards()` trae los nueve rankings en una consulta y agrupa en memoria. Las tabs no vuelven a pegarle al servidor.                                                                               |
| `force-dynamic` en todas las páginas multiplica los requests a Supabase                                           | Es la contrapartida elegida frente a un ranking desactualizado. El camino de salida —`revalidatePath()` desde la Server Action— está identificado y no requiere rediseño.                                    |
| La aplicación deja de funcionar por completo si Supabase no responde, porque hasta el catálogo vive ahí           | Cambio real respecto de hoy y consecuencia directa de borrar el array. Las páginas muestran su estado vacío en vez de lanzar, y `/supabase-check` sigue siendo la herramienta para diagnosticarlo.           |
| El seed y el array se desincronizan durante la implementación y el catálogo cambia sin que nadie lo note          | El paso 2 copia los valores literalmente y el paso 8 borra el array en el mismo spec. Entre uno y otro hay un criterio de aceptación sobre el orden y la cantidad de filas.                                  |
| `plays` pasa de string a número y algún lugar imprime `12400` sin formatear                                       | Son dos lugares (la tarjeta y el detalle) y los dos usan `toLocaleString("es-ES")`, igual que `best`. El cambio de tipo lo obliga el compilador.                                                             |
| La fecha del ranking se ve distinta en la fila del usuario que en el resto de la tabla                            | `formatScoreDate()` con `timeZone: "UTC"` explícito, usado por el servidor y por el browser. Hay un criterio de aceptación que lo compara.                                                                   |
| Las vistas quedan como `security definer` por omisión y esquivan la RLS                                           | `security_invoker = on` declarado en las dos, con un criterio de aceptación propio y una corrida del advisor de seguridad de Supabase.                                                                       |
| Borrar `saveScore()` de `lib/session.tsx` rompe algo que todavía lo usa                                           | El único llamador es el modal de `components/reproductor.tsx`, y el paso 7 lo reemplaza antes de que el paso 8 borre el método. `grep` de `av_scores` es criterio de aceptación.                             |
| El día que llegue auth, las filas anónimas de `scores` no tienen a quién pertenecer                               | Queda registrado como decisión: la migración que agregue `user_id` decide qué hacer con ellas. No se inventa hoy una columna que no se puede llenar.                                                         |

## Lo que **no** entra en esta spec

- Auth real, `profiles`, o cualquier cambio a `av_user`.
- La columna `scores.user_id` y sus políticas.
- El ticker `LIVE_SCORES` y la tabla `TOP_TODAY` del home.
- Una tabla `categories` o cualquier cambio a `CATS`.
- Escribir el catálogo desde la aplicación, o un panel de administración.
- Realtime: los rankings no se actualizan solos.
- Contar partidas empezadas, distinguidas de puntajes guardados.
- Subir a Postgres lo que ya haya en `av_scores` de un navegador.
- Un rate limit distribuido (Redis/KV).
- La `service_role` key.
- Motores para los otros ocho juegos.
- Tests automatizados.

Cada una de esas, si aparece, va en su propia spec.
