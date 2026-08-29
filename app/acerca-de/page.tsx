// ===== app/acerca-de/page.tsx — Acerca de (stub) =====
// Stub del SPEC 02: el nav del prototipo trae los cuatro links y dejar uno
// cayendo en el 404 es un bug visible. La pantalla real (misión, highlights,
// divisor animado y formulario de contacto) es el SPEC 03.
// Solo clases que ya existen: cero CSS nuevo.

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Acerca de · Arcade Vault",
  description: "Qué es Arcade Vault y quién lo hace. Próximamente.",
};

export default function AcercaDePage() {
  return (
    <div className="about fade-in">
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          PRÓXIMAMENTE <span className="blink">_</span>
        </p>
        <div style={{ marginTop: 32 }}>
          <Link className="btn lg" href="/">
            VOLVER AL INICIO
          </Link>
        </div>
      </section>
    </div>
  );
}
