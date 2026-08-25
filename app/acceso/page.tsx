// ===== app/acceso/page.tsx — Acceso al sistema =====
// Portado de references/templates/auth.jsx. La tarjeta entera es interactiva
// (tabs, campos, submit), así que vive en la isla client; acá queda solo el
// contenedor que la centra.

import type { Metadata } from "next";

import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = {
  title: "Acceso · Arcade Vault",
  description: "Entrá al vault para guardar tus puntajes.",
};

export default function AccesoPage() {
  return (
    <div className="av-auth-wrap fade-in">
      <AuthForm />
    </div>
  );
}
