// ===== proxy.ts — punto de entrada del proxy de Next.js =====
// OJO CON EL NOMBRE: en Next.js 16 el archivo se llama proxy.ts. La convención
// middleware.ts está DEPRECADA y renombrada
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md).
// La enorme mayoría de los tutoriales de Supabase que circulan siguen diciendo
// middleware.ts: están desactualizados. La documentación oficial de Supabase ya
// migró a proxy.ts.
//
// Toda la lógica vive en lib/supabase/proxy.ts. Acá solo se delega.

import { updateSession } from "@/lib/supabase/proxy";

import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Corre en todas las rutas MENOS los estáticos, donde refrescar la sesión
    // no aporta nada y solo sumaría latencia a cada asset:
    // - _next/static  → JS y CSS compilados
    // - _next/image   → imágenes optimizadas
    // - favicon.ico
    // - archivos con extensión de imagen o fuente servidos desde public/
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
