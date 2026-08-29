// ===== app/page.tsx — Home (landing) =====
// Portado de Home() de references/templates/home-about/home.jsx. Server
// Component: la única isla es <Reveal>, que envuelve las secciones que aparecen
// al scrollear. El hero no la lleva a propósito — es el contenido crítico y
// tiene que verse aunque el JS no corra.

import type { Metadata } from "next";
import Link from "next/link";

import { FeatureIcon, type FeatureIconKind } from "@/components/home/feature-icon";
import { FloatingSilhouettes } from "@/components/home/floating-silhouettes";
import { MiniCard } from "@/components/home/mini-card";
import { Reveal } from "@/components/home/reveal";
import { GAMES, LIVE_SCORES, TOP_TODAY, type Accent } from "@/lib/data";

export const metadata: Metadata = {
  title: "Arcade Vault · Portal Retro",
  description: "Jugá clásicos de arcade online y competí por el puntaje más alto.",
};

// Copy de UI, no datos: vive acá y no en lib/data.ts, igual que en el prototipo.
const FEATURES: { i: FeatureIconKind; t: string; d: string; c: Accent }[] = [
  { i: "GAMEPAD", t: "JUEGOS CLÁSICOS", d: "Arkanoid, Tetris, Snake y muchos más. Los mejores arcades de todos los tiempos en un solo lugar.", c: "cyan" },
  { i: "FREE",    t: "100% GRATIS",      d: "Sin suscripciones, sin pagos ocultos. Todos los juegos disponibles de forma gratuita.", c: "yellow" },
  { i: "TROPHY",  t: "LADDER BOARDS",    d: "Compite con jugadores de todo el mundo. Escala el ranking y demuestra quién es el mejor.", c: "magenta" },
  { i: "ROCKET",  t: "SIEMPRE CRECIENDO",d: "Agregamos nuevos juegos constantemente. Vuelve seguido, siempre habrá algo nuevo que jugar.", c: "green" },
];

// Números de marketing del prototipo: el stat dice 12+ aunque GAMES tenga 8.
const STATS: { n: string; u: string; s: string }[] = [
  { n: "12+", u: "JUEGOS", s: "Y CONTANDO" },
  { n: "MILES", u: "DE PARTIDAS", s: "JUGADAS CADA DÍA" },
  { n: "GLOBAL", u: "RANKING", s: "COMPITE CON EL MUNDO" },
];

export default function HomePage() {
  return (
    <div className="home fade-in">
      {/* HERO */}
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">▸ INSERTA UNA MONEDA<span className="blink">_</span></div>
          <h1 className="home-title">
            <span className="line-1">EL ARCADE</span>
            <span className="line-2">CLÁSICO ESTÁ</span>
            <span className="line-3">DE VUELTA</span>
          </h1>
          <p className="home-sub">
            Juega los mejores clásicos directamente en tu navegador.<br/>
            Sin descargas. Sin costo. Solo diversión.
          </p>
          <div className="home-ctas">
            <Link className="btn xl pulse" href="/juegos">▶  EXPLORAR JUEGOS</Link>
            <Link className="btn xl magenta" href="/acceso">✦  CREAR CUENTA</Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>DESLIZA</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      {/* WHY */}
      <Reveal className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">{"// 01"}</div>
          <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
          <div className="section-rule"></div>
        </div>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <div key={f.i} className={"feature-card " + f.c} style={{ transitionDelay: (i * 80) + "ms" }}>
              <FeatureIcon kind={f.i} />
              <div className="ft-title pixel">{f.t}</div>
              <div className="ft-desc">{f.d}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* GAMES PREVIEW */}
      <Reveal className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">{"// 02"}</div>
          <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
          <div className="section-rule"></div>
        </div>
        <div className="mini-rail">
          {GAMES.slice(0, 6).map(g => (
            <MiniCard key={g.id} game={g} />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link className="btn lg" href="/juegos">VER TODOS LOS JUEGOS →</Link>
        </div>
      </Reveal>

      {/* STATS */}
      <Reveal className="home-stats">
        <div className="stats-inner">
          {STATS.map((st, i) => (
            <div key={st.u} className="stat-block" style={{ transitionDelay: (i * 90) + "ms" }}>
              <div className="stat-n neon-yellow">{st.n}</div>
              <div className="stat-u pixel">{st.u}</div>
              <div className="stat-s">{st.s}</div>
            </div>
          ))}
        </div>
      </Reveal>

      {/* RECENT ACTIVITY / LEADERBOARD */}
      <Reveal className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">{"// 03"}</div>
          <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
          <div className="section-rule"></div>
        </div>
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
            </div>
            <div className="ticker">
              {LIVE_SCORES.map((r, i) => (
                <div key={r.player} className="tick-row" style={{ animationDelay: (i * 60) + "ms" }}>
                  <span className={"tk-p neon-" + r.color}>{r.player}</span>
                  <span className="tk-mid">▸ {r.game}</span>
                  <span className="tk-s">+{r.score.toLocaleString("es-ES")}</span>
                  <span className="tk-t">{r.when}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
              <Link className="lb-link" href="/salon">VER SALÓN →</Link>
            </div>
            <div className="top-list">
              {TOP_TODAY.map((r, i) => (
                <div key={r.player} className={"top-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}>
                  <span className="tp-rk">#{String(r.rank).padStart(2, "0")}</span>
                  <span className="tp-bar"><span className="tp-fill" style={{ width: (100 - i * 16) + "%" }}></span></span>
                  <span className="tp-p">{r.player}</span>
                  <span className="tp-s">{r.score.toLocaleString("es-ES")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* PRICING */}
      <Reveal className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-green">{"// 04"}</div>
          <h2 className="section-title">PRECIOS</h2>
          <div className="section-rule"></div>
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">PLAN ÚNICO</div>
            <div className="pc-name pixel">JUGADOR VAULT</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">/ SIEMPRE</span>
            </div>
            <div className="pc-tag">SIN TRUCOS · SIN LETRA PEQUEÑA</div>
            <ul className="pc-list">
              <li>✔ Acceso a todos los juegos</li>
              <li>✔ Ranking global y salón de la fama</li>
              <li>✔ Sin anuncios entre partidas</li>
              <li>✔ Guarda tus puntuaciones</li>
              <li>✔ Nuevos juegos cada mes</li>
              <li>✔ Funciona en cualquier navegador</li>
            </ul>
            <Link className="btn xl pulse" style={{ width: "100%" }} href="/acceso">EMPEZAR GRATIS →</Link>
            <div className="pc-foot">No pedimos tarjeta. Nunca lo haremos.</div>
            <div className="pc-stamp pixel">FREE<br/>PLAY</div>
          </div>

          <div className="pricing-faq">
            <div className="faq-item">
              <div className="faq-q pixel">¿REALMENTE ES GRATIS?</div>
              <div className="faq-a">Sí. Arcade Vault es un proyecto sin fines de lucro hecho por amor a los clásicos. No hay versión &quot;premium&quot; escondida.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q pixel">¿NECESITO CREAR CUENTA?</div>
              <div className="faq-a">No. Puedes jugar como invitado. Si quieres guardar tu puntuación y aparecer en el ranking, regístrate en 10 segundos.</div>
            </div>
            <div className="faq-item">
              <div className="faq-q pixel">¿CÓMO SOBREVIVEN SIN COBRAR?</div>
              <div className="faq-a">Es un proyecto comunitario. Si te gusta, compártelo. Esa es toda la moneda que aceptamos.</div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* FINAL CTA */}
      <Reveal className="home-final">
        <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
        <Link className="btn xl pulse final-cta" href="/juegos">INSERTAR MONEDA →</Link>
        <div className="final-tag">Gratis. Sin registro obligatorio. Empieza en segundos.</div>
      </Reveal>
    </div>
  );
}
