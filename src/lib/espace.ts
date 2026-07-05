import { createClient } from "@/lib/supabase/server";

// Retourne le chemin de l'espace connecté de l'utilisateur courant,
// ou null s'il n'est pas connecté. Sert à empêcher un utilisateur déjà
// connecté de retomber sur l'accueil public / la connexion / l'inscription.
export async function espaceUtilisateur(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: prof } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return prof?.role === "admin"
    ? "/admin"
    : prof?.role === "receptif"
      ? "/espace-receptif"
      : "/mon-espace";
}
