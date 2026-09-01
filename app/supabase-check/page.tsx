import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";

import { PROBE_TABLE, readProbe, readProbeThrow, type ProbeVerdict } from "./probe";
import { SelfTest } from "./self-test";

// ===== app/supabase-check — autodiagnóstico de la conexión a Supabase =====
// Ruta permanente y fuera del nav, como /estilos. No la linkea nadie: se llega
// escribiéndola. Existe para el día que falte una variable de entorno en el
// ambiente desplegado, que es cuándo fallan estas cosas.
//
// force-dynamic porque si no el ping se congelaría en tiempo de compilación y
// la página mostraría para siempre el resultado del build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Autodiagnóstico · Arcade Vault",
  description: "Estado en vivo de la conexión con Supabase.",
  robots: { index: false, follow: false },
};

/** Qué clase de clave hay en el entorno. Es información de diagnóstico real: */
/** distingue la publicable moderna de la anon JWT heredada y de la ausencia.  */
function describeKey(key: string): string {
  if (!key) return "AUSENTE";
  if (key.startsWith("sb_publishable_")) return "PUBLICABLE";
  if (key.startsWith("eyJ")) return "ANON · JWT HEREDADA";
  return "DESCONOCIDA";
}

function describeUrl(url: string): string {
  if (!url) return "AUSENTE";
  try {
    const host = new URL(url).host;
    // Para un host de Supabase alcanza con el ref: el sufijo es siempre el
    // mismo y hace que el valor no entre en una línea del CRT en pantallas
    // chicas. Un dominio propio se muestra entero, que ahí sí es información.
    return host.endsWith(".supabase.co") ? host.replace(".supabase.co", "") : host;
  } catch {
    return "MAL FORMADA";
  }
}

export default async function SupabaseCheckPage() {
  // Las variables se leen acá dentro, en tiempo de request, nunca en tiempo de
  // módulo: sin ellas la aplicación tiene que compilar igual y el resto de las
  // rutas tiene que seguir funcionando. Solo esta página reporta FALLO.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

  let server: ProbeVerdict;
  try {
    const supabase = await createClient();
    // La tabla no existe: se prueba el circuito hasta PostgREST, no la tabla.
    // El cast es porque Database tipa el esquema real, donde "_probe" no
    // figura —y no debe figurar—: es justamente el punto de la sonda.
    const { error } = await supabase.from(PROBE_TABLE as never).select("*").limit(1);
    server = readProbe(error);
  } catch (e) {
    // La página nunca lanza: un fallo se muestra, no rompe la ruta.
    server = readProbeThrow(e);
  }

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>MODO SERVICIO</h1>
        <p>El cableado a Supabase, probado en vivo desde las dos puntas.</p>
      </div>

      <SelfTest
        server={server}
        project={describeUrl(url)}
        keyKind={describeKey(key)}
        env={process.env.NODE_ENV === "production" ? "PRODUCCION" : "DESARROLLO"}
        at={new Date().toLocaleString("es-ES")}
      />
    </div>
  );
}
