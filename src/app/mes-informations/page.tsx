import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { labelJour } from "@/lib/jours";
import AppHeader from "@/components/AppHeader";
import ModifierInfos from "@/app/mon-espace/ModifierInfos";

export const dynamic = "force-dynamic";

export default async function MesInformations() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/inscription");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "receptif") redirect("/espace-receptif");

  const { data: agent } = await supabase
    .from("agents")
    .select("agence, ville, prenom, nom, email, telephone")
    .eq("id", user.id)
    .single();

  const { data: joursRows } = await supabase
    .from("agent_jours")
    .select("jour")
    .eq("agent_id", user.id)
    .order("jour");
  const jours = (joursRows ?? []).map((r) => r.jour as string);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="font-titre text-4xl font-600 text-encre">Mes informations</h1>
        <p className="mb-6 mt-1 font-corps text-encreDoux">
          Modifiez les coordonnées de votre agence. Votre e-mail sert d'identifiant de
          connexion et n'est pas modifiable ici.
        </p>
        <ModifierInfos
          initial={{
            agence: agent?.agence ?? "",
            ville: agent?.ville ?? "",
            prenom: agent?.prenom ?? "",
            nom: agent?.nom ?? "",
            telephone: agent?.telephone ?? "",
          }}
          email={agent?.email ?? ""}
          joursLabel={jours.length ? jours.map(labelJour).join(", ") : "À choisir"}
        />
      </div>
    </div>
  );
}
