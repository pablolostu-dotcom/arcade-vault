"use client";

// ===== components/about/contact-form.tsx =====
// Portado del <form> de references/templates/home-about/about.jsx. El
// prototipo era puro teatro (setSent y nada más); acá el envío es real y eso
// agrega dos estados que el template no contempla: enviando y error.
// La validación de cliente con shake se conserva tal cual: corre ANTES de
// tocar la red. La del servidor vive en actions.ts y no depende de esta.

import { useState, useTransition } from "react";

import { sendContactMessage, type ContactError } from "@/app/acerca-de/actions";

const EMPTY = { name: "", email: "", msg: "", website: "" };

// El registro es el del template: mayúsculas, directo, sin detalles del
// proveedor (esos quedan en console.error del servidor).
const ERROR_TEXT: Record<ContactError, string> = {
  INVALID: "REVISA LOS CAMPOS: FALTA ALGO O EL CORREO NO ES VÁLIDO.",
  RATE_LIMIT: "DEMASIADOS ENVÍOS. ESPERA UNOS MINUTOS.",
  SEND: "NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO.",
};

export function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [sent, setSent] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState<ContactError | null>(null);
  const [isPending, startTransition] = useTransition();

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.msg.trim()) {
      triggerShake();
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await sendContactMessage(form);
      if (res.ok) {
        setSent(res.name);
      } else {
        // Los campos quedan intactos: reescribir el mensaje sería el castigo
        // por un fallo que no es del visitante.
        setError(res.error);
        triggerShake();
      }
    });
  };

  const reset = () => {
    setSent(null);
    setForm(EMPTY);
    setError(null);
  };

  return (
    <form className={"contact-form" + (shake ? " shake" : "")} onSubmit={onSubmit}>
      {!sent ? (
        <>
          <div className="field">
            <label htmlFor="contact-name">NOMBRE</label>
            <input
              id="contact-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">CORREO ELECTRÓNICO</label>
            <input
              id="contact-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-msg">MENSAJE</label>
            <textarea
              id="contact-msg"
              rows={5}
              value={form.msg}
              onChange={(e) => setForm({ ...form, msg: e.target.value })}
              placeholder="Cuéntanos qué tienes en mente…"
            />
          </div>

          {/* Honeypot: fuera de pantalla, no display:none — eso lo detectan
              los bots que valen algo. Un humano nunca lo ve ni lo tabula. */}
          <input
            name="website"
            value={form.website}
            onChange={(e) => setForm({ ...form, website: e.target.value })}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{ position: "absolute", left: "-9999px" }}
          />

          <button
            className="btn xl press"
            type="submit"
            disabled={isPending}
            style={{ width: "100%" }}
          >
            {isPending ? "▶  ENVIANDO…" : "▶  ENVIAR MENSAJE"}
          </button>

          {error && (
            <div
              className="pixel neon-magenta"
              role="alert"
              style={{ marginTop: 14, fontSize: 9, lineHeight: 1.7, letterSpacing: "0.1em" }}
            >
              {ERROR_TEXT[error]}
            </div>
          )}
        </>
      ) : (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS,{" "}
              {sent.toUpperCase()}.<span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={reset}>
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
