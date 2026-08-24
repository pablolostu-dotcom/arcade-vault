import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sistema visual · Arcade Vault",
  description: "Referencia del tema global portado desde el prototipo.",
};

// Página de referencia del tema: existe solo para verificar que el CSS global
// rinde igual que el prototipo. Se puede borrar sin afectar a la app.

const COVERS = [
  { cover: "cover-bricks", title: "BLOQUE BUSTER", cat: "ARCADE", short: "Rebota la pelota y destruye muros de neón.", best: 28450, color: "" },
  { cover: "cover-tetro", title: "CAÍDA", cat: "PUZZLE", short: "Encaja las piezas antes de que el techo te aplaste.", best: 184220, color: "magenta" },
  { cover: "cover-snake", title: "SERPENTINA", cat: "CLÁSICO", short: "Crece sin morder tu propia cola.", best: 9820, color: "yellow" },
  { cover: "cover-glot", title: "GLOTÓN", cat: "LABERINTO", short: "Comé todos los puntos y esquivá a los fantasmas.", best: 76300, color: "" },
  { cover: "cover-invaders", title: "INVASORES", cat: "SHOOTER", short: "Defendé la colonia oleada tras oleada.", best: 45120, color: "magenta" },
  { cover: "cover-rocas", title: "ROCAS", cat: "ESPACIO", short: "Pulverizá asteroides a la deriva.", best: 33990, color: "yellow" },
  { cover: "cover-rana", title: "RANA", cat: "ARCADE", short: "Cruzá la autopista sin quedar en el asfalto.", best: 15740, color: "" },
  { cover: "cover-duelo", title: "DUELO", cat: "VERSUS", short: "El primer videojuego, con más neón.", best: 21, color: "magenta" },
];

const SCORES = [
  { pl: "PABLO", sc: 184220, dt: "24/08/2026" },
  { pl: "NEXUS", sc: 152880, dt: "23/08/2026" },
  { pl: "KIRA", sc: 141005, dt: "22/08/2026" },
  { pl: "ZERO", sc: 98430, dt: "21/08/2026" },
  { pl: "LUMEN", sc: 87210, dt: "20/08/2026" },
];

function rankClass(i: number) {
  return i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "";
}

export default function EstilosPage() {
  return (
    <>
      <nav className="av-nav">
        <div className="logo">
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">ARCADE VAULT</div>
        </div>
        <div className="links">
          <a className="active">BIBLIOTECA</a>
          <a>SALÓN DE LA FAMA</a>
          <a>SISTEMA VISUAL</a>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>03 CRÉDITOS</span>
        </div>
        <button className="btn ghost auth-btn">ENTRAR</button>
        <button className="btn hamburger">≡</button>
      </nav>

      <main className="av-main">
        <section className="av-hero">
          <h1>ARCADE VAULT</h1>
          <div className="sub">
            INSERTÁ MONEDA <span className="blink">_</span>
          </div>
        </section>

        <div className="av-filters">
          <label className="av-search">
            <span className="ico">&gt;</span>
            <input placeholder="BUSCAR JUEGO" />
          </label>
          <div className="av-chips">
            <button className="chip active">TODOS</button>
            <button className="chip">ARCADE</button>
            <button className="chip">PUZZLE</button>
            <button className="chip">SHOOTER</button>
            <button className="chip">CLÁSICO</button>
          </div>
        </div>

        <div className="av-grid">
          {COVERS.map((g) => (
            <article className="card" key={g.cover}>
              <div className="cover">
                <div className={"cover-bg " + g.cover} />
                <div className="label">{g.cat}</div>
              </div>
              <div className="meta">
                <div className="title">{g.title}</div>
                <div className="desc">{g.short}</div>
                <div className="row">
                  <div className="score-badge">
                    <span>MEJOR PUNTUACIÓN</span>
                    <b>{g.best.toLocaleString("es-ES")}</b>
                  </div>
                  <button className={"btn " + g.color}>JUGAR</button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="av-detail">
          <div className="detail-cover">
            <div className="cover-bg cover-tetro" />
          </div>
          <div className="detail-info">
            <h2 className="neon-cyan">CAÍDA</h2>
            <div className="detail-tags">
              <span>PUZZLE</span>
              <span>1 JUGADOR</span>
              <span>1984</span>
            </div>
            <p>
              Piezas geométricas descienden desde la oscuridad. Rotalas, encastralas y limpiá
              líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.
            </p>
            <div className="stat-strip">
              <div>
                <div className="l">Récord</div>
                <div className="v">184.220</div>
              </div>
              <div>
                <div className="l">Partidas</div>
                <div className="v">31.8K</div>
              </div>
              <div>
                <div className="l">Dificultad</div>
                <div className="v">ALTA</div>
              </div>
            </div>
            <div className="detail-actions">
              <button className="btn lg pulse">JUGAR AHORA</button>
              <button className="btn ghost lg">VOLVER</button>
            </div>
          </div>
          <div className="leaderboard">
            <h3>TOP 5 GLOBAL</h3>
            {SCORES.map((s, i) => (
              <div className={"lb-row" + rankClass(i)} key={s.pl}>
                <span className="rk">{String(i + 1).padStart(2, "0")}</span>
                <span className="pl">{s.pl}</span>
                <span className="sc">{s.sc.toLocaleString("es-ES")}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="av-player">
          <div className="player-hud">
            <div className="hud-stat">
              <div className="l">Puntaje</div>
              <div className="v">042.980</div>
            </div>
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">♥♥♥</div>
            </div>
            <div className="hud-stat level">
              <div className="l">Nivel</div>
              <div className="v">07</div>
            </div>
            <div className="hud-actions">
              <button className="btn">PAUSA</button>
              <button className="btn magenta">SALIR</button>
            </div>
          </div>
          <div className="crt">
            <div className="crt-screen">
              <div className="game-arena">
                <div className="grid-floor" />
                <div className="player-ship" />
                <div className="enemy e1" />
                <div className="enemy e2" />
                <div className="enemy e3" />
              </div>
            </div>
            <div className="crt-bottom">
              <span className="led">EN LÍNEA</span>
              <span>ARCADE VAULT CRT-88</span>
            </div>
          </div>
          <div className="tw-section" style={{ marginTop: 18 }}>
            <div className="tw-label">GUARDADO</div>
            <span className="toast-saved">PUNTAJE REGISTRADO</span>
          </div>
        </div>

        <div className="av-hall">
          <div className="hall-head">
            <h1>SALÓN DE LA FAMA</h1>
            <p>Los puntajes más altos del vault</p>
          </div>
          <div className="hall-tabs">
            <button className="chip active">CAÍDA</button>
            <button className="chip">BLOQUE BUSTER</button>
            <button className="chip">SERPENTINA</button>
          </div>
          <div className="podium">
            <div className="podium-slot silver">
              <div className="rank-num">2</div>
              <div className="name">NEXUS</div>
              <div className="score">152.880</div>
              <div className="date">23/08/2026</div>
            </div>
            <div className="podium-slot gold">
              <div className="rank-num">1</div>
              <div className="name">PABLO</div>
              <div className="score">184.220</div>
              <div className="date">24/08/2026</div>
            </div>
            <div className="podium-slot bronze">
              <div className="rank-num">3</div>
              <div className="name">KIRA</div>
              <div className="score">141.005</div>
              <div className="date">22/08/2026</div>
            </div>
          </div>
          <div className="hall-table">
            <div className="th">
              <span>#</span>
              <span>JUGADOR</span>
              <span>JUEGO</span>
              <span>PUNTAJE</span>
            </div>
            {SCORES.map((s, i) => (
              <div
                className={"tr" + rankClass(i) + (s.pl === "PABLO" ? " you" : "")}
                key={s.pl}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <span className="rk">{String(i + 1).padStart(2, "0")}</span>
                <span className="pl">{s.pl}</span>
                <span className="dt">CAÍDA</span>
                <span className="sc">{s.sc.toLocaleString("es-ES")}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="av-auth-wrap">
          <div className="auth-card">
            <div className="auth-header">
              <div className="mark" />
              <h2 className="neon-cyan">INICIAR SESIÓN</h2>
            </div>
            <div className="auth-tabs">
              <button className="on">ENTRAR</button>
              <button>REGISTRARSE</button>
            </div>
            <div className="field">
              <label htmlFor="alias">Alias</label>
              <input id="alias" placeholder="MAX 10 CARACTERES" />
            </div>
            <div className="field">
              <label htmlFor="pin">PIN</label>
              <input id="pin" type="password" placeholder="••••" />
            </div>
            <button className="btn lg" style={{ width: "100%" }}>
              INSERTAR MONEDA
            </button>
            <div className="auth-divider">O CONTINUÁ CON</div>
            <div className="social">
              <button className="btn ghost">GOOGLE</button>
              <button className="btn ghost">GITHUB</button>
            </div>
          </div>
        </div>

        <div className="av-hall">
          <div className="tw-section">
            <div className="tw-label">BOTONES</div>
            <div className="detail-actions">
              <button className="btn">CYAN</button>
              <button className="btn magenta">MAGENTA</button>
              <button className="btn yellow">YELLOW</button>
              <button className="btn ghost">GHOST</button>
              <button className="btn xl">XL</button>
            </div>
          </div>
          <div className="divider" />
          <div className="tw-section">
            <div className="tw-label">TEXTO</div>
            <div className="pixel neon-cyan">pixel + neón cyan</div>
            <div className="pixel neon-magenta">pixel + neón magenta</div>
            <div className="pixel neon-yellow flicker">pixel + neón yellow (flicker)</div>
            <div className="pixel neon-green">pixel + neón green</div>
            <p className="mono">
              Cuerpo en mono: 0123456789 — ÁÉÍÓÚ ñ ¿? ¡! · {(1234567).toLocaleString("es-ES")}
            </p>
          </div>
          <div className="divider" />
          <div className="tw-section">
            <div className="tw-label">SPINNER</div>
            <span className="spinner" />
          </div>
        </div>
      </main>
    </>
  );
}
