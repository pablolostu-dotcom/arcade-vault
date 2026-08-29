// ===== lib/rate-limit.ts — límite de envíos por IP =====
// Ventana deslizante en la memoria del proceso: un Map de clave → timestamps.
//
// LIMITACIÓN ASUMIDA (ver SPEC 03): el estado vive solo en este proceso.
// En serverless cada instancia tiene su propio Map y un redeploy lo borra,
// así que esto NO es un límite distribuido. Frena el caso real —alguien
// martillando el formulario desde una pestaña— y nada más. Si algún día
// aparece spam sostenido, el reemplazo es Redis/KV en otra spec.

const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_HITS = 3; // envíos permitidos por ventana

const hits = new Map<string, number[]>();

/**
 * Registra un intento para `key` y dice si está permitido.
 * Devuelve `false` cuando la clave ya agotó sus MAX_HITS en la ventana;
 * en ese caso el intento no se registra.
 */
export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  // Barrido perezoso: sin esto el Map crece sin techo con cada IP nueva.
  for (const [k, timestamps] of hits) {
    const fresh = timestamps.filter((t) => t > cutoff);
    if (fresh.length === 0) hits.delete(k);
    else hits.set(k, fresh);
  }

  const recent = hits.get(key) ?? [];
  if (recent.length >= MAX_HITS) return false;

  recent.push(now);
  hits.set(key, recent);
  return true;
}
