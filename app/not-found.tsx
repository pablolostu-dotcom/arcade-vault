// ===== app/not-found.tsx — 404 =====
// El prototipo no tiene 404: devuelve null y deja la página en blanco. Con URLs
// reales eso es un bug visible, así que esta pantalla es nueva — pero armada
// solo con clases que ya existen en globals.css, sin agregar ninguna regla.
//
// La idea: en vez de un mensaje centrado, el error se muestra dentro del CRT
// del reproductor, como un gabinete al que le falta el cartucho. El .flicker
// del título ya está contemplado en el bloque prefers-reduced-motion.

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="av-player fade-in" style={{ maxWidth: 640 }}>
      <div className="crt">
        <div className="crt-screen">
          <div className="crt-content">
            <div>
              <div
                className="pixel neon-magenta flicker"
                style={{ fontSize: "clamp(40px, 12vw, 72px)", lineHeight: 1 }}
              >
                404
              </div>
              <div style={{ marginTop: 18, letterSpacing: "0.18em" }}>
                CARTUCHO NO ENCONTRADO _
              </div>
            </div>
          </div>
        </div>
        {/* Sin la clase .led: el punto verde de "SEÑAL OK" del reproductor
            está ausente a propósito. La consola no encendió. */}
        <div className="crt-bottom">
          <span>SIN SEÑAL</span>
          <span>CRT-83 · 60 HZ</span>
          <span>CARGA · 0MB</span>
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <p style={{ color: "var(--ink-dim)", maxWidth: 460, margin: "0 auto 24px" }}>
          No hay ninguna pantalla en esta dirección. Comprueba el enlace o vuelve a la
          biblioteca para elegir un juego.
        </p>
        <Link className="btn lg" href="/juegos">
          VOLVER AL VAULT
        </Link>
      </div>
    </div>
  );
}
