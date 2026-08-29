// ===== app/acerca-de/page.tsx — Acerca de =====
// Portado de references/templates/home-about/about.jsx. Reemplaza el stub del
// SPEC 02. Server Component: las únicas islas son <Reveal> (el observer) y
// <ContactForm> (estado del formulario + Server Action).
// Solo clases que ya existen en globals.css: cero CSS nuevo.

import type { Metadata } from "next";

import { ContactForm } from "@/components/about/contact-form";
import { HighlightIcon, type HighlightIconKind } from "@/components/about/highlight-icon";
import { Reveal } from "@/components/home/reveal";

export const metadata: Metadata = {
  title: "Acerca de · Arcade Vault",
  description:
    "Qué es Arcade Vault, por qué existe y cómo contactarnos: sugerencias, propuestas de juegos o simplemente un saludo.",
};

const HIGHLIGHTS: { i: HighlightIconKind; t: string; c: string }[] = [
  { i: "HEART", t: "HECHO CON ❤️ PARA JUGADORES", c: "magenta" },
  { i: "BROWSER", t: "JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR", c: "cyan" },
  { i: "PLANT", t: "PROYECTO EN CONSTANTE CRECIMIENTO", c: "green" },
];

// El divisor son 24 píxeles que parpadean escalonados. Decorativo puro: el
// nodo lleva aria-hidden y por eso <Reveal> necesitó la prop.
const DIVIDER_PIXELS = Array.from({ length: 24 });

export default function AcercaDePage() {
  return (
    <div className="about fade-in">
      {/* ABOUT — sin reveal: se ve de entrada, igual que el prototipo */}
      <section className="about-hero">
        <div className="kicker pixel neon-yellow">▸ ACERCA DE</div>
        <h1 className="about-title">ACERCA DE ARCADE VAULT</h1>
        <p className="about-mission">
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y celebrar
          los arcades que definieron una generación, haciéndolos accesibles para todos, en cualquier lugar
          y sin costo.
        </p>

        <div className="highlight-row">
          {HIGHLIGHTS.map((h, i) => (
            <div key={h.i} className={"highlight " + h.c} style={{ transitionDelay: (i * 80) + "ms" }}>
              <HighlightIcon kind={h.i} />
              <div className="hl-text pixel">{h.t}</div>
            </div>
          ))}
        </div>
      </section>

      {/* divider banner */}
      <Reveal as="div" className="about-divider" ariaHidden>
        <div className="div-bar"></div>
        <div className="div-pixels">
          {DIVIDER_PIXELS.map((_, i) => (
            <span key={i} style={{ animationDelay: (i * 80) + "ms" }}></span>
          ))}
        </div>
        <div className="div-bar"></div>
      </Reveal>

      {/* CONTACT */}
      <Reveal className="about-contact">
        <div className="contact-grid">
          <div className="contact-intro">
            <div className="kicker pixel neon-cyan">▸ CONTACTO</div>
            <h2 className="contact-title">CONTÁCTANOS</h2>
            <p className="contact-sub">
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
              Escríbenos.
            </p>
            <div className="contact-tips">
              <div className="tip"><span className="tip-led"></span>RESPUESTA EN 24-48H</div>
              <div className="tip"><span className="tip-led y"></span>SUGERENCIAS BIENVENIDAS</div>
              <div className="tip"><span className="tip-led m"></span>SIN SPAM, JAMÁS</div>
            </div>
          </div>

          <ContactForm />
        </div>
      </Reveal>
    </div>
  );
}
