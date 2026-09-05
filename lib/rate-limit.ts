// ===== lib/rate-limit.ts — límite de envíos por IP =====
// Ventana deslizante en la memoria del proceso: un Map de clave → timestamps.
//
// LIMITACIÓN ASUMIDA (ver SPEC 03): el estado vive solo en este proceso.
// En serverless cada instancia tiene su propio Map y un redeploy lo borra,
// así que esto NO es un límite distribuido. Frena el caso real —alguien
// martillando el formulario desde una pestaña— y nada más. Si algún día
// aparece spam sostenido, el reemplazo es Redis/KV en otra spec.
//
// Dos llamadores con topes distintos (SPEC 06): el formulario de contacto usa
// los valores por omisión y el guardado de puntajes pasa los suyos. Cada uno
// namespacea su clave —`<ip>` y `score:<ip>`— así que una clave pertenece
// siempre a un solo llamador y a una sola ventana.

const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_HITS = 3; // envíos permitidos por ventana

/** Tope y ventana de un llamador. Por omisión, los del formulario de contacto. */
export type RateLimitConfig = { max: number; windowMs: number };

const DEFAULT_CONFIG: RateLimitConfig = { max: MAX_HITS, windowMs: WINDOW_MS };

const hits = new Map<string, number[]>();

// La ventana más larga que algún llamador haya pedido. El barrido global NO
// puede usar la ventana del llamador de turno: si el de ventana corta barriera
// con su propio corte, borraría marcas que el de ventana larga todavía cuenta.
let longestWindowMs = DEFAULT_CONFIG.windowMs;

/**
 * Registra un intento para `key` y dice si está permitido.
 * Devuelve `false` cuando la clave ya agotó su cupo en la ventana;
 * en ese caso el intento no se registra.
 */
export function checkRateLimit(key: string, config: RateLimitConfig = DEFAULT_CONFIG): boolean {
  const { max, windowMs } = config;
  const now = Date.now();

  if (windowMs > longestWindowMs) longestWindowMs = windowMs;

  // Barrido perezoso: sin esto el Map crece sin techo con cada IP nueva.
  const sweepCutoff = now - longestWindowMs;
  for (const [k, timestamps] of hits) {
    const fresh = timestamps.filter((t) => t > sweepCutoff);
    if (fresh.length === 0) hits.delete(k);
    else hits.set(k, fresh);
  }

  // El corte de la decisión es el del llamador, no el del barrido.
  const cutoff = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= max) return false;

  recent.push(now);
  hits.set(key, recent);
  return true;
}
