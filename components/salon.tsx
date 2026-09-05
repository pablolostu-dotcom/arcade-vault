"use client";

// ===== components/salon.tsx =====
// Portado de references/templates/salon.jsx (HallOfFame), sin el encabezado ni
// el botón de vuelta: esos los renderiza la página en el servidor.
//
// Es client por dos motivos. La tab elegida es estado local: los nueve rankings
// llegan YA RESUELTOS por props —una sola consulta del servidor, ver
// getAllLeaderboards()— así que cambiar de tab no vuelve a pegarle a nadie.
//
// Y la fila "TU MEJOR MARCA" se consulta DESDE ACÁ, no en el servidor: el alias
// vive en localStorage y el servidor no lo ve. Moverlo a una cookie para que sí
// lo vea es rediseñar la sesión, y eso pertenece al spec de auth. Mientras
// tanto son dos consultas ligeras que dicen la verdad, incluido el caso de
// estar fuera del top 12.

import Link from "next/link";
import { useEffect, useState } from "react";

import { formatScoreDate, type GameWithStats, type ScoreRow } from "@/lib/data";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

/** Las tres primeras filas llevan el resalte de podio del prototipo. */
function rowClass(index: number): string {
  return "tr" + (index === 0 ? " top1" : index === 1 ? " top2" : index === 2 ? " top3" : "");
}

/** La marca del usuario en el juego de la tab activa. */
type OwnMark = { rank: number; score: number; date: string };

/** Slot de podio que nadie reclamó todavía. Sin fecha: no hay nada que datar. */
function EmptySlot({ position }: { position: string }) {
  return (
    <div className="podium-slot empty">
      <div className="rank-num">{position}</div>
      <div className="name">LIBRE</div>
      <div className="score">- - -</div>
    </div>
  );
}

export function Salon({
  games,
  leaderboards,
}: {
  games: GameWithStats[];
  leaderboards: Record<string, ScoreRow[]>;
}) {
  const { user } = useSession();
  const [tab, setTab] = useState(games[0]?.id ?? "");
  // Lo consultado, etiquetado con PARA QUÉ se consultó. Guardar la etiqueta en
  // vez de resetear el estado al cambiar de tab evita el setState sincrónico en
  // el cuerpo del efecto y, de paso, hace imposible mostrar la marca de una tab
  // en otra: si la etiqueta no coincide, el resultado no se usa.
  const [fetched, setFetched] = useState<{ key: string; mark: OwnMark | null } | null>(null);

  // El id de la tab activa, resuelto ANTES de cualquier return: los hooks no
  // pueden quedar detrás de una condición.
  const activeId = games.some((g) => g.id === tab) ? tab : (games[0]?.id ?? "");
  const name = user?.name;
  // Sin sesión no hay nada que consultar: `null` apaga el efecto y la fila.
  const markKey = name && activeId ? `${activeId}|${name}` : null;
  // `undefined` mientras la consulta viaja; `null` cuando no hay marca.
  const ownMark = fetched?.key === markKey ? fetched.mark : undefined;

  useEffect(() => {
    if (!markKey || !name || !activeId) return;

    let cancelled = false;

    void (async () => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("leaderboard_entries")
        .select("score, created_at")
        .eq("game_id", activeId)
        .eq("player_name", name)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data || data.score === null || !data.created_at) {
        setFetched({ key: markKey, mark: null });
        return;
      }

      // El puesto se cuenta con el mismo criterio que ordena la tabla: puntaje
      // descendente y, ante un empate, el más antiguo arriba. Contar solo
      // `score.gt` le daría el mismo puesto a dos empatados y contradiría la
      // fila que está unos renglones más arriba.
      const { count } = await supabase
        .from("leaderboard_entries")
        .select("player_name", { count: "exact", head: true })
        .eq("game_id", activeId)
        .or(
          `score.gt.${data.score},and(score.eq.${data.score},created_at.lt."${data.created_at}")`,
        );

      if (cancelled) return;
      setFetched({
        key: markKey,
        mark: {
          rank: (count ?? 0) + 1,
          score: data.score,
          // El mismo helper que usa el servidor para el resto de la tabla: sin
          // una zona horaria fija, esta fila mostraría otra fecha que las de
          // arriba para el mismo día.
          date: formatScoreDate(data.created_at),
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [markKey, name, activeId]);

  // El catálogo vive en Postgres: si la base no contesta llega vacío. Antes era
  // un array literal y su primer elemento no podía faltar; ahora sí, así que se
  // dice en vez de lanzar.
  if (games.length === 0) {
    return (
      <div className="hall-empty">
        <div className="t">EL VAULT NO RESPONDE</div>
        <div className="d">No se pudo leer el catálogo. Probá recargar en un momento.</div>
      </div>
    );
  }

  // El fallback no debería usarse —activeId siempre sale de `games`— pero evita
  // arrastrar un `undefined` desde find().
  const game = games.find((g) => g.id === activeId) ?? games[0];
  const rows = leaderboards[game.id] ?? [];
  const [first, second, third] = rows;

  return (
    <>
      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (game.id === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        // Sin un solo puntaje no hay podio ni tabla: la sección entera es la
        // invitación. Rellenar el podio con tres slots vacíos sería un mueble
        // sin función.
        <div className="hall-empty">
          <div className="t">AÚN NADIE MARCÓ UN PUNTAJE EN {game.title}</div>
          <div className="d">El puesto #01 está libre.</div>
          <div className="a">
            <Link className="btn lg" href={`/jugar/${game.id}`}>
              ▶ JUGAR {game.title}
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="podium">
            {/* Con una sola marca el podio conserva sus tres columnas y los dos
                slots sin dueño se muestran libres. */}
            {second ? (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{second.name}</div>
                <div className="score">{second.score.toLocaleString("es-ES")}</div>
                <div className="date">{second.date}</div>
              </div>
            ) : (
              <EmptySlot position="02" />
            )}

            {/* first existe siempre en esta rama: rows.length > 0. */}
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{first.name}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {first.score.toLocaleString("es-ES")}
              </div>
              <div className="date">{first.date}</div>
            </div>

            {third ? (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{third.name}</div>
                <div className="score">{third.score.toLocaleString("es-ES")}</div>
                <div className="date">{third.date}</div>
              </div>
            ) : (
              <EmptySlot position="03" />
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div key={r.name} className={rowClass(i)} style={{ animationDelay: `${i * 50}ms` }}>
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}

            {/* Sin sesión no va nada, y mientras la consulta viaja tampoco:
                ownMark queda en undefined y este bloque no se dibuja. La fila
                aparece incluso cuando el puesto cae fuera del top 12 — es la
                razón por la que el puesto se cuenta y no se busca en `rows`. */}
            {user && ownMark === null && (
              <div className="tr you-label">▸ TODAVÍA NO TENÉS MARCA EN {game.title}</div>
            )}
            {user && ownMark && (
              <>
                <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(ownMark.rank).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {user.name}
                  </div>
                  <div
                    className="sc"
                    style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}
                  >
                    {ownMark.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">{ownMark.date}</div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
