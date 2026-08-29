"use client";

// ===== components/home/reveal.tsx =====
// Portado del useReveal() de references/templates/home-about/home.jsx. El
// prototipo barre el documento con querySelectorAll(".reveal") porque no tiene
// componentes; acá cada <Reveal> observa su propio nodo, así no depende del
// orden de montaje ni pisa a otra pantalla que monte a la vez.
//
// Los hijos llegan como children, así que se siguen renderizando en el
// servidor: la isla es solo el contenedor.

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

type RevealProps = {
  children: ReactNode;
  /** Contenedor a renderizar. El home usa <section>; el about también <div>. */
  as?: ElementType;
  className?: string;
};

export function Reveal({ children, as: Tag = "section", className = "" }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Sin IntersectionObserver no hay manera de saber cuándo entra en pantalla,
    // y .reveal arranca en opacity 0: se muestra de entrada antes que dejar la
    // sección invisible para siempre.
    if (typeof IntersectionObserver === "undefined") {
      // Chequeo de capacidad de una sola vez, no un ciclo de render: no hay
      // nada a qué suscribirse si el navegador no trae el observer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          setShown(true);
          io.unobserve(e.target);
        });
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const classes = ["reveal", className, shown ? "in" : ""].filter(Boolean).join(" ");

  return (
    <Tag ref={ref} className={classes}>
      {children}
    </Tag>
  );
}
