"use client";

// ===== app/supabase-check/self-test.tsx — la pantalla de autodiagnóstico =====
// El gabinete rinde su test de sistema. La sonda de SERVIDOR llega hecha por
// prop desde el Server Component; la de NAVEGADOR se corre acá dentro, en el
// browser, porque falla por un motivo distinto: si el servidor está OK y el
// navegador no, las variables NEXT_PUBLIC_ no llegaron al bundle.
//
// Cero CSS nuevo: todo sale de las clases de app/globals.css (crt, crt-screen,
// crt-content, crt-bottom, leaderboard, tw-label, divider, spinner, pixel,
// mono, neon-green, neon-magenta) más ajustes de layout en línea, que es como
// están escritas el resto de las pantallas del repo.

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

import {
  PROBE_TABLE,
  readProbe,
  readProbeThrow,
  type ProbeVerdict,
} from "./probe";

type Props = {
  /** Veredicto de la sonda de servidor, ya resuelto en el Server Component. */
  server: ProbeVerdict;
  /** Host del proyecto, o el motivo por el que no se pudo leer. */
  project: string;
  /** Qué clase de clave hay en el entorno: publicable, JWT heredada, ausente. */
  keyKind: string;
  /** Desarrollo o producción: cambia cuándo se inyectaron las NEXT_PUBLIC_. */
  env: string;
  /** Momento del render, calculado en el servidor para no romper la hidratación. */
  at: string;
};

const LABEL = {
  fontSize: 10,
  color: "var(--ink-faint)",
  letterSpacing: "0.16em",
} as const;

const VALUE = {
  fontSize: 11,
  color: "var(--ink)",
  letterSpacing: "0.08em",
  wordBreak: "break-all",
} as const;

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "baseline",
        gap: 14,
        padding: "4px 0",
      }}
    >
      <span className="mono" style={LABEL}>
        {label}
      </span>
      <span className="mono" style={VALUE}>
        {value}
      </span>
    </div>
  );
}

function Status({ verdict }: { verdict: ProbeVerdict | null }) {
  if (verdict === null) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className="spinner" />
        <span className="pixel" style={{ fontSize: 10, color: "var(--ink-faint)" }}>
          PROBANDO
        </span>
      </span>
    );
  }
  const ok = verdict.status === "ok";
  return (
    <span
      className={"pixel " + (ok ? "neon-green" : "neon-magenta")}
      style={{ fontSize: 12 }}
    >
      {ok ? "OK" : "FALLO"}
    </span>
  );
}

function Probe({
  label,
  verdict,
  live,
}: {
  label: string;
  verdict: ProbeVerdict | null;
  live?: boolean;
}) {
  return (
    <div
      aria-live={live ? "polite" : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: 14,
        padding: "7px 0",
      }}
    >
      <span className="mono" style={{ ...LABEL, color: "var(--ink-dim)" }}>
        {label}
      </span>
      <Status verdict={verdict} />
    </div>
  );
}

/** Panel de detalle de una sonda. El error solo aparece cuando hay error. */
function Detail({
  title,
  proves,
  verdict,
  fix,
}: {
  title: string;
  proves: string;
  verdict: ProbeVerdict | null;
  fix: string;
}) {
  return (
    <div className="leaderboard" style={{ padding: 16 }}>
      <div className="tw-label">{title}</div>
      <div style={{ marginBottom: 12 }}>
        <Status verdict={verdict} />
      </div>
      <p
        className="mono"
        style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "var(--ink-dim)" }}
      >
        {proves}
      </p>

      {verdict !== null && (
        <>
          <div className="divider" style={{ margin: "14px 0" }} />
          {verdict.status === "fail" && verdict.code !== "" && (
            <div className="pixel neon-magenta" style={{ fontSize: 10, marginBottom: 8 }}>
              {verdict.code}
            </div>
          )}
          <p
            className="mono"
            style={{
              margin: 0,
              fontSize: 11,
              lineHeight: 1.7,
              color: verdict.status === "fail" ? "var(--ink)" : "var(--ink-faint)",
              wordBreak: "break-word",
            }}
          >
            {verdict.detail}
          </p>
          {verdict.status === "fail" && (
            <p
              className="mono"
              style={{
                margin: "10px 0 0",
                fontSize: 11,
                lineHeight: 1.7,
                color: "var(--ink-dim)",
              }}
            >
              {fix}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function SelfTest({ server, project, keyKind, env, at }: Props) {
  // null = todavía probando. Es también el estado con el que el servidor
  // renderiza esta fila, así que la hidratación calza sin avisos.
  const [browser, setBrowser] = useState<ProbeVerdict | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const supabase = createClient();
        // Misma consulta que la sonda de servidor, contra la misma tabla que no
        // existe. El cast es porque Database tipa el esquema real, donde
        // "_probe" no figura —y no debe figurar—: es justamente el punto.
        const { error } = await supabase
          .from(PROBE_TABLE as never)
          .select("*")
          .limit(1);
        if (alive) setBrowser(readProbe(error));
      } catch (e) {
        if (alive) setBrowser(readProbeThrow(e));
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <div className="crt" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="crt-screen">
          <div className="crt-content">
            <div style={{ width: "88%" }}>
              <div className="pixel neon-cyan" style={{ fontSize: 11, letterSpacing: "0.14em" }}>
                TEST DE SISTEMA
              </div>

              <div className="divider" style={{ margin: "12px 0" }} />

              <Line label="PROYECTO" value={project} />
              <Line label="CLAVE" value={keyKind} />
              <Line label="ENTORNO" value={env} />

              <div className="divider" style={{ margin: "12px 0" }} />

              <Probe label="SERVIDOR" verdict={server} />
              <Probe label="NAVEGADOR" verdict={browser} live />
            </div>
          </div>
        </div>
        <div className="crt-bottom">
          <span className="led">CRT-83</span>
          <span>SONDA · {PROBE_TABLE}</span>
          <span>{at}</span>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
          marginTop: 28,
        }}
      >
        <Detail
          title="DESDE EL SERVIDOR"
          verdict={server}
          proves="Corre en el Server Component, con el cliente de lib/supabase/server.ts. Prueba que este proceso alcanza el proyecto y que la clave del entorno es aceptada."
          fix="Revisá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en el entorno de este despliegue, y que el proyecto no esté pausado."
        />
        <Detail
          title="DESDE EL NAVEGADOR"
          verdict={browser}
          proves="Corre en tu navegador, con el cliente de lib/supabase/client.ts. Prueba que las dos variables NEXT_PUBLIC_ llegaron al bundle y que el cliente de browser funciona."
          fix="Si el servidor está OK y esta falla, las variables no se compilaron en el bundle: volvé a construir la aplicación con las dos NEXT_PUBLIC_ definidas."
        />
      </div>
    </>
  );
}
