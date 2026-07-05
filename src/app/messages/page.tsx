import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppHeader from "@/components/AppHeader";
import Messagerie from "@/components/Messagerie";

export const dynamic = "force-dynamic";

export default async function MessagesAgent() {
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

  return (
    <div className="min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="font-titre text-4xl font-600 text-encre">Messagerie</h1>
        <p className="mb-6 mt-1 font-corps text-encreDoux">
          Échangez avec les réceptifs — avant ou après un rendez-vous.
        </p>
        <Messagerie role="agent" agentId={user.id} />
      </div>
    </div>
  );
}
