// ===== app/supabase-check/probe.ts — cómo se lee el resultado de la sonda =====
// Esto es lo ÚNICO no obvio de toda la ruta, así que vive en un solo lugar y lo
// usan las dos sondas —la de servidor y la de navegador— sin poder divergir.
//
// La sonda consulta una tabla que NO EXISTE y NO DEBE EXISTIR. No se está
// probando la tabla: se está probando que el pedido llegue hasta PostgREST y
// que PostgREST conteste. Por eso un error de esquema es ÉXITO — significa URL
// correcta, clave aceptada y base respondiendo. Un 401, una clave inválida o un
// fallo de red son FALLO.
//
// La distinción se hace SIEMPRE por el código de error, nunca por el texto del
// mensaje: el texto lo reescribe Supabase cuando quiere, el código no.

export const PROBE_TABLE = "_probe";

/** 42P01 = undefined_table (Postgres). PGRST205 = tabla ausente del schema cache. */
const TABLA_INEXISTENTE = new Set(["42P01", "PGRST205"]);

export type ProbeVerdict =
  | { status: "ok"; detail: string }
  | { status: "fail"; code: string; detail: string };

/** La forma mínima del error de PostgREST que a esta sonda le importa. */
type ProbeError = { code?: string | null; message?: string | null };

export function readProbe(error: ProbeError | null): ProbeVerdict {
  if (!error) {
    // La consulta salió limpia, así que alguien creó una tabla _probe. El
    // circuito funciona igual —sigue siendo OK— pero la sonda dejó de probar
    // lo que creía probar y conviene apuntarla a otro nombre.
    return {
      status: "ok",
      detail: `La consulta salió sin error: hoy existe una tabla "${PROBE_TABLE}". El circuito funciona, pero conviene mover la sonda a otro nombre.`,
    };
  }

  const code = error.code ?? "";

  if (TABLA_INEXISTENTE.has(code)) {
    return {
      status: "ok",
      detail: `PostgREST contestó ${code}: la tabla "${PROBE_TABLE}" no existe. Es la respuesta esperada — URL correcta, clave aceptada y base respondiendo.`,
    };
  }

  return {
    status: "fail",
    // Sin código la UI no dibuja la etiqueta: un rótulo que dice "no hay dato"
    // es ruido. El mensaje del proveedor alcanza.
    code: code,
    detail: error.message ?? "El proyecto no devolvió ningún mensaje.",
  };
}

/** La consulta ni siquiera llegó a contestar: red, DNS, CORS o URL rota. */
export function readProbeThrow(e: unknown): ProbeVerdict {
  return {
    status: "fail",
    code: "SIN RESPUESTA",
    detail:
      e instanceof Error
        ? e.message
        : "El pedido falló antes de recibir una respuesta del proyecto.",
  };
}
