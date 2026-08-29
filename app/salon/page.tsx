// ===== app/salon/page.tsx — Salón de la Fama =====
// Portado de references/templates/salon.jsx. El encabezado y el botón de vuelta
// son estáticos, así que se quedan en el servidor; las tabs, el podio y la tabla
// dependen de la tab elegida y de la sesión, y viven en la isla <Salon />.

import type { Metadata } from "next";
import Link from "next/link";

import { Salon } from "@/components/salon";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
  description: "Los nombres que nunca se borran de la pantalla.",
};

export default function SalonPage() {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <Salon />

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link className="btn lg" href="/juegos">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
