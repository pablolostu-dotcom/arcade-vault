"use client";

// ===== lib/session.tsx — sesión falsa y puntajes guardados =====
// Mismas claves de localStorage que el prototipo (references/templates/app.jsx):
//   av_user   → { name } | ausente
//   av_scores → array append-only de { game, score, name, at }
// Nada en esta spec lee av_scores: se escribe y no se lee, igual que el prototipo.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export type User = { name: string };

export type SavedScore = {
  game: string;
  score: number;
  name: string;
  at: number;
};

type SessionValue = {
  user: User | null;
  signIn: (name: string) => void;
  signOut: () => void;
  saveScore: (entry: Omit<SavedScore, "at">) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

/** El nombre siempre en mayúsculas y truncado a 10 caracteres. */
function normalizeName(name: string): string {
  return name.toUpperCase().slice(0, 10);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // El primer render es siempre "sin sesión": leer localStorage durante el
  // render rompe la hidratación y lanza en el servidor.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      const stored = raw ? (JSON.parse(raw) as User | null) : null;
      // La regla apunta a evitar cascadas de renders, pero acá el render extra
      // es exactamente uno y es el objetivo: el primer render va sin sesión
      // (para no romper la hidratación) y recién después se aplica lo guardado.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored && typeof stored.name === "string") setUser(stored);
    } catch {
      // localStorage deshabilitado (modo privado) o JSON corrupto: sin sesión.
    }
    setHydrated(true);
  }, []);

  // Espeja el estado en localStorage en cada cambio, pero recién después de
  // hidratar: si no, el efecto de montaje borraría la sesión guardada.
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
      else localStorage.removeItem(USER_KEY);
    } catch {
      // Sin persistencia: la app sigue funcionando en memoria.
    }
  }, [user, hydrated]);

  const signIn = useCallback((name: string) => {
    setUser({ name: normalizeName(name) });
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
  }, []);

  const saveScore = useCallback((entry: Omit<SavedScore, "at">) => {
    try {
      const raw = localStorage.getItem(SCORES_KEY);
      const all = raw ? (JSON.parse(raw) as SavedScore[]) : [];
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {
      // Igual que el prototipo: si falla, se pierde el puntaje sin romper la UI.
    }
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ user, signIn, signOut, saveScore }),
    [user, signIn, signOut, saveScore],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return value;
}
