import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data, error } = await sb.auth.admin.listUsers({ perPage: 200 });
if (error) {
  console.log("Erreur listUsers:", error.message);
  process.exit(1);
}
const u = data.users.find((x) => x.email === "martin@togezer.travel");
if (!u) {
  console.log("❌ Aucun utilisateur martin@togezer.travel dans Auth.");
  process.exit(0);
}
console.log("✔ Utilisateur trouvé :");
console.log("  id:", u.id);
console.log("  email_confirmé:", !!u.email_confirmed_at, u.email_confirmed_at ?? "");
console.log("  banni jusqu'à:", u.banned_until ?? "non");
console.log("  créé le:", u.created_at);
const { data: p } = await sb.from("profiles").select("role, email").eq("id", u.id).single();
console.log("  profil:", p ?? "AUCUN PROFIL");
console.log("\nTous les comptes Auth existants:");
data.users.forEach((x) => console.log("  -", x.email, "| confirmé:", !!x.email_confirmed_at));
