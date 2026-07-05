"use server";

import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

async function origin() {
  const h = await headers();
  const host = h.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

// Génère un lien de réinitialisation de mot de passe (à transmettre à la personne).
export async function genererLienReset(
  email: string,
): Promise<{ link?: string; error?: string }> {
  await requireAdmin();
  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${await origin()}/nouveau-mot-de-passe` },
  });
  if (error || !data.properties) {
    return { error: error?.message ?? "Génération du lien impossible." };
  }
  return { link: data.properties.action_link };
}

// Supprime définitivement un utilisateur (agent ou réceptif) et ses données liées.
export async function supprimerUtilisateur(
  userId: string,
): Promise<{ ok?: true; error?: string }> {
  await requireAdmin();
  const svc = createServiceClient();
  const { error } = await svc.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/admin/agents");
  revalidatePath("/admin/receptifs");
  return { ok: true };
}
