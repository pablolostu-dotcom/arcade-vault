"use client";

// ===== components/salon.tsx =====
// Portado de references/templates/salon.jsx (HallOfFame), sin el encabezado ni
// el botón de vuelta: esos los renderiza la página en el servidor.
//
// Es client porque la tab elegida es estado local. Los nueve rankings llegan
// YA RESUELTOS por props —una sola consulta del servidor, ver
// getAllLeaderboards()— así que cambiar de tab no vuelve a pegarle a nadie.

import Link from "next/link";
import { useState } from "react";

import type { GameWithStats, ScoreRow } from "@/lib/data";

/** Las tres primeras filas llevan el resalte de podio del prototipo. */
function rowClass(index: number): string {
  return "tr" + (index === 0 ? " top1" : index === 1 ? " top2" : index === 2 ? " top3" : "");
}

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
  const [tab, setTab] = useState(games[0]?.id ?? "");

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

  // El fallback no debería usarse —la tab siempre sale de `games`— pero evita
  // arrastrar un `undefined` desde find().
  const game = games.find((g) => g.id === tab) ?? games[0];
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
          </div>
        </>
      )}
    </>
  );
}
