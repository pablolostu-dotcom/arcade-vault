"use client";

// ===== components/nav.tsx =====
// Portado de references/templates/nav.jsx. El prototipo compara route.name;
// acá el estado activo sale de la URL real vía usePathname().

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useSession } from "@/lib/session";

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, signOut } = useSession();

  // Estado activo del mapa de rutas del SPEC 02. "Biblioteca" abarca también el
  // detalle y el reproductor, igual que en el prototipo (detalle y player
  // cuentan como biblioteca).
  const isHome = pathname === "/";
  const isLibrary = pathname.startsWith("/juegos") || pathname.startsWith("/jugar");
  const isSalon = pathname === "/salon";
  const isAbout = pathname === "/acerca-de";
  const isAuth = pathname === "/acceso";

  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link className="logo" href="/" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link className={isHome ? "active" : ""} href="/">
            Inicio
          </Link>
          <Link className={isLibrary ? "active" : ""} href="/juegos">
            Biblioteca
          </Link>
          <Link className={isSalon ? "active" : ""} href="/salon">
            Salón de la Fama
          </Link>
          <Link className={isAbout ? "active" : ""} href="/acerca-de">
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={signOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link className="btn auth-btn" href="/acceso">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
          aria-expanded={open}
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
        aria-hidden="true"
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link className={isHome ? "active" : ""} href="/" onClick={close}>
          Inicio
        </Link>
        <Link className={isLibrary ? "active" : ""} href="/juegos" onClick={close}>
          Biblioteca
        </Link>
        <Link className={isSalon ? "active" : ""} href="/salon" onClick={close}>
          Salón de la Fama
        </Link>
        <Link className={isAbout ? "active" : ""} href="/acerca-de" onClick={close}>
          Acerca de
        </Link>
        <Link className={isAuth ? "active" : ""} href="/acceso" onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
