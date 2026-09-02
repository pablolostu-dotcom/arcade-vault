# SPEC 04 — Integración de Supabase: el cableado, sin producto todavía

> **Status:** Implementado
> **Depends on:** SPEC 03
> **Date:** 2026-09-02
> **Objective:** Dejar Supabase conectado al proyecto — clientes de browser y de servidor, refresco de sesión en `proxy.ts`, tipos generados y migraciones versionadas — sin crear ninguna tabla ni cambiar ninguna pantalla existente.

## Por qué existe este spec

Arcade Vault llega hasta acá sin base de datos. La sesión es falsa (`lib/session.tsx` guarda `av_user` en `localStorage`), los puntajes se escriben en `av_scores` y **nadie los lee**, y los leaderboards del Salón y del Detalle salen de `seededScores()`, un LCG determinístico que fabrica las mismas diez filas para todos. La única pieza de servidor del repo es la Server Action de contacto del SPEC 03.

Los specs que vienen — auth real, puntajes persistidos, rankings de verdad — necesitan todos la misma base: un cliente de Supabase que funcione en las tres superficies de Next (Server Components, Client Components y proxy), cookies que sobrevivan al refresco del token, y un lugar donde vivan las migraciones. Montar eso **dentro** del spec de auth mezclaría dos cosas que fallan por motivos distintos: "la conexión no está bien cableada" y "el flujo de login no está bien diseñado".

Este spec hace solo lo primero. Es deliberadamente aburrido: al terminar, la aplicación se ve y se comporta **exactamente igual que hoy**. Lo único nuevo que un humano puede mirar es una ruta de diagnóstico.

Hay además una razón técnica concreta para separarlo. Next.js 16 **deprecó `middleware.ts` y lo renombró a `proxy.ts`** (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`), mientras que la enorme mayoría de los tutoriales de Supabase que circulan siguen diciendo `middleware.ts`. Resolver ese desajuste una vez, acá, evita arrastrarlo a cada spec siguiente.

## Alcance

**Dentro:**

- Las dependencias `@supabase/ssr` y `@supabase/supabase-js`, más el CLI `supabase` como dependencia de desarrollo.
- `lib/supabase/client.ts` — cliente de browser (`createBrowserClient`).
- `lib/supabase/server.ts` — cliente de servidor (`createServerClient` sobre `await cookies()`), para Server Components, Server Actions y Route Handlers.
- `lib/supabase/proxy.ts` — `updateSession(request)`, el refresco de token que reescribe las cookies.
- `proxy.ts` en la raíz — el archivo de convención de Next.js 16, con su `matcher`.
- `lib/database.types.ts` — tipos generados por el CLI y versionados, hoy con el esquema vacío.
- El script `npm run db:types` que los regenera.
- `supabase/` en el repo: `config.toml` y `migrations/` (vacío, con `.gitkeep`), para que el esquema tenga desde el día cero un lugar versionado donde vivir.
- Las dos variables de entorno nuevas en `.env.example`.
- `/supabase-check` — ruta de diagnóstico fuera del nav, al estilo de `/estilos`, que prueba en vivo el cliente de servidor y el de browser.

**Fuera de alcance (para specs futuras):**

- **Cualquier tabla.** Ni `profiles`, ni `scores`, ni nada. `supabase/migrations/` queda vacío a propósito. La primera migración la escribe el spec que la necesite.
- **Auth real.** No hay registro, ni login, ni logout, ni callback de OAuth, ni recuperación de contraseña. `/acceso` sigue aceptando cualquier alias contra `localStorage`.
- **Tocar `lib/session.tsx`.** `av_user` y `av_scores` siguen exactamente como están. Nada de esta spec lee ni escribe esas claves.
- **Puntajes persistidos.** Se siguen guardando en `localStorage` y sin leerse.
- **Reemplazar `seededScores()`.** El Salón y el top-10 del Detalle siguen mostrando el mock determinístico.
- **RLS y políticas.** Sin tablas no hay nada que proteger. Las políticas se escriben junto con la tabla que protegen.
- **La `service_role` key.** No entra al repo ni a `.env.example`.
- **Rutas protegidas.** El `proxy.ts` refresca la sesión y nada más: no redirige, no bloquea, no decide.
- **Realtime, Storage y Edge Functions.**
- **Stack local con Docker** (`supabase start`). Se trabaja contra el proyecto remoto.
- **Tests automatizados.** El repo no tiene test runner y este spec no instala uno.

## Modelo de datos

**Este spec no introduce ninguna estructura de datos persistida.** No crea tablas, no escribe migraciones y no guarda nada entre sesiones. Es la consecuencia directa de la decisión de alcance: solo el cableado.

Lo único que se introduce es la forma tipada del cliente y las variables de entorno.

```ts
// lib/database.types.ts — generado por `npm run db:types`, versionado.
// Con el esquema público vacío, el CLI emite esto (o su equivalente):
export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
```

Los tres clientes se parametrizan con ese tipo, de modo que el día que exista la primera tabla baste con volver a correr el script para que todo el repo la conozca:

```ts
// lib/supabase/client.ts   → createBrowserClient<Database>(url, key): SupabaseClient<Database>
// lib/supabase/server.ts   → createClient(): Promise<SupabaseClient<Database>>
// lib/supabase/proxy.ts    → updateSession(request: NextRequest): Promise<NextResponse>
```

Variables de entorno nuevas (`.env.local`, ya ignorado por `.gitignore` vía `.env*`; se agregan a `.env.example`, que sí se versiona):

| Variable                               | Uso                                            | Pública                       |
| -------------------------------------- | ---------------------------------------------- | ----------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto (`https://<ref>.supabase.co`) | Sí — va al bundle del cliente |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable (`sb_publishable_…`)          | Sí — va al bundle del cliente |

Las dos llevan `NEXT_PUBLIC_` **a propósito**: el cliente de browser las necesita y son públicas por diseño. La seguridad de una base de Supabase no la da esconder la clave publicable, la da RLS. Esto es lo opuesto a las tres variables del SPEC 03 (`RESEND_API_KEY` y compañía), que jamás pueden salir del servidor — la diferencia queda comentada en `.env.example` para que nadie las trate igual.

Es la clave **publicable** moderna (`sb_publishable_…`), no la `anon` key JWT heredada. Ambas funcionan, pero la publicable se rota de forma independiente y es la que Supabase recomienda para proyectos nuevos.

## Plan de implementación

1. **Dependencias y entorno.** `npm install @supabase/ssr @supabase/supabase-js` y `npm install -D supabase`. Agregar a `.env.example` las dos variables con valores de muestra y un comentario que explique por qué estas sí llevan `NEXT_PUBLIC_` y las de Resend no. Poner los valores reales en `.env.local`.
   _Verificación:_ `npm run build` pasa y `git status` no muestra `.env.local`.

2. **`lib/supabase/client.ts`** — el cliente de browser:

   ```ts
   import { createBrowserClient } from "@supabase/ssr";
   export function createClient() {
     return createBrowserClient<Database>(
       process.env.NEXT_PUBLIC_SUPABASE_URL!,
       process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
     );
   }
   ```

   _Verificación:_ `npx tsc --noEmit` pasa.

3. **`lib/supabase/server.ts`** — el cliente de servidor, con `cookies()` **await-eado** (en Next.js 16 es asíncrono, igual que el `headers()` que ya usa la Server Action del SPEC 03). `getAll()` devuelve `cookieStore.getAll()`; `setAll()` escribe cada cookie dentro de un `try/catch` vacío, con el comentario de por qué: llamarlo desde un Server Component tira, y se puede ignorar justamente porque el `proxy.ts` del paso 5 refresca la sesión.
   _Verificación:_ `npx tsc --noEmit` pasa.

4. **`lib/supabase/proxy.ts`** — `updateSession(request)`, copiado del ejemplo oficial:
   - `let supabaseResponse = NextResponse.next({ request })`.
   - `createServerClient` con `getAll()` leyendo de `request.cookies` y `setAll(cookiesToSet, headers)` que escribe en `request.cookies`, **reconstruye** `supabaseResponse` y vuelca las cookies y los headers sobre la respuesta nueva.
   - Inmediatamente después, `await supabase.auth.getClaims()`. **Entre `createServerClient` y esa llamada no va ni una línea de código**: el orden importa y equivocarlo produce usuarios deslogueados al azar, que es un bug carísimo de diagnosticar. Va comentado en el archivo.
   - Devolver `supabaseResponse` tal cual, sin redirecciones: proteger rutas no es de este spec.
   - El cliente se crea **por request**, nunca en una variable de módulo — con Fluid Compute el proceso se reutiliza entre invocaciones y un cliente global filtraría la sesión de un usuario a otro.

5. **`proxy.ts` en la raíz** — `export async function proxy(request: NextRequest) { return await updateSession(request); }` más el `config.matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` y los assets estáticos. **El archivo se llama `proxy.ts`, no `middleware.ts`**: en Next.js 16 `middleware.ts` está deprecado y renombrado. Los tutoriales de Supabase que digan lo contrario están desactualizados; la documentación oficial de Supabase ya usa `proxy.ts`.
   _Verificación:_ `npm run dev` arranca sin avisos de deprecación, la consola no reporta un proxy inválido y las ocho rutas existentes siguen respondiendo 200.

6. **Tipos y migraciones.** Agregar el script `"db:types": "supabase gen types typescript --project-id <ref> > lib/database.types.ts"` a `package.json`, correrlo y versionar el archivo resultante. Crear `supabase/migrations/.gitkeep` y el `config.toml` del proyecto. Agregar a `.gitignore` lo que el CLI genera y no corresponde versionar (`supabase/.temp/`, `supabase/.branches/`).
   _Verificación:_ `npm run db:types` regenera el archivo sin errores y `npx tsc --noEmit` pasa con los tres clientes tipados con `Database`.

7. **`app/supabase-check/page.tsx`** — la ruta de diagnóstico, con `export const dynamic = "force-dynamic"` para que no se prerenderice en el build (si no, el ping se congelaría en tiempo de compilación).
   - **Sonda de servidor:** desde el Server Component, `createClient()` y luego `supabase.from("_probe").select("*").limit(1)`. La tabla `_probe` **no existe y no debe existir**: lo que se está probando es que la petición llegue a PostgREST y que PostgREST conteste. Un error de esquema (`42P01` / `PGRST205`, "relation does not exist") es **éxito**: significa URL correcta, clave aceptada y base respondiendo. Un `401` / "Invalid API key" o un fallo de red son **fallo**. La distinción se hace por el código de error, no por el texto del mensaje, y va comentada — es lo único no obvio de todo el spec.
   - **Sonda de browser:** un Client Component chico que hace la misma consulta desde el navegador dentro de un `useEffect`, para probar que las variables llegaron al bundle y que el cliente de browser funciona.
   - La página muestra las dos sondas con su estado (`OK` / `FALLO`) y el detalle del error cuando falla. Se estila con las clases que ya existen en `app/globals.css` (`pixel`, `neon-green`, `neon-magenta`, `mono`): **cero CSS nuevo**, igual que los specs 01 a 03.
   - Fuera del nav, como `/estilos`. No se agrega ningún link.

   _Verificación:_ `/supabase-check` muestra las dos sondas en `OK` contra el proyecto real.

8. **Repaso final.** Confirmar que la aplicación se ve idéntica: las ocho rutas del SPEC 03 responden 200 y renderizan igual, el nav no cambió, `/acerca-de` sigue mandando correo y el ciclo de `localStorage` (alias en `/acceso`, puntaje guardado en `/jugar/[id]`) funciona como antes. Confirmar que `lib/session.tsx` no fue modificado. Rompiendo a propósito `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `/supabase-check` debe reportar `FALLO` y **ninguna otra ruta debe romperse**.

## Criterios de aceptación

- [X] `npm run build` termina sin errores ni errores de tipos.
- [X] `npx eslint app lib components` no reporta errores.
- [ ] `npx tsc --noEmit` pasa con los tres clientes tipados con `Database`.
- [X] Las ocho rutas existentes (`/`, `/juegos`, `/juegos/caida`, `/jugar/caida`, `/salon`, `/acceso`, `/acerca-de`, `/estilos`) responden 200 y se ven idénticas a antes del spec.
- [ ] `app/globals.css` no cambió.
- [ ] `lib/session.tsx` no cambió: el alias sigue en `av_user` y los puntajes en `av_scores`.
- [X] El archivo de proxy se llama `proxy.ts` y está en la raíz. **No existe** ningún `middleware.ts` en el repo.
- [X] `npm run dev` no emite avisos de deprecación relacionados con el proxy.
- [X] En `lib/supabase/proxy.ts` no hay **ninguna** sentencia entre `createServerClient(...)` y `await supabase.auth.getClaims()`.
- [ ] Ningún cliente de Supabase se guarda en una variable de módulo: los tres se crean por llamada.
- [ ] `/supabase-check` muestra la sonda de servidor en `OK` contra el proyecto real.
- [ ] `/supabase-check` muestra la sonda de browser en `OK` contra el proyecto real.
- [ ] Con `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` alterada, `/supabase-check` muestra `FALLO` y las otras ocho rutas siguen respondiendo 200.
- [ ] `supabase/migrations/` existe, está versionado y está **vacío**.
- [ ] `npm run db:types` regenera `lib/database.types.ts` sin errores.
- [ ] No hay ninguna tabla nueva en el esquema `public` del proyecto de Supabase.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` no aparece en ningún archivo del repo.
- [ ] `.env.example` está versionado con las dos variables nuevas y `.env.local` no aparece en `git status`.
- [ ] Buscar `RESEND_API_KEY` en `.next/static/` sigue sin devolver resultados (el proxy nuevo no arrastró nada del servidor al bundle).
- [X] `/supabase-check` no aparece en el nav ni en el footer.
- [X] La consola del navegador no muestra errores ni warnings de hidratación en ninguna ruta.

## Decisiones

- **Sí:** un spec solo de cableado, sin una sola tabla. Auth, puntajes y rankings son tres specs que fallan por motivos distintos; si el cableado viaja dentro del primero de ellos, el segundo y el tercero heredan sus decisiones sin haberlas revisado. El costo es que este spec no produce nada visible — asumido.
- **Sí:** `@supabase/ssr` en vez de `@supabase/supabase-js` pelado. El paquete pelado guarda la sesión en `localStorage` y el servidor nunca la ve: los Server Components quedarían ciegos a quién está logueado. `@supabase/ssr` la guarda en cookies, que es lo único que funciona en las tres superficies de Next.
- **Sí:** `proxy.ts`, no `middleware.ts`. Es la convención de Next.js 16 y `middleware.ts` está deprecado. La documentación oficial de Supabase ya está migrada; los tutoriales de terceros, casi ninguno.
- **Sí:** cablear el proxy ahora, aunque hoy no haya sesión que refrescar. Es el archivo cuya ausencia produce el bug más caro de todos (usuarios deslogueados al azar, sin patrón reproducible) y el que más contexto exige para escribirse bien. Hacerlo con la cabeza fría, sin la presión de "hacer andar el login", es la mitad del valor de este spec.
- **Sí:** `getClaims()` y no `getUser()` ni `getSession()`. `getSession()` **no** revalida el token en código de servidor y es falsificable desde la cookie; `getClaims()` verifica la firma del JWT contra las claves públicas del proyecto en cada llamada. Queda establecido acá para que el spec de auth no lo reabra.
- **No:** la `service_role` key. Es una clave de administrador que saltea RLS por completo; sin tablas no hay absolutamente nada que necesite saltearla. Si algún día hace falta, entra en el spec que la justifique, no antes.
- **Sí:** las dos variables con `NEXT_PUBLIC_`. La clave publicable es pública por diseño y el cliente de browser no puede funcionar sin ella. Va comentado en `.env.example` porque convive con las tres de Resend, que son exactamente lo contrario.
- **Sí:** la clave publicable moderna (`sb_publishable_…`) en vez de la `anon` key JWT heredada. Las dos funcionan; la nueva se rota de forma independiente y es la recomendada para proyectos nuevos.
- **Sí:** migraciones versionadas en `supabase/migrations/`, aunque el directorio arranque vacío. El esquema es código: si el historial de la base vive solo en el panel web, el repo deja de describir el sistema. Crear el directorio ahora hace que el primer `.sql` caiga en su lugar sin discusión.
- **No:** aplicar cambios de esquema por las herramientas MCP sin dejar el archivo de migración. Es más rápido y deja la base y el repo desincronizados en silencio.
- **No:** stack local con Docker (`supabase start`). Sumaría Docker como requisito para clonar y correr el repo, que hoy solo necesita Node. Se trabaja contra el proyecto remoto.
- **Sí:** `/supabase-check` permanente y fuera del nav. `/estilos` ya estableció ese patrón en el repo. Cuando falle una variable de entorno en producción — que es cuándo fallan — la herramienta va a estar ahí. No expone nada: dice si el proyecto responde, y la clave que usa ya está en el bundle.
- **No:** un script de smoke test en `scripts/`. El repo no tiene tooling propio y una ruta prueba algo que un script no puede: que funcione **dentro** de Next, con sus cookies y su runtime.
- **Sí:** la sonda consulta una tabla que no existe (`_probe`) e interpreta el error de esquema como éxito. Sin tablas no hay otra forma de probar el circuito completo hasta PostgREST. La alternativa —crear una tabla `health_check` descartable— contradice la decisión de no crear tablas por una ganancia nula.
- **Sí:** dos sondas, servidor y browser. Fallan por causas distintas: la de servidor por credenciales o red, la de browser porque las variables no llegaron al bundle. Una sola no distingue.
- **Sí:** tipos generados y versionados desde el día cero, aunque hoy salgan vacíos. Montar el circuito con el esquema vacío cuesta cinco minutos; montarlo cuando ya hay tres tablas y consultas escritas contra `any` cuesta una refactorización.
- **No:** tocar `lib/session.tsx`. Migrar `av_user` a Supabase Auth es el spec siguiente. Dejarlo intacto acá es lo que hace que este spec sea verificable: si algo de la aplicación cambia de comportamiento, es un bug.
- **Decisión tomada, implementación diferida:** la identidad de arcade será una tabla **`profiles`** (`id` → `auth.users`, `alias` único de ≤10 caracteres en mayúsculas), y los puntajes referenciarán `user_id` con el alias leído por join — no un snapshot congelado por fila. Queda registrada acá porque se decidió en la entrevista de este spec, pero **no se implementa**: la tabla, sus políticas RLS y el trigger de alta van en el spec de auth.

## Riesgos

| Riesgo                                                                                                                                  | Mitigación                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Se copia un tutorial de Supabase que usa `middleware.ts` y en Next.js 16 el archivo queda deprecado o directamente inerte               | Está resuelto en el plan y hay un criterio de aceptación explícito de que no existe `middleware.ts` en el repo. La documentación de referencia es la oficial de Supabase, ya migrada a `proxy.ts`.                                                  |
| Alguien mete código entre `createServerClient` y `getClaims()` en `lib/supabase/proxy.ts` y aparecen deslogueos al azar                 | Comentario en el archivo advirtiéndolo y criterio de aceptación que lo verifica. Es el modo de falla más caro de esta integración: intermitente y sin patrón.                                                                                       |
| Un cliente de Supabase guardado en una variable de módulo filtra la sesión de un usuario a otro bajo Fluid Compute                      | Los tres clientes se crean por llamada. Hay un criterio de aceptación que lo verifica.                                                                                                                                                              |
| El `matcher` del proxy corre en rutas donde no hace falta y suma latencia a cada request                                                | El `matcher` excluye `_next/static`, `_next/image`, `favicon.ico` y los assets. Con esas exclusiones el trabajo por request es una lectura de cookies sin sesión, que hoy es casi nada.                                                             |
| `/supabase-check` se prerenderiza en el build y muestra un resultado congelado, o peor, rompe el build cuando CI no tiene las variables | `export const dynamic = "force-dynamic"`. Además la página nunca lanza: captura el error y lo muestra como `FALLO`.                                                                                                                                 |
| CI o un clon nuevo no tienen `.env.local` y el build se rompe                                                                           | Ningún archivo lee las variables en tiempo de módulo ni valida su presencia al arrancar: sin ellas la aplicación compila y las ocho rutas existentes funcionan, y solo `/supabase-check` reporta `FALLO`. Mismo criterio que el SPEC 03 con Resend. |
| La sonda deja de servir el día que exista una tabla llamada `_probe`                                                                    | El nombre lleva guion bajo justamente para no colisionar con nada del producto, y el spec que introduzca la primera tabla real puede apuntar la sonda ahí y simplificarla.                                                                          |
| `npm run db:types` requiere el CLI autenticado y el `project-id`, y falla en una máquina recién clonada                                 | Es una herramienta de desarrollo, no parte del build: `lib/database.types.ts` está versionado, así que clonar y compilar no necesita el CLI.                                                                                                        |
| Las variables no están cargadas en el hosting y todo falla recién en producción                                                         | Para eso existe `/supabase-check` como ruta permanente y accesible en el ambiente desplegado.                                                                                                                                                       |
| `@supabase/ssr` y `@supabase/supabase-js` engordan el bundle del cliente                                                                | Solo entran en el bundle de las rutas que usen el cliente de browser; hoy, únicamente `/supabase-check`. Las ocho rutas existentes no lo importan.                                                                                                  |

## Lo que **no** entra en esta spec

- Cualquier tabla, migración SQL o política de RLS.
- Registro, login, logout, callback de OAuth o recuperación de contraseña.
- Reemplazar `lib/session.tsx`, `av_user` o `av_scores`.
- Persistir puntajes en Postgres.
- Reemplazar `seededScores()` en el Salón o en el Detalle.
- La tabla `profiles` y su trigger de alta — decidida arriba, implementada en el spec de auth.
- Rutas protegidas o redirecciones desde el proxy.
- La `service_role` key y cualquier operación que saltee RLS.
- Realtime, Storage y Edge Functions.
- Stack local con Docker.
- Tests automatizados.

Cada una de esas, si aparece, va en su propia spec.
