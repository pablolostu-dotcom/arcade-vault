// ===== app/juegos/page.tsx — Biblioteca =====
// Server Component: lee el catálogo de Postgres, renderiza el marco y el hero,
// y delega la interactividad (buscador, chips, grilla) a la isla client
// <Biblioteca />, que recibe los juegos ya resueltos.

import type { Metadata } from "next";

import { Biblioteca } from "@/components/biblioteca";
import { getGames } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
  description: "Todos los juegos del vault, listos para insertar una moneda.",
};

// El mejor puntaje de cada tarjeta sale de `scores`: cachear esta página
// mostraría un número viejo justo después de que alguien guarde el suyo.
export const dynamic = "force-dynamic";

export default async function BibliotecaPage() {
  const games = await getGames();

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <Biblioteca games={games} />
    </div>
  );
}
