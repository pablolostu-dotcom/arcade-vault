// ===== lib/supabase/server.ts — cliente de Supabase para el servidor =====
// Para Server Components, Server Actions y Route Handlers. La sesión se lee y
// se escribe en las cookies del request, que es lo que hace que el servidor vea
// al mismo usuario que el browser.
//
// En Next.js 16 cookies() es ASÍNCRONO (igual que el headers() que ya usa la
// Server Action de contacto del SPEC 03), de ahí el await y el async del que
// cuelga toda la función.
//
// Se crea un cliente POR LLAMADA, nunca en una variable de módulo: con Fluid
// Compute el proceso se reutiliza entre invocaciones y un cliente global
// filtraría la sesión de un usuario al request del siguiente.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Llamado desde un Server Component, donde no se pueden escribir
            // cookies: React ya empezó a renderizar la respuesta. Se puede
            // ignorar SIN CONSECUENCIAS porque el proxy.ts de la raíz refresca
            // la sesión en cada request antes de que la página se renderice.
            // Si algún día se borra el proxy, este catch pasa a ser un bug.
          }
        },
      },
    },
  );
}
