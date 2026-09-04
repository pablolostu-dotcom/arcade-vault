"use client";

// ===== lib/session.tsx — sesión falsa =====
// Una sola clave de localStorage, la misma del prototipo
// (references/templates/app.jsx):
//   av_user → { name } | ausente
//
// Los puntajes NO viven acá. Hasta el SPEC 06 se escribían en una segunda
// clave de localStorage que nadie leía nunca; ahora los guarda la Server Action
// de app/jugar/actions.ts en la tabla `scores` de Postgres, que es de donde los
// rankings los leen.
//
// El auth sigue siendo falso: cualquiera entra escribiendo un alias, así que un
// puntaje es la afirmación de un anónimo sobre sí mismo. El spec de auth real
// convertirá ese alias en una referencia a `profiles`.

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

export type User = { name: string };

type SessionValue = {
  user: User | null;
  signIn: (name: string) => void;
  signOut: () => void;
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

  const value = useMemo<SessionValue>(
    () => ({ user, signIn, signOut }),
    [user, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession debe usarse dentro de <SessionProvider>");
  return value;
}
