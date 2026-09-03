// ===== app/juegos/[id]/page.tsx — Detalle del juego =====
// Portado de references/templates/detalle.jsx. Server Component completo: el
// juego y su top-10 se leen de Postgres y se renderizan en el servidor. El
// `return null` del prototipo cuando el juego no existe se reemplaza por
// notFound().

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Leaderboard } from "@/components/leaderboard";
import { getGame } from "@/lib/catalog";
import { getLeaderboard } from "@/lib/scores";

// El top-10 y los stats salen de `scores`: cachear esta página mostraría el
// ranking de antes justo después de que alguien guarde su puntaje.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/juegos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) return { title: "Juego no encontrado · Arcade Vault" };
  return { title: `${game.title} · Arcade Vault`, description: game.short };
}

export default async function DetallePage({ params }: PageProps<"/juegos/[id]">) {
  const { id } = await params;
  const [game, scores] = await Promise.all([getGame(id), getLeaderboard(id, 10)]);
  if (!game) notFound();

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
              <div className="v">{game.plays.toLocaleString("es-ES")}</div>
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
