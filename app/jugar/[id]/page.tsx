// ===== app/jugar/[id]/page.tsx — Reproductor =====
// Server Component: resuelve el juego (o notFound()) y delega toda la
// interactividad —puntaje simulado, pausa, HUD— a la isla client <Reproductor>.

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Reproductor } from "@/components/reproductor";
import { GAMES } from "@/lib/data";

export async function generateMetadata({
  params,
}: PageProps<"/jugar/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) return { title: "Juego no encontrado · Arcade Vault" };
  return { title: `Jugando ${game.title} · Arcade Vault` };
}

export default async function JugarPage({ params }: PageProps<"/jugar/[id]">) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <Reproductor game={game} />;
}
