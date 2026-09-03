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
      {/* Sin puntajes se muestra la invitación, no una lista de cero filas: un
          panel con encabezado y nada debajo parece un error de carga. El texto
          nombra el puesto con el mismo formato que la columna .rk (#01). */}
      {rows.length === 0 && (
        <div className="lb-empty">
          <div className="t">AÚN NADIE MARCÓ UN PUNTAJE</div>
          <div className="d">Jugá una partida y quedate con el puesto #01.</div>
        </div>
      )}
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
