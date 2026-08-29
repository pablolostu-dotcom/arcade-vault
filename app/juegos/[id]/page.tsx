// ===== app/juegos/[id]/page.tsx — Detalle del juego =====
// Portado de references/templates/detalle.jsx. Server Component completo:
// seededScores es determinista, así que el top-10 se prerenderiza sin riesgo
// de desincronizarse con el cliente. El `return null` del prototipo cuando el
// juego no existe se reemplaza por notFound().

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Leaderboard } from "@/components/leaderboard";
import { GAMES, seededScores } from "@/lib/data";

export async function generateMetadata({
  params,
}: PageProps<"/juegos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) return { title: "Juego no encontrado · Arcade Vault" };
  return { title: `${game.title} · Arcade Vault`, description: game.short };
}

export default async function DetallePage({ params }: PageProps<"/juegos/[id]">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  // Misma semilla que el prototipo: los puntajes coinciden juego por juego.
  const scores = seededScores(id.length * 17 + 3, 10);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{ color: "var(--magenta)", textShadow: "0 0 6px rgba(255,0,110,0.5)" }}
              >
                {game.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link className="btn xl pulse" href={`/jugar/${game.id}`}>
              ▶  JUGAR AHORA
            </Link>
            <Link className="btn ghost lg" href="/juegos">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <Leaderboard rows={scores} />
      </aside>
    </div>
  );
}
