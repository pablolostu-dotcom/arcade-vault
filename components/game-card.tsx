"use client";

// ===== components/game-card.tsx =====
// Portado de references/templates/biblioteca.jsx (GameCard). El tilt escribe
// el transform directo sobre el nodo, igual que el prototipo, y lo limpia al
// salir el mouse. Toda la tarjeta lleva a /juegos/[id].

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, type MouseEvent } from "react";

import type { Game, GameWithStats } from "@/lib/data";

/** El prototipo solo tiene variante magenta y yellow; cyan y green usan el btn base. */
function btnClass(color: Game["color"]): string {
  return "btn " + (color === "magenta" ? "magenta" : color === "yellow" ? "yellow" : "");
}

export function GameCard({ game }: { game: GameWithStats }) {
  const tiltRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const href = `/juegos/${game.id}`;

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };

  const onLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = "";
  };

  return (
    <div
      ref={tiltRef}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={() => router.push(href)}
    >
      <div className="cover">
        <div className={"cover-bg " + game.cover}></div>
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best.toLocaleString("es-ES")}</b>
          </div>
          {/* Link real: el mismo destino que el click en la tarjeta, pero
              alcanzable por teclado y abrible en otra pestaña. */}
          <Link
            className={btnClass(game.color)}
            href={href}
            onClick={(e) => e.stopPropagation()}
          >
            JUGAR
          </Link>
        </div>
      </div>
    </div>
  );
}
