"use client";

// ===== components/game-canvas.tsx =====
// La isla que monta un motor de canvas adentro del marco CRT. Es el único lugar
// del repo que toca el DOM del juego: el motor no sabe nada de React y React no
// sabe nada del loop.
//
// El efecto depende de gameId, así que navegar entre juegos destruye el motor
// viejo y crea uno nuevo. Sin ese destroy() quedarían dos requestAnimationFrame
// corriendo sobre el mismo canvas y el puntaje avanzaría al doble.

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

import type { EngineHandle, GameSnapshot, SkinId } from "@/lib/games/types";
import { ENGINES } from "@/lib/games/registry";

/** El mundo del motor. El canvas se estira por CSS; la física no se entera. */
const WORLD_W = 800;
const WORLD_H = 600;

export type GameCanvasHandle = {
  pause(): void;
  resume(): void;
  restart(): void;
  end(): void;
};

type GameCanvasProps = {
  gameId: string;
  /**
   * El silencio baja por una prop y no por GameCanvasHandle: el motor se crea
   * después de un import() dinámico, así que un setMuted() imperativo llamado
   * al montar encontraría engineRef en null y el primer sonido escaparía
   * aunque el portal estuviera silenciado. Como prop se aplica dos veces —justo
   * después de createEngine() y en el efecto de cambio— y ese hueco no existe.
   */
  muted: boolean;
  /**
   * La skin activa. Baja por el mismo camino que `muted` y por el mismo motivo:
   * el motor se crea después de un import() dinámico, así que la inicial viaja
   * dentro de EngineOptions —no hay hueco para el primer frame— y los cambios
   * posteriores entran por setSkin() sin reiniciar la partida.
   */
  skin: SkinId;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onGameOver: (finalScore: number) => void;
  ref?: Ref<GameCanvasHandle>;
};

export function GameCanvas({ gameId, muted, skin, onSnapshot, onGameOver, ref }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);

  // Los callbacks se leen desde un ref: que el padre re-renderice y pase una
  // función nueva no puede reiniciar la partida.
  const callbacksRef = useRef({ onSnapshot, onGameOver });
  useEffect(() => {
    callbacksRef.current = { onSnapshot, onGameOver };
  }, [onSnapshot, onGameOver]);

  // Y el silencio también: el efecto de montaje lo lee de acá en vez de
  // depender de `muted`, así tocar el botón no vuelve a crear el motor.
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
    engineRef.current?.setMuted(muted);
  }, [muted]);

  // Y la skin igual: el efecto de montaje la lee de acá, así que cambiarla no
  // vuelve a crear el motor ni reinicia la partida.
  const skinRef = useRef(skin);
  useEffect(() => {
    skinRef.current = skin;
    engineRef.current?.setSkin(skin);
  }, [skin]);

  useImperativeHandle(
    ref,
    () => ({
      pause: () => engineRef.current?.pause(),
      resume: () => engineRef.current?.resume(),
      restart: () => engineRef.current?.restart(),
      end: () => engineRef.current?.end(),
    }),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const loadEngine = ENGINES[gameId];
    if (!canvas || !loadEngine) return;

    // Backing store en píxeles del dispositivo y transform escalado: el motor
    // sigue dibujando en 800×600 y no se ve borroso en pantallas HiDPI.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WORLD_W * dpr;
    canvas.height = WORLD_H * dpr;
    // scale() después de fijar width/height: asignarlas resetea el transform.
    canvas.getContext("2d")?.scale(dpr, dpr);

    let engine: EngineHandle | null = null;
    let cancelled = false;

    void loadEngine().then((createEngine) => {
      if (cancelled) return;
      engine = createEngine(canvas, {
        onSnapshot: (snapshot) => callbacksRef.current.onSnapshot(snapshot),
        onGameOver: (finalScore) => callbacksRef.current.onGameOver(finalScore),
        // La skin inicial va acá y no en un setSkin() posterior: con `retro`
        // guardado, ni el primer frame sale en clásico.
        skin: skinRef.current,
      });
      engineRef.current = engine;
      // Antes de start(): con el portal silenciado, ni el primer frame suena.
      engine.setMuted(mutedRef.current);
      engine.start();
    });

    return () => {
      // cancelled cubre el desmontaje mientras el import() todavía viaja.
      cancelled = true;
      engine?.destroy();
      engineRef.current = null;
    };
  }, [gameId]);

  return <canvas ref={canvasRef} className="game-canvas" aria-hidden="true" />;
}
