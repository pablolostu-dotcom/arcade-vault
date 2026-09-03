// ===== components/home/mini-card.tsx =====
// Portado de MiniCard() de references/templates/home-about/home.jsx. El
// prototipo usa <div onClick> porque su navegación es un objeto de estado; acá
// el destino es una URL real, así que va un <Link>: prefetch, click con la
// rueda, indexable — y sin necesidad de que la tarjeta sea client.

import Link from "next/link";

import type { Game } from "@/lib/data";

// La rail del home solo pinta portada, título y categoría: pedir el juego
// entero ataría esta tarjeta a campos que no usa.
type MiniGame = Pick<Game, "id" | "title" | "cat" | "cover">;

export function MiniCard({ game }: { game: MiniGame }) {
  return (
    <Link className="mini-card" href={`/juegos/${game.id}`}>
      <div className="mini-cover"><div className={"cover-bg " + game.cover}></div></div>
      <div className="mini-meta">
        <div className="mini-title">{game.title}</div>
        <div className="mini-cat">{game.cat}</div>
      </div>
    </Link>
  );
}
