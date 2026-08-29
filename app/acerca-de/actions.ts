"use server";

// ===== app/acerca-de/actions.ts — envío del formulario de contacto =====
// Primera pieza de servidor del proyecto (SPEC 03). Las tres variables de
// entorno se leen solo acá dentro y ninguna lleva prefijo NEXT_PUBLIC_:
// la clave de Resend nunca llega al bundle del cliente.

import { headers } from "next/headers";
import { Resend } from "resend";

import { checkRateLimit } from "@/lib/rate-limit";

/** Payload que el formulario manda a la Server Action. */
export type ContactInput = {
  name: string;
  email: string;
  msg: string;
  /** Honeypot: invisible para humanos, siempre "". Si viene con texto, es un bot. */
  website: string;
};

/** Discriminante del mensaje inline. La UI no muestra detalles del proveedor. */
export type ContactError =
  | "INVALID" // validación de servidor: vacíos, correo mal formado, largos
  | "RATE_LIMIT" // demasiados envíos desde la misma IP
  | "SEND"; // Resend falló, o falta la API key en producción

/** Resultado que la acción devuelve al cliente. */
export type ContactResult =
  | { ok: true; name: string } // name = el nombre ya trimmeado, para la terminal
  | { ok: false; error: ContactError };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 80;
const MAX_MSG = 2000;

export async function sendContactMessage(
  input: ContactInput,
): Promise<ContactResult> {
  const name = input.name.trim();
  const email = input.email.trim();
  const msg = input.msg.trim();

  // Al bot se le miente: un error le diría qué campo lo delató.
  if (input.website.trim() !== "") return { ok: true, name };

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) return { ok: false, error: "RATE_LIMIT" };

  // El cliente ya valida, pero la Server Action es invocable directamente:
  // el chequeo del cliente es una conveniencia, no una defensa.
  if (
    !name ||
    !email ||
    !msg ||
    !EMAIL_RE.test(email) ||
    name.length > MAX_NAME ||
    msg.length > MAX_MSG
  ) {
    return { ok: false, error: "INVALID" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;
  const text = `Nombre: ${name}\nCorreo: ${email}\n\n${msg}`;

  if (!apiKey || !to || !from) {
    // En producción, que falte la configuración es un error de verdad.
    if (process.env.NODE_ENV === "production") {
      console.error("[contacto] faltan variables de entorno de Resend");
      return { ok: false, error: "SEND" };
    }
    // En desarrollo, modo simulado: cualquiera puede clonar el repo y ver la
    // pantalla completa funcionando sin abrir cuenta en Resend.
    console.log(`[contacto] modo simulado — no se envió nada:\n${text}`);
    return { ok: true, name };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name}`,
      text,
    });
    // El detalle del proveedor queda en el servidor: al visitante no le sirve
    // el código de Resend y filtrarlo expone infraestructura.
    if (error) {
      console.error("[contacto] Resend devolvió un error:", error);
      return { ok: false, error: "SEND" };
    }
  } catch (err) {
    console.error("[contacto] la llamada a Resend lanzó:", err);
    return { ok: false, error: "SEND" };
  }

  return { ok: true, name };
}
