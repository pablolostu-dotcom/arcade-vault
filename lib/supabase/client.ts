// ===== lib/supabase/client.ts — cliente de Supabase para el browser =====
// Para Client Components ("use client"). Corre dentro del navegador, así que
// las dos variables que lee llevan prefijo NEXT_PUBLIC_ y viajan en el bundle:
// es deliberado y está explicado en .env.example.
//
// Se exporta una FUNCIÓN, no una instancia: nada de clientes en variables de
// módulo. La sesión la guarda @supabase/ssr en cookies —no en localStorage—
// que es lo único que el servidor también puede leer.

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/database.types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
