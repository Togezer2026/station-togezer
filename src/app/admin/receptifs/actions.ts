"use server";

import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

// Crée (ou réattache) le compte d'accès d'un réceptif et le lie à sa fiche.
export async function creerAccesReceptif(
  exposantId: string,
  email: string,
  password: string,
): Promise<{ ok?: true; error?: string }> {
  await requireAdmin();
  if (!email.trim() || password.length < 8) {
    return { error: "E-mail requis et mot de passe d'au moins 8 caractères." };
  }
  const svc = createServiceClient();

  // 1) Créer l'utilisateur Auth (déjà confirmé)
  const { data, error } = await svc.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return { error: error?.message ?? "Création du compte impossible." };
  }
  const uid = data.user.id;

  // 2) Profil rôle réceptif
  const { error: e2 } = await svc
    .from("profiles")
    .upsert({ id: uid, role: "receptif", email: email.trim() });
  if (e2) return { error: e2.message };

  // 3) Lier la fiche réceptif à ce compte
  const { error: e3 } = await svc
    .from("exposants")
    .update({ proprietaire_id: uid })
    .eq("id", exposantId);
  if (e3) return { error: e3.message };

  revalidatePath(`/admin/receptifs/${exposantId}`);
  return { ok: true };
}
