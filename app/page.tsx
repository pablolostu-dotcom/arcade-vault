// ===== app/page.tsx — Biblioteca =====
// Server Component: renderiza el marco y el hero, y delega la interactividad
// (buscador, chips, grilla) a la isla client <Biblioteca />.

import { Biblioteca } from "@/components/biblioteca";

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
