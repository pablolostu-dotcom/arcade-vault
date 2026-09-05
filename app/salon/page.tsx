// ===== app/salon/page.tsx — Salón de la Fama =====
// Portado de references/templates/salon.jsx. El encabezado y el botón de vuelta
// son estáticos, así que se quedan en el servidor; las tabs, el podio y la tabla
// dependen de la tab elegida y viven en la isla <Salon />.
//
// Los nueve rankings se leen ACÁ, en una sola consulta, y viajan completos a la
// isla: cambiar de tab no vuelve a pegarle al servidor.

import type { Metadata } from "next";
import Link from "next/link";

import { Salon } from "@/components/salon";
import { getGames } from "@/lib/catalog";
import { getAllLeaderboards } from "@/lib/scores";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
  description: "Los nombres que nunca se borran de la pantalla.",
};

// El Salón es el ranking: cachearlo mostraría el puesto de antes justo después
// de que alguien lo cambie.
export const dynamic = "force-dynamic";

export default async function SalonPage() {
  // Las doce filas por juego son las del prototipo, contra las diez del detalle.
  const [games, leaderboards] = await Promise.all([getGames(), getAllLeaderboards(12)]);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <Salon games={games} leaderboards={leaderboards} />

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/juegos">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
