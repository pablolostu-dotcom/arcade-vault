"use client";

// ===== components/reproductor.tsx =====
// Portado de references/templates/reproductor.jsx (GamePlayer). No hay ningún
// juego: el puntaje es un setInterval que suma un delta aleatorio, igual que el
// prototipo. Math.random() solo corre dentro del efecto, nunca en el render, así
// que el HTML del servidor y el del cliente coinciden.

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Game } from "@/lib/data";
import { useSession } from "@/lib/session";

export function Reproductor({ game }: { game: Game }) {
  const { user, saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  // Iniciales del modal. Arranca en null en lugar del nombre del usuario porque
  // la sesión se hidrata después del primer render: mientras nadie escriba, el
  // input sigue a displayName; en cuanto se escribe, manda lo tipeado.
  const [initials, setInitials] = useState<string | null>(null);
  // El HUD sigue a la sesión: el provider arranca sin usuario y lo hidrata
  // después del primer render, así que leerlo derivado evita quedar en INVITADO.
  const displayName = user?.name ?? "INVITADO";
  const nameToSave = initials ?? displayName;
  const lives = 3;

  useEffect(() => {
    if (over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [over, paused]);

  useEffect(() => {
    // Mismo criterio que el prototipo: un nivel cada ~2500 puntos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [score]);

  const endGame = () => setOver(true);

  // Las vidas son una constante (el prototipo nunca las descuenta), así que no
  // hay nada que reponer acá: quedan en 3.
  const restart = () => {
    setScore(0);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setInitials(null);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {displayName}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link className="btn ghost" href={`/juegos/${game.id}`}>
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena">
            <div className="grid-floor"></div>
            <div className="enemy e1"></div>
            <div className="enemy e2"></div>
            <div className="enemy e3"></div>
            <div className="player-ship"></div>
          </div>
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        // El backdrop no cierra el modal: en el prototipo su onClick es un no-op
        // a propósito, para que la única salida sea una de las dos acciones.
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={nameToSave}
                  onChange={(e) =>
                    setInitials(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                  aria-label="Tus iniciales"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, score, name: nameToSave });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
