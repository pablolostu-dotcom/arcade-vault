"use client";

// ===== components/biblioteca.tsx =====
// Portado de references/templates/biblioteca.jsx (Library), sin el hero:
// ese lo renderiza la página en el servidor. El filtro es estado local —
// no se refleja en la URL, según la decisión del spec.

import { useMemo, useState } from "react";

import { GameCard } from "@/components/game-card";
import { CATS, GAMES } from "@/lib/data";

export function Biblioteca() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("TODOS");

  const filtered = useMemo(() => {
    return GAMES.filter(
      (g) => (cat === "TODOS" || g.cat === cat) && g.title.toLowerCase().includes(q.toLowerCase()),
    );
  }, [q, cat]);

  return (
    <>
      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un juego por nombre…"
          />
        </div>
        <div className="av-chips">
          {CATS.map((c) => (
            <button
              key={c}
              className={"chip" + (cat === c ? " active" : "")}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: 80,
              color: "var(--ink-faint)",
            }}
          >
            <div className="pixel" style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}>
              NO HAY RESULTADOS
            </div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
        )}
      </div>
    </>
  );
}
