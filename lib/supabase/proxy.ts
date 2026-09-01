// ===== lib/supabase/proxy.ts — refresco de sesión en el borde =====
// Lo invoca el proxy.ts de la raíz en cada request. Su único trabajo es
// refrescar el token de Supabase y reescribir las cookies: NO redirige, NO
// bloquea y NO decide nada. Proteger rutas no es asunto de este archivo.
//
// Existe aunque hoy no haya sesión que refrescar porque es la pieza cuya
// ausencia produce el bug más caro de toda la integración: deslogueos al azar,
// intermitentes y sin patrón reproducible. También es lo que hace que el
// catch vacío de lib/supabase/server.ts sea seguro.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/database.types";

export async function updateSession(request: NextRequest) {
  // La respuesta arranca como un passthrough y se RECONSTRUYE dentro de
  // setAll cada vez que Supabase quiere escribir cookies.
  let supabaseResponse = NextResponse.next({ request });

  // Cliente por request, nunca en una variable de módulo: con Fluid Compute el
  // proceso se reutiliza entre invocaciones y un cliente global filtraría la
  // sesión de un usuario al request del siguiente.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // 1) Las cookies nuevas van al request, para que lo que se renderice
          //    más abajo en la cadena ya vea el token refrescado.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // 2) Se reconstruye la respuesta a partir de ese request actualizado.
          supabaseResponse = NextResponse.next({ request });
          // 3) Y recién ahí se vuelcan las cookies y los headers sobre ella.
          //    Los headers son los de no-cache: una respuesta que setea cookies
          //    de sesión jamás debe quedar cacheada por un CDN, o un usuario
          //    termina recibiendo el token de otro.
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
          for (const [key, value] of Object.entries(headers)) {
            supabaseResponse.headers.set(key, value);
          }
        },
      },
    },
  );

  // ⚠️ NO AGREGUES NADA ENTRE createServerClient() Y ESTA LÍNEA. ⚠️
  //
  // El cliente inicializa la sesión de forma perezosa: hasta que no se llama a
  // getClaims() no lee las cookies ni refresca el token. Cualquier código que
  // se cuele en el medio puede terminar la respuesta antes de que ese refresco
  // ocurra, y el resultado son usuarios deslogueados al azar — un bug
  // intermitente, sin patrón y carísimo de diagnosticar.
  //
  // Es getClaims() y no getSession() ni getUser(): getSession() no revalida el
  // token en el servidor y es falsificable desde la cookie; getClaims()
  // verifica la firma del JWT contra las claves públicas del proyecto.
  await supabase.auth.getClaims();

  // Se devuelve TAL CUAL. Si algún día hace falta redirigir, hay que devolver
  // una respuesta nueva copiándole encima las cookies de supabaseResponse:
  // perderlas acá es la otra mitad de este mismo bug.
  return supabaseResponse;
}
