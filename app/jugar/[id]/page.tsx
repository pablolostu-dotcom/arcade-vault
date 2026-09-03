// ===== app/jugar/[id]/page.tsx — Reproductor =====
// Server Component: resuelve el juego (o notFound()) y delega toda la
// interactividad —puntaje simulado, pausa, HUD— a la isla client <Reproductor>.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Reproductor } from "@/components/reproductor";
import { getGame } from "@/lib/catalog";

// El catálogo vive en Postgres: un juego nuevo tiene que ser jugable sin un
// deploy, así que la ruta no se prerenderiza.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/jugar/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) return { title: "Juego no encontrado · Arcade Vault" };
  return { title: `Jugando ${game.title} · Arcade Vault` };
}

export default async function JugarPage({ params }: PageProps<"/jugar/[id]">) {
  const { id } = await params;
  const game = await getGame(id);
  if (!game) notFound();

  return <Reproductor game={game} />;
}
