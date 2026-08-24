// ===== components/leaderboard.tsx =====
// Portado de references/templates/detalle.jsx (el bloque .leaderboard).
// Sin estado y sin efectos: las filas llegan por props ya calculadas, así que
// se renderiza entero en el servidor.

import type { ScoreRow } from "@/lib/data";

/** Las tres primeras filas llevan el resalte de podio del prototipo. */
function rowClass(index: number): string {
  return "lb-row" + (index === 0 ? " top1" : index === 1 ? " top2" : index === 2 ? " top3" : "");
}

export function Leaderboard({ rows }: { rows: ScoreRow[] }) {
  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {rows.map((r, i) => (
        <div key={r.name} className={rowClass(i)}>
          <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
          <div className="pl">
            {r.name}
            <div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
              {r.date}
            </div>
          </div>
          <div className="sc">{r.score.toLocaleString("es-ES")}</div>
        </div>
      ))}
    </div>
  );
}
