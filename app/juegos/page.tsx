// ===== app/juegos/page.tsx — Biblioteca =====
// Server Component: renderiza el marco y el hero, y delega la interactividad
// (buscador, chips, grilla) a la isla client <Biblioteca />.

import type { Metadata } from "next";

import { Biblioteca } from "@/components/biblioteca";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
  description: "Todos los juegos del vault, listos para insertar una moneda.",
};

export default function BibliotecaPage() {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <Biblioteca />
    </div>
  );
}
