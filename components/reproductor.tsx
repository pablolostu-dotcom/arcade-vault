"use client";

// ===== components/reproductor.tsx =====
// Portado de references/templates/reproductor.jsx (GamePlayer). Es el chasis
// único de los nueve juegos y adentro se bifurca una sola vez, por hasEngine():
//
//   - con motor (asteroides): el HUD sigue a los snapshots del canvas.
//   - sin motor (los otros ocho): el puntaje es un setInterval que suma un
//     delta aleatorio, igual que el prototipo. Math.random() solo corre dentro
//     del efecto, nunca en el render, así que el HTML del servidor y el del
//     cliente coinciden.
//
// El import de hasEngine es estático (es un mapa de strings), pero el motor
// cuelga de un import() dinámico adentro del registro: los ocho simulados no
// pagan su peso.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { submitScore, type SubmitScoreError } from "@/app/jugar/actions";
import { GameCanvas, type GameCanvasHandle } from "@/components/game-canvas";
import type { Game } from "@/lib/data";
import type { GameSnapshot, SkinId } from "@/lib/games/types";
import { SKIN_IDS } from "@/lib/games/types";
import { hasEngine } from "@/lib/games/registry";
import { useSession } from "@/lib/session";

// Mismo registro que el formulario de contacto: mayúsculas, directo y sin
// detalles del proveedor —esos quedan en el console.error del servidor—.
// La preferencia de silencio del portal, con el prefijo av_ de av_user y el
// mismo formato JSON. Ausente ⇒ con sonido.
const MUTED_KEY = "av_muted";

// La skin es POR JUEGO y no del portal: elegir `retro` en Tetris no puede
// cambiarle la paleta a Snake. Va un mapa { [gameId]: SkinId } en una sola
// clave —y no una clave av_skin_<id> por juego— para que siga siendo una
// lectura, un JSON.parse y un efecto espejo, calcado de av_muted.
const SKIN_KEY = "av_skin";

const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};

/** Un id desconocido, un JSON corrupto o un valor fuera de SKIN_IDS ⇒ clásico. */
function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && (SKIN_IDS as readonly string[]).includes(value);
}

const ERROR_TEXT: Record<SubmitScoreError, string> = {
  INVALID: "REVISA LAS INICIALES: HACEN FALTA ENTRE 1 Y 10 CARACTERES.",
  RATE_LIMIT: "DEMASIADOS GUARDADOS. ESPERA UNOS MINUTOS Y REINTENTA.",
  DB: "NO SE PUDO GUARDAR LA PUNTUACIÓN. REINTENTA.",
};

// El reproductor solo necesita saber a qué juego pertenece la partida y cómo
// se llama: pedir el juego entero lo ataría a campos que no usa.
type PlayableGame = Pick<Game, "id" | "title">;

export function Reproductor({ game }: { game: PlayableGame }) {
  const { user } = useSession();
  const withEngine = hasEngine(game.id);
  const canvasRef = useRef<GameCanvasHandle>(null);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  // Antes era la constante 3: el prototipo nunca descuenta vidas. Con motor sí
  // se descuentan, así que pasa a ser estado. Sin motor arranca y se queda en 3.
  //
  // `null` significa "este juego no tiene vidas" y esconde el slot ♥: Tetris no
  // tiene el concepto. Arranca en null con motor y lo llena el primer snapshot,
  // así el HUD nunca muestra tres corazones prestados antes del primer frame.
  const [lives, setLives] = useState<number | null>(withEngine ? null : 3);
  // El stat propio de cada juego, ya formateado por el motor. Sin motor no hay.
  const [extra, setExtra] = useState<GameSnapshot["extra"]>(undefined);
  const [paused, setPaused] = useState(false);
  // El silencio es del portal, no de la partida: vive acá y baja al motor por
  // la prop `muted` de <GameCanvas>. Los motores mudos lo ignoran.
  const [muted, setMuted] = useState(false);
  const [mutedHydrated, setMutedHydrated] = useState(false);
  // La skin también es del portal y baja al motor por la prop `skin` de
  // <GameCanvas>. Los motores que todavía no tienen skins la ignoran.
  const [skin, setSkin] = useState<SkinId>("clasico");
  const [skinHydrated, setSkinHydrated] = useState(false);
  const [over, setOver] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<SubmitScoreError | null>(null);
  const [isSaving, startSaving] = useTransition();
  // Iniciales del modal. Arranca en null en lugar del nombre del usuario porque
  // la sesión se hidrata después del primer render: mientras nadie escriba, el
  // input sigue a displayName; en cuanto se escribe, manda lo tipeado.
  const [initials, setInitials] = useState<string | null>(null);
  // El HUD sigue a la sesión: el provider arranca sin usuario y lo hidrata
  // después del primer render, así que leerlo derivado evita quedar en INVITADO.
  const displayName = user?.name ?? "INVITADO";
  const nameToSave = initials ?? displayName;

  // av_muted se lee en un efecto y no durante el render: leer localStorage en
  // el render rompe la hidratación y lanza en el servidor. Mismo patrón —y
  // mismo eslint-disable— que av_user en lib/session.tsx.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MUTED_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw !== null) setMuted(JSON.parse(raw) === true);
    } catch {
      // localStorage deshabilitado (modo privado) o JSON corrupto: con sonido.
    }
    setMutedHydrated(true);
  }, []);

  // El espejo de vuelta, recién después de hidratar: si no, el efecto de
  // montaje pisaría con `false` la preferencia guardada.
  useEffect(() => {
    if (!mutedHydrated) return;
    try {
      localStorage.setItem(MUTED_KEY, JSON.stringify(muted));
    } catch {
      // Sin persistencia: el silencio vale solo para esta partida.
    }
  }, [muted, mutedHydrated]);

  // av_skin, mismo patrón que av_muted: se lee en un efecto y nunca durante el
  // render. La diferencia es que acá lo guardado es un mapa y hay que sacar la
  // entrada de ESTE juego.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SKIN_KEY);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        // typeof null === "object": el chequeo explícito es lo que evita que un
        // av_skin con el literal "null" adentro tire al leer la entrada.
        const saved =
          typeof parsed === "object" && parsed !== null
            ? (parsed as Record<string, unknown>)[game.id]
            : undefined;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (isSkinId(saved)) setSkin(saved);
      }
    } catch {
      // localStorage deshabilitado (modo privado) o JSON corrupto: clásico.
    }
    setSkinHydrated(true);
  }, [game.id]);

  // El espejo de vuelta. Relee el mapa antes de escribirlo para no borrar la
  // preferencia de los otros juegos, que esta pantalla no tiene en memoria.
  useEffect(() => {
    if (!skinHydrated) return;
    try {
      const raw = localStorage.getItem(SKIN_KEY);
      const parsed: unknown = raw === null ? null : JSON.parse(raw);
      const map = typeof parsed === "object" && parsed !== null ? parsed : {};
      localStorage.setItem(SKIN_KEY, JSON.stringify({ ...map, [game.id]: skin }));
    } catch {
      // Sin persistencia: la skin vale solo para esta partida.
    }
  }, [skin, skinHydrated, game.id]);

  useEffect(() => {
    if (withEngine || over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [withEngine, over, paused]);

  useEffect(() => {
    if (withEngine) return;
    // Mismo criterio que el prototipo: un nivel cada ~2500 puntos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [withEngine, score]);

  // El motor solo emite cuando algún valor cambió: esto no corre por frame.
  const handleSnapshot = useCallback((snapshot: GameSnapshot) => {
    setScore(snapshot.score);
    setLives(snapshot.lives ?? null);
    setLevel(snapshot.level);
    setExtra(snapshot.extra);
  }, []);

  const handleGameOver = useCallback((finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  }, []);

  const togglePause = useCallback(() => {
    if (over) return;
    if (paused) canvasRef.current?.resume();
    else canvasRef.current?.pause();
    setPaused(!paused);
  }, [over, paused]);

  // Escape y P hacen lo mismo que el botón: el que viene del portal encuentra
  // su tecla y el que viene del Tetris original, la suya. Solo con motor, los
  // ocho simulados tienen que comportarse exactamente igual que antes.
  // La pausa la maneja React y no el motor, así el overlay que se ve es siempre
  // el mismo y la tecla no alterna dos veces por pulsación.
  useEffect(() => {
    if (!withEngine) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.code === "KeyP") togglePause();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [withEngine, togglePause]);

  // El puntaje se guarda en Postgres, no en localStorage. Si falla, el modal
  // sigue abierto con el puntaje y las iniciales intactas: reescribirlos sería
  // el castigo por un fallo que no es del jugador.
  const handleSave = () => {
    setSaveError(null);
    startSaving(async () => {
      const res = await submitScore({ gameId: game.id, score, name: nameToSave });
      if (res.ok) setSaved(true);
      else setSaveError(res.error);
    });
  };

  // Con motor, end() dispara onGameOver y ese callback abre el modal: así el
  // botón FIN y perder la última vida terminan por el mismo camino.
  const endGame = () => {
    if (withEngine) canvasRef.current?.end();
    else setOver(true);
  };

  const restart = () => {
    // Los valores a mano PRIMERO y el motor al final: restart() emite su
    // snapshot inicial de forma síncrona, así que si se llamara antes, estos
    // setters lo pisarían y el HUD perdería el slot `extra` hasta el próximo
    // cambio de puntaje. Sin motor no hay quien los pise y mandan estos.
    setScore(0);
    setLevel(1);
    setLives(withEngine ? null : 3);
    setExtra(undefined);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(null);
    setInitials(null);
    canvasRef.current?.restart();
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
          {lives !== null && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {extra && (
            <div className="hud-stat triple">
              <div className="l">{extra.label}</div>
              <div className="v">{extra.value}</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          {/* Solo con motor: los ocho simulados no tienen nada que silenciar.
              Aparece en los tres con motor y no solo en los que suenan —hacerlo
              depender del audio del juego obligaría al motor a reportarle esa
              capacidad a React, que es un segundo canal para un botón—. */}
          {withEngine && (
            <button className="btn ghost" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>
              {muted ? "SILENCIO" : "SONIDO"}
            </button>
          )}
          {/* El selector de skin es un botón que cicla y no un <select>: un
              select necesitaría CSS nuevo en globals.css, y al portar pantallas
              la regla ha sido no escribir CSS nuevo. Reusa .btn ghost, la misma
              clase del botón de silencio. Aparece en los cuatro con motor
              aunque tres todavía no-opeen setSkin(), por el mismo criterio con
              el que el botón de silencio aparece en los que no suenan. */}
          {withEngine && (
            <button
              className="btn ghost"
              onClick={() => setSkin((s) => SKIN_IDS[(SKIN_IDS.indexOf(s) + 1) % SKIN_IDS.length])}
              aria-label={`Skin: ${SKIN_LABELS[skin]}. Pulsa para cambiar.`}
            >
              {SKIN_LABELS[skin]}
            </button>
          )}
          <button className="btn yellow" onClick={togglePause}>
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
          {withEngine ? (
            <GameCanvas
              ref={canvasRef}
              gameId={game.id}
              muted={muted}
              skin={skin}
              onSnapshot={handleSnapshot}
              onGameOver={handleGameOver}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {/* Siempre en el DOM: quien lo muestra u oculta es la media query
              (pointer: coarse) de globals.css. Detectar el dispositivo en JS
              haria que servidor y cliente rendericen distinto en el primer
              paso, que es justo el problema de hidratacion que evitamos. */}
          {withEngine && (
            <div className="keyboard-notice">
              <div className="t">{game.title} REQUIERE TECLADO</div>
              {/* Genérico a propósito: el aviso lo comparten todos los juegos
                  con motor y cada uno tiene sus propios controles. El título
                  ya se adapta solo porque sale de game.title. */}
              <div className="s">Conecta uno para jugar</div>
            </div>
          )}
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
              <>
                <div className="input-row">
                  <input
                    value={nameToSave}
                    onChange={(e) => setInitials(e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="TUS INICIALES"
                    aria-label="Tus iniciales"
                    disabled={isSaving}
                  />
                  <button className="btn yellow" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                  </button>
                </div>
                {saveError && (
                  <div
                    className="pixel neon-magenta"
                    role="alert"
                    style={{ marginTop: 14, fontSize: 9, lineHeight: 1.7, letterSpacing: "0.1em" }}
                  >
                    {ERROR_TEXT[saveError]}
                  </div>
                )}
              </>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link className="btn magenta" href="/juegos">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
