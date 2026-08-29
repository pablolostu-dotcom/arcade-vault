# SPEC 03 — Acerca de: la pantalla real y el envío de correo con Resend

> **Status:** APROBADO
> **Depends on:** SPEC 02
> **Date:** 2026-08-29
> **Objective:** Portar `references/templates/home-about/about.jsx` a `/acerca-de` reemplazando el stub, y hacer que su formulario de contacto envíe un correo real con Resend desde una Server Action.

## Por qué existe este spec

El SPEC 02 dejó `/acerca-de` como un stub "PRÓXIMAMENTE" y difirió explícitamente la pantalla real a este spec: hero de misión, tres highlights con iconos pixel, el divisor animado de 24 píxeles y el formulario de contacto con la terminal de éxito.

El CSS ya está resuelto. `app/globals.css` contiene **todos** los selectores que usa `about.jsx` — `.about`, `.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`, `.highlight`, `.hl-icon`, `.hl-text`, `.about-divider`, `.div-bar`, `.div-pixels`, `.about-contact`, `.contact-grid`, `.contact-intro`, `.contact-title`, `.contact-sub`, `.contact-tips`, `.tip`, `.tip-led`, `.contact-form`, `.terminal-success`, `.term-bar`, `.term-body`, `.field`, `.btn.press`, `.btn.ghost`, `@keyframes shake` y `@keyframes pxblink`. Igual que en los specs 01 y 02: **no se escribe una sola línea de CSS nuevo**.

Lo que este spec agrega y los anteriores no tenían es la **primera pieza de servidor del proyecto**. Hasta hoy todo es estático o `localStorage`: no hay endpoints, ni secretos, ni dependencias fuera de `next` / `react` / `react-dom`. El formulario del prototipo es puro teatro (`setSent(form.name)` y nada más). Acá pasa a mandar un correo de verdad, con clave de API, validación de servidor y estados de error que el template no contempla.

## Alcance

**Dentro:**

- La pantalla Acerca de completa en `/acerca-de`, reemplazando el stub del SPEC 02: `about-hero` (kicker, título, misión), `highlight-row` con las 3 tarjetas, el `about-divider` de 24 píxeles animados y la sección `about-contact` con su `contact-grid`.
- Los 3 iconos pixel de los highlights (`HEART`, `BROWSER`, `PLANT`), portados rect por rect.
- El formulario de contacto: los tres campos (NOMBRE, CORREO ELECTRÓNICO, MENSAJE), el `shake` sobre campos vacíos y la terminal de éxito con el botón "ENVIAR OTRO MENSAJE".
- El envío real por **Resend** desde una Server Action, con `replyTo` apuntando al correo del visitante.
- Los estados que el template no tiene: **enviando** (botón deshabilitado con "ENVIANDO…") y **error** (`shake` + mensaje inline, conservando lo escrito).
- Validación del lado del servidor: campos no vacíos, formato de correo, nombre ≤ 80 y mensaje ≤ 2.000 caracteres.
- Anti-abuso: campo honeypot oculto y límite por IP en memoria del proceso.
- Modo simulado cuando falta `RESEND_API_KEY` en desarrollo.
- `.env.example` versionado con las tres variables.
- La animación `reveal` en el divisor y en la sección de contacto (el hero no la lleva, igual que el prototipo).

**Fuera de alcance (para specs futuras):**

- **Auto-respuesta al visitante.** Solo se manda el correo al equipo.
- **Persistencia de los mensajes.** No hay base de datos ni log: Resend es el único destino.
- **Rate limiting distribuido** (Redis, Upstash, KV). El límite vive en la memoria del proceso y se pierde en cada redeploy.
- **Plantilla HTML del correo.** El cuerpo va en texto plano.
- **Prefill del formulario con `av_user`.** Los campos arrancan siempre vacíos.
- **CAPTCHA** de cualquier tipo.
- **El componente gamepad**, cuyo CSS sigue copiado y sin usar desde el SPEC 02.
- Cualquier juego jugable, backend propio o autenticación real. Sin cambios respecto de los specs anteriores.
- Tocar el nav, el home o cualquier otra pantalla. `/acerca-de` ya está en el nav desde el SPEC 02 y su estado activo ya funciona.

## Modelo de datos

No hay estructuras nuevas de persistencia: nada se guarda entre sesiones. Las estructuras que se introducen viven solo durante el request.

```ts
// app/acerca-de/actions.ts

/** Payload que el formulario manda a la Server Action. */
export type ContactInput = {
  name: string;
  email: string;
  msg: string;
  /** Honeypot: invisible para humanos, siempre "". Si viene con texto, es un bot. */
  website: string;
};

/** Resultado que la acción devuelve al cliente. */
export type ContactResult =
  | { ok: true; name: string }        // name = el nombre ya trimmeado, para la terminal
  | { ok: false; error: ContactError };

/** Discriminante del mensaje inline. La UI no muestra detalles del proveedor. */
export type ContactError =
  | "INVALID"    // validación de servidor: vacíos, correo mal formado, largos
  | "RATE_LIMIT" // demasiados envíos desde la misma IP
  | "SEND";      // Resend falló, o falta la API key en producción
```

```ts
// lib/rate-limit.ts

/** Ventana deslizante por clave (la IP), en la memoria del proceso. */
export function checkRateLimit(key: string): boolean;

const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_HITS = 3;               // envíos permitidos por ventana
```

Variables de entorno (`.env.local`, ya ignorado por `.gitignore` vía `.env*`; se versiona `.env.example` con los nombres y valores de muestra):

| Variable | Uso | Ausente en desarrollo | Ausente en producción |
|---|---|---|---|
| `RESEND_API_KEY` | Clave del cliente de Resend | Modo simulado: loguea y devuelve `ok` | `{ ok: false, error: "SEND" }` |
| `CONTACT_TO_EMAIL` | Destinatario del mensaje | ídem | ídem |
| `CONTACT_FROM_EMAIL` | Remitente (`onboarding@resend.dev` hasta tener dominio verificado) | ídem | ídem |

Ninguna lleva prefijo `NEXT_PUBLIC_`: las tres se leen solo dentro de la Server Action y nunca llegan al bundle del cliente.

## Plan de implementación

1. **Dependencia y entorno** — `npm install resend`. Crear `.env.example` con las tres variables y valores de muestra, y `.env.local` (no versionado) con los valores reales. Verificación: `npm run build` pasa y `git status` no muestra `.env.local`.

2. **`lib/rate-limit.ts`** — `checkRateLimit(key)` sobre un `Map<string, number[]>` a nivel de módulo: filtra los timestamps fuera de la ventana de 10 minutos, devuelve `false` si ya hay 3 o más, si no registra el hit y devuelve `true`. Barrido perezoso de claves vencidas en cada llamada para que el `Map` no crezca sin techo. Comentario explícito de que el estado es por proceso y se pierde en cada redeploy. Verificación: `npx tsc --noEmit` pasa.

3. **`app/acerca-de/actions.ts`** — `"use server"` arriba de todo. `sendContactMessage(input: ContactInput): Promise<ContactResult>`:
   - Si `input.website` no está vacío → devolver `{ ok: true, name }` sin mandar nada. Al bot se le miente; no se le da señal.
   - Leer la IP de `(await headers()).get("x-forwarded-for")?.split(",")[0]` con fallback `"unknown"`, y pasarla por `checkRateLimit` → `RATE_LIMIT`.
   - Validar: los tres campos con contenido tras `trim()`, correo contra un regex simple (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), `name.length <= 80`, `msg.length <= 2000` → `INVALID`.
   - Si falta alguna de las tres variables de entorno: en `NODE_ENV !== "production"` loguear el mensaje formateado en la consola del servidor y devolver `{ ok: true, name }`; en producción devolver `SEND`.
   - `new Resend(process.env.RESEND_API_KEY).emails.send({ from, to, replyTo: email, subject: "[Arcade Vault] Mensaje de " + name, text })`, con el cuerpo en texto plano (nombre, correo, línea en blanco, mensaje). Si la respuesta trae `error` o la llamada lanza → `SEND`, con el detalle en `console.error` del servidor y nunca en la respuesta al cliente.

   Verificación: con `RESEND_API_KEY` puesta, un envío desde el formulario llega a `CONTACT_TO_EMAIL`; el cuarto envío seguido desde la misma IP devuelve `RATE_LIMIT`.

4. **`components/about/highlight-icon.tsx`** — server, sin estado. Los 3 SVG (`HEART` magenta, `BROWSER` cian, `PLANT` verde) con `fill="currentColor"`, tipados con la unión `"HEART" | "BROWSER" | "PLANT"` en lugar de un `string` libre, igual que `feature-icon.tsx` del SPEC 02. Los `#0a0a0f` de recorte del navegador y el `strokeWidth="1.4"` se copian tal cual, en camelCase. Verificación: los 3 iconos se ven con su color y su glow.

5. **`components/about/contact-form.tsx`** — client. Estado con `useState`: `form` (`{ name, email, msg, website }`), `sent` (`string | null`), `shake` (boolean) y `error` (`ContactError | null`); `useTransition` para el pendiente. En el submit:
   - `preventDefault()`; si algún campo visible está vacío → `setShake(true)` y limpiarlo a los 400 ms, sin llamar al servidor (idéntico al prototipo).
   - Si no, `startTransition(async () => …)` llamando a `sendContactMessage(form)`. Con `ok` → `setSent(res.name)`. Con error → `setError(res.error)` y disparar el mismo `shake`, dejando los campos intactos.
   - El botón: `disabled={isPending}` y el texto pasa de `"▶  ENVIAR MENSAJE"` a `"▶  ENVIANDO…"`.
   - El honeypot es un `<input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position:"absolute", left:"-9999px" }} />` — fuera de pantalla, no `display:none`, que algunos bots detectan.
   - El mensaje de error va debajo del botón, con clases existentes (`pixel neon-magenta`), en el registro del template: `INVALID` → "REVISA LOS CAMPOS: FALTA ALGO O EL CORREO NO ES VÁLIDO."; `RATE_LIMIT` → "DEMASIADOS ENVÍOS. ESPERA UNOS MINUTOS."; `SEND` → "NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO."
   - La terminal de éxito se copia literal del prototipo, incluidas las cuatro líneas `[OK]`, el nombre en mayúsculas, el `caret` y el botón "ENVIAR OTRO MENSAJE" que resetea `sent`, `form` y `error`.

   Verificación: enviar con un campo vacío sacude el formulario sin tocar la red; un envío válido muestra la terminal con el nombre en mayúsculas.

6. **`components/home/reveal.tsx`** — agregar una prop opcional `ariaHidden?: boolean` que se renderiza como `aria-hidden` en el contenedor. Es el único cambio a un componente existente, y existe porque el `about-divider` del prototipo es decorativo y lleva `aria-hidden="true"` **y** `reveal` en el mismo nodo. Verificación: el home sigue renderizando igual y `npx tsc --noEmit` pasa.

7. **`app/acerca-de/page.tsx`** — reemplazar el stub por la pantalla completa, como Server Component. `<div className="about fade-in">` con:
   - `about-hero`: kicker "▸ ACERCA DE" (`pixel neon-yellow`), `about-title`, `about-mission` con el texto de la misión y el `highlight-row` de 3 tarjetas con su `transitionDelay` de `i * 80` ms copiado tal cual.
   - `<Reveal as="div" className="about-divider" ariaHidden>` con los dos `div-bar` y los 24 `<span>` de `div-pixels`, cada uno con su `animationDelay` de `i * 80` ms.
   - `<Reveal className="about-contact">` con el `contact-grid`: el `contact-intro` (kicker "▸ CONTACTO", título, subtítulo y los 3 `tip` con sus LED verde/amarillo/magenta) y `<ContactForm />`.
   - `metadata` con el título de la pantalla, reemplazando el del stub.

   El `<Link>` "VOLVER AL INICIO" del stub se elimina: no existe en el prototipo y el nav ya cubre la vuelta. Verificación: `/acerca-de` responde 200 y se ve igual que `references/templates/home-about/about.jsx` abierto al lado.

8. **Repaso final** — recorrer `/acerca-de` en desktop y en 480 px contra el prototipo: que estén las cuatro piezas, que los píxeles del divisor parpadeen escalonados, que el reveal dispare, que el ciclo completo (vacío → shake, válido → enviando → terminal → "ENVIAR OTRO MENSAJE" → formulario limpio) funcione, y que la consola no tenga errores ni warnings de hidratación. Confirmar además que el resto de las rutas del SPEC 02 siguen intactas.

## Criterios de aceptación

- [ ] `npm run build` termina sin errores ni errores de tipos.
- [ ] `npx eslint app lib components` no reporta errores.
- [ ] Las ocho rutas (`/`, `/juegos`, `/juegos/caida`, `/jugar/caida`, `/salon`, `/acceso`, `/acerca-de`, `/estilos`) responden 200.
- [x] `app/globals.css` no cambió **por trabajo de este spec**. Ver la excepción anotada abajo: la rama incluye un arreglo de `.hero-scroll` que es del home (SPEC 02), no de Acerca de.
- [ ] `/acerca-de` muestra el hero con el kicker "▸ ACERCA DE", el título, el texto de misión y las 3 tarjetas de highlight con su icono pixel y su color (magenta, cian, verde).
- [ ] El `about-divider` muestra 24 píxeles parpadeando con retardo escalonado y no es alcanzable por lector de pantalla (`aria-hidden`).
- [ ] El divisor y la sección de contacto arrancan invisibles y aparecen al entrar en viewport; el hero se ve de entrada, sin `reveal`.
- [ ] El formulario muestra los 3 campos con sus labels y placeholders del prototipo (`px_kai`, `jugador@vault.gg`, `Cuéntanos qué tienes en mente…`).
- [ ] Enviar con cualquier campo vacío sacude el formulario y **no** genera ninguna petición de red.
- [ ] Durante el envío el botón queda deshabilitado y dice "ENVIANDO…".
- [ ] Un envío válido con `RESEND_API_KEY` configurada entrega el correo en `CONTACT_TO_EMAIL`, con asunto `[Arcade Vault] Mensaje de <NOMBRE>` y `reply-to` igual al correo del formulario.
- [ ] Tras el éxito, la terminal muestra las cuatro líneas `[OK]` y el nombre del visitante en mayúsculas.
- [ ] "ENVIAR OTRO MENSAJE" vuelve al formulario con los tres campos vacíos y sin mensaje de error.
- [ ] Con una `RESEND_API_KEY` inválida, el formulario muestra "NO SE PUDO ENVIAR EL MENSAJE. INTÉNTALO DE NUEVO.", se sacude y **conserva lo escrito**.
- [ ] Un correo mal formado (`asdf`) devuelve el error de validación aunque el navegador no lo bloquee.
- [ ] Un mensaje de más de 2.000 caracteres o un nombre de más de 80 devuelve el error de validación.
- [ ] El cuarto envío seguido desde la misma IP dentro de 10 minutos muestra "DEMASIADOS ENVÍOS. ESPERA UNOS MINUTOS."
- [ ] Un envío con el campo honeypot relleno muestra la terminal de éxito y **no** manda ningún correo.
- [ ] Sin `RESEND_API_KEY` en desarrollo, el envío muestra la terminal de éxito y el mensaje aparece en la consola del servidor.
- [ ] Buscar `RESEND_API_KEY`, `CONTACT_TO_EMAIL` y `CONTACT_FROM_EMAIL` en `.next/static/` no devuelve resultados.
- [ ] `.env.example` está versionado con las tres variables y `.env.local` no aparece en `git status`.
- [ ] El nav marca "Acerca de" como link activo en `/acerca-de` y el resto de las pantallas del SPEC 02 se ven idénticas a antes.
- [ ] En un viewport de 480 px la pantalla no genera scroll horizontal, el `highlight-row` colapsa a una columna y el `contact-grid` a una sola.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en `/acerca-de`.

## Excepción: un cambio en `app/globals.css` ajeno a este spec

La rama `spec-03-acerca-de-y-contacto` incluye **un cambio en `app/globals.css` que no pertenece a este spec**, hecho a pedido del usuario durante la revisión final. Queda anotado acá porque contradice el criterio de aceptación de arriba y la regla de "cero CSS nuevo" de los specs 01–03.

**Qué:** `.hero-scroll` pasa de `bottom: -20px` a `bottom: -60px`, con un comentario que explica el porqué.

**Por qué:** el indicador "DESLIZA ▼" del hero del home se dibujaba **encima** del botón "EXPLORAR JUEGOS". Su bloque contenedor es `.home-hero-inner` —el único ancestro posicionado—, que termina justo al pie de los botones; como el indicador mide 35 px de alto, `bottom: -20px` dejaba su borde superior 15 px por encima de esa línea (medido: `hero-scroll.top = 739` contra `botones.bottom = 754`).

**No es un error del port.** El prototipo servido aparte da los mismos 739 / 754 y se ve igual de superpuesto: el defecto es del original y se había copiado fielmente. Por eso el arreglo es una desviación deliberada del prototipo y no una corrección de un port mal hecho.

**Por qué −60 px:** coincide con el `padding-bottom` del hero, así que en el peor caso el indicador aterriza justo sobre su borde y nunca lo recorta el `overflow: hidden`. Verificado sin solape ni recorte en 1440×900, 480×900 (botones apilados) y 1280×620.

**Alcance:** es territorio del SPEC 02 (home), no de Acerca de. No toca ningún selector que use `/acerca-de`.

## Decisiones

- **Sí:** Server Action en `app/acerca-de/actions.ts`. No expone un endpoint público que haya que proteger aparte, la clave nunca sale del servidor y no hay que serializar JSON a mano. Es lo idiomático en App Router y el repo no tiene ningún `/api` que imitar.
- **No:** Route Handler `/api/contacto`. Solo aporta poder probar con `curl`, a cambio de una superficie pública más y de manejo manual del request.
- **Sí:** `useTransition` con la acción llamada desde el `onSubmit`, en lugar de `<form action={…}>` con `useActionState`. Conserva exactamente el comportamiento del prototipo — validación en cliente con `shake` **antes** de tocar la red — que un `form action` obligaría a reescribir.
- **Sí:** estados de error y de envío, que el template no tiene. El prototipo no puede fallar porque no manda nada; en cuanto hay red, mostrar éxito pase lo que pase es mentirle al usuario.
- **No:** terminal de error en magenta. Sería lo más coherente visualmente, pero exige CSS nuevo y los specs 01 y 02 establecieron que el CSS se copia, no se inventa. El `shake` ya existente más una línea con clases existentes cubre el caso.
- **Sí:** el mensaje de error es genérico y el detalle del proveedor queda en `console.error` del servidor. Al visitante no le sirve el código de Resend y filtrarlo expone infraestructura.
- **Sí:** honeypot fuera de pantalla (`left: -9999px`) en vez de `display: none`. Los bots que valen algo ignoran los campos ocultos por `display`.
- **Sí:** al bot detectado se le devuelve éxito. Un error le dice qué campo lo delató.
- **Sí:** rate limit en un `Map` del proceso, asumiendo su limitación. Es 20 renglones sin dependencias y frena el caso real (alguien martillando el formulario). Un límite distribuido implica Redis o KV: infraestructura que este proyecto no tiene y que no se justifica por una pantalla de contacto.
- **Sí:** validación a mano, sin Zod. Son cuatro chequeos sobre tres campos; meter una dependencia en un repo que hoy tiene tres cambia el perfil del proyecto por muy poco.
- **Sí:** validar de nuevo en el servidor aunque el cliente ya valide. La Server Action es invocable directamente; el cliente es una conveniencia, no una defensa.
- **Sí:** las tres direcciones y la clave por variables de entorno, con `.env.example` versionado. Nada de correos personales en el repo y el mismo código sirve en local y en producción.
- **Sí:** modo simulado sin `RESEND_API_KEY` en desarrollo. Cualquiera puede clonar el repo y ver la pantalla completa funcionando sin abrir cuenta en Resend. En producción falta de clave es un error de verdad y se reporta como tal.
- **No:** romper el build si falta la variable. Haría imposible clonar y correr el repo, y CI no tiene por qué conocer secretos para chequear tipos.
- **Sí:** texto plano con `replyTo`. El correo lo lee una sola persona y responder con un click es todo lo que se necesita; una plantilla HTML es superficie de mantenimiento a cambio de nada.
- **No:** auto-respuesta al visitante. Duplica cuota y puntos de falla, y la terminal en pantalla más el tip "RESPUESTA EN 24-48H" ya cierran el ciclo.
- **No:** guardar los mensajes. No hay base de datos, y un `console.log` con nombre y correo deja datos personales en los logs del hosting.
- **No:** prellenar el nombre con `av_user`. Guarda solo un alias de ≤ 10 caracteres en mayúsculas — no es el nombre de nadie — y leerlo durante el render invita a un warning de hidratación.
- **Sí:** agregar `ariaHidden` a `<Reveal>` en vez de duplicar el componente. El divisor necesita `reveal` y `aria-hidden` en el mismo nodo; es una prop opcional que no cambia el comportamiento existente.
- **Sí:** se elimina el "VOLVER AL INICIO" del stub. No existe en el prototipo y el nav ya está en todas las pantallas.
- **Sí:** reutilizar las clases del CSS portado en lugar de utilidades de Tailwind, igual que los specs 01 y 02.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El dominio remitente no está verificado en Resend y los correos caen en spam o son rechazados | Hasta tener dominio propio se usa `onboarding@resend.dev`, que Resend permite sin verificación. `CONTACT_FROM_EMAIL` es una variable justamente para cambiarlo sin tocar código. |
| El rate limit en memoria no sirve en serverless: cada instancia tiene su `Map` y un redeploy lo borra | Asumido y documentado en el código. Frena el martilleo desde una pestaña, que es el caso real de una pantalla de contacto. Si aparece spam sostenido, el reemplazo es un límite distribuido en otro spec. |
| Una clave de API filtrada al bundle del cliente | Las tres variables se leen solo dentro del archivo con `"use server"` y ninguna lleva `NEXT_PUBLIC_`. Hay un criterio de aceptación que lo verifica con una búsqueda en `.next/static/`. |
| El honeypot rompe el autocompletado o confunde a un lector de pantalla | Lleva `aria-hidden="true"`, `tabIndex={-1}` y `autoComplete="off"`, y el `name` es `website`, que ningún autocompletado de navegador rellena en un formulario de contacto. |
| `resend` es la primera dependencia de runtime fuera de React y arrastra peso al servidor | Es un cliente HTTP fino sobre la API REST, sin dependencias nativas, y solo se importa dentro de la Server Action: no entra en ningún bundle de cliente. |
| Portar los SVG rect por rect y equivocar una coordenada deja un icono deformado | Se comparan contra el prototipo abierto al lado en el paso 8. Son tres formas reconocibles: un error se ve. |
| `startTransition` con una función `async` no se comporta como se espera y el `isPending` no cubre todo el envío | React 19 soporta acciones asíncronas dentro de `startTransition` y mantiene `isPending` hasta que la promesa resuelve. Se verifica en el criterio del botón deshabilitado, no se asume. |

## Lo que **no** entra en esta spec

- Auto-respuesta por correo al visitante.
- Persistencia o log de los mensajes enviados.
- Rate limiting distribuido (Redis, Upstash, KV) o CAPTCHA.
- Plantilla HTML del correo.
- Verificación de un dominio propio en Resend.
- Prefill del formulario con la sesión de `localStorage`.
- El componente gamepad, cuyo CSS sigue copiado y sin usar.
- Cualquier juego jugable, backend propio o autenticación real.
- Rediseño de cualquier otra pantalla.
- Tests automatizados. El repo no tiene test runner y este spec no instala uno.

Cada una de esas, si aparece, va en su propia spec.
