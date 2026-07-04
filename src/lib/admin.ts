import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Garde d'accès admin : renvoie le profil admin ou redirige.
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/mon-espace");
  return { user, profile, supabase };
}
